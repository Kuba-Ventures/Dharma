// External money sources for the Finance page. Each reader is optional: with
// its key unset it reports "not_connected" and the page says so instead of
// showing a misleading $0.

export type VendorReading<ReadingType> =
  | { state: "not_connected" }
  | { state: "unavailable"; reason: string }
  | { state: "connected"; reading: ReadingType };

// Billing pages listed on the Finance page. monthlyUsd is the fixed monthly
// cost (null = usage-based or unknown); fixed costs feed the burn tile.
export const adminVendors: { name: string; purpose: string; billingUrl: string; monthlyUsd: number | null }[] = [
  { name: "Vercel", purpose: "Hosting, cron, AI Gateway", billingUrl: "https://vercel.com/dashboard/usage", monthlyUsd: null },
  { name: "Anthropic (via AI Gateway)", purpose: "Drafts, labels, tone", billingUrl: "https://vercel.com/dashboard/ai-gateway", monthlyUsd: null },
  { name: "Neon", purpose: "Postgres", billingUrl: "https://console.neon.tech/app/billing", monthlyUsd: null },
  { name: "Google Cloud", purpose: "OAuth, Gmail Pub/Sub", billingUrl: "https://console.cloud.google.com/billing", monthlyUsd: null },
];

export function fixedMonthlyCostUsd(): number | null {
  const knownCosts = adminVendors.map((vendor) => vendor.monthlyUsd).filter((cost): cost is number => cost != null);
  return knownCosts.length > 0 ? knownCosts.reduce((total, cost) => total + cost, 0) : null;
}

function describeFailure(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 160) : "request failed";
}

// ─── Stripe MRR ─────────────────────────────────────────────────────────────

type StripePrice = { unit_amount: number | null; recurring: { interval: string; interval_count: number } | null };
type StripeSubscription = {
  id: string;
  items: { data: { quantity?: number; price: StripePrice }[] };
  discount?: { coupon?: { percent_off?: number | null } | null } | null;
};

export type StripeRevenueReading = { mrrUsd: number; activeSubscriptions: number };

const monthsPerInterval: Record<string, number> = { day: 12 / 365, week: 12 / 52, month: 1, year: 12 };

// Normalizes every subscription item to a monthly amount (annual / 12 etc).
export function monthlyRecurringRevenueUsd(subscriptions: StripeSubscription[]): number {
  let mrrCents = 0;
  for (const subscription of subscriptions) {
    const percentOff = subscription.discount?.coupon?.percent_off ?? 0;
    for (const item of subscription.items.data) {
      const recurring = item.price.recurring;
      if (!recurring || item.price.unit_amount == null) continue;
      const intervalMonths = (monthsPerInterval[recurring.interval] ?? 1) * recurring.interval_count;
      mrrCents += ((item.price.unit_amount * (item.quantity ?? 1)) / intervalMonths) * (1 - percentOff / 100);
    }
  }
  return Math.round(mrrCents) / 100;
}

export async function loadStripeRevenue(): Promise<VendorReading<StripeRevenueReading>> {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return { state: "not_connected" };
  try {
    const subscriptions: StripeSubscription[] = [];
    let startingAfter: string | null = null;
    for (let pageIndex = 0; pageIndex < 20; pageIndex++) {
      const query = new URLSearchParams({ status: "active", limit: "100" });
      if (startingAfter) query.set("starting_after", startingAfter);
      const response = await fetch(`https://api.stripe.com/v1/subscriptions?${query}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      const page = (await response.json().catch(() => ({}))) as {
        data?: StripeSubscription[];
        has_more?: boolean;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(`Stripe ${response.status}: ${page.error?.message ?? "list failed"}`);
      subscriptions.push(...(page.data ?? []));
      if (!page.has_more || !page.data?.length) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
    return {
      state: "connected",
      reading: { mrrUsd: monthlyRecurringRevenueUsd(subscriptions), activeSubscriptions: subscriptions.length },
    };
  } catch (error) {
    console.error("[admin] Stripe revenue failed:", error);
    return { state: "unavailable", reason: describeFailure(error) };
  }
}

// ─── Vercel AI Gateway credits ──────────────────────────────────────────────

export type AiGatewayCreditsReading = { balanceUsd: number; totalUsedUsd: number };

export async function loadAiGatewayCredits(): Promise<VendorReading<AiGatewayCreditsReading>> {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (!gatewayKey) return { state: "not_connected" };
  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/credits", {
      headers: { Authorization: `Bearer ${gatewayKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => ({}))) as { balance?: string | number; total_used?: string | number };
    if (!response.ok) throw new Error(`AI Gateway ${response.status}`);
    return {
      state: "connected",
      reading: { balanceUsd: Number(body.balance) || 0, totalUsedUsd: Number(body.total_used) || 0 },
    };
  } catch (error) {
    console.error("[admin] AI Gateway credits failed:", error);
    return { state: "unavailable", reason: describeFailure(error) };
  }
}
