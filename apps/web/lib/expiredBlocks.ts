// Auto-clearing of scheduling blocks whose event has fully passed.
//
// A "block" is one entry in a user's `schedulingPreferences.blockedWindows`.
// Each carries a recurrence describing how (and until when) it repeats. Once a
// block's last occurrence is in the past it should disappear from the
// Scheduling card and, if it was mirrored, from the user's calendar. This
// module is the single, pure source of truth for "is this block done?" so the
// client (what the card shows) and the server (what gets persisted / deleted
// from Google Calendar) agree.

// Minimal structural shape shared by the client and server BlockedWindow types.
type BlockLike = {
  recurrence?: {
    freq?: "none" | "daily" | "weekly" | "monthly" | string;
    date?: string; // "YYYY-MM-DD" — the day a one-off ("none") lands on
    until?: string; // "YYYY-MM-DD" — inclusive end date for a recurring block
  };
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isISODate(s: string | undefined): s is string {
  return typeof s === "string" && ISO_DATE.test(s);
}

// Today's date as "YYYY-MM-DD" in the given IANA time zone. Blocks store
// wall-clock dates with no zone, so "has this day passed?" has to be judged in
// the user's own zone — otherwise a block can clear a day early or late for
// users far from UTC. Falls back to the host zone if `tz` is unusable.
export function todayISOInZone(tz?: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(now);
  }
}

// Whether a block's event has fully passed relative to `todayISO`.
//
// - one-off ("none"): expired the day *after* its date, so a block scheduled
//   for today still shows today and clears tomorrow.
// - recurring (daily/weekly/monthly): only expires when it has a bounded
//   `until` end date that is now in the past. An open-ended recurrence never
//   auto-clears.
// - a block with no recurrence, or an incomplete one (no date / no until),
//   never auto-clears — there's nothing that says it's finished.
//
// Comparison is lexicographic on "YYYY-MM-DD", which orders chronologically.
export function isBlockExpired(block: BlockLike, todayISO: string): boolean {
  if (!isISODate(todayISO)) return false;
  const rec = block.recurrence;
  if (!rec) return false;
  if (rec.freq === "none") {
    return isISODate(rec.date) && rec.date < todayISO;
  }
  return isISODate(rec.until) && rec.until < todayISO;
}

// Split blocks into the ones that survive and the ones that have expired.
// Order within each group is preserved so callers can persist `kept` directly.
export function pruneExpiredBlocks<T extends BlockLike>(
  blocks: readonly T[],
  todayISO: string,
): { kept: T[]; expired: T[] } {
  const kept: T[] = [];
  const expired: T[] = [];
  for (const b of blocks) {
    if (isBlockExpired(b, todayISO)) expired.push(b);
    else kept.push(b);
  }
  return { kept, expired };
}
