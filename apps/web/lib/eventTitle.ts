import type { calendar_v3 } from "googleapis";

// The label to show for a calendar event in the dashboard.
//
// On a calendar the user only has *reader* access to (e.g. a personal calendar
// shared into their work account as "See all event details", not writer/owner),
// Google hides the details of any event marked *private*: the event still comes
// back — so the busy time is visible — but with no `summary` and
// `visibility: "private"`. Google's own UIs render these as "Busy". Do the same
// instead of the misleading "(no title)", which reads like the event is broken.
//
// Order matters: a private event the user *can* fully see (writer/owner access)
// keeps its real `summary`, so the summary check comes first and only
// detail-hidden events fall through to "Busy". A genuinely untitled but visible
// event stays "(no title)".
export function eventDisplayTitle(
  event: Pick<calendar_v3.Schema$Event, "summary" | "visibility">,
): string {
  const summary = event.summary?.trim();
  if (summary) return summary;
  if (event.visibility === "private") return "Busy";
  return "(no title)";
}
