export const maxDuration = 30;

import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { verifyExtensionToken } from "../../../../lib/extension-token";
import { prisma } from "../../../../lib/prisma";
import { makeAuthForUser, createDraft } from "../../../../lib/gmail";
import { google } from "googleapis";

const TONE_INSTRUCTIONS: Record<string, string> = {
  "My Tone": "Write in a natural, professional but personal tone — direct, warm, not overly formal. Mirror the style of someone who has worked in business for years and writes clearly without corporate jargon.",
  Concise: "Write a brief, direct reply. No filler words, no pleasantries beyond a quick greeting. Get to the point in 2-4 sentences.",
  "Formal / Legal": "Write in formal, precise language appropriate for legal or official correspondence. Use complete sentences, avoid contractions, and maintain a professional distance.",
  "Casual / Friendly": "Write in a warm, conversational tone. It's okay to be a little informal — use contractions, keep it light and approachable.",
};

function getRelevantTimeWindow(emailText: string, now: Date): { timeMin: string; timeMax: string } {
  const lower = emailText.toLowerCase();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const add = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

  if (/\btoday\b/.test(lower))
    return { timeMin: now.toISOString(), timeMax: add(today, 1).toISOString() };

  if (/\btomorrow\b/.test(lower))
    return { timeMin: add(today, 1).toISOString(), timeMax: add(today, 2).toISOString() };

  if (/\bnext week\b/.test(lower)) {
    const daysToMon = ((1 - today.getDay() + 7) % 7) || 7;
    const mon = add(today, daysToMon);
    return { timeMin: mon.toISOString(), timeMax: add(mon, 5).toISOString() };
  }

  if (/\bthis week\b/.test(lower)) {
    const daysToFri = (5 - today.getDay() + 7) % 7;
    return { timeMin: now.toISOString(), timeMax: add(today, daysToFri + 1).toISOString() };
  }

  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  for (let i = 0; i < days.length; i++) {
    if (new RegExp(`\\b${days[i]}\\b`).test(lower)) {
      const ahead = ((i - today.getDay() + 7) % 7) || 7;
      const target = add(today, ahead);
      return { timeMin: target.toISOString(), timeMax: add(target, 1).toISOString() };
    }
  }

  // Default: next 3 days
  return { timeMin: now.toISOString(), timeMax: add(today, 3).toISOString() };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  try {
  const { threadId, tone, draftText } = await req.json() as { threadId: string; tone?: string; draftText?: string | null };

  let userId: string | undefined;
  const session = await auth();
  if (session?.user?.id) {
    userId = session.user.id;
  } else {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      userId = verifyExtensionToken(authHeader.slice(7)) ?? undefined;
    } else if (authHeader?.startsWith("GoogleBearer ")) {
      const googleToken = authHeader.slice("GoogleBearer ".length);
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${googleToken}` },
      });
      if (userinfoRes.ok) {
        const { email } = await userinfoRes.json() as { email: string };
        const cred = await prisma.googleCredential.findUnique({ where: { email } });
        if (cred) userId = cred.userId;
      }
    }
  }
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const googleCred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!googleCred) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

  const { auth: oauthClient } = await makeAuthForUser(userId);
  const gmail = google.gmail({ version: "v1", auth: oauthClient });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  let prompt: string;

  if (draftText) {
    // Polish mode — no thread needed
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { toneProfile: true, toneExample: true },
    });

    const toneBlock = user?.toneProfile
      ? `Writing style to match exactly: ${user.toneProfile}${user.toneExample ? `\n\nExample:\n${user.toneExample.slice(0, 300)}` : ""}`
      : "Write in a direct, natural, professional tone.";

    prompt = `You are polishing a draft email on behalf of Finley Underwood. Rewrite their notes into a clean, complete email in their exact writing style.

${toneBlock}

Rules:
- Keep all the same intent and key points — do not add information not implied by the notes.
- No generic openers like "Thanks for reaching out" or "Hope you're well".
- No sign-off name at the end — the sender's signature handles that.
- No subject line.
- Keep it concise.
- If there is an opening line, leave one blank line before the body, and one blank line before the closing.

Their notes/draft:
${draftText.slice(0, 1000)}

Polished email:`;

  } else {
    // Thread-dependent modes — fetch thread now
    let thread;
    try {
      thread = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
    } catch (err: any) {
      const message = err?.errors?.[0]?.message ?? err?.message ?? "Gmail API error";
      console.error("[thread-draft] gmail.threads.get failed:", message, "threadId:", threadId);
      return NextResponse.json({ error: `Gmail error: ${message}`, threadId }, { status: 502 });
    }
    const messages = thread.data.messages ?? [];
    if (!messages.length) return NextResponse.json({ error: "Thread empty" }, { status: 404 });

    const msg = messages[messages.length - 1];
    const headers = msg.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    const from = get("From");
    const subject = get("Subject") || "(no subject)";

    function extractBody(payload: typeof msg.payload): string {
      if (!payload) return "";
      if (payload.mimeType === "text/plain" && payload.body?.data) {
        return Buffer.from(payload.body.data, "base64").toString("utf-8");
      }
      if (payload.parts) {
        for (const part of payload.parts) {
          const text = extractBody(part);
          if (text) return text;
        }
      }
      return "";
    }

    const emailBody = extractBody(msg.payload) || msg.snippet || "";
    const toneKey = tone ?? "Concise";

    if (toneKey === "Scheduling") {
    const now = new Date();
    const { timeMin, timeMax } = getRelevantTimeWindow(emailBody, now);

    const [calendarRes, user] = await Promise.all([
      google.calendar({ version: "v3", auth: oauthClient }).events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        maxResults: 10,
        singleEvents: true,
        orderBy: "startTime",
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { schedulingPreferences: true, toneProfile: true, toneExample: true } }),
    ]);

    const TZ = "America/New_York";
    const busyList = (calendarRes.data.items ?? [])
      .filter((e) => e.status !== "cancelled" && e.start?.dateTime)
      .map((e) => {
        const start = new Date(e.start!.dateTime!);
        const end = new Date(e.end!.dateTime!);
        return `• ${start.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ })} - ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ })} ET: busy`;
      })
      .join("\n") || "No events in this window";

    const toneBlock = user?.toneProfile
      ? `Writing style to match exactly: ${user.toneProfile}${user.toneExample ? `\n\nExample of how this person writes:\n${user.toneExample.slice(0, 300)}` : ""}`
      : "Write in a direct, natural tone.";

    const prefsLine = user?.schedulingPreferences
      ? `\nScheduling preferences: ${user.schedulingPreferences}`
      : "";

    prompt = `You are drafting a scheduling reply on behalf of Finley Underwood. Your top priority is matching their writing style exactly.

${toneBlock}

Scheduling rules:
- Check whether any time proposed in the email conflicts with the busy times below.
- If the proposed time IS blocked, say it does not work and propose 2-3 specific free times from the gaps in the calendar that fit the scheduling preferences.
- If the proposed time IS free and fits the scheduling preferences, confirm it.
- Never use em-dashes (use a comma or period instead).
- Never name or describe what event is blocking the time — just say the time does not work.
- Do NOT use generic openers like "Thanks for reaching out" or "I hope you're doing well".
- Always end with a casual question asking if the proposed times work (e.g. "Would any of these work?", "Do any of these fit your schedule?", "Are you free at any of these?"). Never end with a statement.
- Do not include any sign-off name at the end.
- Keep it to 2-3 sentences.
- Format: if there is an opening line, leave one blank line before the message body, and one blank line before the closing question.
- Do not include a subject line.${prefsLine}

My calendar for the relevant window:
${busyList}

Email from: ${from}
Subject: ${subject}
Body:
${emailBody.slice(0, 800)}

Reply draft:`;
    } else {
      const toneInstruction = TONE_INSTRUCTIONS[toneKey] ?? TONE_INSTRUCTIONS.Concise;
      prompt = `${toneInstruction}

You are drafting a reply on behalf of Finley Underwood. Read the email below and write an appropriate reply draft. Do not include a subject line. End with just the name "Finley" — do not include a sign-off like "Best" or "Sincerely".

Email from: ${from}
Subject: ${subject}
Body:
${emailBody.slice(0, 1500)}

Reply draft:`;
    }
  }

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
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

  if (!claudeRes.ok) return NextResponse.json({ error: "Claude failed" }, { status: 500, headers: CORS });
  const claudeData = await claudeRes.json() as { content: Array<{ text: string }> };
  const replyBody = claudeData.content[0]?.text?.trim() ?? "";

  return NextResponse.json({ ok: true, text: replyBody }, { headers: CORS });
  } catch (err: any) {
    console.error("[thread-draft] unhandled error:", err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500, headers: CORS });
  }
}
