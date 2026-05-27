import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { tierFor } from "../../../../lib/tiers";
import { BADGES, getBadge } from "../../../../lib/badges";
import { appendRow, ensureHeaders, readRows } from "../../../../lib/adminSheet";

// Seconds-saved constants — same as /api/metrics + /api/metrics/timeseries.
const SECONDS_SAVED_PER_DRAFT = 180;
const SECONDS_SAVED_PER_TAG = 30;

// GET /api/cron/awards
// Protected by header `Authorization: Bearer <CRON_SECRET>` so only Vercel
// Cron (or you, with the env var) can trigger it. Two responsibilities:
//
// 1. Walk every user, recompute cumulativeSecondsSaved from UsageEvent +
//    ClassifiedThread totals, update tier accordingly.
// 2. Sync identity badges from the Subscribers tab of the admin sheet. The
//    `badges` column (E) holds a comma-separated list of badge_ids per row.
//    The cron upserts matching UserBadge rows so the Profile page reflects
//    sheet edits the next day. Achievement badges remain derived at render
//    time — only identity badges sync via the sheet.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Pass 0: stamp tab headers so the sheet shows expected columns even
  // before any traffic. Idempotent — only writes if row 1 is empty. ---
  await Promise.all([
    ensureHeaders("Waitlist"),
    ensureHeaders("Subscribers"),
    ensureHeaders("Debugging"),
  ]);

  // --- Pass 1: cumulative seconds + tier ---
  const users = await prisma.user.findMany({
    select: { id: true, email: true, createdAt: true },
  });
  for (const u of users) {
    const [draftCount, tagCount] = await Promise.all([
      prisma.usageEvent.count({ where: { userId: u.id, eventType: "draft" } }),
      prisma.classifiedThread.count({ where: { userId: u.id } }),
    ]);
    const cumulativeSecondsSaved =
      draftCount * SECONDS_SAVED_PER_DRAFT + tagCount * SECONDS_SAVED_PER_TAG;
    const tier = tierFor(cumulativeSecondsSaved);
    await prisma.user.update({
      where: { id: u.id },
      data: { cumulativeSecondsSaved, tier },
    });
  }

  // --- Pass 2: ensure BadgeDef rows exist for everything in lib/badges.ts ---
  // UserBadge has a FK to BadgeDef, so we upsert the catalogue before linking.
  // The library is the source of truth; the table is a queryable mirror.
  for (const b of BADGES) {
    await prisma.badgeDef.upsert({
      where: { id: b.id },
      create: {
        id: b.id,
        title: b.title,
        description: b.description,
        kind: b.kind,
        criteria: {},
      },
      update: {
        title: b.title,
        description: b.description,
        kind: b.kind,
      },
    });
  }

  // --- Pass 2.5: ensure every User has a Subscribers row ---
  // The Subscribers tab is "all tracked users" — so every DB user should be
  // there. Append-only: existing rows are left untouched so admin edits to
  // tier / badges / notes survive across runs.
  const existingSubscribersRows = await readRows("Subscribers");
  const existingEmails = new Set(
    existingSubscribersRows
      .map((r) => (r[0] ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  let backfilled = 0;
  for (const u of users) {
    if (!u.email) continue;
    if (existingEmails.has(u.email.toLowerCase())) continue;
    await appendRow("Subscribers", [
      u.email,
      "", // tier — admin fills in (subscriber/advisor/beta-tester/founder/investor)
      u.createdAt.toISOString(),
      "", // stripe_customer_id
      "", // badges
      "", // notes
    ]);
    backfilled += 1;
  }

  // --- Pass 3: sync identity badges from Subscribers sheet ---
  // Sheet columns: email | tier | started_at | stripe_customer_id | badges | notes
  // Re-read after backfill so the new rows are included in the badge pass.
  const rows = await readRows("Subscribers");
  const emailToBadgeIds = new Map<string, string[]>();
  for (const r of rows) {
    const email = (r[0] ?? "").trim().toLowerCase();
    if (!email) continue;
    const badgesCell = r[4] ?? "";
    const badgeIds = badgesCell
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((id) => !!getBadge(id)); // ignore typos
    if (badgeIds.length > 0) emailToBadgeIds.set(email, badgeIds);
  }

  let grantedCount = 0;
  for (const [email, badgeIds] of emailToBadgeIds) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) continue; // sheet has rows for non-users (e.g. future hires); skip
    for (const badgeId of badgeIds) {
      const existing = await prisma.userBadge.findUnique({
        where: { userId_badgeId: { userId: user.id, badgeId } },
      });
      if (existing) continue;
      await prisma.userBadge.create({ data: { userId: user.id, badgeId } });
      grantedCount += 1;
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    usersScanned: users.length,
    subscribersBackfilled: backfilled,
    sheetRows: rows.length,
    badgesGranted: grantedCount,
  });
}
