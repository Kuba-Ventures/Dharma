import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { buildSnapshot } from "../../../../lib/badgeSnapshot";
import {
  earnedAchievementBadges,
  groupProgress,
  identityBadgesForEmail,
  resolveBadgeId,
  type BadgeGroup,
} from "../../../../lib/badges";

// Groups surfaced with progress. Tiered groups (drafts/time_saved/organization/
// tone) drive the dashboard rings; boolean groups are included for completeness.
const PROGRESS_GROUPS: BadgeGroup[] = [
  "drafts",
  "time_saved",
  "organization",
  "tone",
  "onboarding",
  "tenure",
  "geo",
];

// GET /api/badges/:userId — earned badges + per-group progress. Self-only
// (mirrors /api/metrics). `:userId` may be "me".
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = await params;
  const targetId = userId === "me" ? session.user.id : userId;
  if (targetId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [snapshot, dbUser, userBadges] = await Promise.all([
    buildSnapshot(targetId),
    prisma.user.findUnique({ where: { id: targetId }, select: { email: true } }),
    prisma.userBadge.findMany({ where: { userId: targetId }, select: { badgeId: true } }),
  ]);

  // Merge persisted (sheet identity + previously awarded), live env identity,
  // and freshly derived achievements; map any retired ids forward.
  const earned = Array.from(
    new Set([
      ...userBadges.map((b) => resolveBadgeId(b.badgeId)),
      ...identityBadgesForEmail(dbUser?.email ?? null),
      ...earnedAchievementBadges(snapshot),
    ]),
  );

  const groups = PROGRESS_GROUPS.map((g) => groupProgress(g, snapshot));

  return NextResponse.json({ earned, groups });
}
