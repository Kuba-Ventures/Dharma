import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { timeSavedSeconds } from "../../../../lib/timeSaved";

// GET /api/metrics/timeseries?days=30
// → { points: [{ date: "2026-05-20", draftCount, tagCount, secondsSaved }] }
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const url = new URL(req.url);
  const days = Math.min(
    Math.max(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 1),
    365,
  );

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const [drafts, tags] = await Promise.all([
    prisma.usageEvent.findMany({
      where: { userId, eventType: "draft", createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.classifiedThread.findMany({
      where: { userId, classifiedAt: { gte: since } },
      select: { classifiedAt: true },
    }),
  ]);

  // Bucket by UTC date string.
  const buckets = new Map<string, { draftCount: number; tagCount: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    buckets.set(d.toISOString().slice(0, 10), { draftCount: 0, tagCount: 0 });
  }
  for (const d of drafts) {
    const key = d.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) b.draftCount += 1;
  }
  for (const t of tags) {
    const key = t.classifiedAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) b.tagCount += 1;
  }

  const points = Array.from(buckets.entries()).map(([date, b]) => ({
    date,
    draftCount: b.draftCount,
    tagCount: b.tagCount,
    secondsSaved: timeSavedSeconds(b.draftCount, b.tagCount),
  }));

  const totalSecondsSaved = points.reduce((s, p) => s + p.secondsSaved, 0);

  return NextResponse.json({ days, points, totalSecondsSaved });
}
