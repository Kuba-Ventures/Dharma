import { prisma } from "./prisma";
import type { EventType } from "./usage";
import { limitsFor, globalCeilingUsd, planForUser } from "./aiLimits";
import type { Plan } from "./aiLimits";
import { isComped } from "./effectiveTier";

export { planForUser } from "./aiLimits";
export type { Plan } from "./aiLimits";

// Cost/abuse guardrails for every AI (Anthropic) call path. Built on the
// UsageEvent table that logUsage() already writes, so limits are enforced from
// real per-user cost + volume with no new storage.
//
// Three layers, checked cheapest-first:
//   1. Kill switch      — AI_DISABLED=true blocks everything (incident lever).
//   2. Global ceiling   — total spend across ALL users in the trailing 24h,
//                         so one bad day (or a mass-signup event) can't run up
//                         an unbounded Anthropic bill.
//   3. Per-user limits  — burst (per-minute), daily action count, and daily
//                         cost, sized by plan (free vs paid).
//
// Checks are trailing: they read already-logged usage, so the CURRENT call is
// allowed to complete and gets logged; the NEXT call sees the updated total.
// A single call can therefore overshoot a cap by at most one call's cost,
// which is acceptable and keeps the guard off the request's hot path for the
// AI call itself.

export type GuardResult =
  | { allowed: true }
  | { allowed: false; status: number; code: string; error: string };

async function countSince(userId: string, since: Date): Promise<number> {
  return prisma.usageEvent.count({
    where: { userId, createdAt: { gte: since } },
  });
}

async function costSince(
  since: Date,
  userId?: string,
): Promise<number> {
  const res = await prisma.usageEvent.aggregate({
    _sum: { costUsd: true },
    where: { createdAt: { gte: since }, ...(userId ? { userId } : {}) },
  });
  return res._sum.costUsd ?? 0;
}

// Resolve the user's plan. A user gets paid limits if they're on the
// AI_PAID_USER_IDS allowlist (the billing seam) OR they've been comped in the
// admin sheet (Tier set above what they earned) — so an admin comp lifts AI
// limits the same way it lifts the displayed tier. The comp check reuses the
// ~60s-cached Users-tab read, so it isn't a Sheets API hit per request. Falls
// back to `free` if the user row is missing.
async function resolvePlan(userId: string): Promise<Plan> {
  if (planForUser(userId) === "paid") return "paid";
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, cumulativeSecondsSaved: true },
  });
  if (!user) return "free";
  return (await isComped(user.cumulativeSecondsSaved, user.email))
    ? "paid"
    : "free";
}

// Main entry point. Call after resolving userId, before the Anthropic request.
// `eventType` is accepted for future per-type limits and logging; current
// limits are aggregate across all AI actions (the right abuse metric).
export async function checkAiGuard(
  userId: string,
  eventType: EventType,
): Promise<GuardResult> {
  // 1. Kill switch.
  if (process.env.AI_DISABLED === "true") {
    return {
      allowed: false,
      status: 503,
      code: "ai_disabled",
      error: "AI features are temporarily unavailable. Please try again later.",
    };
  }

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const minuteAgo = new Date(now - 60 * 1000);

  // 2. Global spend ceiling (protects the bill regardless of who's calling).
  const globalCost = await costSince(dayAgo);
  if (globalCost >= globalCeilingUsd()) {
    console.error(
      `[aiGuard] GLOBAL ceiling hit: $${globalCost.toFixed(2)} >= $${globalCeilingUsd()} (blocking ${eventType} for ${userId})`,
    );
    return {
      allowed: false,
      status: 503,
      code: "global_capacity",
      error: "Dharma is at capacity right now. Please try again later.",
    };
  }

  // 3. Per-user limits, sized by plan. Plan resolution runs alongside the usage
  //    reads — it doesn't depend on them, only the comparisons below do.
  const [plan, burst, daily, userCost] = await Promise.all([
    resolvePlan(userId),
    countSince(userId, minuteAgo),
    countSince(userId, dayAgo),
    costSince(dayAgo, userId),
  ]);
  const limits = limitsFor(plan);

  if (burst >= limits.perMinute) {
    return {
      allowed: false,
      status: 429,
      code: "rate_burst",
      error: "You're going a bit fast. Please wait a moment and try again.",
    };
  }
  if (daily >= limits.perDay) {
    return {
      allowed: false,
      status: 429,
      code: "rate_daily",
      error: "You've reached today's usage limit. It resets in 24 hours.",
    };
  }
  if (userCost >= limits.costUsdPerDay) {
    return {
      allowed: false,
      status: 429,
      code: "cost_daily",
      error: "You've reached today's usage limit. It resets in 24 hours.",
    };
  }

  return { allowed: true };
}

// Lightweight variant for non-user-initiated pipelines (classify, signal,
// milestones driven by inbound email / cron). These shouldn't 429 a webhook;
// they should just pause AI work when the kill switch is on or the global
// ceiling is hit. Returns true if the pipeline may proceed.
export async function pipelineAiAllowed(): Promise<boolean> {
  if (process.env.AI_DISABLED === "true") return false;
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const globalCost = await costSince(dayAgo);
  if (globalCost >= globalCeilingUsd()) {
    console.error(
      `[aiGuard] GLOBAL ceiling hit: $${globalCost.toFixed(2)} — pausing pipeline AI`,
    );
    return false;
  }
  return true;
}
