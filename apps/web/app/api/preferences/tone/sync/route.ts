import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { makeAuthForUser } from "../../../../../lib/gmail";
import { logUsage } from "../../../../../lib/usage";
import { checkAiGuard } from "../../../../../lib/aiGuard";
import { ANTHROPIC_URL, anthropicHeaders } from "../../../../../lib/anthropicEndpoint";
import { google } from "googleapis";

// Analyze the user's most recent 15 sent emails. Per the May 23 spec: fewer
// emails, but extract intro greeting + sign-off as structured fields so the
// sidebar can render them as editable inputs.
const SENT_SAMPLE_COUNT = 15;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function fetchSentEmailBodies(userId: string): Promise<string[]> {
  const { auth: oauthClient } = await makeAuthForUser(userId);
  const gmail = google.gmail({ version: "v1", auth: oauthClient });

  const listRes = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["SENT"],
    maxResults: SENT_SAMPLE_COUNT,
  });

  const ids = (listRes.data.messages ?? []).map((m) => m.id!).filter(Boolean);

  const results = await Promise.allSettled(
    ids.map((id) =>
      gmail.users.messages.get({ userId: "me", id, format: "full" }).then((res) => {
        const parts = res.data.payload?.parts ?? [];
        const bodyData =
          res.data.payload?.body?.data ??
          parts.find((p) => p.mimeType === "text/plain")?.body?.data ??
          parts.flatMap((p) => p.parts ?? []).find((p) => p.mimeType === "text/plain")?.body?.data;
        if (!bodyData) return null;
        return Buffer.from(bodyData, "base64").toString("utf-8").slice(0, 800);
      })
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<string | null> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value as string);
}

type ToneAnalysis = {
  summary: string;
  example: string;
  intro: string;
  signOff: string;
};

async function analyzeTonesWithClaude(bodies: string[], userId: string): Promise<ToneAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const combinedSamples = bodies
    .slice(0, SENT_SAMPLE_COUNT)
    .map((b, i) => `--- Email ${i + 1} ---\n${b.trim()}`)
    .join("\n\n");

  const prompt = `You are analyzing a person's email writing style based on emails they actually sent.

Here are ${bodies.length} emails they wrote:

${combinedSamples}

Analyze their tone and writing style carefully. Pay close attention to:
- How they open/greet (formal, casual, direct, no greeting at all)
- How they close/sign off (regards, thanks, no sign-off, etc.)
- Email length and structure preferences
- Vocabulary level and formality
- Punctuation and formatting habits

Return a JSON object with exactly four fields:
{
  "summary": "A 1-2 sentence description of their writing style starting with 'Writes with...' Focus on tone, formality, and sentence structure only. Do not mention the person's name, do not mention specific greetings or sign-offs.",
  "example": "A short sample email (3-6 sentences) written in their exact style. Use a professional but realistic scenario like following up on a project. Use their actual patterns. End the email at the closing word only (e.g. 'Thanks,' or 'Best,'). Do not include any name or title after it.",
  "intro": "The exact text they most commonly use to open emails, including punctuation, but with the recipient's name replaced by a placeholder if present. Examples: 'Hi {{name}},', 'Hey,', 'Hello,', or '' if they typically skip greetings. One short string, no explanation.",
  "signOff": "The exact text they most commonly use to close emails, including punctuation and a trailing newline + their first name if they sign with their name. Examples: 'Thanks,\\nMara', 'Best,\\nMarcus', '— Alex', or '' if they typically skip sign-offs. One short string, no explanation."
}

JSON only, no other text.`;

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    content: Array<{ text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };
  if (data.usage) {
    await logUsage({
      userId,
      eventType: "tone_sync",
      model: "claude-haiku-4-5-20251001",
      usage: data.usage,
    });
  }
  const raw = data.content[0]?.text ?? "";

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Claude response");

  const parsed = JSON.parse(match[0]) as Partial<ToneAnalysis>;
  if (!parsed.summary || !parsed.example) {
    throw new Error("Missing summary or example in Claude response");
  }

  return {
    summary: parsed.summary,
    example: parsed.example,
    intro: parsed.intro ?? "",
    signOff: parsed.signOff ?? "",
  };
}

function googleErrMessage(err: unknown): string | null {
  const code = (err as { code?: number })?.code;
  if (code === 401) return "Google access expired. Sign out and sign back in to reconnect.";
  if (code === 403) return "Gmail permission denied. Sign out and sign back in to re-grant access.";
  return null;
}

// Resolve the calling user from either a NextAuth session (dashboard) or a
// GoogleBearer token (Apps Script add-on sidebar).
async function resolveUserId(req: NextRequest): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const authHeader = req.headers.get("authorization");
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

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const guard = await checkAiGuard(userId, "tone_sync");
  if (!guard.allowed)
    return NextResponse.json({ error: guard.error }, { status: guard.status, headers: CORS });

  const cred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!cred) {
    return NextResponse.json(
      { error: "Google account not linked. Sign out and sign back in to reconnect." },
      { status: 401, headers: CORS }
    );
  }

  let bodies: string[];
  try {
    bodies = await fetchSentEmailBodies(userId);
  } catch (err) {
    console.error("[tone/sync] Failed to fetch sent emails:", err);
    const msg = googleErrMessage(err) ?? "Failed to fetch sent emails";
    return NextResponse.json({ error: msg }, { status: 502, headers: CORS });
  }

  if (bodies.length < 3) {
    return NextResponse.json({ error: "Not enough sent emails to analyze" }, { status: 422, headers: CORS });
  }

  let result: ToneAnalysis;
  try {
    result = await analyzeTonesWithClaude(bodies, userId);
  } catch (err) {
    console.error("[tone/sync] Claude analysis failed:", err);
    return NextResponse.json({ error: "Tone analysis failed" }, { status: 502, headers: CORS });
  }

  // Optional Sonnet 4 second pass: produces a single voice-only sentence
  // suitable for the "Your voice, summarized" card. Gated by env var so we
  // can flip it on per environment without code changes. Sonnet costs ~5x
  // Haiku — gate stays off during alpha.
  let toneSummary: string | null = null;
  if (process.env.ENABLE_SONNET_COPY === "true" && process.env.ANTHROPIC_API_KEY) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, name: true },
      });
      const firstName =
        user?.firstName ?? user?.name?.split(" ")[0] ?? "they";
      const sonnetPrompt = `You are a writing-style observer. Given the style profile and the user's first name, produce ONE sentence that completes: "Dharma writes like ${firstName}: ___".

Style profile: ${result.summary}

Rules: max 18 words. No adverbs like "professionally" or "effectively". No mention of name. Voice description only — concrete, not generic.

Return just the completing phrase. No quotes, no preamble.`;

      const sonnetRes = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: anthropicHeaders(process.env.ANTHROPIC_API_KEY!),
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 60,
          messages: [{ role: "user", content: sonnetPrompt }],
        }),
      });
      if (sonnetRes.ok) {
        const data = (await sonnetRes.json()) as {
          content: Array<{ text: string }>;
          usage?: { input_tokens: number; output_tokens: number };
        };
        toneSummary = data.content[0]?.text?.trim()?.replace(/^["']|["']$/g, "") ?? null;
        if (data.usage) {
          await logUsage({
            userId,
            eventType: "tone_sync",
            model: "claude-sonnet-4-20250514",
            usage: data.usage,
          });
        }
      }
    } catch (err) {
      console.error("[tone/sync] Sonnet summary pass failed:", err);
      // Non-fatal — fall through to saving Haiku output only.
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      tone: "My Tone",
      toneProfile: result.summary,
      toneSummary: toneSummary,
      toneExample: result.example,
      inferredIntro: result.intro || null,
      inferredSignOff: result.signOff || null,
    },
  });

  return NextResponse.json(
    {
      summary: result.summary,
      toneSummary,
      example: result.example,
      intro: result.intro,
      signOff: result.signOff,
    },
    { headers: CORS }
  );
}
