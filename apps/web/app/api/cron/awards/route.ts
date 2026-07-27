import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { tierFor, TIER_IDS, tierRank } from "../../../../lib/tiers";
import {
  BADGES,
  IDENTITY_BADGE_IDS,
  getBadge,
  earnedAchievementBadges,
} from "../../../../lib/badges";
import { buildSnapshot, foundingCohortIds } from "../../../../lib/badgeSnapshot";
import {
  appendRow,
  batchUpdateCells,
  ensureHeaders,
  readRows,
  setColumnDropdown,
} from "../../../../lib/adminSheet";
import { timeSavedSeconds } from "../../../../lib/timeSaved";

// GET /api/cron/awards
// Protected by header `Authorization: Bearer <CRON_SECRET>` so only Vercel
// Cron (or you, with the env var) can trigger it. Two responsibilities:
//
// 1. Walk every user, recompute cumulativeSecondsSaved from UsageEvent +
//    ClassifiedThread totals, update tier accordingly.
// 2. Sync identity badges from the Users tab of the admin sheet. The
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
  // before any traffic. Idempotent — only writes if row 1 is empty.
  // Also apply the identity-badge dropdown to Users!E so admins pick
  // from a valid list instead of free-typing. Non-strict mode allows
  // comma-separated overrides like "founder,advisor". ---
  await Promise.all([
    ensureHeaders("Waitlist"),
    ensureHeaders("Users"),
    ensureHeaders("Debugging"),
  ]);
  await setColumnDropdown("Users", "E", IDENTITY_BADGE_IDS);
  await setColumnDropdown("Users", "B", TIER_IDS);

  // --- Pass 1: cumulative seconds + tier ---
  const users = await prisma.user.findMany({
    select: { id: true, email: true, createdAt: true },
  });
  let achievementsAwarded = 0;
  // First-100-by-signup cohort, computed once and reused per user.
  const foundingIds = await foundingCohortIds();
  const errors: Array<{ email: string | null; step: string; message: string }> = [];
  // email -> { id, earned tier } so Pass 2.7 can mirror/comp tiers without
  // recomputing seconds.
  const tierByEmail = new Map<string, { id: string; earned: string }>();

  // --- Catalogue: ensure BadgeDef rows exist BEFORE any awards ---
  // UserBadge has a FK to BadgeDef, so the catalogue must exist before the
  // per-user loop below creates achievement UserBadge rows. The library is the
  // source of truth; the BadgeDef table is a queryable mirror.
  for (const b of BADGES) {
    const criteria = {
      group: b.group ?? null,
      tier: b.tier ?? null,
      metric: b.metric ?? null,
      threshold: b.threshold ?? null,
    };
    await prisma.badgeDef.upsert({
      where: { id: b.id },
      create: { id: b.id, title: b.title, description: b.description, kind: b.kind, criteria },
      update: { title: b.title, description: b.description, kind: b.kind, criteria },
    });
  }

  for (const u of users) {
    try {
      const [draftCount, tagCount] = await Promise.all([
        prisma.usageEvent.count({ where: { userId: u.id, eventType: "draft" } }),
        prisma.classifiedThread.count({ where: { userId: u.id } }),
      ]);
      const cumulativeSecondsSaved = timeSavedSeconds(draftCount, tagCount);
      const tier = tierFor(cumulativeSecondsSaved);
      await prisma.user.update({
        where: { id: u.id },
        data: { cumulativeSecondsSaved, tier },
      });
      if (u.email) tierByEmail.set(u.email.toLowerCase(), { id: u.id, earned: tier });

      // --- Pass 1.5: award achievement badges from a derived snapshot ---
      // Idempotent: skip ids already granted (the unique constraint backstops).
      const snapshot = await buildSnapshot(u.id, { foundingIds });
      for (const badgeId of earnedAchievementBadges(snapshot)) {
        const existing = await prisma.userBadge.findUnique({
          where: { userId_badgeId: { userId: u.id, badgeId } },
          select: { id: true },
        });
        if (existing) continue;
        await prisma.userBadge.create({ data: { userId: u.id, badgeId } });
        achievementsAwarded += 1;
      }
    } catch (err) {
      errors.push({
        email: u.email,
        step: "user-pass",
        message: err instanceof Error ? err.message : String(err),
      });
      console.error(`[cron] user pass failed for ${u.email}:`, err);
    }
  }

  // --- Pass 2.5: ensure every User has a Users row ---
  // The Users tab is "all tracked users" — so every DB user should be
  // there. Append-only: existing rows are left untouched so admin edits to
  // tier / badges / notes survive across runs.
  const existingUsersRows = await readRows("Users");
  const existingEmails = new Set(
    existingUsersRows
      .map((r) => (r[0] ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  let backfilled = 0;
  for (const u of users) {
    if (!u.email) continue;
    if (existingEmails.has(u.email.toLowerCase())) continue;
    await appendRow("Users", [
      u.email,
      "", // tier — admin fills in (team/prospect/partner/etc)
      u.createdAt.toISOString(),
      "", // stripe_customer_id
      "", // badges
      "", // notes
    ]);
    backfilled += 1;
  }

  // --- Pass 3: sync identity badges from Users sheet ---
  // Sheet columns: email | tier | started_at | stripe_customer_id | badges | notes
  // Re-read after backfill so the new rows are included in the badge pass.
  const rows = await readRows("Users");

  // --- Pass 2.7: two-way tier sync (comp-up, single column) ---
  // The Users tab's Tier column (B) mirrors each user's current tier. An admin
  // can pick a HIGHER tier to comp a user up — that sticks because we take the
  // higher of (earned, sheet). A same/lower/blank value reverts to earned, so
  // a stale mirror can never silently demote anyone.
  const tierCellUpdates: { range: string; value: string }[] = [];
  let tiersComped = 0;
  for (let i = 0; i < rows.length; i++) {
    const email = (rows[i][0] ?? "").trim().toLowerCase();
    if (!email) continue;
    const entry = tierByEmail.get(email);
    if (!entry) continue; // sheet row without a matching user
    const sheetTier = (rows[i][1] ?? "").trim();
    const effective =
      tierRank(sheetTier) > tierRank(entry.earned) ? sheetTier : entry.earned;
    if (effective !== entry.earned) {
      await prisma.user.update({ where: { id: entry.id }, data: { tier: effective } });
      tiersComped += 1;
    }
    if ((rows[i][1] ?? "") !== effective) {
      tierCellUpdates.push({ range: `Users!B${i + 2}`, value: effective });
    }
  }
  await batchUpdateCells(tierCellUpdates);

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
    achievementsAwarded,
    tiersComped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
