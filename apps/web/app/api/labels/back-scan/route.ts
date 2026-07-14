// Raised from 60s: both the onboarding and the manual "Sync inbox" paths run a
// synchronous first page (25 threads) and then keep paginating in an after()
// continuation (same invocation) until they hit BACKFILL_TARGET (~75) threads,
// so the function needs headroom for a few ~45s budget windows inside ~2 min.
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

// Page size / first synchronous tranche. One Gmail list page yields up to this
// many threads; the interactive response returns after this many so the inbox's
// front page is labeled on arrival without a long wait.
const MAX_THREADS = Number(process.env.BACKSCAN_MAX_THREADS) || 25;
// Total threads a full backfill covers (front page + background tail). "Last 75
// emails" — deep enough to sort the useful part of the inbox, bounded so the
// cost (one Haiku classify per thread) and Gmail quota stay predictable.
const BACKFILL_TARGET = Number(process.env.BACKSCAN_BACKFILL_TARGET) || 75;
// The wall-time is dominated by one Haiku classify call per thread, run in
// serial batches of CONCURRENCY. At 5 a 25-thread tranche is 5 serial batches;
// at 25 the whole tranche runs as ONE parallel batch (~5x headroom over the
// old default, comfortably past the 3x target). Gmail's per-user quota
// (~250 units/s; ~10 units/thread) absorbs the burst fine. The ceiling to
// watch as usage grows is Anthropic RPM (up to CONCURRENCY concurrent Haiku
// calls per onboarding user, times simultaneous onboarders) — dial down via
// BACKSCAN_CONCURRENCY with no redeploy if that ever bites.
const CONCURRENCY = Number(process.env.BACKSCAN_CONCURRENCY) || 25;
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
  /**
   * How many inbox threads to process before stopping. scanCore paginates
   * across Gmail list pages (MAX_THREADS threads each) until it has handled
   * this many candidate threads, hits the last page, or runs out of budget.
   */
  target?: number;
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
  const { userId, force = false, target = MAX_THREADS, pageToken = null, skipSignals = false } = opts;

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

  // Resolve the Gmail client once. Token refresh / auth failures classify into
  // an actionable message rather than an opaque 500. Listing is done per-page
  // inside the pagination loop below.
  let gmail: gmail_v1.Gmail;
  try {
    const { auth: oauthClient } = await makeAuthForUser(userId);
    gmail = google.gmail({ version: "v1", auth: oauthClient });
  } catch (err) {
    return { kind: "gmail_error", err };
  }

  let scanned = 0;
  let tagged = 0;
  let skipped = 0;

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
  let processed = 0; // candidate threads consumed (classified + skipped)
  let currentPageToken: string | null = pageToken;
  // Token for the page *after* the last one we listed — lets a follow-up call
  // (the onboarding/sync tail) resume where this one stopped.
  let resumeToken: string | null = null;

  // Paginate inbox pages until we've handled `target` threads, exhausted the
  // inbox, or run out of budget. Each page yields up to MAX_THREADS threads.
  while (processed < target) {
    if (Date.now() - startedAt > BUDGET_MS) {
      incomplete = true;
      break;
    }

    let messages: gmail_v1.Schema$Message[];
    let nextPageToken: string | null;
    try {
      const listRes = await gmail.users.messages.list({
        userId: "me",
        labelIds: ["INBOX"],
        // One page of messages → at most MAX_THREADS unique threads. We consume
        // the WHOLE page each iteration (below), so nextPageToken never skips
        // unconsumed threads — the "recent mail left unlabeled" bug. Overshoot
        // of `target` is therefore bounded by one page.
        maxResults: MAX_THREADS,
        ...(currentPageToken ? { pageToken: currentPageToken } : {}),
      });
      messages = listRes.data.messages ?? [];
      nextPageToken = listRes.data.nextPageToken ?? null;
    } catch (err) {
      return { kind: "gmail_error", err };
    }
    resumeToken = nextPageToken;

    // Dedupe this page's messages to unique threads. Consume all of them — do
    // not cap by remaining target, or the resume token would skip the leftover.
    const seenThreads = new Set<string>();
    const candidates: Array<{ messageId: string; threadId: string }> = [];
    for (const m of messages) {
      if (!m.id || !m.threadId) continue;
      if (seenThreads.has(m.threadId)) continue;
      seenThreads.add(m.threadId);
      candidates.push({ messageId: m.id, threadId: m.threadId });
      if (candidates.length >= MAX_THREADS) break;
    }
    if (candidates.length === 0) break; // empty page → nothing left to do
    processed += candidates.length;

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
    skipped += alreadySet.size;
    const toClassify = candidates.filter((c) => !alreadySet.has(c.threadId));

    for (let i = 0; i < toClassify.length; i += CONCURRENCY) {
      if (Date.now() - startedAt > BUDGET_MS) {
        incomplete = true;
        break;
      }
      await Promise.all(toClassify.slice(i, i + CONCURRENCY).map(processOne));
    }
    if (incomplete) break;

    if (!nextPageToken) break; // reached the end of the inbox
    currentPageToken = nextPageToken;
  }

  // Real timing for the back-scan (the middleware request log doesn't carry
  // function duration). Grep "[back-scan] done" in the Vercel runtime logs for
  // actual ms/scanned/tagged as users onboard or sync.
  console.log(
    `[back-scan] done in ${Date.now() - startedAt}ms · scanned=${scanned} tagged=${tagged} ` +
      `skipped=${skipped} incomplete=${incomplete} target=${target} concurrency=${CONCURRENCY} ` +
      `pageToken=${pageToken ? "y" : "n"}`,
  );

  return {
    kind: "ok",
    scanned,
    tagged,
    skipped,
    incomplete,
    total: processed,
    // Budget-interrupted → resume from the page we were on; otherwise hand back
    // the token after the last processed page (null once the inbox is done).
    nextPageToken: incomplete ? currentPageToken : resumeToken,
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // force=true (Sync-inbox button) bypasses dedupe. onboarding=true skips
  // signal detection on the first tranche to protect the redirect budget.
  //
  // Both paths backfill up to BACKFILL_TARGET (~75) threads: the first
  // MAX_THREADS (25) run synchronously so the inbox front page is labeled on
  // arrival, and the remainder run in an after() tail (background, same
  // invocation) so the response stays fast. Best-effort — tail failures just
  // leave those threads for live classification to pick up.
  const body = (await req.json().catch(() => ({}))) as {
    force?: boolean;
    onboarding?: boolean;
  };
  const force = body.force === true;
  const onboarding = body.onboarding === true;

  const first = await scanCore({
    userId,
    force,
    target: MAX_THREADS,
    skipSignals: onboarding,
  });

  if (first.kind === "setup_error") {
    return NextResponse.json({ error: first.error }, { status: first.status });
  }
  if (first.kind === "gmail_error") {
    return gmailErrorResponse(first.err);
  }

  const remainingTarget = BACKFILL_TARGET - first.total;
  const tailQueued = !!first.nextPageToken && remainingTarget > 0;
  if (tailQueued) {
    const pageToken = first.nextPageToken;
    after(async () => {
      try {
        const tail = await scanCore({
          userId,
          force,
          target: remainingTarget,
          pageToken,
          skipSignals: true,
        });
        if (tail.kind !== "ok") {
          console.error("[back-scan] backfill tail non-ok:", tail.kind);
        }
      } catch (err) {
        console.error("[back-scan] backfill tail threw:", err);
      }
    });
  }

  return NextResponse.json({
    scanned: first.scanned,
    tagged: first.tagged,
    skipped: first.skipped,
    incomplete: first.incomplete,
    total: first.total,
    tailQueued,
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
