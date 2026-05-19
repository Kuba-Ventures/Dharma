import { prisma } from "./prisma";

// Pricing in USD per token. Anthropic published tiers as of Jan 2026:
//   Haiku  4.5  →  $1.00 / $5.00 per 1M (input / output)
//   Sonnet 4.x  →  $3.00 / $15.00 per 1M (input / output)
// Both the clean and date-suffixed model IDs are mapped so logUsage works
// regardless of which form the call site uses.
export const PRICING: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5":          { in: 1.0  / 1_000_000, out: 5.0  / 1_000_000 },
  "claude-haiku-4-5-20251001": { in: 1.0  / 1_000_000, out: 5.0  / 1_000_000 },
  "claude-sonnet-4-5":         { in: 3.0  / 1_000_000, out: 15.0 / 1_000_000 },
  "claude-sonnet-4-5-20250929":{ in: 3.0  / 1_000_000, out: 15.0 / 1_000_000 },
  "claude-sonnet-4":           { in: 3.0  / 1_000_000, out: 15.0 / 1_000_000 },
  "claude-sonnet-4-20250514":  { in: 3.0  / 1_000_000, out: 15.0 / 1_000_000 },
};

export type EventType = "classify" | "draft" | "tone_sync" | "schedule";

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

export async function logUsage(params: {
  userId: string;
  eventType: EventType;
  model: string;
  usage: AnthropicUsage;
}): Promise<void> {
  const { userId, eventType, model, usage } = params;
  if (!userId) return;
  const price = PRICING[model];
  if (!price) {
    console.warn(`[usage] No pricing for model "${model}" — logging with cost 0`);
  }
  const cost =
    (usage.input_tokens ?? 0) * (price?.in ?? 0) +
    (usage.output_tokens ?? 0) * (price?.out ?? 0);

  try {
    await prisma.usageEvent.create({
      data: {
        userId,
        eventType,
        model,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        costUsd: cost,
      },
    });
  } catch (err) {
    console.error("[usage] Failed to log event:", err);
  }
}
