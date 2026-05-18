import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { makeAuthForUser } from "../../../../../lib/gmail";
import { prisma } from "../../../../../lib/prisma";
import { google } from "googleapis";

export interface UpcomingEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
}

export interface SchedulePatterns {
  preferredWindow: string;
  preferredDays: string;
  typicalDuration: string;
  meetingsPerWeek: string;
  insight: string;
}

async function analyzePatterns(events: { start: string; end: string }[]): Promise<SchedulePatterns> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || events.length < 3) {
    return {
      preferredWindow: "Not enough data",
      preferredDays: "Not enough data",
      typicalDuration: "Not enough data",
      meetingsPerWeek: "N/A",
      insight: "Sync more calendar activity to see your scheduling patterns.",
    };
  }

  const lines = events
    .map((e) => `${new Date(e.start).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })} – ${new Date(e.end).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}`)
    .join("\n");

  const prompt = `Analyze these calendar meeting times and identify the user's scheduling preferences.

Meeting history (most recent first):
${lines}

Return a JSON object with exactly these fields:
{
  "preferredWindow": "A 1-2 sentence description of when they prefer to meet based strictly on the data above. State the actual time range they cluster in, describe it (e.g. 'late morning' or 'early afternoon'), then note what time slots they appear to avoid (early morning, late afternoon, evening). Format: 'Prefers [time range] ([description of those hours]); avoids [times not seen in data].' Be specific with actual times from the data.",
  "preferredDays": "The days they most often schedule meetings, e.g. 'Tuesday – Thursday' or 'Weekdays'",
  "typicalDuration": "Most common meeting length, e.g. '30 minutes' or '1 hour'",
  "meetingsPerWeek": "Average number of meetings per week as a range, e.g. '3–4'",
  "insight": "One concise sentence describing their overall scheduling style, starting with 'Prefers' or 'Tends to'. Do not mention their name."
}

JSON only, no other text.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = (await res.json()) as { content: Array<{ text: string }> };
  const match = data.content[0]?.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in response");
  return JSON.parse(match[0]) as SchedulePatterns;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { auth: oauthClient } = await makeAuthForUser(session.user.id);
  const calendar = google.calendar({ version: "v3", auth: oauthClient });

  const now = new Date().toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [upcomingRes, pastRes, user] = await Promise.all([
    calendar.events.list({
      calendarId: "primary",
      timeMin: now,
      maxResults: 5,
      orderBy: "startTime",
      singleEvents: true,
      eventTypes: ["default"],
    }),
    calendar.events.list({
      calendarId: "primary",
      timeMin: thirtyDaysAgo,
      timeMax: now,
      maxResults: 60,
      singleEvents: true,
      eventTypes: ["default"],
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { schedulingPreferences: true },
    }),
  ]);

  const upcoming: UpcomingEvent[] = (upcomingRes.data.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .map((e) => ({
      id: e.id ?? "",
      title: e.summary ?? "Untitled",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      isAllDay: !e.start?.dateTime,
    }));

  const pastForAnalysis = (pastRes.data.items ?? [])
    .filter((e) => e.status !== "cancelled" && e.start?.dateTime)
    .map((e) => ({ start: e.start!.dateTime!, end: e.end!.dateTime! }));

  let patterns: SchedulePatterns;
  try {
    patterns = await analyzePatterns(pastForAnalysis);
  } catch {
    patterns = {
      preferredWindow: "Analysis unavailable",
      preferredDays: "N/A",
      typicalDuration: "N/A",
      meetingsPerWeek: "N/A",
      insight: "Could not analyse calendar patterns.",
    };
  }

  return NextResponse.json({ upcoming, patterns, savedPreferences: user?.schedulingPreferences ?? null });
}
