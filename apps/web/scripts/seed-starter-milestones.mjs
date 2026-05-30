// Starter milestone seed — universal (no requiredCity) milestones at common
// time-saved thresholds. Run once per fresh database; idempotent via upsert.
//
// The in-memory MILESTONES library in lib/milestones.ts already covers the
// 0s → 1h "intro" beats. This script extends the universal ladder with longer
// thresholds so users past the intro tier still see fresh content. Per-city
// milestones continue to be generated lazily by lib/milestoneGenerator.ts.
//
// Usage:
//   cd apps/web && node scripts/seed-starter-milestones.mjs
//   cd apps/web && node scripts/seed-starter-milestones.mjs --dry  (print, don't write)
//
// IMPORTANT: this is the starter set, not the final 50-entry library. See
// NIGHT-RUN.md Phase 5 — Finley to review/expand before running at scale.

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

const dry = process.argv.includes("--dry");

const G_PURPLE =
  "linear-gradient(135deg, rgba(127,119,221,0.18), rgba(38,33,92,0.45))";
const G_TEAL =
  "linear-gradient(135deg, rgba(29,158,117,0.20), rgba(127,119,221,0.10))";
const G_CORAL =
  "linear-gradient(135deg, rgba(216,90,48,0.20), rgba(127,119,221,0.10))";
const G_AMBER =
  "linear-gradient(135deg, rgba(239,159,39,0.22), rgba(127,119,221,0.10))";

// Each entry is universal (no requiredCity) so it applies to every user. Copy
// stays short and sentence-case. Thresholds in seconds.
const STARTER = [
  {
    id: "starter-three-hours",
    category: "regional",
    title: "Three hours back.",
    description:
      "Half a workday returned. The compounding effect is starting to show.",
    threshold: 10_800,
    gradient: G_TEAL,
  },
  {
    id: "starter-five-hours",
    category: "regional",
    title: "Five hours back.",
    description:
      "{firstName}, that's a full afternoon. Adept tier unlocked.",
    threshold: 18_000,
    gradient: G_PURPLE,
  },
  {
    id: "starter-ten-hours",
    category: "regional",
    title: "Ten hours back.",
    description:
      "Enough time to read a full book — or finish the project you've been postponing.",
    threshold: 36_000,
    gradient: G_AMBER,
  },
  {
    id: "starter-workday",
    category: "regional",
    title: "A full workday saved.",
    description: "Eight hours of inbox triage you didn't have to do.",
    threshold: 28_800,
    gradient: G_CORAL,
  },
  {
    id: "starter-twenty-hours",
    category: "regional",
    title: "Twenty hours back.",
    description:
      "A full half-week of pure focus reclaimed. Practitioner tier unlocked.",
    threshold: 72_000,
    gradient: G_TEAL,
  },
  {
    id: "starter-fifty-hours",
    category: "regional",
    title: "Fifty hours back.",
    description:
      "{firstName}, that's a full week of work returned to deeper things.",
    threshold: 180_000,
    gradient: G_PURPLE,
  },
  {
    id: "starter-eighty-hours",
    category: "regional",
    title: "Two weeks back.",
    description:
      "Enough time for the deep work most operators never get to. Master tier territory.",
    threshold: 288_000,
    gradient: G_AMBER,
  },
  {
    id: "starter-hundred-hours",
    category: "regional",
    title: "One hundred hours.",
    description:
      "Three weeks of cumulative focus reclaimed. You've outpaced the inbox by a country mile.",
    threshold: 360_000,
    gradient: G_CORAL,
  },
  {
    id: "starter-two-fifty-hours",
    category: "regional",
    title: "Two hundred fifty hours.",
    description:
      "Six full workweeks of attention restored. Partner-tier territory.",
    threshold: 900_000,
    gradient: G_PURPLE,
  },
];

function main() {
  console.log(
    `[seed-starter] ${STARTER.length} universal milestones queued${dry ? " (dry run)" : ""}`,
  );
  for (const m of STARTER) {
    const hours = (m.threshold / 3600).toFixed(1);
    console.log(`  · ${m.id.padEnd(28)} ${hours.padStart(6)}h  — ${m.title}`);
  }

  if (dry) return;

  const prisma = new PrismaClient();
  return (async () => {
    let created = 0;
    let updated = 0;
    for (const m of STARTER) {
      const existing = await prisma.milestoneDef.findUnique({ where: { id: m.id } });
      await prisma.milestoneDef.upsert({
        where: { id: m.id },
        create: {
          id: m.id,
          category: m.category,
          title: m.title,
          description: m.description,
          threshold: m.threshold,
          copyTemplate: m.description,
          gradient: m.gradient,
          requiredCity: null,
        },
        update: {
          category: m.category,
          title: m.title,
          description: m.description,
          threshold: m.threshold,
          copyTemplate: m.description,
          gradient: m.gradient,
        },
      });
      if (existing) updated++;
      else created++;
    }
    console.log(`[seed-starter] done — ${created} created, ${updated} updated`);
    await prisma.$disconnect();
  })();
}

const result = main();
if (result instanceof Promise) {
  result.catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
