// One-off backfill: mark any user without onboardingCompletedAt as completed
// so existing users (who pre-date the onboarding flow) don't get bounced into
// it. Idempotent — safe to re-run.
//
// Usage: cd apps/web && node scripts/backfill-onboarding.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const result = await prisma.user.updateMany({
    where: { onboardingCompletedAt: null },
    data: { onboardingCompletedAt: now, onboardingStep: 4 },
  });
  console.log(`Backfilled ${result.count} user(s) as onboarded at ${now.toISOString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
