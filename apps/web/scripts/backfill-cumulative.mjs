// One-off backfill: populate cumulativeSecondsSaved + tier for every user
// from their existing UsageEvent + ClassifiedThread totals. This is the same
// calculation /api/cron/awards runs nightly — running it once now seeds the
// dashboard MilestoneHero and TierLadder with real numbers instead of
// everyone showing 0.
//
// Usage: cd apps/web && node scripts/backfill-cumulative.mjs

import { PrismaClient } from "@prisma/client";

const SECONDS_SAVED_PER_DRAFT = 180;
const SECONDS_SAVED_PER_TAG = 30;

const TIERS = [
  { id: "Apprentice", threshold: 0 },
  { id: "Adept", threshold: 3600 },
  { id: "Practitioner", threshold: 18000 },
  { id: "Master", threshold: 72000 },
  { id: "Partner", threshold: 288000 },
];

function tierFor(seconds) {
  let current = TIERS[0].id;
  for (const t of TIERS) {
    if (seconds >= t.threshold) current = t.id;
    else break;
  }
  return current;
}

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  let updated = 0;

  for (const u of users) {
    const [drafts, tags] = await Promise.all([
      prisma.usageEvent.count({ where: { userId: u.id, eventType: "draft" } }),
      prisma.classifiedThread.count({ where: { userId: u.id } }),
    ]);
    const seconds = drafts * SECONDS_SAVED_PER_DRAFT + tags * SECONDS_SAVED_PER_TAG;
    const tier = tierFor(seconds);
    await prisma.user.update({
      where: { id: u.id },
      data: { cumulativeSecondsSaved: seconds, tier },
    });
    console.log(`${u.email}: ${drafts} drafts + ${tags} tags = ${seconds}s (${tier})`);
    updated += 1;
  }

  console.log(`\nBackfilled ${updated} user(s)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
