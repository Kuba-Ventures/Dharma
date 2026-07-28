import type { TimeSlot, SchedulingRequest } from "@dharma/types";

export interface CalendarProvider {
  getEvents(start: Date, end: Date): Promise<TimeSlot[]>;
}

// A Google Calendar `calendarList` entry reduced to the fields we use to decide
// whether it belongs to the user's visible schedule. Kept structural so a full
// googleapis `calendar_v3.Schema$CalendarListEntry` assigns to it directly.
export type CalendarListEntryLike = {
  id?: string | null;
  selected?: boolean | null;
  deleted?: boolean | null;
  primary?: boolean | null;
};

// The calendars that make up a user's *visible* schedule: the ones ticked
// (shown) in their Google Calendar UI. This is what both the dashboard card and
// the free-busy engine read from, so meetings on the user's Work / Personal
// calendars are seen — not just `primary` (issue #74).
//
// Rules: primary is always kept even when Google omits `selected` on it;
// deleted entries and entries without an id are dropped; ids are de-duplicated
// preserving order. Falls back to ["primary"] so callers never get an empty set
// (e.g. when calendarList is unavailable or returns nothing).
export function visibleCalendarIds(entries: CalendarListEntryLike[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (!e.id || e.deleted) continue;
    if (!(e.selected || e.primary)) continue;
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    ids.push(e.id);
  }
  return ids.length > 0 ? ids : ["primary"];
}

// Merges events from multiple providers concurrently.
// Individual provider failures are logged and skipped so one broken
// credential doesn't block the whole response.
export class MultiProvider implements CalendarProvider {
  constructor(private readonly providers: CalendarProvider[]) {}

  async getEvents(start: Date, end: Date): Promise<TimeSlot[]> {
    const results = await Promise.allSettled(
      this.providers.map((p) => p.getEvents(start, end))
    );

    const allSlots: TimeSlot[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        allSlots.push(...result.value);
      } else {
        console.error("[MultiProvider] A calendar provider failed:", result.reason);
      }
    }

    return allSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
  }
}

// Returns 0 (Sun) – 6 (Sat) in the given timezone.
function getLocalDayOfWeek(date: Date, tz: string): number {
  const dow = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: tz }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dow);
}

// Returns 0–23 in the given timezone.
function getLocalHour(date: Date, tz: string): number {
  const h = parseInt(
    new Intl.DateTimeFormat("en", { hour: "numeric", hour12: false, timeZone: tz }).format(date)
  );
  return h === 24 ? 0 : h;
}

// Parses loose time hints from email text and returns a preferred date window.
function parseTimePreference(text: string, now: Date, tz: string): { start: Date; end: Date } | null {
  const lower = text.toLowerCase();
  const todayDow = getLocalDayOfWeek(now, tz);

  // Base all day arithmetic on UTC midnight so the current time-of-day doesn't
  // shift the computed window. e.g. "next tuesday" at 8 PM should still
  // include 9 AM slots on Tuesday, not start the window at 8 PM Tuesday.
  const todayMidnight = new Date(now);
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const addDays = (d: Date, n: number) => {
    const r = new Date(d);
    r.setUTCDate(r.getUTCDate() + n);
    return r;
  };

  // Days until next Monday (always at least 1 day away)
  const daysToMonday = ((1 - todayDow + 7) % 7) || 7;
  const nextMonday = addDays(todayMidnight, daysToMonday);

  if (/early next week/.test(lower)) {
    return { start: nextMonday, end: addDays(nextMonday, 3) };
  }
  if (/next week/.test(lower)) {
    return { start: nextMonday, end: addDays(nextMonday, 5) };
  }
  if (/this week/.test(lower)) {
    const daysToFriday = (5 - todayDow + 7) % 7;
    return { start: todayMidnight, end: addDays(todayMidnight, daysToFriday + 1) };
  }
  if (/tomorrow/.test(lower)) {
    const tomorrow = addDays(todayMidnight, 1);
    return { start: tomorrow, end: addDays(tomorrow, 1) };
  }

  // Explicit day-of-week mention ("next tuesday", "this friday", etc.)
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < dayNames.length; i++) {
    if (new RegExp(`\\b${dayNames[i]}\\b`).test(lower)) {
      const daysAhead = ((i - todayDow + 7) % 7) || 7;
      const target = addDays(todayMidnight, daysAhead);
      return { start: target, end: addDays(target, 1) };
    }
  }

  return null;
}

export async function getAvailableSlots(
  provider: CalendarProvider,
  request: SchedulingRequest,
  timezone = "America/New_York"
): Promise<{ slots: TimeSlot[] }> {
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const busySlots = await provider.getEvents(now, twoWeeksOut);

  const preferredRange = parseTimePreference(request.rawText, now, timezone);

  const candidates: TimeSlot[] = [];
  // Snap cursor to current hour
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);

  while (cursor < twoWeeksOut && candidates.length < 30) {
    const localHour = getLocalHour(cursor, timezone);
    const localDow = getLocalDayOfWeek(cursor, timezone);
    const isWeekday = localDow >= 1 && localDow <= 5;
    const isBusinessHour = localHour >= 9 && localHour < 17;

    if (isWeekday && isBusinessHour) {
      const slotEnd = new Date(cursor.getTime() + request.durationMinutes * 60 * 1000);
      const endHour = getLocalHour(slotEnd, timezone);
      // Slot must end by 5 PM — exactly 17:00 is fine, 17:30 is not
      const fitsInDay =
        endHour < 17 || (endHour === 17 && slotEnd.getMinutes() === 0);

      if (fitsInDay) {
        const overlaps = busySlots.some((b) => cursor < b.end && slotEnd > b.start);
        if (!overlaps) {
          candidates.push({ start: new Date(cursor), end: new Date(slotEnd) });
        }
      }
    }

    cursor.setTime(cursor.getTime() + 60 * 60 * 1000); // advance 1 hour
  }

  // If the email mentions a preferred timeframe, surface those slots first
  if (preferredRange) {
    const { start, end } = preferredRange;
    const inRange = candidates.filter((s) => s.start >= start && s.start < end);
    const outRange = candidates.filter((s) => !(s.start >= start && s.start < end));
    return { slots: [...inRange, ...outRange] };
  }

  return { slots: candidates };
}
