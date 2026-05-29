import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { findCityByName } from "../../../../lib/cities";
import { generateMilestonesForCity } from "../../../../lib/milestoneGenerator";
import { MILESTONES } from "../../../../lib/milestones";

// PATCH { firstName?, homeCity? { name, state }, timezone? }
//
// Updates editable identity fields. Changing the home city re-seeds the
// milestone library for the user (different city = different landmarks).
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    firstName?: string;
    homeCity?: { name?: string; state?: string };
    timezone?: string;
    displayBadgeId?: string | null;
  };

  const data: {
    firstName?: string;
    homeCity?: string;
    homeCityLat?: number | null;
    homeCityLng?: number | null;
    timezone?: string;
    displayBadgeId?: string | null;
  } = {};

  if (typeof body.firstName === "string") {
    data.firstName = body.firstName.trim();
  }
  if (body.displayBadgeId !== undefined) {
    data.displayBadgeId = body.displayBadgeId;
  }
  if (body.homeCity?.name) {
    const found = findCityByName(body.homeCity.name, body.homeCity.state);
    if (found) {
      data.homeCity = `${found.name}, ${found.state}`;
      data.homeCityLat = found.lat;
      data.homeCityLng = found.lng;
      data.timezone = found.timezone;
    } else {
      data.homeCity = body.homeCity.state
        ? `${body.homeCity.name}, ${body.homeCity.state}`
        : body.homeCity.name;
      data.homeCityLat = null;
      data.homeCityLng = null;
    }
  }
  if (typeof body.timezone === "string" && !data.timezone) {
    data.timezone = body.timezone;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      firstName: true,
      homeCity: true,
      timezone: true,
    },
  });

  // If the user just set or changed their home city, seed milestones for it.
  // Skip cities the in-memory library already covers (SF, NYC, Charlotte,
  // DC, Boston). Fire-and-forget via waitUntil so the response is fast.
  if (data.homeCity && updated.homeCity) {
    const alreadyHandled = MILESTONES.some(
      (m) => m.requiredCity === updated.homeCity,
    );
    if (!alreadyHandled) {
      try {
        waitUntil(
          generateMilestonesForCity(updated.homeCity).catch((err) =>
            console.error("[profile/update] milestone seed failed:", err),
          ),
        );
      } catch {
        // waitUntil not available in dev — fire without awaiting.
        void generateMilestonesForCity(updated.homeCity).catch((err) =>
          console.error("[profile/update] milestone seed failed:", err),
        );
      }
    }
  }

  return NextResponse.json(updated);
}
