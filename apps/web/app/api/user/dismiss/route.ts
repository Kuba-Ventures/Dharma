import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

// POST { id } — add the tile id to the user's dismissedTiles list.
// Idempotent: re-dismissing a tile that's already hidden is a no-op.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dismissedTiles: true },
  });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.dismissedTiles.includes(id)) {
    return NextResponse.json({ success: true, already: true });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { dismissedTiles: { push: id } },
  });

  return NextResponse.json({ success: true });
}
