// Pure helpers for mirroring scheduling *blocks* (focus/hold windows created
// in Configuration → Scheduling) to Google Calendar: the recurrence/event-body
// builders and the shared block types.
//
// Deliberately free of any prisma / googleapis-runtime / network imports so it
// stays unit-testable (see blockMirror.test.ts). The DB- and Calendar-touching
// reconcile lives in blockReconcile.ts, which builds on these helpers.

import type { calendar_v3 } from "googleapis";
import { DHARMA_BLOCK_DESCRIPTION, DHARMA_BLOCK_EXT_KEY } from "./dharmaBlock";

// Per-block recurrence — gives each block event-like control over how it
// repeats, instead of auto-deriving the schedule from the user's meeting days.
export type Recurrence = {
  freq: "none" | "daily" | "weekly" | "monthly";
  interval?: number; // every N (days/weeks/months); default 1
  days?: number[];   // 0=Sun..6=Sat — used when freq === "weekly"
  date?: string;     // "YYYY-MM-DD" — required for one-off ("none"), optional anchor otherwise
  until?: string;    // "YYYY-MM-DD" — optional end date (inclusive)
};

// Mirrored block shape — round-tripped through `schedulingPreferences`.
export type BlockedWindow = {
  start: string;            // "HH:MM"
  end: string;              // "HH:MM"
  label?: string;
  mirrorToCalendar?: boolean;
  calendarEventId?: string; // present once the block has been synced to Calendar
  recurrence?: Recurrence;  // how the mirrored event repeats
  colorId?: string;         // Google Calendar event color "1".."11"
};

export type Prefs = {
  defaultDurationMin?: number;
  bufferMin?: number;
  maxPerDay?: number;
  blockedWindows?: BlockedWindow[];
};

const DAY_RRULE_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
// Google Calendar event color "1" = Lavender (#7986CB), the nearest preset to
// Dharma's brand indigo. Calendar only supports its fixed 11-color palette.
const DHARMA_EVENT_COLOR_ID = "1";
const BLOCK_DESCRIPTION = DHARMA_BLOCK_DESCRIPTION;

export function safeParsePrefs(raw: string | null | undefined): Prefs {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Prefs;
  } catch {
    return {};
  }
}

// "HH:MM" string -> { h: number, m: number }. Returns null if invalid.
export function parseHHMM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// "YYYY-MM-DD" -> local Date (midnight). Returns null if malformed.
function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Legacy blocks (saved before recurrence existed) mirror as weekly on the
// user's active meeting days — preserving the old behavior.
export function effectiveRecurrence(block: BlockedWindow, activeDays: Set<number>): Recurrence {
  if (block.recurrence) return block.recurrence;
  return { freq: "weekly", interval: 1, days: [...activeDays] };
}

// Resolve the anchor date the first event instance lands on. Explicit `date`
// wins; otherwise we pick the next upcoming day that matches (for weekly, the
// next selected weekday; otherwise today).
export function resolveAnchor(rec: Recurrence, now: Date = new Date()): Date | null {
  if (rec.date) return parseDate(rec.date);
  const wantDays =
    rec.freq === "weekly" && rec.days && rec.days.length ? new Set(rec.days) : null;
  for (let i = 0; i < 14; i++) {
    const cand = new Date(now);
    cand.setDate(now.getDate() + i);
    if (wantDays && !wantDays.has(cand.getDay())) continue;
    return cand;
  }
  return null;
}

// Build an RRULE string from a recurrence, or null for a one-off.
export function buildRRule(rec: Recurrence): string | null {
  if (rec.freq === "none") return null;
  const interval = rec.interval && rec.interval > 0 ? rec.interval : 1;
  let rule = `RRULE:FREQ=${rec.freq.toUpperCase()};INTERVAL=${interval}`;
  if (rec.freq === "weekly" && rec.days && rec.days.length > 0 && rec.days.length < 7) {
    const codes = [...rec.days].sort((a, b) => a - b).map((d) => DAY_RRULE_CODES[d]);
    rule += `;BYDAY=${codes.join(",")}`;
  }
  if (rec.until) {
    const end = parseDate(rec.until);
    if (end) {
      // Inclusive end-of-day in UTC. Approximation is fine for whole-day bounds.
      rule += `;UNTIL=${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T235959Z`;
    }
  }
  return rule;
}

export function buildEventBody(
  block: BlockedWindow,
  activeDays: Set<number>,
  tz: string,
  now: Date = new Date(),
): calendar_v3.Schema$Event | null {
  const rec = effectiveRecurrence(block, activeDays);
  const start = parseHHMM(block.start);
  const end = parseHHMM(block.end);
  if (!start || !end) return null;
  const anchor = resolveAnchor(rec, now);
  if (!anchor) return null;

  const dateStr = `${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}-${pad(anchor.getDate())}`;
  // Calendar API takes wall-clock dateTime + a sibling timeZone field.
  const startDT = `${dateStr}T${pad(start.h)}:${pad(start.m)}:00`;
  const endDT = `${dateStr}T${pad(end.h)}:${pad(end.m)}:00`;

  const summary = block.label?.trim() ? block.label.trim() : "Dharma block";

  const event: calendar_v3.Schema$Event = {
    summary,
    description: BLOCK_DESCRIPTION,
    // Durable machine marker so surfaces like the dashboard "meetings this
    // week" card can exclude Dharma blocks without string-matching the
    // description (issue #86).
    extendedProperties: { private: { [DHARMA_BLOCK_EXT_KEY]: "1" } },
    start: { dateTime: startDT, timeZone: tz },
    end: { dateTime: endDT, timeZone: tz },
    transparency: "opaque",
    // Per-block color if the user picked one, else "Lavender" — the closest
    // preset to Dharma's brand indigo (#7F77DD). Google only allows its fixed
    // 11-color palette ("1".."11").
    colorId: /^([1-9]|1[01])$/.test(block.colorId ?? "")
      ? (block.colorId as string)
      : DHARMA_EVENT_COLOR_ID,
    reminders: { useDefault: false, overrides: [] },
  };

  const rrule = buildRRule(rec);
  if (rrule) event.recurrence = [rrule];
  return event;
}

// Pull a human-readable message out of a googleapis / fetch error.
export function calendarErrorMessage(err: unknown): string {
  const e = err as {
    code?: number | string;
    message?: string;
    errors?: { message?: string }[];
    response?: { data?: { error?: { message?: string } | string } };
  };
  const apiErr = e?.response?.data?.error;
  // OAuth token refresh failed: the stored Google grant is expired or revoked
  // (e.g. the user revoked access, or the OAuth client rotated). The library
  // surfaces this as `invalid_grant (400)`, which is meaningless to a user —
  // translate it into an actionable reconnect prompt.
  const oauthErrCode = typeof apiErr === "string" ? apiErr : undefined;
  if (oauthErrCode === "invalid_grant" || e?.message === "invalid_grant") {
    return "Google access expired — sign out and sign back in to reconnect, then add the block again";
  }
  const detail =
    (typeof apiErr === "object" ? apiErr?.message : apiErr) ||
    e?.errors?.[0]?.message ||
    e?.message ||
    "Unknown calendar error";
  return e?.code ? `${detail} (${e.code})` : detail;
}
