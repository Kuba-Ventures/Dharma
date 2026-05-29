// One-shot: bump a user's cumulativeSecondsSaved + tier, then clear their
// lastSeenTier so the next dashboard load fires the tier-up banner +
// confetti. Use to demo the celebration before they organically cross the
// threshold.
//
// Usage:
//   cd apps/web && node scripts/bump-tier.mjs <email> <newSecondsSaved>

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

const email = process.argv[2];
const seconds = parseInt(process.argv[3] ?? "4000", 10);

if (!email) {
  console.error("Usage: node scripts/bump-tier.mjs <email> <seconds>");
  process.exit(1);
}

const TIERS = [
  { id: "Apprentice", threshold: 0 },
  { id: "Adept", threshold: 3600 },
  { id: "Practitioner", threshold: 18000 },
  { id: "Master", threshold: 72000 },
  { id: "Partner", threshold: 288000 },
];

function tierFor(s) {
  let t = TIERS[0].id;
  for (const x of TIERS) if (s >= x.threshold) t = x.id;
  return t;
}

const prisma = new PrismaClient();
const tier = tierFor(seconds);
const user = await prisma.user.update({
  where: { email },
  data: { cumulativeSecondsSaved: seconds, tier, lastSeenTier: null },
  select: { id: true, email: true, tier: true, cumulativeSecondsSaved: true, lastSeenTier: true },
});
console.log(`Updated ${user.email}:`, {
  cumulativeSecondsSaved: user.cumulativeSecondsSaved,
  tier: user.tier,
  lastSeenTier: user.lastSeenTier,
});
console.log("\nNext dashboard load on this account will fire the confetti.");
await prisma.$disconnect();
