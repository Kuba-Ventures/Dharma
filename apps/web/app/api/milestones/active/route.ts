import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import {
  MILESTONES,
  applyTemplate,
  nextLockedMilestone,
  unlockedMilestoneIds,
} from "../../../../lib/milestones";

// GET → most recently unlocked milestone, next locked milestone, and the
// user's cumulative seconds saved. Derives directly from the in-memory
// library + user state — no MilestoneDef table seeding required.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      cumulativeSecondsSaved: true,
      homeCity: true,
      firstName: true,
      name: true,
    },
  });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const firstName = user.firstName ?? user.name?.split(" ")[0] ?? null;
  const unlocked = unlockedMilestoneIds(
    user.cumulativeSecondsSaved,
    user.homeCity,
  );

  // Most recent unlock = highest-threshold unlocked milestone.
  const activeId =
    unlocked
      .map((id) => MILESTONES.find((m) => m.id === id)!)
      .sort((a, b) => b.threshold - a.threshold)[0]?.id ?? null;
  const active = activeId ? MILESTONES.find((m) => m.id === activeId)! : null;

  const next = nextLockedMilestone(
    user.cumulativeSecondsSaved,
    user.homeCity,
  );

  return NextResponse.json({
    active: active
      ? {
          id: active.id,
          milestoneId: active.id,
          achievedAt: new Date().toISOString(),
          title: applyTemplate(active.title, { firstName, city: user.homeCity }),
          description: applyTemplate(active.description, {
            firstName,
            city: user.homeCity,
          }),
          gradient: active.gradient,
        }
      : null,
    next: next
      ? {
          id: next.id,
          title: applyTemplate(next.title, { firstName, city: user.homeCity }),
          description: applyTemplate(next.description, {
            firstName,
            city: user.homeCity,
          }),
          threshold: next.threshold,
          gradient: next.gradient,
        }
      : null,
    cumulativeSecondsSaved: user.cumulativeSecondsSaved,
    homeCity: user.homeCity,
    firstName,
  });
}
