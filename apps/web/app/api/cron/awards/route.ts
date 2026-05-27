import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { tierFor } from "../../../../lib/tiers";

// Seconds-saved constants — same as /api/metrics + /api/metrics/timeseries.
const SECONDS_SAVED_PER_DRAFT = 180;
const SECONDS_SAVED_PER_TAG = 30;

// GET /api/cron/awards
// Protected by header `Authorization: Bearer <CRON_SECRET>` so only Vercel
// Cron (or you, with the env var) can trigger it. Walks every user, recomputes
// cumulative seconds saved from UsageEvent + ClassifiedThread totals, and
// updates User.cumulativeSecondsSaved + User.tier accordingly.
//
// Down the road this is also where milestone unlocks should write rows into
// UserMilestone (with idempotency on (userId, milestoneId)) and where badge
// auto-awards live. For now the in-memory libraries derive both at render
// time, so this job's only responsibility is keeping cumulativeSecondsSaved
// honest.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  let updated = 0;

  for (const u of users) {
    const [draftCount, tagCount] = await Promise.all([
      prisma.usageEvent.count({ where: { userId: u.id, eventType: "draft" } }),
      prisma.classifiedThread.count({ where: { userId: u.id } }),
    ]);
    const cumulativeSecondsSaved =
      draftCount * SECONDS_SAVED_PER_DRAFT + tagCount * SECONDS_SAVED_PER_TAG;
    const tier = tierFor(cumulativeSecondsSaved);

    await prisma.user.update({
      where: { id: u.id },
      data: { cumulativeSecondsSaved, tier },
    });
    updated += 1;
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    users: updated,
  });
}
