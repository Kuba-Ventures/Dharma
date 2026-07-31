export const maxDuration = 30;

import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { verifyExtensionToken } from "../../../../lib/extension-token";
import { prisma } from "../../../../lib/prisma";
import { markAddonInstalled } from "../../../../lib/addonInstall";
import { makeAuthForUser } from "../../../../lib/gmail";
import { listVisibleCalendarIds } from "../../../../lib/googleCalendars";
import { getRelevantTimeWindow } from "../../../../lib/schedulingWindow";
import { resolveRecipientName } from "../../../../lib/recipientName";
import { logUsage } from "../../../../lib/usage";
import { checkAiGuard } from "../../../../lib/aiGuard";
import { ANTHROPIC_URL, anthropicHeaders } from "../../../../lib/anthropicEndpoint";
import { TONE_INSTRUCTIONS } from "../../../../lib/toneInstructions";
import { google } from "googleapis";

// Hard rules applied to every draft regardless of tone
const WRITING_RULES = `\
- Never use em-dashes or en-dashes. Use a comma or period instead.
- No generic openers like "Thanks for reaching out" or "Hope you're well".
- No subject line.
- Greet the recipient only by a name that actually appears in their email — the name they signed off with, or the name on the From line. If no name is clear, use a neutral greeting with no name. Never invent, guess, or substitute a different name.`;

// Catches month names ("Sep 12", "September 12, 2026"), MM/DD or MM/DD/YYYY,
// ISO YYYY-MM-DD, and relative phrases ("next Monday", "this week", "tomorrow").
// Used to surface dates the email mentioned so the model can reason about
// whether they are past, present, or future relative to today.
const DATE_PATTERN = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember|t)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:today|tomorrow|yesterday|tonight|this\s+week|next\s+week|next\s+month|this\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day|next\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/gi;

function extractDates(text: string): string[] {
  const matches = text.match(DATE_PATTERN) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const norm = m.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(m);
      if (out.length >= 10) break;
    }
  }
  return out;
}

// `anchor` is the date relative words ("today", "tomorrow", a weekday) should
// resolve against — the email's SENT date, so a reply written later still reads
// "tomorrow" as the day after the email. `now` is the real current moment. The
// model is always grounded in the current date AND time so it never proposes a
// slot that has already passed today (e.g. offering 10:30am when it's 11:35am).
function buildDateContext(emailBody: string, anchor: Date = new Date(), now: Date = anchor): string {
  const fmtDate = (d: Date) =>
    d.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York",
    });
  const fmtDateTime = (d: Date) =>
    d.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });
  const lines: string[] = [];
  // Ground the model in the real current moment (date AND time). The time is
  // essential: without it the model knows the day but not that, say, 10:30am
  // has already passed, so it proposes slots in the past.
  lines.push(`The current date and time is ${fmtDateTime(now)} (America/New_York). Never suggest a date or time earlier than this — only propose slots in the future.`);
  if (fmtDate(anchor) !== fmtDate(now)) {
    lines.push(`This email was sent on ${fmtDate(anchor)}. Resolve relative dates like "today", "tomorrow", or a weekday RELATIVE TO WHEN THE EMAIL WAS SENT, not to the current date. If a time they asked about has already passed, say so and offer fresh options.`);
  }
  const referenced = extractDates(emailBody);
  if (referenced.length > 0) {
    lines.push(`Dates mentioned in this email: ${referenced.join(", ")}.`);
    lines.push("If any of those dates have already passed, never propose them. Always reason forward from the current date and time.");
  }
  return lines.join("\n");
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
        if (cred) {
          void markAddonInstalled(cred.userId).catch(() => {});
          userId = cred.userId;
        }
      }
    }
  }
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const guard = await checkAiGuard(userId, "draft");
  if (!guard.allowed)
    return NextResponse.json({ error: guard.error }, { status: guard.status, headers: CORS });

  const googleCred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!googleCred) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

  const { auth: oauthClient } = await makeAuthForUser(userId);
  const gmail = google.gmail({ version: "v1", auth: oauthClient });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  // Identity for prompt substitution. fullName goes into "on behalf of X" lines.
  // inferredSignOff/Intro come from tone analysis (Bug 3b) and are user-editable;
  // firstName is the final fallback when no sign-off is set.
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      tone: true,
      toneProfile: true,
      toneSummary: true,
      toneExample: true,
      inferredIntro: true,
      inferredSignOff: true,
      schedulingPreferences: true,
      schedulingEnabled: true,
    },
  });
  // Dashboard saves to `toneSummary`; older flows wrote to `toneProfile`.
  // Prefer the newer column so dashboard-only users still get a tone-matched draft.
  const effectiveTone = dbUser?.toneSummary ?? dbUser?.toneProfile ?? null;
  const fullName = dbUser?.name?.trim() || dbUser?.email?.split("@")[0] || "the sender";
  const firstName = fullName.split(/\s+/)[0];

  // Sign-off the model should end with. Inferred wins; otherwise just the first name.
  const signOffBlock = dbUser?.inferredSignOff?.trim()
    ? `End the email with exactly this sign-off (including the line break before the name):\n${dbUser.inferredSignOff}`
    : `End with just the name "${firstName}"; do not include a sign-off like "Best" or "Sincerely".`;
  const introHint = dbUser?.inferredIntro?.trim()
    ? `\nWhen an opening greeting fits, use this form: ${dbUser.inferredIntro}`
    : "";

  // Tone preference resolution: explicit request body wins, then the user's
  // saved preference, then Concise. Hoisted so logUsage can attribute the
  // draft to its tone preset regardless of which prompt branch ran.
  const toneKey = tone ?? dbUser?.tone ?? "Concise";

  let prompt: string;

  if (draftText) {
    // Polish mode — no thread needed
    const toneBlock = effectiveTone
      ? `Writing style to match exactly: ${effectiveTone}${dbUser?.toneExample ? `\n\nExample:\n${dbUser.toneExample.slice(0, 300)}` : ""}`
      : "Write in a direct, natural, professional tone.";

    prompt = `You are polishing a draft email on behalf of ${fullName}. Rewrite their notes into a clean, complete email in their exact writing style.

${buildDateContext(draftText ?? "")}

${toneBlock}

Rules:
${WRITING_RULES}
- Keep all the same intent and key points; do not add information not implied by the notes.
- No sign-off name at the end; the sender's signature handles that.${introHint}
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

    // Anchor relative dates ("tomorrow", "Friday") to when the email was SENT,
    // not to now: a reply written the next day must read "tomorrow" as the day
    // after the email was sent. Keep the real `now` too, so we never propose a
    // slot that has already passed. Fall back to now if internalDate is missing.
    const now = new Date();
    const sentMs = Number(msg.internalDate);
    const emailSentAt = Number.isFinite(sentMs) && sentMs > 0 ? new Date(sentMs) : now;

    // Address the reply to a real name — the sender's sign-off or From name —
    // filled in by us, not guessed by the model. The saved greeting is a
    // template like "Hey {{name}},"; leaving the model to fill {{name}} produced
    // hallucinated openers ("Hey Brady,"). If no name is found, greet neutrally.
    const recipientName = resolveRecipientName(from, emailBody);
    const introForm = dbUser?.inferredIntro?.trim() || "";
    const resolvedGreeting = recipientName
      ? introForm.replace(/\{\{?\s*name\s*\}?\}/gi, recipientName) || `Hi ${recipientName},`
      : "";
    const threadIntroHint = recipientName
      ? `\nOpen with this exact greeting: "${resolvedGreeting}". Address the recipient only as "${recipientName}" — never any other name, and never leave a literal "{{name}}" placeholder.`
      : `\nIf a greeting fits, address the sender by the name they signed off with or the From line; never invent a name.`;

    if (toneKey === "Scheduling") {
    if (dbUser?.schedulingEnabled === false) {
      return NextResponse.json({ error: "Scheduling is disabled. Enable it in your Dharma dashboard." }, { status: 403, headers: CORS });
    }

    const { timeMin, timeMax } = getRelevantTimeWindow(emailBody, emailSentAt);

    // Read every calendar the user has *visible*, not just `primary` — meetings
    // often live on a Work/secondary calendar, and a primary-only busy check
    // silently confirms times that are actually booked (issue #74 parity).
    const cal = google.calendar({ version: "v3", auth: oauthClient });
    const calendarIds = await listVisibleCalendarIds(cal);
    const eventsPerCalendar = await Promise.all(
      calendarIds.map((calId) =>
        cal.events
          .list({
            calendarId: calId,
            timeMin,
            timeMax,
            maxResults: 10,
            singleEvents: true,
            orderBy: "startTime",
          })
          .then((r) => r.data.items ?? [])
          .catch((err) => {
            console.error(`[thread-draft] events.list failed for ${calId}:`, err?.message ?? err);
            return [];
          }),
      ),
    );

    const TZ = "America/New_York";
    const busyList = eventsPerCalendar
      .flat()
      .filter((e) => e.status !== "cancelled" && e.start?.dateTime)
      .sort((a, b) => new Date(a.start!.dateTime!).getTime() - new Date(b.start!.dateTime!).getTime())
      .map((e) => {
        const start = new Date(e.start!.dateTime!);
        const end = new Date(e.end!.dateTime!);
        return `• ${start.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ })} - ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ })} ET: busy`;
      })
      .join("\n") || "No events in this window";

    const toneBlock = effectiveTone
      ? `Writing style to match exactly: ${effectiveTone}${dbUser?.toneExample ? `\n\nExample of how this person writes:\n${dbUser.toneExample.slice(0, 300)}` : ""}`
      : "Write in a direct, natural tone.";

    const prefsLine = dbUser?.schedulingPreferences
      ? `\nScheduling preferences: ${dbUser.schedulingPreferences}`
      : "";

    prompt = `You are drafting a scheduling reply on behalf of ${fullName}. Your top priority is matching their writing style exactly.

${buildDateContext(emailBody, emailSentAt, now)}

${toneBlock}

Scheduling rules:
${WRITING_RULES}
- Check whether any time proposed in the email conflicts with the busy times below.
- If the proposed time IS blocked, FIRST clearly decline that exact time by name (e.g. "No, 4pm doesn't work for me"), then offer 2-3 specific alternative times (e.g. "2:30pm today" or "Monday at 10am" — real clock times, not vague ranges like "afternoon") from the free gaps that fit the scheduling preferences. Only propose times still in the future relative to the current date and time given above; never propose a slot earlier today than right now.
- If the proposed time IS free and fits the scheduling preferences, confirm it.
- Only propose times on weekdays (Monday to Friday) between 9am and 5pm Eastern, unless the sender explicitly asked about a weekend or a time outside those hours. Never propose a weekend or evening slot by default.
- Never name or describe what event is blocking the time; just say the time does not work.
- Always end with a casual question asking if the proposed times work (e.g. "Would any of these work?", "Do any of these fit your schedule?", "Are you free at any of these?"). Never end with a statement.
- Do not include any sign-off name at the end.${threadIntroHint}
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

${buildDateContext(emailBody, emailSentAt, now)}

You are drafting a reply on behalf of ${fullName}. Read the email below and write an appropriate reply draft.

Rules:
${WRITING_RULES}
- ${signOffBlock}${threadIntroHint}
- If there is an opening line, leave one blank line before the body, and one blank line before the closing.

Email from: ${from}
Subject: ${subject}
Body:
${emailBody.slice(0, 1500)}

Reply draft:`;
    }
  }

  const claudeRes = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!claudeRes.ok) return NextResponse.json({ error: "Claude failed" }, { status: 500, headers: CORS });
  const claudeData = await claudeRes.json() as {
    content: Array<{ text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };
  const replyBody = (claudeData.content[0]?.text?.trim() ?? "")
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/ {2,}/g, " ");

  if (claudeData.usage) {
    await logUsage({
      userId,
      eventType: "draft",
      model: "claude-haiku-4-5-20251001",
      usage: claudeData.usage,
      tone: toneKey,
    });
  }

  // Polish mode (draftText present) isn't a thread reply, so don't flip
  // draftCreated on the ClassifiedThread.
  if (!draftText && threadId) {
    await prisma.classifiedThread.updateMany({
      where: { userId, threadId },
      data: { draftCreated: true },
    });
  }

  return NextResponse.json({ ok: true, text: replyBody }, { headers: CORS });
  } catch (err: any) {
    console.error("[thread-draft] unhandled error:", err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500, headers: CORS });
  }
}
