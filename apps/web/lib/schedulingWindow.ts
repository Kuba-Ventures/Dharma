import { todayISOInZone } from "./expiredBlocks";

// Day-bucketing for the scheduling free-busy check.
//
// The window that decides which events the model sees must be computed in the
// user's zone (America/New_York), NOT the host's UTC. Bucketing in UTC made a
// late-evening Eastern send resolve "tomorrow" one calendar day late: an email
// sent 11:15 PM ET on Jul 30 is already Jul 31 in UTC, so "tomorrow" became
// Aug 1 and the busy check looked at the wrong day, silently confirming a slot
// that was actually booked the day before.

const TZ = "America/New_York";

// Add n calendar days to a "YYYY-MM-DD" civil date. Pure calendar arithmetic,
// zone-agnostic (no DST involved — we're moving whole days).
export function addDaysCivil(civil: string, n: number): string {
  const [y, m, d] = civil.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// The UTC instant of local midnight (00:00) on `civil` in `tz`. Derives the
// zone's actual offset at that instant by formatting, so it's correct across
// DST (EDT -04:00 in summer, EST -05:00 in winter).
export function zonedMidnightUTC(civil: string, tz: string = TZ): Date {
  const [y, m, d] = civil.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcGuess));
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offset = asUTC - utcGuess; // zone offset east of UTC, in ms
  return new Date(utcGuess - offset);
}

// Day-of-week (0=Sun..6=Sat) of a civil date, zone-agnostic (noon avoids any
// edge near midnight).
function civilDayOfWeek(civil: string): number {
  const [y, m, d] = civil.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

// Resolve the free-busy window from relative words in the email, bucketing days
// in `tz`. `anchor` is the moment relative words resolve against — the email's
// sent time — so a reply written later still reads "tomorrow" as the day after
// the email was sent.
export function getRelevantTimeWindow(
  emailText: string,
  anchor: Date,
  tz: string = TZ,
): { timeMin: string; timeMax: string } {
  const lower = emailText.toLowerCase();
  const anchorDay = todayISOInZone(tz, anchor); // "YYYY-MM-DD" in tz

  const dayWindow = (civil: string) => ({
    timeMin: zonedMidnightUTC(civil, tz).toISOString(),
    timeMax: zonedMidnightUTC(addDaysCivil(civil, 1), tz).toISOString(),
  });
  const spanWindow = (startCivil: string, days: number) => ({
    timeMin: zonedMidnightUTC(startCivil, tz).toISOString(),
    timeMax: zonedMidnightUTC(addDaysCivil(startCivil, days), tz).toISOString(),
  });

  if (/\btoday\b/.test(lower)) return dayWindow(anchorDay);
  if (/\btomorrow\b/.test(lower)) return dayWindow(addDaysCivil(anchorDay, 1));

  const dow = civilDayOfWeek(anchorDay);

  if (/\bnext week\b/.test(lower)) {
    const daysToMon = ((1 - dow + 7) % 7) || 7;
    return spanWindow(addDaysCivil(anchorDay, daysToMon), 5);
  }
  if (/\bthis week\b/.test(lower)) {
    const daysToFri = (5 - dow + 7) % 7;
    return spanWindow(anchorDay, daysToFri + 1);
  }

  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < days.length; i++) {
    if (new RegExp(`\\b${days[i]}\\b`).test(lower)) {
      const ahead = ((i - dow + 7) % 7) || 7;
      return dayWindow(addDaysCivil(anchorDay, ahead));
    }
  }

  // Default: the next 3 days from the anchor day.
  return spanWindow(anchorDay, 3);
}
