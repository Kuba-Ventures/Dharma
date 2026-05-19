import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [draftAgg, totalAgg, taggedCount] = await Promise.all([
    prisma.usageEvent.aggregate({
      where: { userId, eventType: "draft", createdAt: { gte: weekAgo } },
      _sum: { costUsd: true },
      _count: { _all: true },
    }),
    prisma.usageEvent.aggregate({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      _sum: { costUsd: true },
    }),
    prisma.classifiedThread.count({ where: { userId } }),
  ]);

  const draftsThisWeek = draftAgg._count._all;
  const draftCost = draftAgg._sum.costUsd ?? 0;
  const avgCostPerDraft = draftsThisWeek > 0 ? draftCost / draftsThisWeek : 0;
  const totalSpend30d = totalAgg._sum.costUsd ?? 0;

  return NextResponse.json({
    draftsThisWeek,
    avgCostPerDraft,
    emailsTagged: taggedCount,
    totalSpend30d,
  });
}
