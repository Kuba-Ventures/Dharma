// Generates city-specific milestone definitions via Claude on first sight of
// a new home city, then persists them to MilestoneDef so subsequent users in
// the same city reuse them. ~$0.001 per city via Haiku 4.5 — cheap, and
// idempotent: existing rows for the city short-circuit immediately.

import { prisma } from "./prisma";
import { ANTHROPIC_URL, anthropicHeaders } from "./anthropicEndpoint";

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

**Landmark accuracy is the hardest constraint:**
- Every landmark must be a REAL place documented on Wikipedia or a government website (state park system, NPS, city tourism board).
- If a candidate landmark sounds plausible but you're not 100% certain it exists in this specific region, DROP IT and pick another. False precision is worse than vague.
- Cross-check: would a local resident roll their eyes? (e.g. Stanley Park is in Vancouver, not Virginia — do not relocate famous landmarks.)
- For small towns, lean on REGIONAL landmarks within ~100 miles (state parks, AT trail sections, well-known peaks, scenic byways, historic sites). Better to reference a real landmark 90 miles away than invent one in town.
- Do NOT mash up two real landmarks (e.g. "Humpback Rock via McAfee Knob" — those are separate landmarks in different parts of Virginia).
- For each milestone, internally name the Wikipedia article title or government website that documents it; if you can't, drop the milestone.

**Threshold calibration — this is the most important constraint:**
The threshold (in seconds) should approximate the REAL-WORLD time investment to complete the activity from this city, including round-trip drive time. Be honest. If a landmark is 30 minutes away, the threshold reflects that, not an arbitrary larger number.

Anchors:
- 30-minute walk through a downtown district → 1800s
- 1-hour park visit → 3600s
- 2-hour local hike or bike ride → 7200s
- Drive somewhere 45 minutes away + 2 hours on-site + drive back → ~14400s
- Half-day trip (~4 hours total) → 14400s
- Full-day excursion (drive + activity, ~8 hours) → 28800s
- Major peak: 2-hour drive each way + 5-hour hike + meal → ~36000s
- Long road trip or multi-day landmark visit → 50000-80000s
- Cap at 86400s (24 hours)

Other constraints:
- Categories: "peak" / "trail" / "cultural" / "regional" / "city_to_city"
- Spread the 6 milestones across the threshold range — at least one short (under 5400s) and one long (over 40000s)
- Titles in lowercase sentence form, JUST the action (e.g. "summit Mt. Mitchell" or "walk the Brooklyn Bridge round trip"), no leading "{firstName}, you saved enough time to..."
- Descriptions: 1-2 sentences with a specific fact about the landmark + how the saved time relates

Output JSON array of 6 entries, exact shape:
[
  {
    "id": "kebab-case-slug-unique-to-this-milestone",
    "category": "peak",
    "title": "summit Mt. Mitchell",
    "description": "Eastern US's tallest peak at 6,684 ft. About 90 minutes from here, plus a 4-hour round-trip hike.",
    "threshold": 27000
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

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: anthropicHeaders(apiKey),
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
