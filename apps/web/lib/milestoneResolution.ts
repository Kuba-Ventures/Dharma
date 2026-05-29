// Server-only milestone resolution that merges the in-memory library
// (universal entries + a handful of hand-curated city ones) with
// DB-stored entries generated lazily by lib/milestoneGenerator.ts.
//
// Edge routes (e.g. /api/share/milestone) keep using lib/milestones.ts
// directly — those only need the in-memory entries and can't import
// Prisma. This helper is for Node-only routes.

import { prisma } from "./prisma";
import { MILESTONES, type Milestone } from "./milestones";

export type ResolvedMilestone = Milestone;

export async function effectiveMilestones(
  homeCity: string | null,
): Promise<ResolvedMilestone[]> {
  const fromLib = MILESTONES.filter(
    (m) => !m.requiredCity || m.requiredCity === homeCity,
  );
  if (!homeCity) return fromLib;

  const fromDb = await prisma.milestoneDef.findMany({
    where: { requiredCity: homeCity },
    select: {
      id: true,
      category: true,
      title: true,
      description: true,
      threshold: true,
      gradient: true,
    },
  });

  const knownIds = new Set(fromLib.map((m) => m.id));
  const dbMapped: ResolvedMilestone[] = fromDb
    .filter((m) => !knownIds.has(m.id))
    .map((m) => ({
      id: m.id,
      category: (m.category as Milestone["category"]) ?? "regional",
      title: m.title,
      description: m.description,
      threshold: m.threshold ?? 0,
      requiredCity: homeCity,
      gradient: m.gradient,
    }));

  return [...fromLib, ...dbMapped];
}

export async function effectiveUnlockedMilestoneIds(
  secondsSaved: number,
  homeCity: string | null,
): Promise<string[]> {
  const all = await effectiveMilestones(homeCity);
  return all
    .filter((m) => {
      if (secondsSaved < m.threshold) return false;
      if (m.requiredCity && m.requiredCity !== homeCity) return false;
      return true;
    })
    .map((m) => m.id);
}

export async function effectiveNextLockedMilestone(
  secondsSaved: number,
  homeCity: string | null,
): Promise<ResolvedMilestone | null> {
  const all = await effectiveMilestones(homeCity);
  return (
    all
      .filter((m) => {
        if (secondsSaved >= m.threshold) return false;
        if (m.requiredCity && m.requiredCity !== homeCity) return false;
        return true;
      })
      .sort((a, b) => a.threshold - b.threshold)[0] ?? null
  );
}
