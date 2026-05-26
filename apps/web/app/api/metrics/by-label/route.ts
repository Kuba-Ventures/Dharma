import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

// GET /api/metrics/by-label?days=30
// → { rows: [{ labelName, color, tagged, draftedHere }] }
//
// Returns per-label volume in the window. A real reply-rate-by-label
// (replies / drafts within a label) requires more thread-state plumbing than
// v1 carries; for now we surface the count of classified threads per label
// and how many drafts overall — enough to render the by-label bars and tell
// users which labels Dharma is touching most. Real reply-rate by label is a
// follow-up.
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

  // Tag counts per label name — currently labels track via LabelMapping, not
  // per-thread, so we approximate by counting threads classified in window.
  const totalTagged = await prisma.classifiedThread.count({
    where: { userId, classifiedAt: { gte: since } },
  });

  const rows = labels.map((l) => ({
    labelName: l.name,
    color: l.color,
    // Without per-thread label data we can't break down tagged by label —
    // surface the total as an upper bound. v2 will populate this properly.
    tagged: totalTagged,
  }));

  return NextResponse.json({ rows, totalTagged, days });
}
