import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getNewMessageIds, getMessage, createDraft, applyGmailLabels } from "../../../../lib/gmail";
import { classifyEmail, classifyEmailLabels, classifyForPreset, extractConfirmedTime, extractProposedTimes, detectTimezoneFromText } from "../../../../lib/classify";
import { LABEL_PRESETS, HIGH_PRIORITY_NAME, isPresetKey } from "../../../../lib/labelPresets";
import { createCalendarEvent } from "../../../../lib/calendar";
import { getAvailableSlots } from "@dharma/calendar-core";
import { RealGoogleProvider } from "@dharma/providers-google";
import { generateReply, generateAIReply, generateConfirmationReply } from "@dharma/reply-generation";
import type { SchedulingRequest } from "@dharma/types";
import { logUsage } from "../../../../lib/usage";

// Accepts both:
//   x-cron-secret header (local poller script)
//   Authorization: Bearer <secret> header (Vercel Cron)
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("x-cron-secret") === secret) return true;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return false;
}

async function runPoll(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Auto-seed any accounts that connected but whose historyId was never written
  // (can happen if the Vercel function was killed before setupGmailWatch finished)
  const unseeded = await prisma.googleCredential.findMany({
    where: { gmailHistoryId: null },
  });
  if (unseeded.length > 0) {
    const { setupGmailWatch } = await import("../../../../lib/gmail");
    await Promise.allSettled(
      unseeded.map((c) =>
        setupGmailWatch(c.userId, c.accessToken, c.refreshToken).catch((err) =>
          console.error(`[poll] Failed to seed historyId for ${c.email}:`, err)
        )
      )
    );
  }

  // Find all users with a Gmail watch set up
  const creds = await prisma.googleCredential.findMany({
    where: { gmailHistoryId: { not: null } },
  });

  const results: Array<{ email: string; draftsCreated: number; eventsCreated: number; error?: string }> = [];

  for (const googleCred of creds) {
    const email = googleCred.email;
    let draftsCreated = 0;
    let eventsCreated = 0;

    try {
      // Use Gmail history API to get messages since the last poll
      const messageIds = await getNewMessageIds(
        googleCred.accessToken,
        googleCred.refreshToken,
        googleCred.gmailHistoryId!
      );

      // Get the current historyId from Gmail so we advance it even if no messages
      // We do this by fetching the profile
      const { google } = await import("googleapis");
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!
      );
      auth.setCredentials({
        access_token: googleCred.accessToken,
        refresh_token: googleCred.refreshToken,
      });
      const gmail = google.gmail({ version: "v1", auth });
      const profile = await gmail.users.getProfile({ userId: "me" });
      const latestHistoryId = String(profile.data.historyId ?? googleCred.gmailHistoryId);

      // Advance historyId so next poll only sees newer messages
      await prisma.googleCredential.update({
        where: { email },
        data: { gmailHistoryId: latestHistoryId },
      });

      console.log(`[poll] ${email}: ${messageIds.length} new message(s)`);

      for (const messageId of messageIds) {
        try {
          const msg = await getMessage(
            googleCred.accessToken,
            googleCred.refreshToken,
            messageId,
            email
          );

          if (!msg) continue;

          // ── Label classification (rule-based + AI) ─────────────────────────
          // Run in background — don't let label errors block scheduling logic
          (async () => {
            try {
              const labels = await prisma.label.findMany({
                where: { userId: googleCred.userId, enabled: true, gmailLabelId: { not: null } },
                include: { rules: true },
              });
              if (!labels.length) return;

              const ruleMatches = labels.filter((label) =>
                label.rules.some((rule) => {
                  const haystack =
                    rule.field === "subject" ? msg.subject.toLowerCase()
                    : rule.field === "from" ? msg.from.toLowerCase()
                    : msg.body.toLowerCase();
                  const needle = rule.value.toLowerCase();
                  switch (rule.operator) {
                    case "contains":     return haystack.includes(needle);
                    case "not_contains": return !haystack.includes(needle);
                    case "starts_with":  return haystack.startsWith(needle);
                    case "is":           return haystack === needle;
                    default:             return false;
                  }
                })
              );

              const labelsWithoutRules = labels.filter(
                (l) => l.rules.length === 0 && !ruleMatches.find((m) => m.id === l.id)
              );
              let aiMatches: typeof labels = [];
              if (labelsWithoutRules.length > 0 && process.env.ANTHROPIC_API_KEY) {
                const aiNames = await classifyEmailLabels(
                  msg.subject, msg.from, msg.body,
                  labelsWithoutRules.map((l) => ({ name: l.name, description: l.description })),
                  googleCred.userId
                );
                aiMatches = labelsWithoutRules.filter((l) => aiNames.includes(l.name));
              }

              const gmailIds = [...ruleMatches, ...aiMatches].map((l) => l.gmailLabelId!);
              if (gmailIds.length > 0) {
                await applyGmailLabels(googleCred.userId, messageId, gmailIds);
                console.log(`[poll] Labels applied to ${messageId}: ${[...ruleMatches, ...aiMatches].map((l) => l.name).join(", ")}`);
              }
            } catch (err) {
              console.error(`[poll] Label classification failed for ${messageId}:`, err);
            }
          })();

          // ── Preset label classification (Feature 1: Tabs & Labels) ─────────
          // Industry-preset auto-tagging using Haiku 4.5. Idempotent per thread.
          (async () => {
            try {
              const presetRow = await prisma.labelPreset.findUnique({
                where: { userId: googleCred.userId },
              });
              if (!presetRow?.enabled || !isPresetKey(presetRow.preset)) return;
              if (!process.env.ANTHROPIC_API_KEY) return;

              // Skip if this thread has already been classified once.
              const already = await prisma.classifiedThread.findUnique({
                where: { userId_threadId: { userId: googleCred.userId, threadId: msg.threadId } },
              });
              if (already) return;

              const result = await classifyForPreset(
                presetRow.preset,
                msg.subject,
                msg.from,
                msg.body.slice(0, 200),
                msg.body,
                googleCred.userId,
              );

              const presetSpec = LABEL_PRESETS[presetRow.preset];
              const matched = result.label
                ? presetSpec.find((l) => l.shortName === result.label)
                : null;

              const labelNamesToApply: string[] = [];
              if (matched) labelNamesToApply.push(matched.name);
              if (result.priority > 0.75) labelNamesToApply.push(HIGH_PRIORITY_NAME);

              if (labelNamesToApply.length > 0) {
                const mappings = await prisma.labelMapping.findMany({
                  where: { userId: googleCred.userId, labelName: { in: labelNamesToApply } },
                });
                const gmailIds = mappings.map((m) => m.gmailLabelId);
                if (gmailIds.length > 0) {
                  await applyGmailLabels(googleCred.userId, messageId, gmailIds);
                  console.log(`[poll] Preset labels applied to ${messageId}: ${mappings.map((m) => m.labelName).join(", ")} (priority=${result.priority.toFixed(2)})`);
                }
              }

              await prisma.classifiedThread.upsert({
                where: { userId_threadId: { userId: googleCred.userId, threadId: msg.threadId } },
                create: { userId: googleCred.userId, threadId: msg.threadId },
                update: {},
              });
            } catch (err) {
              console.error(`[poll] Preset classification failed for ${messageId}:`, err);
            }
          })();

          const { isSchedulingRequest, isTimeConfirmation, durationMinutes } = await classifyEmail(
            msg.subject,
            msg.body,
            googleCred.userId
          );

          // ── Time confirmation → create calendar event ──────────────────────
          if (isTimeConfirmation) {
            console.log(`[poll] Time confirmation detected: "${msg.subject}" from ${msg.from}`);
            console.log(`[poll] Email body: ${msg.body.slice(0, 200)}`);
            const todayISO = new Date().toISOString().slice(0, 10);
            const meeting = await extractConfirmedTime(msg.subject, msg.body, todayISO, googleCred.userId);
            console.log(`[poll] Extracted meeting:`, JSON.stringify(meeting));

            if (meeting) {
              // Parse sender email from "Display Name <email>" or plain "email" format
              const angleMatch = msg.from.match(/<([^>]+)>/);
              const senderEmail = angleMatch
                ? angleMatch[1].trim()
                : msg.from.replace(/\s*\(.*\)/, "").trim();
              const meetLink = await createCalendarEvent(
                googleCred.accessToken,
                googleCred.refreshToken,
                {
                  title: meeting.title,
                  startISO: meeting.startISO,
                  endISO: meeting.endISO,
                  attendeeEmail: senderEmail,
                  organizerEmail: email,
                },
                async (newAccessToken, expiresAt) => {
                  await prisma.googleCredential.update({
                    where: { email },
                    data: { accessToken: newAccessToken, expiresAt },
                  });
                }
              );
              eventsCreated++;
              console.log(`[poll] Calendar event created${meetLink ? ` — Meet: ${meetLink}` : ""}`);
            } else {
              console.log(`[poll] Could not extract time from confirmation email`);
            }
            continue;
          }

          if (!isSchedulingRequest) continue;

          console.log(`[poll] Scheduling request: "${msg.subject}" from ${msg.from}`);

          // Detect the sender's timezone for display purposes.
          const senderTimezone = detectTimezoneFromText(`${msg.subject} ${msg.body}`);
          console.log(`[poll] Sender timezone detected: ${senderTimezone}`);

          const todayISO = new Date().toISOString().slice(0, 10);
          const request: SchedulingRequest = { rawText: msg.body, durationMinutes };

          const provider = new RealGoogleProvider(
            email,
            {
              accessToken: googleCred.accessToken,
              refreshToken: googleCred.refreshToken,
              expiresAt: googleCred.expiresAt,
            },
            async ({ accessToken, expiresAt }) => {
              await prisma.googleCredential.update({
                where: { email },
                data: { accessToken, expiresAt },
              });
            }
          );

          // ── Step 1: check if the email offers specific times ──────────────
          // e.g. an EA sending "I have Tue 1:30 PM, Wed 3 PM, Thu 4 PM PDT"
          const proposedTimes = await extractProposedTimes(msg.subject, msg.body, todayISO, googleCred.userId);
          console.log(`[poll] Proposed times found: ${proposedTimes?.length ?? 0}`);

          let replyBody: string;
          let confirmedSlot: { start: Date; end: Date } | null = null;

          if (proposedTimes && proposedTimes.length > 0) {
            // Check each offered time — use the first one that's free
            for (const pt of proposedTimes) {
              const pStart = new Date(pt.startISO);
              const pEnd = new Date(pt.endISO);
              const busy = await provider.getEvents(pStart, pEnd);
              const hasConflict = busy.some((b) => pStart < b.end && pEnd > b.start);
              console.log(`[poll] ${pt.startISO}: busy=${hasConflict}`);
              if (!hasConflict) {
                confirmedSlot = { start: pStart, end: pEnd };
                break;
              }
            }
          }

          if (confirmedSlot) {
            // One of their offered times works — confirm it in their timezone
            if (process.env.ANTHROPIC_API_KEY) {
              let text = "";
              try {
                for await (const chunk of generateConfirmationReply(
                  confirmedSlot,
                  msg.body,
                  senderTimezone,
                  async (u) => { await logUsage({ userId: googleCred.userId, eventType: "draft", model: u.model, usage: { input_tokens: u.inputTokens, output_tokens: u.outputTokens } }); }
                )) {
                  text += chunk;
                }
                replyBody = text;
              } catch {
                replyBody = generateReply([confirmedSlot]);
              }
            } else {
              replyBody = generateReply([confirmedSlot]);
            }
          } else {
            // Either no specific times were offered, or all of them conflict.
            // Find our own available slots and suggest them in ET.
            const allOfferedTimesBusy = (proposedTimes?.length ?? 0) > 0;
            const { slots } = await getAvailableSlots(provider, request);
            const suggestedSlots = slots.slice(0, 3);
            console.log(`[poll] Suggesting ${suggestedSlots.length} own slots (offeredTimesBusy=${allOfferedTimesBusy})`);

            if (process.env.ANTHROPIC_API_KEY && msg.body.trim()) {
              let text = "";
              try {
                for await (const chunk of generateAIReply(
                  suggestedSlots,
                  msg.body,
                  "America/New_York",
                  allOfferedTimesBusy,
                  undefined,
                  async (u) => { await logUsage({ userId: googleCred.userId, eventType: "draft", model: u.model, usage: { input_tokens: u.inputTokens, output_tokens: u.outputTokens } }); }
                )) {
                  text += chunk;
                }
                replyBody = text;
              } catch {
                replyBody = generateReply(suggestedSlots);
              }
            } else {
              replyBody = generateReply(suggestedSlots);
            }
          }

          await createDraft(googleCred.accessToken, googleCred.refreshToken, {
            from: email,
            to: msg.from,
            subject: msg.subject,
            body: replyBody,
            threadId: msg.threadId,
            inReplyTo: msg.messageIdHeader,
            references: msg.references,
          });

          draftsCreated++;
          console.log(`[poll] Draft created for "${msg.subject}"`);
        } catch (err) {
          console.error(`[poll] Failed to process message ${messageId}:`, err);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[poll] Error processing ${email}:`, msg);
      results.push({ email, draftsCreated, eventsCreated, error: msg });
      continue;
    }

    results.push({ email, draftsCreated, eventsCreated });
  }

  return NextResponse.json({ polled: creds.length, results });
}

export const GET = runPoll;
export const POST = runPoll;
