import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

// POST { id?: string }  — remove a single tile id, OR
// POST { all: true }    — clear the list entirely
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    all?: boolean;
  };

  if (body.all) {
    await prisma.user.update({
      where: { id: userId },
      data: { dismissedTiles: [] },
    });
    return NextResponse.json({ success: true, cleared: true });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id or all required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dismissedTiles: true },
  });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.update({
    where: { id: userId },
    data: { dismissedTiles: user.dismissedTiles.filter((t) => t !== body.id) },
  });

  return NextResponse.json({ success: true });
}
