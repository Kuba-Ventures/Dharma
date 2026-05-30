import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { renewGmailWatch, setupGmailWatch } from "../../../../lib/gmail";

// Gmail Pub/Sub watches expire after 7 days. This cron renews any watch
// expiring within the next 48 hours so a single missed run still leaves
// a buffer. Idempotent — re-calling users.watch replaces the existing watch.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const renewBy = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const stale = await prisma.googleCredential.findMany({
    where: {
      OR: [{ gmailWatchExpiry: null }, { gmailWatchExpiry: { lt: renewBy } }],
    },
    select: {
      userId: true,
      email: true,
      accessToken: true,
      refreshToken: true,
      gmailHistoryId: true,
    },
  });

  const results: Array<{ email: string; status: "renewed" | "seeded" | "failed"; error?: string }> = [];
  for (const cred of stale) {
    try {
      // First-time setup also needs gmailHistoryId seeded; renewal must not
      // overwrite an existing historyId (would drop in-flight messages).
      if (cred.gmailHistoryId) {
        await renewGmailWatch(cred.userId, cred.accessToken, cred.refreshToken);
        results.push({ email: cred.email, status: "renewed" });
      } else {
        await setupGmailWatch(cred.userId, cred.accessToken, cred.refreshToken);
        results.push({ email: cred.email, status: "seeded" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron/renew-watches] ${cred.email} failed:`, message);
      results.push({ email: cred.email, status: "failed", error: message });
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    candidates: stale.length,
    renewed: results.filter((r) => r.status === "renewed").length,
    seeded: results.filter((r) => r.status === "seeded").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  });
}
