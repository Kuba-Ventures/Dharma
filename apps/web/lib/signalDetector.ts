// Detects high-signal emails — deal flow, term sheets, transactional events —
// that are worth surfacing in the Signals tab regardless of which preset
// label they got. Runs after the classifier on every new thread; idempotent
// at the (userId, threadId, kind) level via Signal's unique constraint.

import { prisma } from "./prisma";
import { logUsage } from "./usage";
import { ANTHROPIC_URL, anthropicHeaders } from "./anthropicEndpoint";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const CONFIDENCE_THRESHOLD = 0.7;

export type SignalKind = "deal_flow" | "term_sheet" | "transaction";

export interface SignalPayload {
  threadId: string;
  subject: string;
  from: string;
  summary: string;
  confidence: number;
  evidence: string;
}

interface DetectorResult {
  kind: SignalKind;
  summary: string;
  confidence: number;
  evidence: string;
}

const SYSTEM_PROMPT = `You read emails for a VC/PE/legal professional and flag the rare ones that contain a meaningful signal worth surfacing separately from routine inbox triage.

Three signal kinds — pick at most one, or null if none apply:

- "deal_flow": A founder, investor, or intermediary introducing a specific investment opportunity. Examples: "we're raising a $5M seed round", a pitch deck attached, a forwarded intro with a company in scope, an LP/GP discussing a specific deal. NOT: generic networking emails, newsletters, demo days without a specific ask.

- "term_sheet": The email contains, references, or negotiates actual term-sheet language. Examples: valuation/cap, liquidation preference, board composition, pro-rata rights, vesting schedules, anti-dilution. NOT: general "let's discuss terms" without specifics.

- "transaction": A live transactional event requiring near-term action. Examples: wire instructions, signature pages ready, executed docs, closing checklists, money movement confirmations. NOT: "we're closing soon" without anything actionable.

Be conservative — false positives clutter the Signals tab. When in doubt, return null.

Return ONLY JSON: {"kind": "deal_flow" | "term_sheet" | "transaction" | null, "summary": "one short sentence describing what's worth flagging", "confidence": 0..1, "evidence": "the literal phrase from the email that triggered the flag (max 120 chars)"}`;

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
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 200,
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
      kind: SignalKind | null;
      summary?: string;
      confidence?: number;
      evidence?: string;
    };
    if (!parsed.kind) return null;
    if ((parsed.confidence ?? 0) < CONFIDENCE_THRESHOLD) return null;
    return {
      kind: parsed.kind,
      summary: parsed.summary ?? "",
      confidence: parsed.confidence ?? 0,
      evidence: parsed.evidence ?? "",
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
