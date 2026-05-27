// Tier ladder for the Profile page. Log-scale thresholds on cumulative
// seconds saved — early wins feel fast, partner status feels earned.

export type Tier =
  | "Apprentice"
  | "Adept"
  | "Practitioner"
  | "Master"
  | "Partner";

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
