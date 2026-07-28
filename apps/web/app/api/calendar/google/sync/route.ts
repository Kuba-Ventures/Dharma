import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { makeAuthForUser, setupGmailWatch } from "../../../../../lib/gmail";
import { prisma } from "../../../../../lib/prisma";
import { resyncUserCalendar } from "../../../../../lib/blockReconcile";

// The block-reconcile below makes live Google Calendar calls (each capped by
// withCalendarTimeout); give the function headroom over the browser default.
export const maxDuration = 30;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const cred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!cred) {
    return NextResponse.json(
      { error: "Google account not linked. Sign out and sign back in to reconnect." },
      { status: 401 }
    );
  }

  try {
    const { cred: freshCred } = await makeAuthForUser(userId);
    await setupGmailWatch(userId, freshCred.accessToken, freshCred.refreshToken);
  } catch (err) {
    console.error("[calendar/google/sync] Gmail watch failed:", err);
    const code = (err as { code?: number })?.code;
    if (code === 401) return NextResponse.json({ error: "Google access expired. Sign out and sign back in to reconnect." }, { status: 401 });
    if (code === 403) return NextResponse.json({ error: "Calendar permission denied. Sign out and sign back in to re-grant access." }, { status: 403 });
    return NextResponse.json({ error: "Sync failed. Please try again." }, { status: 502 });
  }

  // Re-mirror the user's scheduling blocks to Google Calendar so "Resync
  // calendar" actually re-creates any block events that drifted out of the
  // calendar (deleted out-of-band, a save that never reached Calendar, blocks
  // created before a Google reconnect) instead of silently doing nothing
  // (issue #84). Best-effort: the Gmail watch above already succeeded, so a
  // calendar hiccup surfaces per-block errors rather than failing the request.
  try {
    const { syncErrors } = await resyncUserCalendar(userId);
    return NextResponse.json({ ok: true, syncErrors });
  } catch (err) {
    console.error("[calendar/google/sync] Block reconcile failed:", err);
    return NextResponse.json({
      ok: true,
      syncErrors: ["Couldn’t re-sync your scheduling blocks — please try again."],
    });
  }
}
