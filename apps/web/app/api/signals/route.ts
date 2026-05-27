import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

// GET /api/signals?unread=1 → { signals, unreadCount }
// Producers don't exist yet — this surface returns whatever's in the table
// and an unread count. Real signal detection (deal/term-sheet language via
// Claude) is a follow-up. The sidebar badge reads this endpoint.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";

  const [signals, unreadCount] = await Promise.all([
    prisma.signal.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.signal.count({ where: { userId, readAt: null } }),
  ]);

  return NextResponse.json({ signals, unreadCount });
}
