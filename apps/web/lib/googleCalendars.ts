import type { calendar_v3 } from "googleapis";
import { visibleCalendarIds } from "@dharma/calendar-core";

// Resolve the calendar IDs that make up the user's *visible* schedule — the
// calendars ticked (shown) in their Google Calendar UI — so surfaces that read
// their schedule see Work / Personal meetings, not just `primary` (issue #74).
//
// Never throws: on any calendarList failure it logs and falls back to
// `["primary"]`, matching the pre-#74 single-calendar behavior.
export async function listVisibleCalendarIds(
  calendar: calendar_v3.Calendar,
): Promise<string[]> {
  try {
    const list = await calendar.calendarList.list({
      minAccessRole: "reader",
      maxResults: 250,
    });
    return visibleCalendarIds(list.data.items ?? []);
  } catch (err) {
    console.error("[calendars] calendarList.list failed; using primary only:", err);
    return ["primary"];
  }
}
