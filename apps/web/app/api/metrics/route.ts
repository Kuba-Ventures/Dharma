import { NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { countSentInWindow, makeAuthForUser } from "../../../lib/gmail";
import {
  SECONDS_SAVED_PER_DRAFT,
  SECONDS_SAVED_PER_TAG,
  timeSavedSeconds,
} from "../../../lib/timeSaved";

// Approximate count of all sent messages, no time filter. Used for the
// all-time reply-rate variant. Returns null on Gmail-API failure so the UI can
// show "—" rather than a misleading zero.
async function countSentAllTime(userId: string): Promise<number | null> {
  try {
    const { auth } = await makeAuthForUser(userId);
    const gmail = google.gmail({ version: "v1", auth });
    const res = await gmail.users.messages.list({
      userId: "me",
      q: "in:sent",
      maxResults: 1,
    });
    return res.data.resultSizeEstimate ?? 0;
  } catch (err) {
    console.error("[metrics] countSentAllTime failed:", err);
    return null;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    draftAgg,
    totalAgg,
    draftsAllTime,
    taggedThisWeek,
    sentThisWeek,
    sentAllTime,
  ] = await Promise.all([
    prisma.usageEvent.aggregate({
      where: { userId, eventType: "draft", createdAt: { gte: weekAgo } },
      _sum: { costUsd: true },
      _count: { _all: true },
    }),
    prisma.usageEvent.aggregate({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      _sum: { costUsd: true },
    }),
    prisma.usageEvent.count({ where: { userId, eventType: "draft" } }),
    prisma.classifiedThread.count({
      where: { userId, classifiedAt: { gte: weekAgo } },
    }),
    countSentInWindow(userId, 7),
    countSentAllTime(userId),
  ]);

  const draftsThisWeek = draftAgg._count._all;
  const draftCost = draftAgg._sum.costUsd ?? 0;
  const avgCostPerDraft = draftsThisWeek > 0 ? draftCost / draftsThisWeek : 0;
  const totalSpend30d = totalAgg._sum.costUsd ?? 0;

  const timeSavedSecondsThisWeek = timeSavedSeconds(draftsThisWeek, taggedThisWeek);

  // Reply rate: ratio of sent vs. drafted. Returns null when we have no
  // drafts to compare against or the Gmail call failed — beats a misleading
  // 0%. Both windows clamp to 1.0.
  const replyRate7d =
    sentThisWeek == null || draftsThisWeek === 0
      ? null
      : Math.min(1, sentThisWeek / draftsThisWeek);

  const replyRateAllTime =
    sentAllTime == null || draftsAllTime === 0
      ? null
      : Math.min(1, sentAllTime / draftsAllTime);

  return NextResponse.json({
    draftsThisWeek,
    avgCostPerDraft,
    // emailsTagged is windowed to this week to match the surrounding tiles.
    // Earlier shape returned an all-time count here; that diverged from the
    // "this week" framing and from /api/metrics/by-label.
    emailsTagged: taggedThisWeek,
    totalSpend30d,
    timeSavedSecondsThisWeek,
    replyRate7d,
    replyRateAllTime,
    // Surfaced so the dashboard label-status card can describe the same
    // window as the Metrics tab. Equivalent to the totalTagged returned by
    // /api/metrics/by-label?days=7 when called with the default 30 days.
    constants: {
      secondsSavedPerDraft: SECONDS_SAVED_PER_DRAFT,
      secondsSavedPerTag: SECONDS_SAVED_PER_TAG,
    },
  });
}
