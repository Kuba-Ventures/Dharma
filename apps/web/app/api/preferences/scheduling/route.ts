import { NextResponse } from "next/server";
import { google, type calendar_v3 } from "googleapis";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { makeAuthForUser } from "../../../../lib/gmail";

// Mirrored block shape — round-tripped through `schedulingPreferences`.
type BlockedWindow = {
  start: string;            // "HH:MM"
  end: string;              // "HH:MM"
  label?: string;
  mirrorToCalendar?: boolean;
  calendarEventId?: string; // present once the block has been synced to Calendar
};

type Prefs = {
  defaultDurationMin?: number;
  bufferMin?: number;
  maxPerDay?: number;
  blockedWindows?: BlockedWindow[];
};

const DAY_RRULE_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
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

// Build the first event instance for a recurring block. Picks the next
// upcoming active day so the recurrence anchors sensibly.
function nextOccurrence(activeDays: Set<number>, startHHMM: string, tz: string): string | null {
  const start = parseHHMM(startHHMM);
  if (!start) return null;
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const cand = new Date(now);
    cand.setDate(now.getDate() + i);
    if (!activeDays.has(cand.getDay())) continue;
    // Format YYYY-MM-DDTHH:MM:SS (Calendar API treats as local with the
    // sibling timeZone field).
    const y = cand.getFullYear();
    const mo = String(cand.getMonth() + 1).padStart(2, "0");
    const d = String(cand.getDate()).padStart(2, "0");
    const hh = String(start.h).padStart(2, "0");
    const mm = String(start.m).padStart(2, "0");
    // For "today", skip if start has already passed in the user's timezone-ish
    // local — we approximate using server time. Worst case: the block starts
    // a few hours in the past on the first day, which Calendar accepts.
    if (i === 0) {
      const startToday = new Date(cand);
      startToday.setHours(start.h, start.m, 0, 0);
      if (startToday < now) continue;
    }
    // Suppressing the explicit tz here; Calendar API takes the dateTime
    // local + timeZone separately, so this string is wall-clock.
    return `${y}-${mo}-${d}T${hh}:${mm}:00`;
    tz; // silence unused-warning in some lint configs
  }
  return null;
}

function buildEventBody(
  block: BlockedWindow,
  activeDays: Set<number>,
  tz: string,
): calendar_v3.Schema$Event | null {
  const startDT = nextOccurrence(activeDays, block.start, tz);
  if (!startDT) return null;
  const endDT = nextOccurrence(activeDays, block.end, tz);
  if (!endDT) return null;

  // BYDAY list from active days (skip if all 7 — then no BYDAY clause).
  const codes = [...activeDays].sort().map((d) => DAY_RRULE_CODES[d]);
  const byday = codes.length === 7 ? "" : `;BYDAY=${codes.join(",")}`;

  const summary = block.label?.trim() ? block.label.trim() : "Dharma block";

  return {
    summary,
    description: BLOCK_DESCRIPTION,
    start: { dateTime: startDT, timeZone: tz },
    end: { dateTime: endDT, timeZone: tz },
    recurrence: [`RRULE:FREQ=WEEKLY${byday}`],
    transparency: "opaque",
    reminders: { useDefault: false, overrides: [] },
  };
}

// Reconcile the new blocks against the previous DB state by mirroring to
// Google Calendar. Returns the new blocks with calendarEventId populated
// for each mirrored block. Failures are swallowed per-block so one bad
// row doesn't take down the whole save.
async function reconcileBlocks(
  userId: string,
  oldBlocks: BlockedWindow[],
  newBlocks: BlockedWindow[],
  tz: string,
  activeDays: Set<number>,
): Promise<BlockedWindow[]> {
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
        // Calendar unavailable — keep the block but drop the eventId so we
        // retry next save instead of pretending we synced.
        reconciled.push({ ...block, calendarEventId: undefined });
        continue;
      }
      const body = buildEventBody(block, activeDays, tz);
      if (!body) {
        reconciled.push({ ...block, calendarEventId: undefined });
        continue;
      }
      if (prevId) {
        // Patch existing event in case label/times changed.
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
            reconciled.push({ ...block, calendarEventId: undefined });
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
          reconciled.push({ ...block, calendarEventId: undefined });
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

  return reconciled;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json()) as { enabled?: boolean; schedulingPreferences?: string };

  // Pull current state so we can reconcile blocks against the old eventIds.
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { schedulingPreferences: true, timezone: true },
  });
  const oldPrefs = safeParse(dbUser?.schedulingPreferences);
  const tz = dbUser?.timezone ?? "America/New_York";

  const data: { schedulingEnabled?: boolean; schedulingPreferences?: string } = {};
  if (typeof body.enabled === "boolean") data.schedulingEnabled = body.enabled;

  if (typeof body.schedulingPreferences === "string") {
    const incoming = safeParse(body.schedulingPreferences);
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
      incoming.blockedWindows = reconciled;
    }

    data.schedulingPreferences = JSON.stringify(incoming);
  }

  await prisma.user.update({ where: { id: userId }, data });

  return NextResponse.json({
    success: true,
    schedulingPreferences: data.schedulingPreferences ?? dbUser?.schedulingPreferences ?? null,
  });
}
