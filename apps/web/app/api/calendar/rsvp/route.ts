import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { verifyExtensionToken } from "../../../../lib/extension-token";
import { prisma } from "../../../../lib/prisma";
import { makeAuthForUser } from "../../../../lib/gmail";
import { logUsage } from "../../../../lib/usage";
import { ANTHROPIC_URL, anthropicHeaders } from "../../../../lib/anthropicEndpoint";
import { google } from "googleapis";

// RSVP to a Google Calendar invite OR generate a reschedule draft.
// Called by the Apps Script sidebar's Accept / Decline / Reschedule buttons
// after /api/emails/[id]/classify returned { kind: "invite", invite: {...} }.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return verifyExtensionToken(authHeader.slice(7)) ?? null;
  }
  if (authHeader?.startsWith("GoogleBearer ")) {
    const googleToken = authHeader.slice("GoogleBearer ".length);
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${googleToken}` },
    });
    if (userinfoRes.ok) {
      const { email } = (await userinfoRes.json()) as { email: string };
      const cred = await prisma.googleCredential.findUnique({ where: { email } });
      if (cred) return cred.userId;
    }
  }
  return null;
}

type RsvpBody = {
  iCalUID?: string;
  action: "accept" | "decline" | "tentative" | "reschedule";
  // For reschedule, the sidebar passes through event summary + start so we can
  // draft a context-aware reply without a second Gmail lookup.
  summary?: string;
  start?: string;
  organizer?: string;
};

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const body = (await req.json()) as RsvpBody;
  if (!body.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400, headers: CORS });
  }

  const googleCred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!googleCred) return NextResponse.json({ error: "Google not connected" }, { status: 400, headers: CORS });

  const { auth: oauthClient } = await makeAuthForUser(userId);
  const calendar = google.calendar({ version: "v3", auth: oauthClient });

  if (body.action === "reschedule") {
    // Generate a short context-aware reply proposing alternative times.
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500, headers: CORS });

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, toneProfile: true, toneExample: true, inferredSignOff: true },
    });
    const fullName = dbUser?.name?.trim() || dbUser?.email?.split("@")[0] || "the sender";
    const firstName = fullName.split(/\s+/)[0];

    const now = new Date();
    const prettyToday = now.toLocaleString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: "America/New_York",
    });
    const isoToday = now.toISOString().slice(0, 10);

    const toneBlock = dbUser?.toneProfile
      ? `Writing style to match exactly: ${dbUser.toneProfile}`
      : "Write in a direct, natural tone.";
    const signOffBlock = dbUser?.inferredSignOff?.trim()
      ? `End with exactly:\n${dbUser.inferredSignOff}`
      : `End with just "${firstName}"; no sign-off like "Best" or "Sincerely".`;

    const eventLine = body.summary && body.start
      ? `The original meeting is "${body.summary}" on ${body.start}.`
      : "The original meeting time does not work.";

    const prompt = `You are drafting a short email on behalf of ${fullName} to reschedule a meeting.

Today is ${prettyToday} (${isoToday}, America/New_York).
${eventLine}

${toneBlock}

Rules:
- 2-3 sentences max.
- Politely say the proposed time does not work and ask for alternative times.
- Do not propose specific times yourself (the user will fill those in).
- Never use em-dashes.
- No subject line.
- ${signOffBlock}

Reschedule reply:`;

    const claudeRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: anthropicHeaders(apiKey),
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      return NextResponse.json({ error: "Reschedule reply generation failed" }, { status: 502, headers: CORS });
    }

    const claudeData = (await claudeRes.json()) as {
      content: Array<{ text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };
    const text = (claudeData.content[0]?.text?.trim() ?? "").replace(/—/g, ",");
    if (claudeData.usage) {
      await logUsage({
        userId,
        eventType: "draft",
        model: "claude-haiku-4-5-20251001",
        usage: claudeData.usage,
      });
    }
    return NextResponse.json({ ok: true, kind: "reschedule", text }, { headers: CORS });
  }

  // accept / decline / tentative — patch the calendar event's attendee response
  if (!body.iCalUID) {
    return NextResponse.json({ error: "Missing iCalUID for RSVP" }, { status: 400, headers: CORS });
  }

  const responseStatus = body.action === "accept" ? "accepted"
    : body.action === "decline" ? "declined"
    : "tentative";

  // Find the event in the user's primary calendar by iCalUID.
  let events;
  try {
    events = await calendar.events.list({
      calendarId: "primary",
      iCalUID: body.iCalUID,
      maxResults: 1,
      showDeleted: false,
    });
  } catch (err) {
    console.error("[rsvp] events.list failed:", err);
    return NextResponse.json({ error: "Could not find event in your calendar" }, { status: 502, headers: CORS });
  }

  const event = events.data.items?.[0];
  if (!event?.id) {
    return NextResponse.json({ error: "Event not found in your calendar. The organizer may not have added you as an attendee." }, { status: 404, headers: CORS });
  }

  const me = googleCred.email.toLowerCase();
  const updatedAttendees = (event.attendees ?? []).map((a) =>
    (a.email ?? "").toLowerCase() === me
      ? { ...a, responseStatus }
      : a
  );

  // If we aren't already listed as an attendee, add ourselves with the response.
  // This covers invites where the organizer used a forwarded address.
  if (!updatedAttendees.some((a) => (a.email ?? "").toLowerCase() === me)) {
    updatedAttendees.push({ email: googleCred.email, responseStatus, self: true });
  }

  try {
    await calendar.events.patch({
      calendarId: "primary",
      eventId: event.id,
      sendUpdates: "all",
      requestBody: { attendees: updatedAttendees },
    });
  } catch (err) {
    console.error("[rsvp] events.patch failed:", err);
    return NextResponse.json({ error: "Could not update RSVP" }, { status: 502, headers: CORS });
  }

  return NextResponse.json({ ok: true, kind: body.action, responseStatus }, { headers: CORS });
}
