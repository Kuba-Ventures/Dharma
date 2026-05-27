import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { findCityByName } from "../../../../lib/cities";

// POST { step?: 1-4, city?: { name, state }, complete?: true }
//
// Advances the user through the onboarding flow. Each step records progress
// so a refresh resumes where they left off. Step 2 also persists the
// confirmed home city and timezone. Setting complete=true (after step 4)
// stamps onboardingCompletedAt so the (app) layout stops redirecting.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    step?: number;
    city?: { name?: string; state?: string };
    complete?: boolean;
  };

  const data: {
    onboardingStep?: number;
    onboardingCompletedAt?: Date;
    homeCity?: string;
    homeCityLat?: number;
    homeCityLng?: number;
    timezone?: string;
  } = {};

  if (typeof body.step === "number" && body.step >= 0 && body.step <= 4) {
    data.onboardingStep = body.step;
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
      homeCity: true,
      timezone: true,
    },
  });

  return NextResponse.json(updated);
}
