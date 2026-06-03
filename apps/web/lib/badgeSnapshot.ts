// Derives a per-user MetricSnapshot from existing tables (no counter table).
// Single source of truth for both the award path (cron) and the read path
// (the /api/badges progress endpoint + the profile page).

import { prisma } from "./prisma";
import { timeSavedSeconds } from "./timeSaved";
import { identityBadgesForEmail, type MetricSnapshot } from "./badges";
import {
  effectiveMilestones,
  effectiveUnlockedMilestoneIds,
} from "./milestoneResolution";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const EMPTY_SNAPSHOT: MetricSnapshot = {
  draftsGenerated: 0,
  timeSavedSec: 0,
  threadsLabeled: 0,
  toneModesUsed: 0,
  gmailConnected: false,
  calendarConnected: false,
  toneTrained: false,
  onboardingComplete: false,
  dealHawk: false,
  dayOne: false,
  founding100: false,
  oneYear: false,
  geoMilestone: false,
};

type BuildOpts = {
  // When the caller already knows the founding-100 cohort (the cron computes it
  // once for all users), pass it to skip a per-user createdAt count.
  foundingIds?: Set<string>;
  // "now" override for deterministic tests; defaults to Date.now().
  nowMs?: number;
};

// The first 100 user ids by signup time. Computed once by the cron and passed
// into buildSnapshot so the per-user path doesn't run N count queries.
export async function foundingCohortIds(): Promise<Set<string>> {
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

export async function buildSnapshot(userId: string, opts: BuildOpts = {}): Promise<MetricSnapshot> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      createdAt: true,
      homeCity: true,
      toneSummary: true,
      toneProfile: true,
      onboardingCompletedAt: true,
      googleCredential: { select: { id: true } },
      microsoftCredential: { select: { id: true } },
      appleCredential: { select: { id: true } },
    },
  });
  if (!user) return { ...EMPTY_SNAPSHOT };

  const nowMs = opts.nowMs ?? Date.now();

  const [draftCount, threadsLabeled, toneGroups, dealSignal, beforeCount] = await Promise.all([
    prisma.usageEvent.count({ where: { userId, eventType: "draft" } }),
    prisma.classifiedThread.count({ where: { userId } }),
    prisma.usageEvent.groupBy({
      by: ["tone"],
      where: { userId, eventType: "draft", tone: { not: null } },
    }),
    prisma.signal.findFirst({
      where: { userId, kind: { in: ["deal_flow", "term_sheet"] } },
      select: { id: true },
    }),
    opts.foundingIds
      ? Promise.resolve<number | null>(null)
      : prisma.user.count({ where: { createdAt: { lt: user.createdAt } } }),
  ]);

  const timeSavedSec = timeSavedSeconds(draftCount, threadsLabeled);

  // Google grant covers both Gmail and Calendar; Microsoft/Apple add calendar.
  const gmailConnected = !!user.googleCredential;
  const calendarConnected =
    !!user.googleCredential || !!user.microsoftCredential || !!user.appleCredential;

  // Geo milestone (the "mountain-mover" tie-in) — reuse the milestone resolver.
  const [unlocked, milestones] = await Promise.all([
    effectiveUnlockedMilestoneIds(timeSavedSec, user.homeCity),
    effectiveMilestones(user.homeCity),
  ]);
  const geoMilestone = unlocked.some((id) => !!milestones.find((m) => m.id === id)?.requiredCity);

  const founding100 = opts.foundingIds
    ? opts.foundingIds.has(userId)
    : (beforeCount ?? Infinity) < 100;

  return {
    draftsGenerated: draftCount,
    timeSavedSec,
    threadsLabeled,
    toneModesUsed: toneGroups.length,
    gmailConnected,
    calendarConnected,
    toneTrained: !!(user.toneSummary || user.toneProfile),
    onboardingComplete: !!user.onboardingCompletedAt,
    dealHawk: !!dealSignal,
    dayOne: identityBadgesForEmail(user.email).includes("beta"),
    founding100,
    oneYear: nowMs - user.createdAt.getTime() >= ONE_YEAR_MS,
    geoMilestone,
  };
}
