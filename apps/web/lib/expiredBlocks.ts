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
  end?: string; // "HH:MM" — the block's wall-clock end time (used for one-offs)
  recurrence?: {
    freq?: "none" | "daily" | "weekly" | "monthly" | string;
    date?: string; // "YYYY-MM-DD" — the day a one-off ("none") lands on
    until?: string; // "YYYY-MM-DD" — inclusive end date for a recurring block
  };
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function isISODate(s: string | undefined): s is string {
  return typeof s === "string" && ISO_DATE.test(s);
}

// A reference "now" the expiry check understands: either a bare day
// ("YYYY-MM-DD") or a minute-precision local timestamp ("YYYY-MM-DDTHH:MM").
function isNowStamp(s: string | undefined): s is string {
  return typeof s === "string" && (ISO_DATE.test(s) || ISO_DATETIME.test(s));
}

// Normalize "HH:MM" (allowing a single-digit hour, as some legacy values have)
// to a zero-padded "HH:MM" so it sorts lexicographically. Returns null if the
// value isn't a valid time.
function normHHMM(s: string | undefined): string | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
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

// Now as a minute-precision local timestamp "YYYY-MM-DDTHH:MM" in the given
// IANA time zone. This is what lets a one-off block clear the moment its end
// time passes (rather than waiting for the calendar day to roll over). Falls
// back to the host zone if `tz` is unusable.
export function nowISOInZone(tz?: string, now: Date = new Date()): string {
  const fmt = (timeZone?: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    // Some engines render midnight as "24"; normalize to "00".
    let hour = get("hour");
    if (hour === "24") hour = "00";
    return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
  };
  try {
    return fmt(tz);
  } catch {
    return fmt(undefined);
  }
}

// Whether a block's event has fully passed relative to `nowISO`.
//
// `nowISO` may be a bare day ("YYYY-MM-DD") or a minute-precision local
// timestamp ("YYYY-MM-DDTHH:MM"). Pass a timestamp (via nowISOInZone) to get
// the time-aware behavior below; a bare day falls back to whole-day rules.
//
// - one-off ("none"): with a timestamp and a known end time, expires the
//   moment its end passes — a block that ended at 6:45pm clears that evening,
//   not the next day. Without an end time (or given only a bare day), it
//   falls back to clearing the day *after* its date.
// - recurring (daily/weekly/monthly): expires when it has a bounded `until`
//   end date that is now in the past (whole-day). An open-ended recurrence
//   never auto-clears.
// - a block with no recurrence, or an incomplete one (no date / no until),
//   never auto-clears — there's nothing that says it's finished.
//
// All comparisons are lexicographic on the shared "YYYY-MM-DD[THH:MM]"
// shape, which orders chronologically.
export function isBlockExpired(block: BlockLike, nowISO: string): boolean {
  if (!isNowStamp(nowISO)) return false;
  const rec = block.recurrence;
  if (!rec) return false;
  const today = nowISO.slice(0, 10);
  if (rec.freq === "none") {
    if (!isISODate(rec.date)) return false;
    const end = normHHMM(block.end);
    // Time-aware once we have both an end time and a full timestamp.
    if (end && nowISO.length > 10) {
      return `${rec.date}T${end}` <= nowISO;
    }
    // Fallback: clears the day after its date.
    return rec.date < today;
  }
  return isISODate(rec.until) && rec.until < today;
}

// Split blocks into the ones that survive and the ones that have expired.
// Order within each group is preserved so callers can persist `kept` directly.
export function pruneExpiredBlocks<T extends BlockLike>(
  blocks: readonly T[],
  nowISO: string,
): { kept: T[]; expired: T[] } {
  const kept: T[] = [];
  const expired: T[] = [];
  for (const b of blocks) {
    if (isBlockExpired(b, nowISO)) expired.push(b);
    else kept.push(b);
  }
  return { kept, expired };
}
