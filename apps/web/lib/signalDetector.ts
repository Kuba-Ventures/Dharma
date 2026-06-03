// Detects high-signal emails the user would otherwise miss. Runs after the
// classifier on every new inbound thread; idempotent at the
// (userId, threadId, kind) level via Signal's unique constraint.
//
// Privacy invariant: this file reads the full email body for the LLM call but
// persists only `subject`, `from`, an AI-generated `summary`, an `evidence`
// snippet (capped at 120 chars), `confidence`, the new `title` /
// `whyItMatters` fields, and the `threadId`. Full bodies are never written to
// `Signal.payload`. Don't change that without a fresh privacy review.
//
// Cost ceiling: per-user daily call cap via the SIGNAL_DAILY_LIMIT env
// (default 100). Enforced by counting today's UsageEvent rows with
// eventType="signal" before issuing any LLM call. The new payload spec —
// `title`, `whyItMatters`, plus the existing `summary`/`evidence` — is what
// the Signals page renders.
//
// TODO(precision feedback): /api/signals/[id]/confirm and
// /api/signals/[id]/dismiss endpoints don't exist yet. Today the only state
// transition is "read" (via /api/signals/[id]/read). The brief explicitly
// flagged faking precision telemetry as worse than having none — until
// confirm/dismiss ships, the detector has no closed-loop calibration.

import { prisma } from "./prisma";
import { logUsage } from "./usage";
import { ANTHROPIC_URL, anthropicHeaders } from "./anthropicEndpoint";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const CONFIDENCE_THRESHOLD = 0.7;

// Today's spec covers buried_intent as a per-message detector. cold_thread is
// deterministic + light-LLM but needs a periodic sweep over dormant threads
// (it doesn't fire on an inbound — by definition there isn't one), which is
// future work. pattern_shift needs a ContactBaseline table we don't have.
// Both kind names are reserved here and rendered on the page so when they
// land later, the chip styling already exists.
export type SignalKind = "buried_intent" | "cold_thread";

export interface SignalPayload {
  threadId: string;
  subject: string;
  from: string;
  title: string;
  whyItMatters: string;
  summary: string;
  confidence: number;
  evidence: string;
}

interface DetectorResult {
  kind: SignalKind;
  title: string;
  whyItMatters: string;
  summary: string;
  confidence: number;
  evidence: string;
}

const SYSTEM_PROMPT = `You read inbound emails for a VC/PE/legal operator and flag the rare ones with buried intent — a latent ask the sender did NOT state outright but that an experienced operator would catch.

Buried intent examples:
- A founder updating you on traction whose subtext is "we're about to raise" — even if no round is mentioned
- A vendor mentioning growth or hiring whose subtext is "we're outgrowing our current provider"
- A portfolio CEO mentioning a strategic conversation whose subtext is exit/acquisition exploration
- A long-time relationship suddenly asking about your other portfolio whose subtext is fundraise exploration

Not buried intent:
- Explicit asks ("can we schedule a call about the round")
- Generic newsletters or status updates
- Pleasantries, scheduling back-and-forth, or routine ops

Be conservative — false positives waste the operator's attention. When the intent is explicit, when it's a pure status update, or when you're unsure, return null.

Return ONLY JSON:
{
  "kind": "buried_intent" | null,
  "title": "short headline of the latent intent (max 6 words)",
  "whyItMatters": "one sentence on why this is worth catching now",
  "summary": "one short sentence describing what's flagged",
  "evidence": "the literal phrase from the email that triggered the flag (max 120 chars)",
  "confidence": 0..1
}`;

// Lazily-evaluated daily limit. Returning a Number on each call lets test
// runs override SIGNAL_DAILY_LIMIT without a process restart.
function dailyLimit(): number {
  const raw = process.env.SIGNAL_DAILY_LIMIT;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 100;
}

async function isUnderDailyLimit(userId: string): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const todayCount = await prisma.usageEvent.count({
    where: {
      userId,
      eventType: "signal",
      createdAt: { gte: startOfDay },
    },
  });
  return todayCount < dailyLimit();
}

async function detect(args: {
  subject: string;
  from: string;
  body: string;
  userId: string;
}): Promise<DetectorResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const userMessage = `Subject: ${args.subject}\nFrom: ${args.from}\nBody (first 2000 chars):\n${args.body.slice(0, 2000)}`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: anthropicHeaders(apiKey),
      // Bound the call so signal detection can't hang the back-scan budget.
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 240,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) {
      console.error(`[signal] Anthropic error ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      content: Array<{ text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };
    if (data.usage) {
      await logUsage({
        userId: args.userId,
        eventType: "signal",
        model: HAIKU_MODEL,
        usage: data.usage,
      });
    }
    const text = data.content[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as {
      kind: "buried_intent" | null;
      title?: string;
      whyItMatters?: string;
      summary?: string;
      confidence?: number;
      evidence?: string;
    };
    if (parsed.kind !== "buried_intent") return null;
    if ((parsed.confidence ?? 0) < CONFIDENCE_THRESHOLD) return null;
    return {
      kind: "buried_intent",
      title: (parsed.title ?? "").slice(0, 80),
      whyItMatters: parsed.whyItMatters ?? "",
      summary: parsed.summary ?? "",
      confidence: parsed.confidence ?? 0,
      evidence: (parsed.evidence ?? "").slice(0, 120),
    };
  } catch (err) {
    console.error("[signal] detect failed:", err);
    return null;
  }
}

// Runs detection and persists a Signal row if one fires. Idempotent on
// (userId, threadId, kind). Safe to call from any classify path.
export async function detectAndPersistSignal(args: {
  userId: string;
  threadId: string;
  subject: string;
  from: string;
  body: string;
}): Promise<void> {
  // Per-user gate from Configuration → Signal detection. Short-circuits
  // before any LLM call so we don't burn tokens for users who opted out.
  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { signalDetectionEnabled: true },
  });
  if (!user || !user.signalDetectionEnabled) return;

  // Daily cost ceiling. Quiet by design — over-limit users should see no
  // new signals for the rest of the day, but their other inbox work
  // continues normally.
  if (!(await isUnderDailyLimit(args.userId))) {
    console.log(
      `[signal] daily limit reached for user ${args.userId} (limit=${dailyLimit()})`,
    );
    return;
  }

  const result = await detect({
    subject: args.subject,
    from: args.from,
    body: args.body,
    userId: args.userId,
  });
  if (!result) return;

  const payload: SignalPayload = {
    threadId: args.threadId,
    subject: args.subject,
    from: args.from,
    title: result.title,
    whyItMatters: result.whyItMatters,
    summary: result.summary,
    confidence: result.confidence,
    evidence: result.evidence,
  };

  try {
    await prisma.signal.upsert({
      where: {
        userId_threadId_kind: {
          userId: args.userId,
          threadId: args.threadId,
          kind: result.kind,
        },
      },
      create: {
        userId: args.userId,
        threadId: args.threadId,
        kind: result.kind,
        payload: payload as unknown as object,
      },
      update: {
        payload: payload as unknown as object,
      },
    });
  } catch (err) {
    console.error("[signal] persist failed:", err);
  }
}
