import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { tierFor, TIER_IDS, tierRank } from "../../../../lib/tiers";
import { BADGES, IDENTITY_BADGE_IDS, getBadge } from "../../../../lib/badges";
import {
  effectiveMilestones,
  effectiveUnlockedMilestoneIds,
} from "../../../../lib/milestoneResolution";
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

  // --- Pass 1: cumulative seconds + tier + milestone persistence ---
  const users = await prisma.user.findMany({
    select: { id: true, email: true, createdAt: true, homeCity: true },
  });
  let milestonesAwarded = 0;
  const errors: Array<{ email: string | null; step: string; message: string }> = [];
  // email -> { id, earned tier } so Pass 2.7 can mirror/comp tiers without
  // recomputing seconds.
  const tierByEmail = new Map<string, { id: string; earned: string }>();
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

      const unlockedIds = await effectiveUnlockedMilestoneIds(
        cumulativeSecondsSaved,
        u.homeCity,
      );
      const userMilestones = await effectiveMilestones(u.homeCity);
      for (const milestoneId of unlockedIds) {
        const def = userMilestones.find((m) => m.id === milestoneId);
        if (!def) continue;
        try {
          await prisma.milestoneDef.upsert({
            where: { id: def.id },
            create: {
              id: def.id,
              category: def.category,
              title: def.title,
              description: def.description,
              threshold: def.threshold,
              copyTemplate: def.title,
              gradient: def.gradient,
            },
            update: {
              category: def.category,
              title: def.title,
              description: def.description,
              threshold: def.threshold,
              gradient: def.gradient,
            },
          });
          const before = await prisma.userMilestone.findUnique({
            where: {
              userId_milestoneId: { userId: u.id, milestoneId: def.id },
            },
            select: { id: true },
          });
          if (!before) {
            await prisma.userMilestone.create({
              data: { userId: u.id, milestoneId: def.id },
            });
            milestonesAwarded += 1;
          }
        } catch (err) {
          errors.push({
            email: u.email,
            step: `milestone:${def.id}`,
            message: err instanceof Error ? err.message : String(err),
          });
          console.error(
            `[cron] milestone ${def.id} failed for ${u.email}:`,
            err,
          );
        }
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
    tiersComped,
    milestonesAwarded,
    errors: errors.length > 0 ? errors : undefined,
  });
}
