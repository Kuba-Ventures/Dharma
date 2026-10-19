// Reporting ranges and calendar-day math for the admin console. Pure (no I/O)
// so it is unit-tested; every chart and total buckets days in adminTimeZone.

export const adminTimeZone = "America/Los_Angeles";

// First day the "All" range reaches back to (launch). Charts never start earlier.
export const allTimeStartDayKey = "2026-03-25";

export const adminReportingRanges = [
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "all", label: "All", days: null },
] as const;

export type AdminReportingRangeKey = (typeof adminReportingRanges)[number]["key"];

export function parseAdminReportingRange(requestedRange: string | string[] | undefined): AdminReportingRangeKey {
  const matchingRange = adminReportingRanges.find((reportingRange) => reportingRange.key === requestedRange);
  return matchingRange ? matchingRange.key : "30d";
}

const dayMilliseconds = 24 * 60 * 60 * 1000;

export function dayKeyInTimeZone(instant: Date, timeZone = adminTimeZone): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    instant,
  );
}

function shiftDayKey(dayKey: string, dayOffset: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + dayOffset)).toISOString().slice(0, 10);
}

function daysBetween(firstDayKey: string, lastDayKey: string): number {
  return Math.round((Date.parse(`${lastDayKey}T00:00:00Z`) - Date.parse(`${firstDayKey}T00:00:00Z`)) / dayMilliseconds);
}

// Milliseconds the zone is ahead of UTC at a given instant (negative west of UTC).
function timeZoneOffsetMilliseconds(instantMilliseconds: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMilliseconds));
  const part = (type: string) => Number(parts.find((candidate) => candidate.type === type)?.value);
  const wallClockAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return wallClockAsUtc - Math.floor(instantMilliseconds / 1000) * 1000;
}

// The instant local midnight starts on dayKey in the zone.
export function startOfDayInstant(dayKey: string, timeZone = adminTimeZone): Date {
  const utcMidnight = Date.parse(`${dayKey}T00:00:00Z`);
  const firstGuess = utcMidnight - timeZoneOffsetMilliseconds(utcMidnight, timeZone);
  return new Date(utcMidnight - timeZoneOffsetMilliseconds(firstGuess, timeZone));
}

export type AdminPeriod = { dayKeys: string[]; start: Date; end: Date };
export type AdminPeriods = { current: AdminPeriod; prior: AdminPeriod };

// Trailing window of whole local days ending today, plus the equal-length
// window right before it for "vs prior" comparisons.
export function periodsForRange(rangeKey: AdminReportingRangeKey, now = new Date()): AdminPeriods {
  const todayKey = dayKeyInTimeZone(now);
  const range = adminReportingRanges.find((candidate) => candidate.key === rangeKey);
  const dayCount = range?.days ?? Math.max(1, daysBetween(allTimeStartDayKey, todayKey) + 1);
  const currentFirstKey = shiftDayKey(todayKey, -(dayCount - 1));
  const priorFirstKey = shiftDayKey(currentFirstKey, -dayCount);
  const keysFrom = (firstKey: string) => Array.from({ length: dayCount }, (_, index) => shiftDayKey(firstKey, index));
  return {
    current: { dayKeys: keysFrom(currentFirstKey), start: startOfDayInstant(currentFirstKey), end: now },
    prior: {
      dayKeys: keysFrom(priorFirstKey),
      start: startOfDayInstant(priorFirstKey),
      end: startOfDayInstant(currentFirstKey),
    },
  };
}

// Lines a sparse {dayKey: value} map up against the full list of days.
export function fillDailySeries(dayKeys: string[], valuesByDayKey: Map<string, number>): number[] {
  return dayKeys.map((dayKey) => valuesByDayKey.get(dayKey) ?? 0);
}

export function percentChange(currentValue: number, priorValue: number): number | null {
  if (priorValue === 0) return null;
  return Math.round(((currentValue - priorValue) / priorValue) * 100);
}
