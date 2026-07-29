// DB- and Google-Calendar-touching reconcile for scheduling blocks.
//
// Builds on the pure builders in blockMirror.ts. Kept separate from them (and
// out of any unit test's import graph) because it pulls in prisma + googleapis
// at runtime. Two entry points:
//   - reconcileBlocks: diff a new block set against the old one and mirror the
//     changes to Calendar. Used by the scheduling save route.
//   - resyncUserCalendar: reload a user's stored blocks and re-mirror them —
//     recreating events that drifted out of Calendar — behind the Scheduling
//     card's "Resync calendar" button (issue #84).

import { google, type calendar_v3 } from "googleapis";
import { prisma } from "./prisma";
import { makeAuthForUser } from "./gmail";
import { withCalendarTimeout } from "./calendarTimeout";
import { pruneExpiredBlocks, nowISOInZone } from "./expiredBlocks";
import {
  buildEventBody,
  calendarErrorMessage,
  safeParsePrefs,
  type BlockedWindow,
} from "./blockMirror";

export type ReconcileResult = { blocks: BlockedWindow[]; errors: string[] };

// Reconcile the new blocks against the previous DB state by mirroring to
// Google Calendar. Returns the new blocks with calendarEventId populated for
// each mirrored block, plus any per-block errors. A block whose calendar
// write fails is reverted to un-mirrored (so the UI doesn't hang on
// "Adding…") and its error is reported back to the client.
export async function reconcileBlocks(
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
          await withCalendarTimeout(
            (signal) =>
              cal.events.patch(
                { calendarId: "primary", eventId: prevId, requestBody: body },
                { signal },
              ),
            "calendar patch",
          );
          touchedIds.add(prevId);
          reconciled.push({ ...block, calendarEventId: prevId });
        } catch (err) {
          // Likely deleted out-of-band — recreate.
          console.warn("[scheduling] patch failed, recreating:", err);
          try {
            const res = await withCalendarTimeout(
              (signal) =>
                cal.events.insert({ calendarId: "primary", requestBody: body }, { signal }),
              "calendar insert (recreate)",
            );
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
          const res = await withCalendarTimeout(
            (signal) =>
              cal.events.insert({ calendarId: "primary", requestBody: body }, { signal }),
            "calendar insert",
          );
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
            await withCalendarTimeout(
              (signal) =>
                cal.events.delete({ calendarId: "primary", eventId: prevId }, { signal }),
              "calendar delete",
            );
          } catch (err) {
            // 404 / 410 already-gone (or a timeout) is fine.
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
        await withCalendarTimeout(
          (signal) => cal.events.delete({ calendarId: "primary", eventId }, { signal }),
          "calendar orphan delete",
        );
      } catch (err) {
        console.warn("[scheduling] orphan delete ignored:", err);
      }
    }
  }

  return { blocks: reconciled, errors };
}

export type ResyncResult = {
  // Whether any calendar work was needed (blocks are mirrored or had events).
  reconciled: boolean;
  // How many blocks are currently mirrored to the calendar after the resync.
  mirroredCount: number;
  // Per-block errors, same shape the save route surfaces.
  syncErrors: string[];
};

// Re-mirror a user's stored blocks to Google Calendar from scratch: recreate
// events that drifted (deleted out-of-band, a save that never reached
// Calendar) and drop fully-passed blocks. Idempotent — re-mirroring a block
// whose event still exists just patches it in place. This is what makes the
// Scheduling card's "Resync calendar" button actually resync (issue #84);
// before, it only re-armed the Gmail watch and left block events untouched.
export async function resyncUserCalendar(userId: string): Promise<ResyncResult> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { schedulingPreferences: true, timezone: true },
  });
  const prefs = safeParsePrefs(dbUser?.schedulingPreferences);
  const tz = dbUser?.timezone ?? "America/New_York";
  const oldBlocks = Array.isArray(prefs.blockedWindows) ? prefs.blockedWindows : [];

  // Same auto-clear rule as the save path: a fully-passed block is dropped
  // (and its mirrored event deleted by the reconcile's orphan pass).
  const newBlocks = pruneExpiredBlocks(oldBlocks, nowISOInZone(tz)).kept;
  const prunedAny = newBlocks.length !== oldBlocks.length;

  const needsCalendar =
    newBlocks.some((b) => b.mirrorToCalendar || b.calendarEventId) ||
    oldBlocks.some((b) => b.calendarEventId);

  if (!needsCalendar) {
    // No mirrored blocks — nothing to re-create. Persist a prune if one
    // happened so the card reflects it, then we're done.
    if (prunedAny) {
      prefs.blockedWindows = newBlocks;
      await prisma.user.update({
        where: { id: userId },
        data: { schedulingPreferences: JSON.stringify(prefs) },
      });
    }
    return { reconciled: false, mirroredCount: 0, syncErrors: [] };
  }

  const hours = await prisma.meetingHour.findMany({
    where: { userId },
    select: { dayOfWeek: true },
  });
  const activeDays = new Set<number>(hours.map((h) => h.dayOfWeek));
  if (activeDays.size === 0) {
    // Sensible default: Mon-Fri.
    [1, 2, 3, 4, 5].forEach((d) => activeDays.add(d));
  }

  const result = await reconcileBlocks(userId, oldBlocks, newBlocks, tz, activeDays);
  prefs.blockedWindows = result.blocks;
  await prisma.user.update({
    where: { id: userId },
    data: { schedulingPreferences: JSON.stringify(prefs) },
  });

  return {
    reconciled: true,
    mirroredCount: result.blocks.filter((b) => b.mirrorToCalendar).length,
    syncErrors: result.errors,
  };
}
