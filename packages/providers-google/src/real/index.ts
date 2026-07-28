import type { TimeSlot } from "@dharma/types";
import { type CalendarProvider, visibleCalendarIds } from "@dharma/calendar-core";
import { google } from "googleapis";

// Google's free-busy API accepts at most 50 calendars per query. Users with
// more visible calendars than this are extraordinarily rare; we cap rather
// than page, since the tail is almost always low-signal subscribed calendars.
const FREEBUSY_MAX_ITEMS = 50;

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export class RealGoogleProvider implements CalendarProvider {
  constructor(
    private readonly email: string,
    private readonly tokens: GoogleTokens,
    private readonly onTokenRefreshed?: (t: { accessToken: string; expiresAt: Date }) => Promise<void>
  ) {}

  async getEvents(start: Date, end: Date): Promise<TimeSlot[]> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: this.tokens.accessToken,
      refresh_token: this.tokens.refreshToken,
      expiry_date: this.tokens.expiresAt.getTime(),
    });

    // Persist new tokens whenever googleapis refreshes them automatically
    oauth2Client.on("tokens", async (newTokens) => {
      if (newTokens.access_token && this.onTokenRefreshed) {
        await this.onTokenRefreshed({
          accessToken: newTokens.access_token,
          expiresAt: new Date(newTokens.expiry_date ?? Date.now() + 3600 * 1000),
        });
      }
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Read busy time from every calendar the user has visible in Google
    // Calendar (Work, Personal, …), not just primary. Otherwise Dharma offers
    // meeting slots that collide with events it can't see and double-books
    // (issue #74). If the calendar list is unavailable, fall back to primary so
    // scheduling still works rather than failing closed.
    let calendarIds: string[] = ["primary"];
    try {
      const list = await calendar.calendarList.list({
        minAccessRole: "reader",
        maxResults: 250,
      });
      calendarIds = visibleCalendarIds(list.data.items ?? []);
    } catch (err) {
      console.error(
        "[RealGoogleProvider] calendarList.list failed; checking primary only:",
        err,
      );
    }

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: calendarIds.slice(0, FREEBUSY_MAX_ITEMS).map((id) => ({ id })),
      },
    });

    // Merge busy periods across all queried calendars. Overlaps are fine —
    // getAvailableSlots only checks whether a candidate slot intersects *any*
    // busy period, so it doesn't matter that the ranges aren't coalesced.
    const calendars = response.data.calendars ?? {};
    const busy: TimeSlot[] = [];
    for (const cal of Object.values(calendars)) {
      for (const period of cal?.busy ?? []) {
        if (period.start && period.end) {
          busy.push({ start: new Date(period.start), end: new Date(period.end) });
        }
      }
    }

    return busy;
  }
}
