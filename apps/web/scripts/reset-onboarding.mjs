// Dev utility: re-enter the onboarding flow for one account by clearing its
// completion stamp. The (app) layout redirects users with no
// onboardingCompletedAt into /onboarding/step-1-connect, so after running this
// just reload the app and you'll start at step 1. Finishing re-stamps it.
//
// Usage: cd apps/web && node scripts/reset-onboarding.mjs you@example.com

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/reset-onboarding.mjs <email>");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, onboardingCompletedAt: true },
  });
  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingCompletedAt: null, onboardingStep: 0 },
  });
  console.log(
    `Reset onboarding for ${user.email} (was ${
      user.onboardingCompletedAt?.toISOString() ?? "already null"
    }). Reload the app to start at step 1.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
