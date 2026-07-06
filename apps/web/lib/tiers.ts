// Tier ladder for the Profile page. Log-scale thresholds on cumulative
// seconds saved — early wins feel fast, partner status feels earned.
//
// Tier is intentionally `string`, not a union. The Prisma schema stores
// `User.tier` as a free-form String, and the TIERS array below is the only
// source of truth at runtime. Adding new tiers is a one-line push to the
// array — consumers iterate, they don't branch on specific tier names.

export type Tier = string;

export type TierSpec = {
  id: Tier;
  threshold: number; // seconds; lower bound (inclusive)
};

export const TIERS: TierSpec[] = [
  { id: "Apprentice", threshold: 0 },
  { id: "Adept", threshold: 3_600 }, // 1h
  { id: "Practitioner", threshold: 18_000 }, // 5h
  { id: "Master", threshold: 72_000 }, // 20h
  { id: "Partner", threshold: 288_000 }, // 80h
];

export function tierFor(secondsSaved: number): Tier {
  let current: Tier = TIERS[0].id;
  for (const t of TIERS) {
    if (secondsSaved >= t.threshold) current = t.id;
    else break;
  }
  return current;
}

// All tier ids in ladder order — used to populate the Users-tab dropdown.
export const TIER_IDS: string[] = TIERS.map((t) => t.id);

// Ladder position of a tier id (0 = Apprentice). Unknown/blank ids return -1,
// so an invalid sheet value always ranks below a real earned tier.
export function tierRank(id: string): number {
  return TIERS.findIndex((t) => t.id === id);
}

// True if `override` is an admin comp that outranks the earned tier — the same
// comp-up condition effectiveTier uses. A blank, unknown, or same/lower
// override is not a comp (tierRank returns -1 for blank/unknown, so it always
// ranks below a real earned tier).
export function isComp(earned: Tier, override: string): boolean {
  return tierRank(override) > tierRank(earned);
}

export function nextTier(currentTier: Tier): TierSpec | null {
  const idx = TIERS.findIndex((t) => t.id === currentTier);
  if (idx === -1 || idx === TIERS.length - 1) return null;
  return TIERS[idx + 1];
}

export function progressToNext(secondsSaved: number): {
  current: Tier;
  next: TierSpec | null;
  progress: number; // 0..1
} {
  const current = tierFor(secondsSaved);
  const next = nextTier(current);
  if (!next) return { current, next: null, progress: 1 };
  const idx = TIERS.findIndex((t) => t.id === current);
  const lower = TIERS[idx].threshold;
  const range = next.threshold - lower;
  const progress = range === 0 ? 1 : Math.min(1, (secondsSaved - lower) / range);
  return { current, next, progress };
}
