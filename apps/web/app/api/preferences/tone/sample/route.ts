import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { logUsage } from "../../../../../lib/usage";
import { SAMPLE_SCENARIOS, scenarioById } from "../../../../../lib/sampleScenarios";

// POST { scenarioId? } → { scenarioId, label, draft }
// Generates a fresh sample draft in the user's current tone, against the
// requested scenario (or the first one if omitted). Haiku 4.5; cheap enough to
// regenerate on a click. Cost logs to UsageEvent.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { scenarioId } = (await req.json().catch(() => ({}))) as {
    scenarioId?: string;
  };
  const scenario = scenarioId ? scenarioById(scenarioId) : SAMPLE_SCENARIOS[0];
  if (!scenario)
    return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      name: true,
      tone: true,
      toneProfile: true,
      toneSummary: true,
      inferredSignOff: true,
    },
  });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "Anthropic not configured" },
      { status: 503 },
    );

  const voice =
    user.toneSummary ??
    user.toneProfile ??
    `Use a ${(user.tone || "concise").toLowerCase()} tone.`;
  const signOff = user.inferredSignOff || "Best,";

  const prompt = `Write a short email draft in this person's voice for the scenario below.

Voice profile: ${voice}

End the email with exactly this sign-off (verbatim, including punctuation/newlines): ${JSON.stringify(signOff)}

Scenario: ${scenario.prompt}

Return only the email body. No subject line. No commentary.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[tone/sample] Anthropic error:", text);
    return NextResponse.json({ error: "Generation failed" }, { status: 502 });
  }

  const data = (await res.json()) as {
    content: Array<{ text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };

  if (data.usage) {
    await logUsage({
      userId,
      eventType: "draft",
      model: "claude-haiku-4-5-20251001",
      usage: data.usage,
    });
  }

  const draft = data.content[0]?.text?.trim() ?? "";

  return NextResponse.json({
    scenarioId: scenario.id,
    label: scenario.label,
    draft,
  });
}
