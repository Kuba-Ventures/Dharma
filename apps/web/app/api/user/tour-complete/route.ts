import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

// GET → current tour state for the signed-in user, so page tours can decide
// whether to auto-show: { tourCompletedAt, toursSeen }.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tourCompletedAt: true, toursSeen: true },
  });
  return NextResponse.json({
    tourCompletedAt: user?.tourCompletedAt ?? null,
    toursSeen: user?.toursSeen ?? [],
  });
}

// POST → mark a tour completed so it won't auto-show again (stays replayable
// via ?tour=1). Body { tour?: string }: with an id, the id is added to the
// per-page toursSeen list; without one, the dashboard tour's tourCompletedAt is
// stamped. Idempotent.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const body = (await req.json().catch(() => ({}))) as { tour?: string };
  const tour = typeof body.tour === "string" ? body.tour.trim() : "";

  if (tour) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { toursSeen: true },
    });
    const seen = user?.toursSeen ?? [];
    if (!seen.includes(tour)) {
      await prisma.user.update({
        where: { id: userId },
        data: { toursSeen: { set: [...seen, tour] } },
      });
    }
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { tourCompletedAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
