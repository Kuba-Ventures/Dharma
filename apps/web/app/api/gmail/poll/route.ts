import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getNewMessageIds, getMessage, applyGmailLabels } from "../../../../lib/gmail";
import { classifyEmailLabels, classifyForPreset } from "../../../../lib/classify";
import { HIGH_PRIORITY_NAME, UNCATEGORIZED_NAME, isPresetKey, isBuiltInPresetKey, resolvePresetSpec } from "../../../../lib/labelPresets";
import { detectAndPersistSignal } from "../../../../lib/signalDetector";
import { sendOpsAlert } from "../../../../lib/opsAlert";

// Fallback label sweep across all connected accounts. Runs on a cron (see
// vercel.json) as a safety net behind the real-time Pub/Sub webhook: it calls
// history.list directly per user and does NOT depend on a live Gmail watch, so
// it keeps labeling even if a watch lapses or a push is dropped. Idempotent —
// it advances each user's historyId and the ClassifiedThread dedupe prevents
// double-labeling, so it cooperates safely with the webhook. Also manually
// invocable for backfill/debugging. Never creates drafts or calendar events;
// drafts are only ever created by the three user-facing button handlers
// (sidebar, inline, FAB).
export const maxDuration = 60;
//
// Accepts both:
//   x-cron-secret header (legacy local poller script)
//   Authorization: Bearer <secret> header (manual invoke)
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

  const results: Array<{ email: string; labeled: number; error?: string }> = [];

  for (const googleCred of creds) {
    const email = googleCred.email;
    let labeled = 0;

    try {
      const messageIds = await getNewMessageIds(
        googleCred.accessToken,
        googleCred.refreshToken,
        googleCred.gmailHistoryId!
      );

      // Advance historyId so a re-invoke doesn't reprocess the same messages
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
          try {
            const labels = await prisma.label.findMany({
              where: { userId: googleCred.userId, enabled: true, gmailLabelId: { not: null } },
              include: { rules: true },
            });
            if (labels.length) {
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
                labeled++;
                console.log(`[poll] Labels applied to ${messageId}: ${[...ruleMatches, ...aiMatches].map((l) => l.name).join(", ")}`);
              }
            }
          } catch (err) {
            console.error(`[poll] Label classification failed for ${messageId}:`, err);
          }

          // ── Preset label classification (Feature: Tabs & Labels) ───────────
          try {
            const presetRow = await prisma.labelPreset.findUnique({
              where: { userId: googleCred.userId },
            });
            if (!presetRow?.enabled || !isPresetKey(presetRow.preset)) continue;
            if (!process.env.ANTHROPIC_API_KEY) continue;

            const spec = resolvePresetSpec({
              preset: presetRow.preset,
              customName: presetRow.customName,
              customLabels: presetRow.customLabels,
              includeUncategorized: presetRow.uncategorizedEnabled,
            });
            if (!spec || spec.labels.length === 0) continue;

            const already = await prisma.classifiedThread.findUnique({
              where: { userId_threadId: { userId: googleCred.userId, threadId: msg.threadId } },
            });
            if (already) continue;

            const labelNames = spec.labels
              .map((l) => l.shortName)
              .filter((n) => n !== HIGH_PRIORITY_NAME && n !== UNCATEGORIZED_NAME);

            const result = await classifyForPreset({
              displayName: spec.displayName,
              labelNames,
              subject: msg.subject,
              from: msg.from,
              snippet: msg.body.slice(0, 200),
              body: msg.body,
              userId: googleCred.userId,
            });

            // Fall back to the catch-all so nothing goes unlabeled.
            const matched =
              (result.label
                ? spec.labels.find((l) => l.shortName === result.label)
                : null) ??
              spec.labels.find((l) => l.shortName === UNCATEGORIZED_NAME) ??
              null;

            const labelNamesToApply: string[] = [];
            if (matched) labelNamesToApply.push(matched.name);
            if (result.priority > 0.75 && isBuiltInPresetKey(presetRow.preset)) {
              labelNamesToApply.push(HIGH_PRIORITY_NAME);
            }

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
              create: {
                userId: googleCred.userId,
                threadId: msg.threadId,
                labelName: matched?.name ?? null,
              },
              update: {},
            });

            await detectAndPersistSignal({
              userId: googleCred.userId,
              threadId: msg.threadId,
              subject: msg.subject,
              from: msg.from,
              body: msg.body,
            });
          } catch (err) {
            console.error(`[poll] Preset classification failed for ${messageId}:`, err);
          }
        } catch (err) {
          console.error(`[poll] Failed to process message ${messageId}:`, err);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[poll] Error processing ${email}:`, msg);
      results.push({ email, labeled, error: msg });
      continue;
    }

    results.push({ email, labeled });
  }

  return NextResponse.json({ polled: creds.length, results });
}

// Wrap the handler so a total poll failure (e.g. DB unreachable) pages ops
// instead of failing silently on the 30-minute cron. Per-message failures are
// already caught inside runPoll and don't reach here.
async function runPollWithAlert(req: NextRequest): Promise<NextResponse> {
  try {
    return await runPoll(req);
  } catch (err) {
    await sendOpsAlert(`[poll] cron run failed: ${(err as Error).message}`);
    throw err;
  }
}

export const GET = runPollWithAlert;
export const POST = runPollWithAlert;
