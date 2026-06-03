import { NextResponse } from "next/server";
import { google, type calendar_v3 } from "googleapis";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { makeAuthForUser } from "../../../../lib/gmail";

// Per-block recurrence — gives each block event-like control over how it
// repeats, instead of auto-deriving the schedule from the user's meeting days.
type Recurrence = {
  freq: "none" | "daily" | "weekly" | "monthly";
  interval?: number; // every N (days/weeks/months); default 1
  days?: number[];   // 0=Sun..6=Sat — used when freq === "weekly"
  date?: string;     // "YYYY-MM-DD" — required for one-off ("none"), optional anchor otherwise
  until?: string;    // "YYYY-MM-DD" — optional end date (inclusive)
};

// Mirrored block shape — round-tripped through `schedulingPreferences`.
type BlockedWindow = {
  start: string;            // "HH:MM"
  end: string;              // "HH:MM"
  label?: string;
  mirrorToCalendar?: boolean;
  calendarEventId?: string; // present once the block has been synced to Calendar
  recurrence?: Recurrence;  // how the mirrored event repeats
  colorId?: string;         // Google Calendar event color "1".."11"
};

type Prefs = {
  defaultDurationMin?: number;
  bufferMin?: number;
  maxPerDay?: number;
  blockedWindows?: BlockedWindow[];
};

const DAY_RRULE_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
// Google Calendar event color "1" = Lavender (#7986CB), the nearest preset to
// Dharma's brand indigo. Calendar only supports its fixed 11-color palette.
const DHARMA_EVENT_COLOR_ID = "1";
const BLOCK_DESCRIPTION =
  "Created by Dharma. Edit or remove this block in Configuration → Scheduling on your dashboard.";

function safeParse(raw: string | null | undefined): Prefs {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Prefs;
  } catch {
    return {};
  }
}

// "HH:MM" string -> { h: number, m: number }. Returns null if invalid.
function parseHHMM(s: string): { h: number; m: number } | null {
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
function effectiveRecurrence(block: BlockedWindow, activeDays: Set<number>): Recurrence {
  if (block.recurrence) return block.recurrence;
  return { freq: "weekly", interval: 1, days: [...activeDays] };
}

// Resolve the anchor date the first event instance lands on. Explicit `date`
// wins; otherwise we pick the next upcoming day that matches (for weekly, the
// next selected weekday; otherwise today).
function resolveAnchor(rec: Recurrence): Date | null {
  if (rec.date) return parseDate(rec.date);
  const now = new Date();
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
function buildRRule(rec: Recurrence): string | null {
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

function buildEventBody(
  block: BlockedWindow,
  activeDays: Set<number>,
  tz: string,
): calendar_v3.Schema$Event | null {
  const rec = effectiveRecurrence(block, activeDays);
  const start = parseHHMM(block.start);
  const end = parseHHMM(block.end);
  if (!start || !end) return null;
  const anchor = resolveAnchor(rec);
  if (!anchor) return null;

  const dateStr = `${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}-${pad(anchor.getDate())}`;
  // Calendar API takes wall-clock dateTime + a sibling timeZone field.
  const startDT = `${dateStr}T${pad(start.h)}:${pad(start.m)}:00`;
  const endDT = `${dateStr}T${pad(end.h)}:${pad(end.m)}:00`;

  const summary = block.label?.trim() ? block.label.trim() : "Dharma block";

  const event: calendar_v3.Schema$Event = {
    summary,
    description: BLOCK_DESCRIPTION,
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
function calendarErrorMessage(err: unknown): string {
  const e = err as {
    code?: number | string;
    message?: string;
    errors?: { message?: string }[];
    response?: { data?: { error?: { message?: string } | string } };
  };
  const apiErr = e?.response?.data?.error;
  const detail =
    (typeof apiErr === "object" ? apiErr?.message : apiErr) ||
    e?.errors?.[0]?.message ||
    e?.message ||
    "Unknown calendar error";
  return e?.code ? `${detail} (${e.code})` : detail;
}

type ReconcileResult = { blocks: BlockedWindow[]; errors: string[] };

// Reconcile the new blocks against the previous DB state by mirroring to
// Google Calendar. Returns the new blocks with calendarEventId populated for
// each mirrored block, plus any per-block errors. A block whose calendar
// write fails is reverted to un-mirrored (so the UI doesn't hang on
// "Adding…") and its error is reported back to the client.
async function reconcileBlocks(
  userId: string,
  oldBlocks: BlockedWindow[],
  newBlocks: BlockedWindow[],
  tz: string,
  activeDays: Set<number>,
): Promise<ReconcileResult> {
  const errors: string[] = [];
  const labelOf = (b: BlockedWindow) => b.label?.trim() || "Block";
  let calendar: calendar_v3.Calendar | null = null;
  async function getCalendar(): Promise<calendar_v3.Calendar | null> {
    if (calendar) return calendar;
    try {
      const { auth: oauth } = await makeAuthForUser(userId);
      calendar = google.calendar({ version: "v3", auth: oauth });
      return calendar;
    } catch (err) {
      console.error("[scheduling] Calendar client unavailable:", err);
      return null;
    }
  }

  // Index old blocks by eventId so we can match across reorders.
  const oldById = new Map<string, BlockedWindow>();
  for (const b of oldBlocks) {
    if (b.calendarEventId) oldById.set(b.calendarEventId, b);
  }

  // First pass: walk new blocks; create/update events. Build set of touched
  // event IDs so we can delete the leftovers afterward.
  const touchedIds = new Set<string>();
  const reconciled: BlockedWindow[] = [];

  for (const block of newBlocks) {
    const wantMirror = !!block.mirrorToCalendar;
    const prevId = block.calendarEventId ?? "";

    if (wantMirror) {
      const cal = await getCalendar();
      if (!cal) {
        // Calendar unavailable — revert the block so it doesn't hang on
        // "Adding…", and report it.
        reconciled.push({ ...block, mirrorToCalendar: false, calendarEventId: undefined });
        errors.push(
          `“${labelOf(block)}” couldn’t reach Google Calendar — try reconnecting your Google account.`,
        );
        continue;
      }
      const body = buildEventBody(block, activeDays, tz);
      if (!body) {
        reconciled.push({ ...block, mirrorToCalendar: false, calendarEventId: undefined });
        errors.push(`“${labelOf(block)}” has invalid times or recurrence; nothing was created.`);
        continue;
      }
      if (prevId) {
        // Patch existing event in case label/times/recurrence changed.
        try {
          await cal.events.patch({
            calendarId: "primary",
            eventId: prevId,
            requestBody: body,
          });
          touchedIds.add(prevId);
          reconciled.push({ ...block, calendarEventId: prevId });
        } catch (err) {
          // Likely deleted out-of-band — recreate.
          console.warn("[scheduling] patch failed, recreating:", err);
          try {
            const res = await cal.events.insert({
              calendarId: "primary",
              requestBody: body,
            });
            const newId = res.data.id ?? undefined;
            if (newId) touchedIds.add(newId);
            reconciled.push({ ...block, calendarEventId: newId });
          } catch (insertErr) {
            console.error("[scheduling] recreate insert failed:", insertErr);
            reconciled.push({ ...block, mirrorToCalendar: false, calendarEventId: undefined });
            errors.push(`“${labelOf(block)}”: ${calendarErrorMessage(insertErr)}`);
          }
        }
      } else {
        try {
          const res = await cal.events.insert({
            calendarId: "primary",
            requestBody: body,
          });
          const newId = res.data.id ?? undefined;
          if (newId) touchedIds.add(newId);
          reconciled.push({ ...block, calendarEventId: newId });
        } catch (err) {
          console.error("[scheduling] insert failed:", err);
          reconciled.push({ ...block, mirrorToCalendar: false, calendarEventId: undefined });
          errors.push(`“${labelOf(block)}”: ${calendarErrorMessage(err)}`);
        }
      }
    } else {
      // Not mirroring. If it previously had an event, delete it.
      if (prevId) {
        const cal = await getCalendar();
        if (cal) {
          try {
            await cal.events.delete({ calendarId: "primary", eventId: prevId });
          } catch (err) {
            // 404 / 410 already-gone is fine.
            console.warn("[scheduling] delete-on-untoggle ignored:", err);
          }
        }
      }
      const { calendarEventId, ...rest } = block;
      void calendarEventId;
      reconciled.push(rest);
    }
  }

  // Second pass: delete events that were in the old set but didn't get
  // touched this round (i.e. their block was deleted entirely).
  const cal = await getCalendar();
  if (cal) {
    for (const [eventId] of oldById) {
      if (touchedIds.has(eventId)) continue;
      try {
        await cal.events.delete({ calendarId: "primary", eventId });
      } catch (err) {
        console.warn("[scheduling] orphan delete ignored:", err);
      }
    }
  }

  return { blocks: reconciled, errors };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json()) as {
    enabled?: boolean;
    schedulingPreferences?: string;
    timezone?: string;
  };

  // Pull current state so we can reconcile blocks against the old eventIds.
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { schedulingPreferences: true, timezone: true },
  });
  const oldPrefs = safeParse(dbUser?.schedulingPreferences);
  const oldTz = dbUser?.timezone ?? "America/New_York";
  // Effective tz for this save = incoming if provided, else existing.
  const tz =
    typeof body.timezone === "string" && body.timezone.trim()
      ? body.timezone.trim()
      : oldTz;
  const tzChanged = tz !== oldTz;

  const data: {
    schedulingEnabled?: boolean;
    schedulingPreferences?: string;
    timezone?: string;
  } = {};
  if (typeof body.enabled === "boolean") data.schedulingEnabled = body.enabled;
  if (typeof body.timezone === "string" && body.timezone.trim()) data.timezone = body.timezone.trim();

  // Per-block calendar sync errors, surfaced to the client so failures aren't
  // silent (the UI otherwise hangs on "Adding…").
  let syncErrors: string[] = [];

  // Either the prefs changed, or the timezone changed and existing blocks
  // need their Calendar events re-anchored to the new tz. Treat both as
  // triggers for the reconciler.
  const prefsBody = typeof body.schedulingPreferences === "string"
    ? safeParse(body.schedulingPreferences)
    : oldPrefs;

  if (typeof body.schedulingPreferences === "string" || tzChanged) {
    const incoming = prefsBody;
    const oldBlocks = Array.isArray(oldPrefs.blockedWindows) ? oldPrefs.blockedWindows : [];
    const newBlocks = Array.isArray(incoming.blockedWindows) ? incoming.blockedWindows : [];

    // Only reconcile if any block needs mirroring or any old block had an
    // event ID (so we can clean up). Avoids a Calendar handshake on saves
    // that don't touch blocks.
    const needsCalendar =
      newBlocks.some((b) => b.mirrorToCalendar || b.calendarEventId) ||
      oldBlocks.some((b) => b.calendarEventId);

    if (needsCalendar) {
      const hours = await prisma.meetingHour.findMany({
        where: { userId },
        select: { dayOfWeek: true },
      });
      const activeDays = new Set<number>(hours.map((h) => h.dayOfWeek));
      if (activeDays.size === 0) {
        // Sensible default: Mon-Fri.
        [1, 2, 3, 4, 5].forEach((d) => activeDays.add(d));
      }
      const reconciled = await reconcileBlocks(userId, oldBlocks, newBlocks, tz, activeDays);
      incoming.blockedWindows = reconciled.blocks;
      syncErrors = reconciled.errors;
    }

    // Persist even when only tzChanged so the event-id-bearing prefs come
    // back patched. Avoid clobbering with empty data when nothing changed.
    if (typeof body.schedulingPreferences === "string" || needsCalendar) {
      data.schedulingPreferences = JSON.stringify(incoming);
    }
  }

  await prisma.user.update({ where: { id: userId }, data });

  return NextResponse.json({
    success: true,
    schedulingPreferences: data.schedulingPreferences ?? dbUser?.schedulingPreferences ?? null,
    syncErrors,
  });
}
