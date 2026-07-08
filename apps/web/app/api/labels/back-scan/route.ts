// Raised from 60s: the onboarding path runs a second 25-thread tranche in an
// after() continuation (same invocation), so the function needs headroom for
// ~two ~45s budget windows to hit 50 threads inside ~2 minutes.
export const maxDuration = 120;

import { NextResponse, after } from "next/server";
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
// returns a partial-but-successful result instead of being killed at the cap
// (an in-flight batch can still run ~10s).
const BUDGET_MS = 45_000;

// Turn a Gmail/token error into an actionable message + status, mirroring the
// reconnect handling other Google-backed routes (tone/sync, calendar/sync) do.
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

type ScanOpts = {
  userId: string;
  force?: boolean;
  limit?: number;
  pageToken?: string | null;
  /** Skip per-thread signal detection (used by the onboarding scan to protect the budget). */
  skipSignals?: boolean;
};

// Discriminated result so the interactive route and the after() tail handle
// setup/gmail failures uniformly without throwing across the response boundary.
type ScanResult =
  | {
      kind: "ok";
      scanned: number;
      tagged: number;
      skipped: number;
      incomplete: boolean;
      total: number;
      nextPageToken: string | null;
    }
  | { kind: "setup_error"; error: string; status: number }
  | { kind: "gmail_error"; err: unknown };

// The classification pass, fully self-contained (resolves preset + Gmail
// client, lists a page of inbox threads, classifies each). Callable directly
// from the route and from an after() continuation — no auth/HTTP inside.
async function scanCore(opts: ScanOpts): Promise<ScanResult> {
  const { userId, force = false, limit = MAX_THREADS, pageToken = null, skipSignals = false } = opts;

  const [presetRow, cred] = await Promise.all([
    prisma.labelPreset.findUnique({ where: { userId } }),
    prisma.googleCredential.findUnique({ where: { userId } }),
  ]);

  if (!cred) return { kind: "setup_error", error: "Google not connected", status: 400 };
  if (!presetRow?.enabled || !isPresetKey(presetRow.preset)) {
    return {
      kind: "setup_error",
      error:
        "No label preset is active yet. Open Configuration → Labels, pick a preset, turn it on, and hit Sync to Gmail.",
      status: 400,
    };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { kind: "setup_error", error: "Classifier unavailable", status: 503 };
  }

  const maybeSpec = resolvePresetSpec({
    preset: presetRow.preset,
    customName: presetRow.customName,
    customLabels: presetRow.customLabels,
    includeUncategorized: presetRow.uncategorizedEnabled,
  });
  if (!maybeSpec || maybeSpec.labels.length === 0) {
    return { kind: "setup_error", error: "Preset has no labels", status: 400 };
  }
  const spec = maybeSpec;
  const preset = presetRow.preset;

  const labelNames = spec.labels
    .map((l) => l.shortName)
    .filter((n) => n !== HIGH_PRIORITY_NAME && n !== UNCATEGORIZED_NAME);

  const mappings = await prisma.labelMapping.findMany({ where: { userId } });
  const mappingByName = new Map(mappings.map((m) => [m.labelName, m.gmailLabelId]));

  const userLabels = await prisma.label.findMany({
    where: { userId, enabled: true, gmailLabelId: { not: null } },
    include: { rules: true },
  });

  // Pull a page of recent inbox threads. Token refresh and Gmail list failures
  // classify into an actionable message rather than an opaque 500.
  let gmail: gmail_v1.Gmail;
  let messages: gmail_v1.Schema$Message[];
  let nextPageToken: string | null;
  try {
    const { auth: oauthClient } = await makeAuthForUser(userId);
    gmail = google.gmail({ version: "v1", auth: oauthClient });
    const listRes = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
      maxResults: limit * 2,
      ...(pageToken ? { pageToken } : {}),
    });
    messages = listRes.data.messages ?? [];
    nextPageToken = listRes.data.nextPageToken ?? null;
  } catch (err) {
    return { kind: "gmail_error", err };
  }

  const seenThreads = new Set<string>();
  const candidates: Array<{ messageId: string; threadId: string }> = [];
  for (const m of messages) {
    if (!m.id || !m.threadId) continue;
    if (seenThreads.has(m.threadId)) continue;
    seenThreads.add(m.threadId);
    candidates.push({ messageId: m.id, threadId: m.threadId });
    if (candidates.length >= limit) break;
  }

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
  const skipped = alreadySet.size;

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

      if (userLabels.length > 0) {
        const ruleMatches = userLabels.filter(
          (l) => l.rules.length > 0 && l.rules.some((rule) => matchesRule(rule, { subject, from, body })),
        );
        const labelsWithoutRules = userLabels.filter((l) => l.rules.length === 0);
        let aiMatches: typeof userLabels = [];
        if (labelsWithoutRules.length > 0) {
          const aiNames = await classifyEmailLabels(
            subject, from, body,
            labelsWithoutRules.map((l) => ({ name: l.name, description: l.description })),
            userId,
          );
          aiMatches = labelsWithoutRules.filter((l) => aiNames.includes(l.name));
        }
        const userGmailIds = [...ruleMatches, ...aiMatches].map((l) => l.gmailLabelId!);
        const userApplySet = new Set(userGmailIds);
        const userRemoveIds = userLabels
          .map((l) => l.gmailLabelId!)
          .filter((id) => !userApplySet.has(id));
        await applyGmailLabels(userId, c.messageId, userGmailIds, userRemoveIds);
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

      const matched =
        (result.label ? spec.labels.find((l) => l.shortName === result.label) : null) ??
        spec.labels.find((l) => l.shortName === UNCATEGORIZED_NAME) ??
        null;
      const namesToApply: string[] = [];
      if (matched) namesToApply.push(matched.name);
      if (result.priority > 0.75 && isBuiltInPresetKey(preset)) {
        namesToApply.push(HIGH_PRIORITY_NAME);
      }

      const applyIds = namesToApply
        .map((n) => mappingByName.get(n))
        .filter((id): id is string => Boolean(id));
      const applySet = new Set(applyIds);
      const presetRemoveIds = mappings
        .map((m) => m.gmailLabelId)
        .filter((id) => !applySet.has(id));
      await applyGmailLabels(userId, c.messageId, applyIds, presetRemoveIds);
      if (applyIds.length > 0) tagged++;

      await prisma.classifiedThread.upsert({
        where: { userId_threadId: { userId, threadId: c.threadId } },
        create: { userId, threadId: c.threadId, labelName: matched?.name ?? null },
        update: { labelName: matched?.name ?? null },
      });

      // Signal detection is skipped for the onboarding scan to protect the
      // 2-minute budget; live classification picks signals up afterward.
      if (!skipSignals) {
        await detectAndPersistSignal({ userId, threadId: c.threadId, subject, from, body });
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      console.error(`[back-scan] thread ${c.threadId} failed:`, m);
    }
  }

  const startedAt = Date.now();
  let incomplete = false;
  for (let i = 0; i < toClassify.length; i += CONCURRENCY) {
    if (Date.now() - startedAt > BUDGET_MS) {
      incomplete = true;
      break;
    }
    await Promise.all(toClassify.slice(i, i + CONCURRENCY).map(processOne));
  }

  return {
    kind: "ok",
    scanned,
    tagged,
    skipped,
    incomplete,
    total: candidates.length,
    nextPageToken,
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // force=true (Sync-inbox button) bypasses dedupe. onboarding=true runs a
  // second 25-thread tranche via after() and skips signal detection, labeling
  // ~50 threads across the two tranches within the raised maxDuration.
  const body = (await req.json().catch(() => ({}))) as {
    force?: boolean;
    onboarding?: boolean;
  };
  const force = body.force === true;
  const onboarding = body.onboarding === true;

  const first = await scanCore({
    userId,
    force,
    limit: MAX_THREADS,
    skipSignals: onboarding,
  });

  if (first.kind === "setup_error") {
    return NextResponse.json({ error: first.error }, { status: first.status });
  }
  if (first.kind === "gmail_error") {
    return gmailErrorResponse(first.err);
  }

  // Onboarding tail: label the next ~25 threads after the response returns, in
  // the same invocation's extended lifetime. Best-effort — failures just leave
  // those threads for live classification.
  if (onboarding && first.nextPageToken) {
    const pageToken = first.nextPageToken;
    after(async () => {
      try {
        const tail = await scanCore({
          userId,
          force,
          limit: MAX_THREADS,
          pageToken,
          skipSignals: true,
        });
        if (tail.kind !== "ok") {
          console.error("[back-scan] onboarding tail non-ok:", tail.kind);
        }
      } catch (err) {
        console.error("[back-scan] onboarding tail threw:", err);
      }
    });
  }

  return NextResponse.json({
    scanned: first.scanned,
    tagged: first.tagged,
    skipped: first.skipped,
    incomplete: first.incomplete,
    total: first.total,
    tailQueued: onboarding && !!first.nextPageToken,
  });
}

function matchesRule(
  rule: { field: string; operator: string; value: string },
  msg: { subject: string; from: string; body: string },
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
