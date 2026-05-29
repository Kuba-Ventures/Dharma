// Generates city-specific milestone definitions via Claude on first sight of
// a new home city, then persists them to MilestoneDef so subsequent users in
// the same city reuse them. ~$0.001 per city via Haiku 4.5 — cheap, and
// idempotent: existing rows for the city short-circuit immediately.

import { prisma } from "./prisma";

type GeneratedMilestone = {
  id: string;
  category: "peak" | "trail" | "cultural" | "regional" | "city_to_city";
  title: string;
  description: string;
  threshold: number;
};

const GRADIENTS = [
  "linear-gradient(135deg, rgba(127,119,221,0.18), rgba(38,33,92,0.45))",
  "linear-gradient(135deg, rgba(29,158,117,0.20), rgba(127,119,221,0.10))",
  "linear-gradient(135deg, rgba(216,90,48,0.20), rgba(127,119,221,0.10))",
  "linear-gradient(135deg, rgba(239,159,39,0.22), rgba(127,119,221,0.10))",
  "linear-gradient(135deg, rgba(180,94,212,0.20), rgba(38,33,92,0.45))",
];

function gradientFor(category: GeneratedMilestone["category"]): string {
  const idx =
    { peak: 2, trail: 1, cultural: 3, regional: 0, city_to_city: 4 }[category] ?? 0;
  return GRADIENTS[idx];
}

const PROMPT = `You are designing milestones for an AI email assistant's gamification feature. Users earn milestones as they save time using the assistant for drafting and labeling.

Generate exactly 6 milestones tied to the city: {CITY}

Each milestone references a REAL local landmark, peak, trail, park, neighborhood, cultural site, or cross-town distance. Do not invent fictional places. If the city is small or unfamiliar, fall back to regional landmarks within ~50 miles.

Constraints:
- Thresholds in seconds, between 3600 and 144000 (1 hour to 40 hours of saved time)
- Spread thresholds across the range — early ones at ~5400-10800 (90 min to 3h), later ones at 30000-100000+
- Categories: "peak" / "trail" / "cultural" / "regional" / "city_to_city"
- Titles in lowercase sentence form, completing "{firstName}, you saved enough time to ___" — but write JUST the action (e.g. "summit Mt. Mitchell" or "walk the Brooklyn Bridge round trip"), NOT the full sentence
- Descriptions: 1-2 sentences with a specific fact about the landmark + how the saved time relates

Output JSON array of 6 entries, exact shape:
[
  {
    "id": "kebab-case-slug-unique-to-this-milestone",
    "category": "peak",
    "title": "summit Mt. Mitchell",
    "description": "Eastern US's tallest peak at 6,684 ft. A full round-trip takes about 5 hours.",
    "threshold": 18000
  },
  ...
]

Output only the JSON array. No commentary, no markdown fences.`;

export async function generateMilestonesForCity(city: string): Promise<{
  created: number;
  skipped: boolean;
}> {
  // Idempotent: if we've already generated for this city, no-op.
  const existing = await prisma.milestoneDef.count({
    where: { requiredCity: city },
  });
  if (existing > 0) return { created: 0, skipped: true };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[milestoneGenerator] ANTHROPIC_API_KEY missing");
    return { created: 0, skipped: true };
  }

  const prompt = PROMPT.replace("{CITY}", city);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(
      `[milestoneGenerator] Anthropic ${res.status} for ${city}: ${text}`,
    );
    return { created: 0, skipped: true };
  }

  const data = (await res.json()) as {
    content: Array<{ text: string }>;
  };
  const raw = data.content[0]?.text?.trim() ?? "";

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error(`[milestoneGenerator] No JSON array in response for ${city}`);
    return { created: 0, skipped: true };
  }

  let parsed: GeneratedMilestone[];
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`[milestoneGenerator] Parse failed for ${city}:`, err);
    return { created: 0, skipped: true };
  }

  // Slug-prefix city so generated ids don't collide across cities.
  const citySlug = city
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  let created = 0;
  for (const m of parsed) {
    if (
      !m.id ||
      typeof m.threshold !== "number" ||
      !m.title ||
      !m.description ||
      !m.category
    ) {
      continue;
    }
    const finalId = `${citySlug}-${m.id}`;
    try {
      await prisma.milestoneDef.upsert({
        where: { id: finalId },
        create: {
          id: finalId,
          category: m.category,
          title: `Enough time to ${m.title.replace(/[.!?]$/, "")}.`,
          description: m.description,
          threshold: m.threshold,
          copyTemplate: m.title,
          gradient: gradientFor(m.category),
          requiredCity: city,
        },
        update: {},
      });
      created += 1;
    } catch (err) {
      console.error(
        `[milestoneGenerator] Failed to upsert ${finalId}:`,
        err,
      );
    }
  }

  return { created, skipped: false };
}
