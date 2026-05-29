import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

// POST → sets User.lastSeenTier = User.tier so future loads know this tier
// has been acknowledged. Called by MilestoneHero after rendering the
// tier-up confetti, so it only fires once per upgrade.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tier: true },
  });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastSeenTier: user.tier },
  });

  return NextResponse.json({ ok: true });
}
