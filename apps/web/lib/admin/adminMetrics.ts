// Read-only Prisma queries behind the admin console. Every query skips
// internal accounts (TEAM_EMAILS + ADMIN_EXCLUDED_EMAILS) so team dogfooding
// never inflates growth or cost-per-user numbers.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readRows, TAB_HEADERS } from "@/lib/adminSheet";
import { adminTimeZone, dayKeyInTimeZone, fillDailySeries, type AdminPeriod, type AdminPeriods } from "./adminRange";

export function internalEmailAddresses(): string[] {
  return [process.env.TEAM_EMAILS, process.env.ADMIN_EXCLUDED_EMAILS]
    .flatMap((rawList) => (rawList ?? "").split(","))
    .map((emailAddress) => emailAddress.trim().toLowerCase())
    .filter(Boolean);
}

// Entries starting with "@" exclude a whole domain, e.g. "@qsbsrollover.com".
async function internalUserIds(): Promise<string[]> {
  const entries = internalEmailAddresses();
  if (entries.length === 0) return [];
  const domains = entries.filter((entry) => entry.startsWith("@"));
  const emailAddresses = entries.filter((entry) => !entry.startsWith("@"));
  const internalUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: emailAddresses, mode: "insensitive" } },
        ...domains.map((domain) => ({ email: { endsWith: domain, mode: "insensitive" as const } })),
      ],
    },
    select: { id: true },
  });
  return internalUsers.map((user) => user.id);
}

type DailyRow = { day_key: string; total: number | null };

function dailyMap(rows: DailyRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.day_key, Number(row.total) || 0]));
}

async function dailyAiSpend(period: AdminPeriod, excludedUserIds: string[]): Promise<number[]> {
  const rows = await prisma.$queryRaw<DailyRow[]>`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${adminTimeZone}, 'YYYY-MM-DD') AS day_key,
           SUM("costUsd")::float8 AS total
    FROM "UsageEvent"
    WHERE "createdAt" >= ${period.start} AND "createdAt" < ${period.end}
      AND NOT ("userId" = ANY(${excludedUserIds}::text[]))
    GROUP BY 1`;
  return fillDailySeries(period.dayKeys, dailyMap(rows));
}

async function dailyActiveUsers(period: AdminPeriod, excludedUserIds: string[]): Promise<number[]> {
  const rows = await prisma.$queryRaw<DailyRow[]>`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${adminTimeZone}, 'YYYY-MM-DD') AS day_key,
           COUNT(DISTINCT "userId")::int AS total
    FROM "UsageEvent"
    WHERE "createdAt" >= ${period.start} AND "createdAt" < ${period.end}
      AND NOT ("userId" = ANY(${excludedUserIds}::text[]))
    GROUP BY 1`;
  return fillDailySeries(period.dayKeys, dailyMap(rows));
}

async function dailySignups(period: AdminPeriod, excludedUserIds: string[]): Promise<number[]> {
  const rows = await prisma.$queryRaw<DailyRow[]>`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${adminTimeZone}, 'YYYY-MM-DD') AS day_key,
           COUNT(*)::int AS total
    FROM "User"
    WHERE "createdAt" >= ${period.start} AND "createdAt" < ${period.end}
      AND NOT ("id" = ANY(${excludedUserIds}::text[]))
    GROUP BY 1`;
  return fillDailySeries(period.dayKeys, dailyMap(rows));
}

function usageWhere(period: AdminPeriod, excludedUserIds: string[]): Prisma.UsageEventWhereInput {
  return { createdAt: { gte: period.start, lt: period.end }, userId: { notIn: excludedUserIds } };
}

async function activeUserCount(period: AdminPeriod, excludedUserIds: string[]): Promise<number> {
  const activeUsers = await prisma.usageEvent.groupBy({ by: ["userId"], where: usageWhere(period, excludedUserIds) });
  return activeUsers.length;
}

async function aiSpendTotal(period: AdminPeriod, excludedUserIds: string[]): Promise<number> {
  const aggregate = await prisma.usageEvent.aggregate({
    where: usageWhere(period, excludedUserIds),
    _sum: { costUsd: true },
  });
  return aggregate._sum.costUsd ?? 0;
}

// ─── Finance ────────────────────────────────────────────────────────────────

export type AiSpendLine = { eventType: string; model: string; events: number; costUsd: number };
export type AiSpendUser = { email: string; tier: string; events: number; costUsd: number };

export type AdminFinanceData = {
  aiSpendUsd: number;
  priorAiSpendUsd: number;
  activeUsers: number;
  priorActiveUsers: number;
  dailyAiSpendUsd: number[];
  spendLines: AiSpendLine[];
  topUsers: AiSpendUser[];
};

export async function loadAdminFinance(periods: AdminPeriods): Promise<AdminFinanceData> {
  const excludedUserIds = await internalUserIds();
  const { current, prior } = periods;
  const [aiSpendUsd, priorAiSpendUsd, activeUsers, priorActiveUsers, dailyAiSpendUsd, lineGroups, userGroups] =
    await Promise.all([
      aiSpendTotal(current, excludedUserIds),
      aiSpendTotal(prior, excludedUserIds),
      activeUserCount(current, excludedUserIds),
      activeUserCount(prior, excludedUserIds),
      dailyAiSpend(current, excludedUserIds),
      prisma.usageEvent.groupBy({
        by: ["eventType", "model"],
        where: usageWhere(current, excludedUserIds),
        _sum: { costUsd: true },
        _count: { _all: true },
      }),
      prisma.usageEvent.groupBy({
        by: ["userId"],
        where: usageWhere(current, excludedUserIds),
        _sum: { costUsd: true },
        _count: { _all: true },
        orderBy: { _sum: { costUsd: "desc" } },
        take: 10,
      }),
    ]);
  const topUserRecords = await prisma.user.findMany({
    where: { id: { in: userGroups.map((group) => group.userId) } },
    select: { id: true, email: true, tier: true },
  });
  const userById = new Map(topUserRecords.map((user) => [user.id, user]));
  return {
    aiSpendUsd,
    priorAiSpendUsd,
    activeUsers,
    priorActiveUsers,
    dailyAiSpendUsd,
    spendLines: lineGroups
      .map((group) => ({
        eventType: group.eventType,
        model: group.model,
        events: group._count._all,
        costUsd: group._sum.costUsd ?? 0,
      }))
      .sort((first, second) => second.costUsd - first.costUsd),
    topUsers: userGroups.map((group) => ({
      email: userById.get(group.userId)?.email ?? group.userId,
      tier: userById.get(group.userId)?.tier ?? "-",
      events: group._count._all,
      costUsd: group._sum.costUsd ?? 0,
    })),
  };
}

// ─── Growth ─────────────────────────────────────────────────────────────────

export type AdminGrowthData = {
  signups: number;
  priorSignups: number;
  activeUsers: number;
  priorActiveUsers: number;
  dailySignups: number[];
  dailyActiveUsers: number[];
  eventCounts: { eventType: string; current: number; prior: number }[];
  funnel: { label: string; count: number | null }[];
  hoursSavedSeconds: number;
  waitlistInRange: number | null;
};

const sevenDayMilliseconds = 7 * 24 * 60 * 60 * 1000;

async function waitlistCounts(period: AdminPeriod): Promise<{ total: number; inRange: number } | null> {
  if (!process.env.ADMIN_SHEET_ID) return null;
  const waitlistRows = await readRows("Waitlist");
  const signedUpColumn = TAB_HEADERS.Waitlist.indexOf("signed_up_at");
  const firstDayKey = period.dayKeys[0];
  const inRange = waitlistRows.filter((row) => {
    const signedUpAt = new Date(row[signedUpColumn] ?? "");
    return !Number.isNaN(signedUpAt.getTime()) && dayKeyInTimeZone(signedUpAt) >= firstDayKey;
  }).length;
  return { total: waitlistRows.length, inRange };
}

export async function loadAdminGrowth(periods: AdminPeriods, now = new Date()): Promise<AdminGrowthData> {
  const excludedUserIds = await internalUserIds();
  const { current, prior } = periods;
  const realUsers: Prisma.UserWhereInput = { id: { notIn: excludedUserIds } };
  const lastSevenDays: AdminPeriod = { dayKeys: [], start: new Date(now.getTime() - sevenDayMilliseconds), end: now };
  const [
    signups,
    priorSignups,
    activeUsers,
    priorActiveUsers,
    signupSeries,
    activeSeries,
    currentEvents,
    priorEvents,
    totalUsers,
    onboardedUsers,
    addonUsers,
    activeLastSevenDays,
    secondsSaved,
    waitlist,
  ] = await Promise.all([
    prisma.user.count({ where: { ...realUsers, createdAt: { gte: current.start, lt: current.end } } }),
    prisma.user.count({ where: { ...realUsers, createdAt: { gte: prior.start, lt: prior.end } } }),
    activeUserCount(current, excludedUserIds),
    activeUserCount(prior, excludedUserIds),
    dailySignups(current, excludedUserIds),
    dailyActiveUsers(current, excludedUserIds),
    prisma.usageEvent.groupBy({ by: ["eventType"], where: usageWhere(current, excludedUserIds), _count: { _all: true } }),
    prisma.usageEvent.groupBy({ by: ["eventType"], where: usageWhere(prior, excludedUserIds), _count: { _all: true } }),
    prisma.user.count({ where: realUsers }),
    prisma.user.count({ where: { ...realUsers, onboardingCompletedAt: { not: null } } }),
    prisma.user.count({ where: { ...realUsers, addonInstalledAt: { not: null } } }),
    activeUserCount(lastSevenDays, excludedUserIds),
    prisma.user.aggregate({ where: realUsers, _sum: { cumulativeSecondsSaved: true } }),
    waitlistCounts(current).catch(() => null),
  ]);
  const priorCountByType = new Map(priorEvents.map((group) => [group.eventType, group._count._all]));
  return {
    signups,
    priorSignups,
    activeUsers,
    priorActiveUsers,
    dailySignups: signupSeries,
    dailyActiveUsers: activeSeries,
    eventCounts: currentEvents
      .map((group) => ({
        eventType: group.eventType,
        current: group._count._all,
        prior: priorCountByType.get(group.eventType) ?? 0,
      }))
      .sort((first, second) => second.current - first.current),
    funnel: [
      { label: "Waitlist", count: waitlist?.total ?? null },
      { label: "Signed up", count: totalUsers },
      { label: "Onboarded", count: onboardedUsers },
      { label: "Add-on installed", count: addonUsers },
      { label: "Active last 7d", count: activeLastSevenDays },
    ],
    hoursSavedSeconds: secondsSaved._sum.cumulativeSecondsSaved ?? 0,
    waitlistInRange: waitlist?.inRange ?? null,
  };
}

// ─── Users ──────────────────────────────────────────────────────────────────

export type AdminUserRow = {
  email: string;
  name: string | null;
  tier: string;
  role: string | null;
  signedUpAt: Date;
  onboarded: boolean;
  addonInstalled: boolean;
  lastActiveAt: Date | null;
  eventsLast30Days: number;
  costLast30DaysUsd: number;
  isInternal: boolean;
};

export async function loadAdminUsers(now = new Date()): Promise<AdminUserRow[]> {
  const excludedUserIds = new Set(await internalUserIds());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [users, recentUsage, lastActivity] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        role: true,
        createdAt: true,
        onboardingCompletedAt: true,
        addonInstalledAt: true,
      },
    }),
    prisma.usageEvent.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _sum: { costUsd: true },
      _count: { _all: true },
    }),
    prisma.usageEvent.groupBy({ by: ["userId"], _max: { createdAt: true } }),
  ]);
  const recentByUserId = new Map(recentUsage.map((group) => [group.userId, group]));
  const lastActiveByUserId = new Map(lastActivity.map((group) => [group.userId, group._max.createdAt]));
  return users.map((user) => ({
    email: user.email,
    name: user.name,
    tier: user.tier,
    role: user.role,
    signedUpAt: user.createdAt,
    onboarded: user.onboardingCompletedAt != null,
    addonInstalled: user.addonInstalledAt != null,
    lastActiveAt: lastActiveByUserId.get(user.id) ?? null,
    eventsLast30Days: recentByUserId.get(user.id)?._count._all ?? 0,
    costLast30DaysUsd: recentByUserId.get(user.id)?._sum.costUsd ?? 0,
    isInternal: excludedUserIds.has(user.id),
  }));
}

// ─── Feedback ───────────────────────────────────────────────────────────────

export type AdminFeedbackRow = {
  email: string;
  kind: string;
  score: number | null;
  message: string | null;
  page: string | null;
  createdAt: Date;
};

export async function loadAdminFeedback(period: AdminPeriod): Promise<AdminFeedbackRow[]> {
  const excludedUserIds = await internalUserIds();
  const feedbackRows = await prisma.feedback.findMany({
    where: { createdAt: { gte: period.start, lt: period.end }, userId: { notIn: excludedUserIds } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { kind: true, score: true, message: true, page: true, createdAt: true, user: { select: { email: true } } },
  });
  return feedbackRows.map((row) => ({
    email: row.user.email,
    kind: row.kind,
    score: row.score,
    message: row.message,
    page: row.page,
    createdAt: row.createdAt,
  }));
}
