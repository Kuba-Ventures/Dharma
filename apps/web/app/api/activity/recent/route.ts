import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { getRecentActivity } from "../../../../lib/recentActivity";

// GET /api/activity/recent?limit=20
// → { events: ActivityEvent[] }
//
// Mixed stream for the dashboard's Recent activity feed: drafts, signals,
// milestone unlocks, and recent classifications. Sorted desc.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(50, Number(url.searchParams.get("limit") ?? "20")),
  );

  const events = await getRecentActivity(session.user.id, limit);
  return NextResponse.json({ events });
}
