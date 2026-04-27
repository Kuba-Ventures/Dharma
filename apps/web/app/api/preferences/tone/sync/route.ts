import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { makeAuthForUser } from "../../../../../lib/gmail";
import { google } from "googleapis";

const SENT_SAMPLE_COUNT = 25;

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

async function analyzeTonesWithClaude(bodies: string[]): Promise<{ summary: string; example: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const combinedSamples = bodies
    .slice(0, 20)
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
- Any personality traits that come through

Return a JSON object with exactly two fields:
{
  "summary": "A 1-2 sentence description of their writing style starting with 'Writes with...' — focus on tone, formality, and sentence structure only. Do not mention the person's name, do not mention specific greetings or sign-offs, do not say 'uses casual greetings like' or 'often ending with'.",
  "example": "A short sample email (3-6 sentences) written in their exact style — a professional but realistic scenario like following up on a project or responding to a meeting request. Use their actual patterns. End the email at the closing word only (e.g. 'Thanks,' or 'Best,') — do not include any name or title after it."
}

JSON only, no other text.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { content: Array<{ text: string }> };
  const raw = data.content[0]?.text ?? "";

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Claude response");

  const parsed = JSON.parse(match[0]) as { summary: string; example: string };
  if (!parsed.summary || !parsed.example) throw new Error("Missing fields in Claude response");

  return parsed;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  let bodies: string[];
  try {
    bodies = await fetchSentEmailBodies(userId);
  } catch (err) {
    console.error("[tone/sync] Failed to fetch sent emails:", err);
    return NextResponse.json({ error: "Failed to fetch sent emails" }, { status: 502 });
  }

  if (bodies.length < 3) {
    return NextResponse.json({ error: "Not enough sent emails to analyze" }, { status: 422 });
  }

  let result: { summary: string; example: string };
  try {
    result = await analyzeTonesWithClaude(bodies);
  } catch (err) {
    console.error("[tone/sync] Claude analysis failed:", err);
    return NextResponse.json({ error: "Tone analysis failed" }, { status: 502 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { tone: "My Tone", toneProfile: result.summary, toneExample: result.example },
  });

  return NextResponse.json({ summary: result.summary, example: result.example });
}
