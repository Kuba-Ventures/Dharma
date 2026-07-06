// Pure (no-I/O) configuration for the AI guardrails. Kept separate from
// aiGuard.ts so the plan/limit logic is unit-testable without pulling in
// Prisma. aiGuard.ts consumes these; nothing here touches the DB.

export type Plan = "free" | "paid";

export type PlanLimits = {
  perMinute: number; // max AI actions in the trailing 60s
  perDay: number; // max AI actions in the trailing 24h
  costUsdPerDay: number; // max Anthropic $ in the trailing 24h
};

export function num(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function limitsFor(plan: Plan): PlanLimits {
  if (plan === "paid") {
    return {
      perMinute: num("AI_PAID_PER_MIN", 30),
      perDay: num("AI_PAID_PER_DAY", 600),
      costUsdPerDay: num("AI_PAID_COST_DAY", 8),
    };
  }
  return {
    perMinute: num("AI_FREE_PER_MIN", 8),
    perDay: num("AI_FREE_PER_DAY", 60),
    costUsdPerDay: num("AI_FREE_COST_DAY", 0.75),
  };
}

// Trailing-24h spend across ALL users, in USD.
export function globalCeilingUsd(): number {
  return num("AI_GLOBAL_COST_DAY", 50);
}

// Plan resolution. Until Stripe billing lands (task #7), a user is "paid" only
// if their id is in the AI_PAID_USER_IDS allowlist; everyone else is "free".
// This is the single seam to replace with a real entitlement check once
// billing exists — nothing else in the guard needs to change.
export function planForUser(userId: string): Plan {
  const raw = process.env.AI_PAID_USER_IDS ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(userId) ? "paid" : "free";
}
