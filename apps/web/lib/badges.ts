// In-memory badge library. Identity badges are awarded by email allowlist
// (env vars). Achievement badges are derived from user state at render time —
// no separate award engine yet; we'll add UserBadge persistence + cron in a
// follow-up if engagement signals justify it.

export type Badge = {
  id: string;
  title: string;
  description: string;
  kind: "identity" | "achievement";
  icon: "crown" | "flask" | "compass" | "briefcase" | "sparkles" | "waveform" | "tags" | "bolt" | "mountain" | "running" | "radar";
  color: "amber" | "violet" | "blue" | "teal" | "brand";
};

export const BADGES: Badge[] = [
  // Identity
  { id: "founder", title: "Founder", description: "Builds Dharma.", kind: "identity", icon: "crown", color: "amber" },
  { id: "beta-tester", title: "Beta tester", description: "Joined while the door was still closed.", kind: "identity", icon: "flask", color: "violet" },
  { id: "advisor", title: "Advisor", description: "Pushes the strategy.", kind: "identity", icon: "compass", color: "blue" },
  { id: "investor", title: "Investor", description: "Believes in the bet.", kind: "identity", icon: "briefcase", color: "teal" },
  // Achievement
  { id: "welcome-aboard", title: "Welcome aboard", description: "Finished onboarding.", kind: "achievement", icon: "sparkles", color: "brand" },
  { id: "tone-deaf-no-more", title: "Tone-deaf no more", description: "Trained Dharma on your sent mail.", kind: "achievement", icon: "waveform", color: "brand" },
  { id: "triage-master", title: "Triage master", description: "100 emails auto-labeled.", kind: "achievement", icon: "tags", color: "brand" },
  { id: "marathoner", title: "Marathoner", description: "4+ cumulative hours saved.", kind: "achievement", icon: "running", color: "brand" },
  { id: "mountain-mover", title: "Mountain mover", description: "Unlocked your first geographic milestone.", kind: "achievement", icon: "mountain", color: "brand" },
];

export function getBadge(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}

// Identity allowlist evaluation — single source of truth so the seed,
// signin event handler, and Profile page agree.
export function identityBadgesForEmail(email: string | null): string[] {
  if (!email) return [];
  const lower = email.toLowerCase();
  const ids: string[] = [];
  const lists: Array<[string, string | undefined]> = [
    ["founder", process.env.FOUNDER_EMAILS],
    ["beta-tester", process.env.BETA_EMAILS],
    ["advisor", process.env.ADVISOR_EMAILS],
    ["investor", process.env.INVESTOR_EMAILS],
  ];
  for (const [badge, raw] of lists) {
    if (!raw) continue;
    const emails = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (emails.includes(lower)) ids.push(badge);
  }
  return ids;
}

// Achievement badges derived from current user state.
export type UserState = {
  onboardingComplete: boolean;
  hasToneSummary: boolean;
  emailsTaggedTotal: number;
  cumulativeSecondsSaved: number;
  achievedGeographicMilestone: boolean;
};

export function earnedAchievementBadges(state: UserState): string[] {
  const ids: string[] = [];
  if (state.onboardingComplete) ids.push("welcome-aboard");
  if (state.hasToneSummary) ids.push("tone-deaf-no-more");
  if (state.emailsTaggedTotal >= 100) ids.push("triage-master");
  if (state.cumulativeSecondsSaved >= 14_400) ids.push("marathoner");
  if (state.achievedGeographicMilestone) ids.push("mountain-mover");
  return ids;
}
