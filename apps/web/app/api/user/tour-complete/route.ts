import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

// Marks the dashboard product tour as completed for the signed-in user, so it
// won't auto-show again (it stays replayable via /dashboard?tour=1). Idempotent.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { tourCompletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
