import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { verifyExtensionToken } from "../../../../../lib/extension-token";
import { prisma } from "../../../../../lib/prisma";
import { makeAuthForUser, createDraft } from "../../../../../lib/gmail";
import { logUsage } from "../../../../../lib/usage";
import { ANTHROPIC_URL, anthropicHeaders } from "../../../../../lib/anthropicEndpoint";
import { google } from "googleapis";

const TONE_INSTRUCTIONS: Record<string, string> = {
  "My Tone":
    "Write in a natural, professional but personal tone: direct, warm, not overly formal. Mirror the style of someone who has worked in business for years and writes clearly without corporate jargon.",
  Concise:
    "Write a brief, direct reply. No filler words, no pleasantries beyond a quick greeting. Get to the point in 2-4 sentences.",
  "Formal / Legal":
    "Write in formal, precise language appropriate for legal or official correspondence. Use complete sentences, avoid contractions, and maintain a professional distance.",
  "Casual / Friendly":
    "Write in a warm, conversational tone. It's okay to be a little informal, use contractions, keep it light and approachable.",
};

// Same date pattern + context builder as thread-draft. Kept in sync manually
// (small enough that extracting to a shared module would be over-engineering).
const DATE_PATTERN = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember|t)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:today|tomorrow|yesterday|tonight|this\s+week|next\s+week|next\s+month|this\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day|next\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/gi;

function buildDateContext(emailBody: string): string {
  const now = new Date();
  const prettyToday = now.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
  const isoToday = now.toISOString().slice(0, 10);
  const matches = emailBody.match(DATE_PATTERN) ?? [];
  const seen = new Set<string>();
  const referenced: string[] = [];
  for (const m of matches) {
    const norm = m.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(norm)) {
      seen.add(norm);
      referenced.push(m);
      if (referenced.length >= 10) break;
    }
  }
  const lines = [`Today is ${prettyToday} (${isoToday}, America/New_York).`];
  if (referenced.length > 0) {
    lines.push(`Dates mentioned in this email: ${referenced.join(", ")}.`);
    lines.push("If any of those dates have already passed, never propose them. Always reason from today's date forward.");
  }
  return lines.join("\n");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: messageId } = await params;
  const { tone } = await req.json() as { tone?: string };

  // Accept either a NextAuth session or a Bearer extension token
  let userId: string | undefined;
  const session = await auth();
  if (session?.user?.id) {
    userId = session.user.id;
  } else {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      userId = verifyExtensionToken(authHeader.slice(7)) ?? undefined;
    }
  }
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const googleCred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!googleCred) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, tone: true, inferredIntro: true, inferredSignOff: true },
  });
  const fullName = dbUser?.name?.trim() || dbUser?.email?.split("@")[0] || "the sender";
  const firstName = fullName.split(/\s+/)[0];
  const signOffBlock = dbUser?.inferredSignOff?.trim()
    ? `End the email with exactly this sign-off (including the line break before the name):\n${dbUser.inferredSignOff}`
    : `End with just the name "${firstName}"; do not include a sign-off like "Best" or "Sincerely".`;
  const introHint = dbUser?.inferredIntro?.trim()
    ? ` When an opening greeting fits, use this form: ${dbUser.inferredIntro}`
    : "";

  const { auth: oauthClient } = await makeAuthForUser(userId);
  const gmail = google.gmail({ version: "v1", auth: oauthClient });

  // Fetch the full email
  const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const msg = res.data;
  const headers = msg.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

  const from = get("From");
  const subject = get("Subject") || "(no subject)";
  const messageIdHeader = get("Message-ID");
  const references = get("References");
  const threadId = msg.threadId ?? messageId;

  // Extract plain text body
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

  const body = extractBody(msg.payload) || msg.snippet || "";
  // Tone preference resolution mirrors thread-draft: request body wins,
  // then saved user preference, then Concise.
  const toneKey = tone ?? dbUser?.tone ?? "Concise";
  const toneInstruction = TONE_INSTRUCTIONS[toneKey] ?? TONE_INSTRUCTIONS.Concise;

  // Generate reply with Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const prompt = `${toneInstruction}

${buildDateContext(body)}

You are drafting a reply on behalf of ${fullName}. Read the email below and write an appropriate reply draft. Do not include a subject line. ${signOffBlock}${introHint}

Email from: ${from}
Subject: ${subject}
Body:
${body.slice(0, 1500)}

Reply draft:`;

  const claudeRes = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!claudeRes.ok) return NextResponse.json({ error: "Claude failed" }, { status: 500 });
  const claudeData = await claudeRes.json() as {
    content: Array<{ text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };
  const replyBody = claudeData.content[0]?.text?.trim() ?? "";

  if (claudeData.usage) {
    await logUsage({
      userId,
      eventType: "draft",
      model: "claude-haiku-4-5-20251001",
      usage: claudeData.usage,
    });
  }

  // Save as Gmail draft
  await createDraft(googleCred.accessToken, googleCred.refreshToken, {
    from: googleCred.email,
    to: from,
    subject,
    body: replyBody,
    threadId,
    inReplyTo: messageIdHeader,
    references,
  });

  return NextResponse.json({ ok: true });
}
