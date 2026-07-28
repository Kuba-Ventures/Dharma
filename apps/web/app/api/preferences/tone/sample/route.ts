import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { logUsage } from "../../../../../lib/usage";
import { checkAiGuard } from "../../../../../lib/aiGuard";
import { SAMPLE_SCENARIOS, scenarioById } from "../../../../../lib/sampleScenarios";
import { ANTHROPIC_URL, anthropicHeaders } from "../../../../../lib/anthropicEndpoint";
import { stripEmDashes } from "../../../../../lib/stripEmDashes";
import { TONE_INSTRUCTIONS, toneUsesSignOff } from "../../../../../lib/toneInstructions";

// POST { scenarioId? } → { scenarioId, label, draft }
// Generates a fresh sample draft in the user's current tone, against the
// requested scenario (or the first one if omitted). Haiku 4.5; cheap enough to
// regenerate on a click. Cost logs to UsageEvent.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const guard = await checkAiGuard(userId, "tone_sync");
  if (!guard.allowed)
    return NextResponse.json({ error: guard.error }, { status: guard.status });

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

  // Preview the user's ACTIVE mode, not just their personal voice. The card is
  // a live preview of the selected tone card, so the mode's instruction has to
  // drive length and formality (this is why selecting Concise used to still
  // produce a long, chatty draft — the mode was never applied here). Scheduling
  // has no instruction string (it's calendar-aware elsewhere) and falls back to
  // plain voice, which is the right behavior for a no-calendar preview.
  const toneKey = user.tone || "Concise";
  const modeInstruction = TONE_INSTRUCTIONS[toneKey];

  const lines = [
    `Write a short email draft for the scenario below${modeInstruction ? "" : " in this person's voice"}.`,
    ``,
    `Voice profile (word choice and personality): ${voice}`,
  ];
  if (modeInstruction) {
    lines.push(
      ``,
      `Tone directive (controls length and formality; overrides the voice profile wherever they conflict): ${modeInstruction}`,
    );
  }
  // Blunt modes (Concise) omit the sign-off on purpose — the directive already
  // forbids pleasantries, and forcing "Talk soon," back on undoes that.
  if (toneUsesSignOff(toneKey)) {
    lines.push(
      ``,
      `End the email with exactly this sign-off (verbatim, including punctuation/newlines): ${JSON.stringify(signOff)}`,
    );
  }
  lines.push(
    ``,
    `Scenario: ${scenario.prompt}`,
    ``,
    `Never use em-dashes (—) or en-dashes (–); use commas or periods instead.`,
    ``,
    `Return only the email body. No subject line. No commentary.`,
  );
  const prompt = lines.join("\n");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(apiKey),
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

  const draft = stripEmDashes(data.content[0]?.text?.trim() ?? "");

  return NextResponse.json({
    scenarioId: scenario.id,
    label: scenario.label,
    draft,
  });
}
