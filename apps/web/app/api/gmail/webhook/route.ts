import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../../../../lib/prisma";
import { getNewMessageIds, getMessage, applyGmailLabels, HistoryExpiredError } from "../../../../lib/gmail";
import { classifyEmailLabels, classifyForPreset } from "../../../../lib/classify";
import { HIGH_PRIORITY_NAME, UNCATEGORIZED_NAME, isPresetKey, isBuiltInPresetKey, resolvePresetSpec } from "../../../../lib/labelPresets";
import { detectAndPersistSignal } from "../../../../lib/signalDetector";

// Allow heavier classification work past the default 15s — caps at 60s to
// stay under the Pub/Sub ack deadline.
export const maxDuration = 60;

// Pub/Sub push handler. Applies labels to new messages. Never creates drafts
// or calendar events — those are user-button-only by design.
//
// Auth: accepts either an OIDC bearer JWT signed by the configured Pub/Sub
// pusher service account (preferred) OR the URL `?token=` against
// PUBSUB_VERIFICATION_TOKEN (legacy/transition). Both are checked; at least
// one must pass. If neither env is set, the handler refuses all requests.
const oidcClient = new OAuth2Client();

async function authorize(req: NextRequest): Promise<boolean> {
  const expectedToken = process.env.PUBSUB_VERIFICATION_TOKEN;
  const expectedSA = process.env.PUBSUB_PUSH_SERVICE_ACCOUNT;
  const expectedAud = process.env.PUBSUB_PUSH_AUDIENCE; // typically the webhook URL

  // URL token path
  if (expectedToken && req.nextUrl.searchParams.get("token") === expectedToken) {
    return true;
  }

  // OIDC JWT path
  const authHeader = req.headers.get("authorization") ?? "";
  if (expectedSA && authHeader.startsWith("Bearer ")) {
    const idToken = authHeader.slice("Bearer ".length).trim();
    try {
      const ticket = await oidcClient.verifyIdToken({
        idToken,
        audience: expectedAud,
      });
      const payload = ticket.getPayload();
      if (payload?.email === expectedSA && payload.email_verified) {
        return true;
      }
    } catch (err) {
      console.warn("[gmail/webhook] OIDC verify failed:", (err as Error).message);
    }
  }

  return false;
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let body: { message?: { data?: string; messageId?: string } };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("OK", { status: 200 });
  }

  const messageData = body?.message?.data;
  if (!messageData) return new NextResponse("OK", { status: 200 });

  let notification: { emailAddress?: string; historyId?: string | number };
  try {
    const decoded = Buffer.from(messageData, "base64").toString("utf-8");
    notification = JSON.parse(decoded);
  } catch {
    return new NextResponse("OK", { status: 200 });
  }

  const emailAddress = notification.emailAddress;
  const newHistoryId = String(notification.historyId ?? "");

  if (!emailAddress || !newHistoryId) return new NextResponse("OK", { status: 200 });

  const googleCred = await prisma.googleCredential.findUnique({
    where: { email: emailAddress },
  });

  if (!googleCred?.gmailHistoryId) {
    console.warn(`[gmail/webhook] No historyId stored for ${emailAddress} — skipping`);
    return new NextResponse("OK", { status: 200 });
  }

  const startHistoryId = googleCred.gmailHistoryId;

  // Advance historyId synchronously so the next Pub/Sub redelivery skips work
  // and so subsequent notifications don't reprocess these messages.
  await prisma.googleCredential.update({
    where: { email: emailAddress },
    data: { gmailHistoryId: newHistoryId },
  });

  // Heavy work happens after we return 200 — Pub/Sub's ack deadline is 60s
  // and AI classification can stack up across multiple messages.
  waitUntil(
    processPush({
      userId: googleCred.userId,
      email: emailAddress,
      accessToken: googleCred.accessToken,
      refreshToken: googleCred.refreshToken,
      startHistoryId,
    }).catch((err) => console.error("[gmail/webhook] processPush failed:", err))
  );

  return new NextResponse("OK", { status: 200 });
}

interface PushContext {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  startHistoryId: string;
}

async function processPush(ctx: PushContext): Promise<void> {
  let messageIds: string[];
  try {
    messageIds = await getNewMessageIds(ctx.accessToken, ctx.refreshToken, ctx.startHistoryId);
  } catch (err) {
    if (err instanceof HistoryExpiredError) {
      console.warn(
        `[gmail/webhook] historyId expired for ${ctx.email}; resetting to ${err.newHistoryId}. Messages between the old and new ID are not recoverable.`
      );
      await prisma.googleCredential.update({
        where: { email: ctx.email },
        data: { gmailHistoryId: err.newHistoryId },
      });
      return;
    }
    console.error("[gmail/webhook] history.list failed:", err);
    return;
  }

  console.log(`[gmail/webhook] ${messageIds.length} new message(s) for ${ctx.email}`);

  for (const messageId of messageIds) {
    try {
      const msg = await getMessage(ctx.accessToken, ctx.refreshToken, messageId, ctx.email);
      if (!msg) continue; // sent by the user themselves

      // Apply matching Gmail labels (rules first, then AI for labels without rules)
      try {
        const labels = await prisma.label.findMany({
          where: { userId: ctx.userId, enabled: true, gmailLabelId: { not: null } },
          include: { rules: true },
        });

        const ruleMatches = labels.filter(
          (l) => l.rules.length > 0 && l.rules.some((rule) => matchesRule(rule, msg))
        );
        const labelsWithoutRules = labels.filter((l) => l.rules.length === 0);
        let aiMatches: typeof labels = [];
        if (labelsWithoutRules.length > 0 && process.env.ANTHROPIC_API_KEY) {
          const aiNames = await classifyEmailLabels(
            msg.subject, msg.from, msg.body,
            labelsWithoutRules.map((l) => ({ name: l.name, description: l.description }))
          );
          aiMatches = labelsWithoutRules.filter((l) => aiNames.includes(l.name));
        }

        const gmailIds = [...ruleMatches, ...aiMatches].map((l) => l.gmailLabelId!);
        if (gmailIds.length > 0) {
          await applyGmailLabels(ctx.userId, messageId, gmailIds);
          console.log(`[gmail/webhook] Labeled message ${messageId}:`, gmailIds);
        }
      } catch (err) {
        console.error("[gmail/webhook] Label application failed:", err);
      }

      // Preset label classification. Idempotent per thread.
      try {
        const presetRow = await prisma.labelPreset.findUnique({
          where: { userId: ctx.userId },
        });
        if (presetRow?.enabled && isPresetKey(presetRow.preset) && process.env.ANTHROPIC_API_KEY) {
          const spec = resolvePresetSpec({
            preset: presetRow.preset,
            customName: presetRow.customName,
            customLabels: presetRow.customLabels,
            includeUncategorized: presetRow.uncategorizedEnabled,
          });
          if (spec && spec.labels.length > 0) {
            const already = await prisma.classifiedThread.findUnique({
              where: { userId_threadId: { userId: ctx.userId, threadId: msg.threadId } },
            });
            if (!already) {
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
                userId: ctx.userId,
              });

              // Fall back to the catch-all so nothing goes unlabeled. Null only
              // when the preset has Uncategorized disabled.
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
                  where: { userId: ctx.userId, labelName: { in: labelNamesToApply } },
                });
                const gmailIds = mappings.map((m) => m.gmailLabelId);
                if (gmailIds.length > 0) {
                  await applyGmailLabels(ctx.userId, messageId, gmailIds);
                  console.log(`[gmail/webhook] Preset labels applied to ${messageId}: ${mappings.map((m) => m.labelName).join(", ")} (priority=${result.priority.toFixed(2)})`);
                }
              }

              await prisma.classifiedThread.upsert({
                where: { userId_threadId: { userId: ctx.userId, threadId: msg.threadId } },
                create: {
                  userId: ctx.userId,
                  threadId: msg.threadId,
                  labelName: matched?.name ?? null,
                },
                update: {},
              });

              await detectAndPersistSignal({
                userId: ctx.userId,
                threadId: msg.threadId,
                subject: msg.subject,
                from: msg.from,
                body: msg.body,
              });
            }
          }
        }
      } catch (err) {
        console.error("[gmail/webhook] Preset classification failed:", err);
      }
    } catch (err) {
      console.error(`[gmail/webhook] Failed to process message ${messageId}:`, err);
    }
  }
}

function matchesRule(
  rule: { field: string; operator: string; value: string },
  msg: { subject: string; from: string; body: string }
): boolean {
  const haystack = (() => {
    switch (rule.field) {
      case "subject": return msg.subject.toLowerCase();
      case "from":    return msg.from.toLowerCase();
      case "body":    return msg.body.toLowerCase();
      default:        return "";
    }
  })();
  const needle = rule.value.toLowerCase();
  switch (rule.operator) {
    case "contains":     return haystack.includes(needle);
    case "not_contains": return !haystack.includes(needle);
    case "starts_with":  return haystack.startsWith(needle);
    case "is":           return haystack === needle;
    default:             return false;
  }
}
