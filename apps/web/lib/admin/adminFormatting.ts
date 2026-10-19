import { adminTimeZone, percentChange } from "./adminRange";

const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const preciseUsdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const countFormatter = new Intl.NumberFormat("en-US");

// Whole dollars at $100 and up, cents below, so small unit costs stay readable.
export function formatUsd(amountUsd: number | null | undefined): string {
  if (amountUsd == null || Number.isNaN(amountUsd)) return "-";
  return Math.abs(amountUsd) >= 100 ? usdFormatter.format(amountUsd) : preciseUsdFormatter.format(amountUsd);
}

export function formatCount(count: number | null | undefined): string {
  if (count == null || Number.isNaN(count)) return "-";
  return countFormatter.format(count);
}

export function formatHours(seconds: number): string {
  return `${countFormatter.format(Math.round(seconds / 3600))}h`;
}

export function divideOrNull(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

export function formatPercent(fraction: number | null): string {
  return fraction == null ? "-" : `${Math.round(fraction * 100)}%`;
}

// "prior $355 · +16%" style note for stat tiles.
export function priorComparisonNote(
  currentValue: number,
  priorValue: number,
  formatValue: (value: number) => string,
): string {
  const change = percentChange(currentValue, priorValue);
  const changeText = change == null ? "" : ` · ${change > 0 ? "+" : ""}${change}%`;
  return `prior ${formatValue(priorValue)}${changeText}`;
}

export function formatAdminDate(instant: Date | string | null): string {
  if (!instant) return "-";
  const parsed = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", { timeZone: adminTimeZone, month: "short", day: "numeric" }).format(parsed);
}

export function formatRelativeTime(instant: Date | null, nowMilliseconds = Date.now()): string {
  if (!instant) return "-";
  const elapsedMinutes = Math.max(0, Math.round((nowMilliseconds - instant.getTime()) / 60_000));
  if (elapsedMinutes < 2) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.round(elapsedHours / 24);
  return elapsedDays === 1 ? "Yesterday" : `${elapsedDays}d ago`;
}

// Net Promoter Score from 0-10 ratings: % promoters (9-10) minus % detractors (0-6).
export function netPromoterScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const promoters = scores.filter((score) => score >= 9).length;
  const detractors = scores.filter((score) => score <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}
