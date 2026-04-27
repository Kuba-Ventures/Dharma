import { google } from "googleapis";

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );
}

export async function createCalendarEvent(
  accessToken: string,
  refreshToken: string,
  opts: {
    title: string;
    startISO: string;
    endISO: string;
    attendeeEmail: string;
    organizerEmail: string;
  },
  onTokenRefresh?: (newToken: string, expiresAt: Date) => Promise<void>
): Promise<string | null> {
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  // Persist refreshed token if the caller provides a callback
  if (onTokenRefresh) {
    auth.on("tokens", (tokens) => {
      if (tokens.access_token) {
        const expiresAt = tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : new Date(Date.now() + 3600 * 1000);
        onTokenRefresh(tokens.access_token, expiresAt).catch((err) =>
          console.error("[calendar] Failed to persist refreshed token:", err)
        );
      }
    });
  }

  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: "all", // Google sends invite emails to all attendees automatically
    conferenceDataVersion: 1, // adds a Google Meet link
    requestBody: {
      summary: opts.title,
      start: { dateTime: opts.startISO },
      end: { dateTime: opts.endISO },
      attendees: [
        { email: opts.organizerEmail, responseStatus: "accepted" },
        { email: opts.attendeeEmail },
      ],
      conferenceData: {
        createRequest: {
          requestId: `dharma-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 60 },
          { method: "popup", minutes: 10 },
        ],
      },
    },
  });

  const meetLink = res.data.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video"
  )?.uri ?? null;

  console.log(
    `[calendar] Event created: "${opts.title}" at ${opts.startISO} — Meet: ${meetLink}`
  );

  return meetLink;
}
