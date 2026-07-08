import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { verifyExtensionToken } from "../../../../../lib/extension-token";
import { prisma } from "../../../../../lib/prisma";
import { markAddonInstalled } from "../../../../../lib/addonInstall";
import { makeAuthForUser } from "../../../../../lib/gmail";
import { google } from "googleapis";

// Calendar-invite detection. Returns one of:
//   { kind: "invite", invite: { ... } } — Google/Outlook/Apple structured invite
//   { kind: "prose" }                    — any other email (sidebar shows tone strip)
// The sidebar branches on this to show Accept/Decline/Reschedule vs Draft Reply.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const INVITE_SENDER_DOMAINS = [
  "calendar-notification@google.com",
  "noreply@calendar.google.com",
  "no-reply@calendar.google.com",
];

const INVITE_SUBJECT_PREFIXES = [
  "invitation:",
  "updated invitation:",
  "canceled event:",
  "cancelled event:",
];

type GmailPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[];
};

function findCalendarPart(payload: GmailPart | undefined | null, depth = 0): { data: string; method?: string } | null {
  if (!payload || depth > 6) return null;
  const mime = (payload.mimeType ?? "").toLowerCase();
  if (mime === "text/calendar" || mime === "application/ics") {
    const raw = payload.body?.data ?? "";
    if (raw) {
      const data = Buffer.from(raw, "base64").toString("utf-8");
      const methodMatch = data.match(/^METHOD:(\w+)/im);
      return { data, method: methodMatch?.[1]?.toUpperCase() };
    }
  }
  for (const part of payload.parts ?? []) {
    const found = findCalendarPart(part, depth + 1);
    if (found) return found;
  }
  return null;
}

function parseICalField(ics: string, field: string): string | undefined {
  // ICS lines: FIELD;PARAMS:VALUE or FIELD:VALUE. We strip the params for simplicity.
  const re = new RegExp(`^${field}(?:;[^:\\r\\n]*)?:(.+)$`, "im");
  const m = ics.match(re);
  return m?.[1]?.trim();
}

function formatICalDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  // ICS dates: YYYYMMDDTHHMMSSZ or YYYYMMDD. Convert to ISO 8601.
  const dt = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?/);
  if (!dt) return raw;
  const [, y, mo, d, h, mi, s] = dt;
  if (h && mi && s) return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  return `${y}-${mo}-${d}`;
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
      if (cred) {
        void markAddonInstalled(cred.userId).catch(() => {});
        return cred.userId;
      }
    }
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: messageId } = await params;
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const googleCred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!googleCred) return NextResponse.json({ error: "Google not connected" }, { status: 400, headers: CORS });

  const { auth: oauthClient } = await makeAuthForUser(userId);
  const gmail = google.gmail({ version: "v1", auth: oauthClient });

  let res;
  try {
    res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  } catch (err) {
    console.error("[classify] gmail.messages.get failed:", err);
    return NextResponse.json({ kind: "prose" }, { headers: CORS }); // safe default
  }

  const msg = res.data;
  const headers = msg.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

  const from = get("From").toLowerCase();
  const subject = get("Subject").toLowerCase();

  const senderMatch = INVITE_SENDER_DOMAINS.some((s) => from.includes(s));
  const subjectMatch = INVITE_SUBJECT_PREFIXES.some((p) => subject.startsWith(p));
  const calendarPart = findCalendarPart(msg.payload as GmailPart);

  // Any one of these signals is enough to treat as an invite.
  if (!senderMatch && !subjectMatch && !calendarPart) {
    return NextResponse.json({ kind: "prose" }, { headers: CORS });
  }

  const invite: {
    iCalUID?: string;
    organizer?: string;
    summary?: string;
    start?: string;
    end?: string;
    method?: string;
    isCancellation?: boolean;
  } = {};

  if (calendarPart) {
    const ics = calendarPart.data;
    invite.iCalUID = parseICalField(ics, "UID");
    const organizerRaw = parseICalField(ics, "ORGANIZER");
    // ORGANIZER values look like "MAILTO:foo@bar.com"
    invite.organizer = organizerRaw?.replace(/^mailto:/i, "");
    invite.summary = parseICalField(ics, "SUMMARY");
    invite.start = formatICalDate(parseICalField(ics, "DTSTART"));
    invite.end = formatICalDate(parseICalField(ics, "DTEND"));
    invite.method = calendarPart.method;
    invite.isCancellation = calendarPart.method === "CANCEL" || subject.startsWith("canceled") || subject.startsWith("cancelled");
  } else {
    // Subject-only fallback: still flag as invite, but we won't have event metadata
    // for RSVP. The sidebar can show a generic "this looks like a calendar event"
    // card with a soft Draft Reply fallback.
    invite.summary = get("Subject");
    invite.isCancellation = subject.startsWith("canceled") || subject.startsWith("cancelled");
  }

  return NextResponse.json({ kind: "invite", invite }, { headers: CORS });
}
