export const maxDuration = 60;

import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { makeAuthForUser, applyGmailLabels } from "../../../../lib/gmail";
import { google, type gmail_v1 } from "googleapis";
import { classifyEmailLabels, classifyForPreset } from "../../../../lib/classify";
import {
  HIGH_PRIORITY_NAME,
  UNCATEGORIZED_NAME,
  isBuiltInPresetKey,
  isPresetKey,
  resolvePresetSpec,
} from "../../../../lib/labelPresets";
import { detectAndPersistSignal } from "../../../../lib/signalDetector";

const MAX_THREADS = 25;
const CONCURRENCY = 5;
// Stop *starting* new classification batches past this point so the function
// returns a partial-but-successful result instead of being killed at the 60s
// cap (an in-flight batch can still run ~10s, leaving headroom under 60s).
const BUDGET_MS = 45_000;

// Turn a Gmail/token error into an actionable message + status, mirroring the
// reconnect handling other Google-backed routes (tone/sync, calendar/sync)
// already do. Without this, an expired grant or Gmail hiccup surfaced to the
// user as a bare "Sync failed".
function gmailErrorResponse(err: unknown): NextResponse {
  const code =
    (err as { code?: number })?.code ??
    (err as { response?: { status?: number } })?.response?.status;
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[back-scan] Gmail/setup failed (code=${code ?? "?"}):`, msg);
  if (code === 401 || /invalid_grant|invalid_token|insufficient|scope|unauthorized/i.test(msg)) {
    return NextResponse.json(
      { error: "Google access expired. Sign out and sign back in to reconnect." },
      { status: 401 },
    );
  }
  if (code === 429) {
    return NextResponse.json(
      { error: "Gmail is rate-limiting right now — wait a moment and try again." },
      { status: 429 },
    );
  }
  return NextResponse.json(
    { error: "Couldn't reach Gmail — please try again in a moment." },
    { status: 502 },
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // When invoked from the "Sync inbox" button, the caller passes force=true to
  // bypass the ClassifiedThread dedupe and re-classify recent threads under
  // the *current* preset. Auto-poll callers should omit it.
  const body = (await req.json().catch(() => ({}))) as { force?: boolean };
  const force = body.force === true;

  const [presetRow, cred] = await Promise.all([
    prisma.labelPreset.findUnique({ where: { userId } }),
    prisma.googleCredential.findUnique({ where: { userId } }),
  ]);

  if (!cred) {
    return NextResponse.json({ error: "Google not connected" }, { status: 400 });
  }
  if (!presetRow?.enabled || !isPresetKey(presetRow.preset)) {
    return NextResponse.json({ error: "No active preset" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Classifier unavailable" }, { status: 503 });
  }

  const maybeSpec = resolvePresetSpec({
    preset: presetRow.preset,
    customName: presetRow.customName,
    customLabels: presetRow.customLabels,
    includeUncategorized: presetRow.uncategorizedEnabled,
  });
  if (!maybeSpec || maybeSpec.labels.length === 0) {
    return NextResponse.json({ error: "Preset has no labels" }, { status: 400 });
  }
  const spec = maybeSpec;
  const preset = presetRow.preset;

  const labelNames = spec.labels
    .map((l) => l.shortName)
    .filter((n) => n !== HIGH_PRIORITY_NAME && n !== UNCATEGORIZED_NAME);

  // Load LabelMappings into a map so we can resolve short names → Gmail ids.
  const mappings = await prisma.labelMapping.findMany({ where: { userId } });
  const mappingByName = new Map(mappings.map((m) => [m.labelName, m.gmailLabelId]));

  // User-defined Labels (separate from preset). Mirrors the path in
  // app/api/gmail/webhook/route.ts so the first-impression scan covers
  // both surfaces a new email would.
  const userLabels = await prisma.label.findMany({
    where: { userId, enabled: true, gmailLabelId: { not: null } },
    include: { rules: true },
  });

  // Pull recent inbox threads — by thread we'd need history, so use messages.list
  // and dedupe by threadId since classification is thread-scoped. Token refresh
  // and Gmail list failures surface here; classify them into an actionable
  // message rather than letting them become an opaque 500 / "Sync failed".
  let gmail: gmail_v1.Gmail;
  let messages: gmail_v1.Schema$Message[];
  try {
    const { auth: oauthClient } = await makeAuthForUser(userId);
    gmail = google.gmail({ version: "v1", auth: oauthClient });
    const listRes = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
      maxResults: MAX_THREADS * 2,
    });
    messages = listRes.data.messages ?? [];
  } catch (err) {
    return gmailErrorResponse(err);
  }

  // Resolve unique threads, skipping any already classified.
  const seenThreads = new Set<string>();
  const candidates: Array<{ messageId: string; threadId: string }> = [];
  for (const m of messages) {
    if (!m.id || !m.threadId) continue;
    if (seenThreads.has(m.threadId)) continue;
    seenThreads.add(m.threadId);
    candidates.push({ messageId: m.id, threadId: m.threadId });
    if (candidates.length >= MAX_THREADS) break;
  }

  // Dedupe only when not forced; the Sync Inbox button always forces a fresh
  // pass so preset changes get reflected on previously-seen threads.
  const alreadySet = force
    ? new Set<string>()
    : new Set(
        (
          await prisma.classifiedThread.findMany({
            where: { userId, threadId: { in: candidates.map((c) => c.threadId) } },
            select: { threadId: true },
          })
        ).map((e) => e.threadId),
      );
  const toClassify = candidates.filter((c) => !alreadySet.has(c.threadId));

  let scanned = 0;
  let tagged = 0;
  let skipped = alreadySet.size;
  const errors: string[] = [];

  async function processOne(c: { messageId: string; threadId: string }) {
    scanned++;
    try {
      const msgRes = await gmail.users.messages.get({
        userId: "me",
        id: c.messageId,
        format: "full",
      });
      const msg = msgRes.data;
      const headers = msg.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const subject = getHeader("Subject");
      const from = getHeader("From");
      const snippet = msg.snippet ?? "";
      const body = extractBody(msg.payload) || snippet;

      // User-defined Label classification (rules first, then AI for labels
      // without rules) — same logic as the webhook.
      if (userLabels.length > 0) {
        const ruleMatches = userLabels.filter(
          (l) => l.rules.length > 0 && l.rules.some((rule) => matchesRule(rule, { subject, from, body }))
        );
        const labelsWithoutRules = userLabels.filter((l) => l.rules.length === 0);
        let aiMatches: typeof userLabels = [];
        if (labelsWithoutRules.length > 0) {
          const aiNames = await classifyEmailLabels(
            subject, from, body,
            labelsWithoutRules.map((l) => ({ name: l.name, description: l.description })),
            userId
          );
          aiMatches = labelsWithoutRules.filter((l) => aiNames.includes(l.name));
        }
        const userGmailIds = [...ruleMatches, ...aiMatches].map((l) => l.gmailLabelId!);
        if (userGmailIds.length > 0) {
          await applyGmailLabels(userId, c.messageId, userGmailIds);
        }
      }

      const result = await classifyForPreset({
        displayName: spec.displayName,
        labelNames,
        subject,
        from,
        snippet,
        body,
        userId,
      });

      // Fall back to the catch-all so nothing goes unlabeled.
      const matched =
        (result.label ? spec.labels.find((l) => l.shortName === result.label) : null) ??
        spec.labels.find((l) => l.shortName === UNCATEGORIZED_NAME) ??
        null;
      const namesToApply: string[] = [];
      if (matched) namesToApply.push(matched.name);
      if (result.priority > 0.75 && isBuiltInPresetKey(preset)) {
        namesToApply.push(HIGH_PRIORITY_NAME);
      }

      if (namesToApply.length > 0) {
        const gmailIds = namesToApply
          .map((n) => mappingByName.get(n))
          .filter((id): id is string => Boolean(id));
        if (gmailIds.length > 0) {
          await applyGmailLabels(userId, c.messageId, gmailIds);
          tagged++;
        }
      }

      await prisma.classifiedThread.upsert({
        where: { userId_threadId: { userId, threadId: c.threadId } },
        create: { userId, threadId: c.threadId, labelName: matched?.name ?? null },
        update: { labelName: matched?.name ?? null },
      });

      await detectAndPersistSignal({
        userId,
        threadId: c.threadId,
        subject,
        from,
        body,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      console.error(`[back-scan] thread ${c.threadId} failed:`, msg);
    }
  }

  // Process in small batches to stay well under Vercel's 60s function limit
  // without saturating Anthropic. Stop starting new batches once we're past the
  // time budget and report the run as incomplete — a partial 200 beats a 60s
  // timeout that the user only sees as "Sync failed".
  const startedAt = Date.now();
  let incomplete = false;
  for (let i = 0; i < toClassify.length; i += CONCURRENCY) {
    if (Date.now() - startedAt > BUDGET_MS) {
      incomplete = true;
      break;
    }
    await Promise.all(toClassify.slice(i, i + CONCURRENCY).map(processOne));
  }

  return NextResponse.json({
    scanned,
    tagged,
    skipped,
    incomplete,
    errors: errors.slice(0, 5),
    total: candidates.length,
  });
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

function extractBody(payload: unknown): string {
  const p = payload as { mimeType?: string; body?: { data?: string }; parts?: unknown[] } | undefined;
  if (!p) return "";
  if (p.mimeType === "text/plain" && p.body?.data) {
    return Buffer.from(p.body.data, "base64").toString("utf-8");
  }
  if (p.parts) {
    for (const part of p.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  return "";
}
