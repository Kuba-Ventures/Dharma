import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { pruneExpiredBlocks, todayISOInZone } from "../../../../lib/expiredBlocks";
import { safeParsePrefs } from "../../../../lib/blockMirror";
import { reconcileBlocks } from "../../../../lib/blockReconcile";

// Bound the function. The calendar-mirror path below makes live Google Calendar
// calls (each capped by withCalendarTimeout); maxDuration is the outer ceiling
// so the request can't stay open until the browser itself gives up ("loaded and
// timed out") with no server-side trace.
export const maxDuration = 30;

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
  const oldPrefs = safeParsePrefs(dbUser?.schedulingPreferences);
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
    ? safeParsePrefs(body.schedulingPreferences)
    : oldPrefs;

  if (typeof body.schedulingPreferences === "string" || tzChanged) {
    const incoming = prefsBody;
    const oldBlocks = Array.isArray(oldPrefs.blockedWindows) ? oldPrefs.blockedWindows : [];
    const rawNewBlocks = Array.isArray(incoming.blockedWindows) ? incoming.blockedWindows : [];

    // Auto-clear blocks whose event has fully passed: a one-off dated before
    // today, or a recurring block whose `until` end date is now in the past.
    // Dropping them here removes them from the persisted prefs, and — because
    // the reconcile pass below deletes any old event that no longer maps to a
    // surviving block — from the mirrored Google Calendar too. Judged in the
    // user's own time zone so a block clears on the right calendar day.
    const today = todayISOInZone(tz);
    const newBlocks = pruneExpiredBlocks(rawNewBlocks, today).kept;
    const prunedAny = newBlocks.length !== rawNewBlocks.length;
    incoming.blockedWindows = newBlocks;

    // Only reconcile if any block needs mirroring or any old block had an
    // event ID (so we can clean up — including deleting a just-expired block's
    // mirrored event). Avoids a Calendar handshake on saves that don't touch
    // blocks.
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
    // back patched, or when a tz-only save pruned an expired block. Avoid
    // clobbering with empty data when nothing changed.
    if (typeof body.schedulingPreferences === "string" || needsCalendar || prunedAny) {
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
