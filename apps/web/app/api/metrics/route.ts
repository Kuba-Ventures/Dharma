import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { countSentInWindow } from "../../../lib/gmail";

// Assumed manual-equivalent time per AI action — used by the Time Saved cell.
// Conservative defaults; tweak here if user research suggests different numbers.
const SECONDS_SAVED_PER_DRAFT = 180;  // 3 min to read + craft a reply
const SECONDS_SAVED_PER_TAG = 30;     // 30 sec to triage + label an email

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [draftAgg, totalAgg, taggedCount, taggedThisWeek, sentThisWeek] = await Promise.all([
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
    prisma.classifiedThread.count({ where: { userId, classifiedAt: { gte: weekAgo } } }),
    countSentInWindow(userId, 7),
  ]);

  const draftsThisWeek = draftAgg._count._all;
  const draftCost = draftAgg._sum.costUsd ?? 0;
  const avgCostPerDraft = draftsThisWeek > 0 ? draftCost / draftsThisWeek : 0;
  const totalSpend30d = totalAgg._sum.costUsd ?? 0;

  const timeSavedSecondsThisWeek =
    draftsThisWeek * SECONDS_SAVED_PER_DRAFT + taggedThisWeek * SECONDS_SAVED_PER_TAG;

  // Reply Rate (7d): rough proxy for "did our drafts get used". If Gmail call
  // failed or the user has no drafts yet, return null so the UI shows "—"
  // instead of a misleading 0%.
  const replyRate7d =
    sentThisWeek == null || draftsThisWeek === 0
      ? null
      : Math.min(1, sentThisWeek / draftsThisWeek);

  return NextResponse.json({
    draftsThisWeek,
    avgCostPerDraft,
    emailsTagged: taggedCount,
    totalSpend30d,
    timeSavedSecondsThisWeek,
    replyRate7d,
  });
}
