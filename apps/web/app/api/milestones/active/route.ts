import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

// GET → { active: UserMilestone | null, next: MilestoneDef | null }
//
// Returns the most recently achieved milestone (for the hero card) plus the
// next locked milestone the user is closest to. Both can be null for new
// users; the hero renders a "first milestone" placeholder in that case.
// The milestone library is seeded in commit 7; until then this safely
// returns nulls for everyone.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [user, achieved] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        cumulativeSecondsSaved: true,
        homeCity: true,
        firstName: true,
      },
    }),
    prisma.userMilestone.findFirst({
      where: { userId },
      orderBy: { achievedAt: "desc" },
      include: { milestone: true },
    }),
  ]);

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find the lowest-threshold milestone the user has NOT achieved yet.
  const achievedIds = achieved
    ? [achieved.milestoneId]
    : [];
  const next = await prisma.milestoneDef.findFirst({
    where: {
      id: { notIn: achievedIds },
      threshold: { gt: user.cumulativeSecondsSaved },
    },
    orderBy: { threshold: "asc" },
  });

  return NextResponse.json({
    active: achieved
      ? {
          id: achieved.id,
          milestoneId: achieved.milestoneId,
          achievedAt: achieved.achievedAt,
          title: achieved.milestone.title,
          description: achieved.milestone.description,
          gradient: achieved.milestone.gradient,
        }
      : null,
    next: next
      ? {
          id: next.id,
          title: next.title,
          description: next.description,
          threshold: next.threshold,
          gradient: next.gradient,
        }
      : null,
    cumulativeSecondsSaved: user.cumulativeSecondsSaved,
    homeCity: user.homeCity,
    firstName: user.firstName,
  });
}
