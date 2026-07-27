import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

// POST — restart onboarding WITHOUT clearing settings.
//
// Clears only the two fields that gate the onboarding redirect:
//   - onboardingCompletedAt (null) makes the (app) layout redirect back into
//     onboarding, and lets the onboarding layout stop bouncing to /dashboard.
//   - onboardingStep (0) resumes the flow from step 1.
//
// Everything the user configured during (or after) onboarding is deliberately
// preserved: role, homeCity/timezone, tone, label preset, scheduling prefs,
// tier/progression, etc. This is a "walk me through it again" affordance
// (primarily for testing the flow), NOT a reset. onboardingFlow is left pinned
// so the user re-runs whichever flow (v1/v2) they were originally assigned.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      onboardingCompletedAt: null,
      onboardingStep: 0,
    },
    select: {
      onboardingStep: true,
      onboardingCompletedAt: true,
      onboardingFlow: true,
    },
  });

  return NextResponse.json(updated);
}
