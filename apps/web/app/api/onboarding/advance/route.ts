import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { findCityByName } from "../../../../lib/cities";
import { isRoleKey, roleToPresetKey } from "../../../../lib/rolePresets";

// POST { step?: 0-4, city?: { name, state }, role?, complete?: true }
//
// Advances the user through onboarding (step is a 0-based index). Each step
// records progress so a refresh resumes where they left off. Step 2 (v1)
// persists the confirmed home city and timezone. The v2 quiz sends `role`,
// which persists User.role AND derives + persists the LabelPreset. The user's
// onboardingFlow is pinned here on first write (from the ONBOARDING_V2 flag) so
// a later flag flip can't move them between flows. Setting complete=true stamps
// onboardingCompletedAt so the (app) layout stops redirecting.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    step?: number;
    city?: { name?: string; state?: string };
    role?: string;
    complete?: boolean;
  };

  if (body.role !== undefined && !isRoleKey(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const data: {
    onboardingStep?: number;
    onboardingCompletedAt?: Date;
    onboardingFlow?: string;
    role?: string;
    homeCity?: string;
    homeCityLat?: number;
    homeCityLng?: number;
    timezone?: string;
  } = {};

  if (typeof body.step === "number" && body.step >= 0 && body.step <= 4) {
    data.onboardingStep = body.step;
  }

  if (body.role !== undefined) {
    data.role = body.role;
  }

  // Flow is pinned at entry (step-1-connect) from the ONBOARDING_V2 flag. By
  // the time the advance route runs, a genuine v2 user is already pinned "v2";
  // any user still null here is a pre-v2 / legacy user, so backfill them to
  // "v1" — NEVER flag-based, or flipping the flag would yank an in-flight v1
  // user onto v2 pages mid-flow.
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingFlow: true },
  });
  if (!current?.onboardingFlow) {
    data.onboardingFlow = "v1";
  }

  if (body.city?.name) {
    const found = findCityByName(body.city.name, body.city.state);
    if (found) {
      data.homeCity = `${found.name}, ${found.state}`;
      data.homeCityLat = found.lat;
      data.homeCityLng = found.lng;
      data.timezone = found.timezone;
    } else {
      // Allow free-text override too; just no lat/lng/tz seed.
      data.homeCity = body.city.state
        ? `${body.city.name}, ${body.city.state}`
        : body.city.name;
    }
  }

  if (body.complete) {
    data.onboardingCompletedAt = new Date();
    data.onboardingStep = 4;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      onboardingStep: true,
      onboardingCompletedAt: true,
      onboardingFlow: true,
      role: true,
      homeCity: true,
      timezone: true,
    },
  });

  // Derive + persist the label preset from the role. Provisioning the Gmail
  // labels + back-scan happens later (personalize step); this just records the
  // active preset so that step opens pre-derived.
  let derivedPreset: string | null = null;
  if (body.role !== undefined) {
    derivedPreset = roleToPresetKey(body.role);
    await prisma.labelPreset.upsert({
      where: { userId },
      create: { userId, preset: derivedPreset, enabled: true },
      update: { preset: derivedPreset, enabled: true },
    });
  }

  return NextResponse.json({ ...updated, derivedPreset });
}
