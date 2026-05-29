// One-shot: generate city-specific milestones via Claude and persist them to
// MilestoneDef. Mirrors lib/milestoneGenerator.ts so we can backfill cities
// whose users saved their homeCity before the on-demand generator shipped.
//
// Usage: cd apps/web && node scripts/seed-city-milestones.mjs "City, ST"

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
try {
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const city = process.argv[2];
if (!city) {
  console.error('Usage: node scripts/seed-city-milestones.mjs "City, ST"');
  process.exit(1);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY not set");
  process.exit(1);
}

const GRADIENTS = {
  peak: "linear-gradient(135deg, rgba(216,90,48,0.20), rgba(127,119,221,0.10))",
  trail: "linear-gradient(135deg, rgba(29,158,117,0.20), rgba(127,119,221,0.10))",
  cultural: "linear-gradient(135deg, rgba(239,159,39,0.22), rgba(127,119,221,0.10))",
  regional: "linear-gradient(135deg, rgba(127,119,221,0.18), rgba(38,33,92,0.45))",
  city_to_city: "linear-gradient(135deg, rgba(180,94,212,0.20), rgba(38,33,92,0.45))",
};

const PROMPT = `You are designing milestones for an AI email assistant's gamification feature. Users earn milestones as they save time using the assistant for drafting and labeling.

Generate exactly 6 milestones tied to the city: ${city}

Each milestone references a REAL local landmark, peak, trail, park, neighborhood, cultural site, or cross-town distance. Do not invent fictional places. If the city is small or unfamiliar, fall back to regional landmarks within ~50 miles.

Constraints:
- Thresholds in seconds, between 3600 and 144000 (1 hour to 40 hours of saved time)
- Spread thresholds across the range — early ones at ~5400-10800 (90 min to 3h), later ones at 30000-100000+
- Categories: "peak" / "trail" / "cultural" / "regional" / "city_to_city"
- Titles in lowercase sentence form, completing "{firstName}, you saved enough time to ___" — but write JUST the action (e.g. "summit Mt. Mitchell" or "walk the Brooklyn Bridge round trip"), NOT the full sentence
- Descriptions: 1-2 sentences with a specific fact about the landmark + how the saved time relates

Output JSON array of 6 entries, exact shape:
[{ "id": "kebab-case-slug", "category": "peak", "title": "summit Mt. Mitchell", "description": "...", "threshold": 18000 }, ...]

Output only the JSON array. No commentary, no markdown fences.`;

console.log(`Asking Claude Haiku for milestones tied to ${city}...`);

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
    messages: [{ role: "user", content: PROMPT }],
  }),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`Claude error ${res.status}:`, text);
  process.exit(1);
}

const data = await res.json();
const raw = data.content[0]?.text?.trim() ?? "";
const match = raw.match(/\[[\s\S]*\]/);
if (!match) {
  console.error("No JSON array in response. Raw:", raw);
  process.exit(1);
}
const parsed = JSON.parse(match[0]);
console.log(`\nClaude returned ${parsed.length} milestones:\n`);
for (const m of parsed) console.log(`  • [${m.threshold}s] ${m.title} (${m.category})`);

const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const prisma = new PrismaClient();
let created = 0;
for (const m of parsed) {
  if (!m.id || typeof m.threshold !== "number" || !m.title || !m.description || !m.category) continue;
  const finalId = `${citySlug}-${m.id}`;
  await prisma.milestoneDef.upsert({
    where: { id: finalId },
    create: {
      id: finalId,
      category: m.category,
      title: `Enough time to ${m.title.replace(/[.!?]$/, "")}.`,
      description: m.description,
      threshold: m.threshold,
      copyTemplate: m.title,
      gradient: GRADIENTS[m.category] ?? GRADIENTS.regional,
      requiredCity: city,
    },
    update: {},
  });
  created += 1;
}

console.log(`\nPersisted ${created} MilestoneDef rows for "${city}".`);
await prisma.$disconnect();
