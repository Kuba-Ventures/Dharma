import type { calendar_v3 } from "googleapis";
import { isInvalidGrant } from "./googleErrors";

// The dashboard Scheduling card fans out one events.list per visible calendar
// and merges the results (issue #74). This helper folds those settled results
// into a single event list.
//
// The distinction that matters: a *single* calendar being unreadable — a
// subscribed calendar that 403s, a transient blip on one of several — is
// tolerated (logged and skipped) so one bad calendar doesn't blank the whole
// card. But an `invalid_grant` is NOT a per-calendar failure: the stored Google
// grant is dead, so every calendar rejects identically. Swallowing that would
// return an empty list and render a misleading "0 meetings this week" instead
// of the actionable reconnect prompt (issues #75 / #91). So rethrow it and let
// the caller's try/catch surface calendarError="reconnect".
//
// Structural result type so callers can pass raw googleapis
// `events.list` responses without adapting them.
type EventsListLike = { data: { items?: calendar_v3.Schema$Event[] | null } };

export function mergeCalendarEvents(
  results: PromiseSettledResult<EventsListLike>[],
): calendar_v3.Schema$Event[] {
  const events: calendar_v3.Schema$Event[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      events.push(...(r.value.data.items ?? []));
    } else if (isInvalidGrant(r.reason)) {
      // Whole-grant failure — surface it, don't bury it under a fake "0".
      throw r.reason;
    } else {
      console.error("[dashboard] events.list failed for a calendar:", r.reason);
    }
  }
  return events;
}
