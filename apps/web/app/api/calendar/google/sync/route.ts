import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { makeAuthForUser, setupGmailWatch } from "../../../../../lib/gmail";
import { prisma } from "../../../../../lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const cred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!cred) {
    return NextResponse.json(
      { error: "Google account not linked — sign out and sign back in to reconnect" },
      { status: 401 }
    );
  }

  try {
    const { cred: freshCred } = await makeAuthForUser(userId);
    await setupGmailWatch(userId, freshCred.accessToken, freshCred.refreshToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[calendar/google/sync] Failed:", err);
    const code = (err as { code?: number })?.code;
    if (code === 401) return NextResponse.json({ error: "Google access expired — sign out and sign back in to reconnect" }, { status: 401 });
    if (code === 403) return NextResponse.json({ error: "Calendar permission denied — sign out and sign back in to re-grant access" }, { status: 403 });
    return NextResponse.json({ error: "Sync failed — please try again" }, { status: 502 });
  }
}
