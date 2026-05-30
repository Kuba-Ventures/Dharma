import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

// GET /api/metrics/by-label?days=30
// → { rows: [{ labelName, color, tagged, drafted, draftRate }], totalTagged, days }
//
// Per-label volume + draft-generation rate within the window. Reply rate
// proper (recipient actually replied) is still a v2 follow-up — that requires
// per-thread Gmail polling — but draftRate (drafts ÷ tagged) is a useful
// signal of which categories Dharma is engaging with.
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
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const labels = await prisma.label.findMany({
    where: { userId },
    select: { name: true, color: true },
    orderBy: { order: "asc" },
  });

  // Group classified threads by labelName within the window.
  const threadsInWindow = await prisma.classifiedThread.findMany({
    where: { userId, classifiedAt: { gte: since } },
    select: { labelName: true, draftCreated: true },
  });

  const totalTagged = threadsInWindow.length;
  const taggedBy = new Map<string, { tagged: number; drafted: number }>();
  let unlabeledTagged = 0;
  let unlabeledDrafted = 0;
  for (const t of threadsInWindow) {
    if (!t.labelName) {
      unlabeledTagged += 1;
      if (t.draftCreated) unlabeledDrafted += 1;
      continue;
    }
    const entry = taggedBy.get(t.labelName) ?? { tagged: 0, drafted: 0 };
    entry.tagged += 1;
    if (t.draftCreated) entry.drafted += 1;
    taggedBy.set(t.labelName, entry);
  }

  const rows = labels.map((l) => {
    const stats = taggedBy.get(l.name) ?? { tagged: 0, drafted: 0 };
    return {
      labelName: l.name,
      color: l.color,
      tagged: stats.tagged,
      drafted: stats.drafted,
      draftRate: stats.tagged > 0 ? stats.drafted / stats.tagged : 0,
    };
  });

  return NextResponse.json({
    rows,
    totalTagged,
    unlabeled: { tagged: unlabeledTagged, drafted: unlabeledDrafted },
    days,
  });
}
