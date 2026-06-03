// In-memory badge library — the source of truth. Identity badges are assigned
// by email allowlist (env vars) and the admin sheet. Achievement badges are
// derived from a MetricSnapshot (see lib/badgeSnapshot.ts) and persisted to the
// UserBadge table by the awards cron. The BadgeDef table mirrors this catalog.

export type BadgeGroup =
  | "onboarding"
  | "drafts"
  | "time_saved"
  | "tone"
  | "organization"
  | "tenure"
  | "geo";

// Which field of a MetricSnapshot gates a given achievement badge.
export type BadgeMetric =
  | "draftsGenerated"
  | "timeSavedSec"
  | "threadsLabeled"
  | "toneModesUsed"
  | "allWiredUp"
  | "toneTrained"
  | "dealHawk"
  | "dayOne"
  | "founding100"
  | "oneYear"
  | "geoMilestone";

export type Badge = {
  id: string;
  title: string;
  description: string;
  kind: "identity" | "achievement";
  icon:
    | "crown"
    | "shield"
    | "flask"
    | "briefcase"
    | "users"
    | "target"
    | "handshake"
    | "sparkles"
    | "waveform"
    | "tags"
    | "bolt"
    | "mountain"
    | "running"
    | "radar"
    | "chart"
    | "compass"
    | "hourglass"
    | "cap"
    | "mic";
  color: "amber" | "violet" | "blue" | "teal" | "brand" | "yellow";
  // When set, renderers show this image instead of the path-based SVG icon.
  // Path must be under /public so Next can serve it.
  iconImage?: string;
  // Achievement-only metadata (optional so identity rows + old callers compile).
  group?: BadgeGroup;
  tier?: number; // ordinal within a tiered group (1..n)
  metric?: BadgeMetric; // snapshot field that gates this badge
  threshold?: number; // numeric cutoff for count metrics
  flavorText?: string; // longer copy for tooltips / future surfaces
};

export const BADGES: Badge[] = [
  // ── Identity (assigned, never earned) ──────────────────────────────────────
  { id: "founder", title: "Founder", description: "Builds Dharma.", kind: "identity", icon: "crown", color: "yellow" },
  { id: "admin", title: "Admin", description: "Operates the system.", kind: "identity", icon: "shield", color: "violet" },
  { id: "beta", title: "Beta tester", description: "Joined while the door was still closed.", kind: "identity", icon: "flask", color: "blue", iconImage: "/badges/beta-flask.svg" },
  { id: "team", title: "Team", description: "Internal staff.", kind: "identity", icon: "users", color: "brand" },
  { id: "prospect", title: "Prospect", description: "Qualified lead in the pipeline.", kind: "identity", icon: "target", color: "violet" },
  { id: "partner", title: "Partner", description: "Referral or distribution partner.", kind: "identity", icon: "handshake", color: "amber" },
  { id: "investor", title: "Investor", description: "Backs Dharma.", kind: "identity", icon: "chart", color: "amber" },
  { id: "advisor", title: "Advisor", description: "Advisory access.", kind: "identity", icon: "compass", color: "violet" },
  { id: "waitlist", title: "Early Access", description: "In before activation.", kind: "identity", icon: "hourglass", color: "blue" },
  { id: "alumni", title: "Alumni", description: "Former client.", kind: "identity", icon: "cap", color: "teal" },
  { id: "press", title: "Press", description: "Media or analyst.", kind: "identity", icon: "mic", color: "brand" },

  // ── Achievement: onboarding (one-time) ─────────────────────────────────────
  { id: "first_draft", title: "First Draft", description: "Generated your first draft.", kind: "achievement", icon: "sparkles", color: "brand", group: "onboarding", metric: "draftsGenerated", threshold: 1, flavorText: "The first of many." },
  { id: "all_wired_up", title: "All Wired Up", description: "Connected Gmail and Calendar.", kind: "achievement", icon: "bolt", color: "brand", group: "onboarding", metric: "allWiredUp", flavorText: "Inbox and calendar, talking." },
  { id: "sounds_like_you", title: "Sounds Like You", description: "Trained Dharma on your sent mail.", kind: "achievement", icon: "waveform", color: "brand", group: "onboarding", metric: "toneTrained", flavorText: "Dharma learned your voice." },
  { id: "filed", title: "Filed", description: "Sorted your first thread.", kind: "achievement", icon: "tags", color: "brand", group: "onboarding", metric: "threadsLabeled", threshold: 1, flavorText: "First thread sorted." },

  // ── Achievement: drafts (tiered) ───────────────────────────────────────────
  { id: "drafts_10", title: "Getting Going", description: "10 drafts generated.", kind: "achievement", icon: "bolt", color: "blue", group: "drafts", tier: 1, metric: "draftsGenerated", threshold: 10 },
  { id: "drafts_100", title: "In the Flow", description: "100 drafts generated.", kind: "achievement", icon: "bolt", color: "blue", group: "drafts", tier: 2, metric: "draftsGenerated", threshold: 100 },
  { id: "drafts_500", title: "Heavy Sender", description: "500 drafts generated.", kind: "achievement", icon: "bolt", color: "blue", group: "drafts", tier: 3, metric: "draftsGenerated", threshold: 500 },
  { id: "drafts_1000", title: "Inbox Operator", description: "1,000 drafts generated.", kind: "achievement", icon: "bolt", color: "blue", group: "drafts", tier: 4, metric: "draftsGenerated", threshold: 1000 },
  { id: "drafts_5000", title: "Draft Machine", description: "5,000 drafts generated.", kind: "achievement", icon: "bolt", color: "blue", group: "drafts", tier: 5, metric: "draftsGenerated", threshold: 5000 },

  // ── Achievement: time saved (tiered) ───────────────────────────────────────
  { id: "time_1h", title: "Hour Back", description: "1 hour saved.", kind: "achievement", icon: "running", color: "teal", group: "time_saved", tier: 1, metric: "timeSavedSec", threshold: 3_600, flavorText: "An hour you didn't spend typing." },
  { id: "time_5h", title: "Day Reclaimed", description: "5 hours saved.", kind: "achievement", icon: "running", color: "teal", group: "time_saved", tier: 2, metric: "timeSavedSec", threshold: 18_000, flavorText: "A full workday back." },
  { id: "time_40h", title: "Week Reclaimed", description: "40 hours saved.", kind: "achievement", icon: "running", color: "teal", group: "time_saved", tier: 3, metric: "timeSavedSec", threshold: 144_000, flavorText: "A whole work week back." },
  { id: "time_100h", title: "Two-Plus Weeks", description: "100 hours saved.", kind: "achievement", icon: "running", color: "teal", group: "time_saved", tier: 4, metric: "timeSavedSec", threshold: 360_000, flavorText: "100 hours saved." },
  { id: "time_250h", title: "Time Lord", description: "250 hours saved.", kind: "achievement", icon: "running", color: "teal", group: "time_saved", tier: 5, metric: "timeSavedSec", threshold: 900_000, flavorText: "250 hours. That's a vacation." },

  // ── Achievement: tone ──────────────────────────────────────────────────────
  { id: "chameleon", title: "Chameleon", description: "Used all four tone modes.", kind: "achievement", icon: "waveform", color: "violet", group: "tone", metric: "toneModesUsed", threshold: 4 },

  // ── Achievement: organization ──────────────────────────────────────────────
  { id: "sorted_100", title: "Sorted", description: "100 emails auto-labeled.", kind: "achievement", icon: "tags", color: "amber", group: "organization", tier: 1, metric: "threadsLabeled", threshold: 100 },
  { id: "sorted_1000", title: "Filing Cabinet", description: "1,000 emails auto-labeled.", kind: "achievement", icon: "tags", color: "amber", group: "organization", tier: 2, metric: "threadsLabeled", threshold: 1000 },
  { id: "deal_hawk", title: "Deal Hawk", description: "Caught a high-priority deal signal.", kind: "achievement", icon: "radar", color: "amber", group: "organization", metric: "dealHawk" },

  // ── Achievement: tenure ────────────────────────────────────────────────────
  { id: "day_one", title: "Day One", description: "Here from the beta.", kind: "achievement", icon: "flask", color: "brand", group: "tenure", metric: "dayOne" },
  { id: "founding_100", title: "Founding 100", description: "One of the first 100.", kind: "achievement", icon: "shield", color: "brand", group: "tenure", metric: "founding100" },
  { id: "one_year", title: "One Year", description: "One year with Dharma.", kind: "achievement", icon: "hourglass", color: "brand", group: "tenure", metric: "oneYear" },

  // ── Achievement: geo (kept from the original system) ───────────────────────
  { id: "mountain-mover", title: "Mountain mover", description: "Unlocked your first geographic milestone.", kind: "achievement", icon: "mountain", color: "brand", group: "geo", metric: "geoMilestone" },
];

// Identity badge IDs only — used to populate the Users sheet dropdown.
// Achievement badges are derived from user state, never manually granted.
export const IDENTITY_BADGE_IDS: string[] = BADGES.filter((b) => b.kind === "identity").map((b) => b.id);

export function getBadge(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}

// Legacy achievement ids retired in the Phase 1 catalog overhaul. Any old
// UserBadge row or saved displayBadgeId pointing at one of these resolves to
// its nearest replacement so nothing dangles. (mountain-mover was kept.)
export const LEGACY_BADGE_ALIASES: Record<string, string> = {
  "welcome-aboard": "all_wired_up",
  "tone-deaf-no-more": "sounds_like_you",
  "triage-master": "sorted_100",
  marathoner: "time_5h",
};

export function resolveBadgeId(id: string): string {
  return LEGACY_BADGE_ALIASES[id] ?? id;
}

// Identity allowlist evaluation — single source of truth so the seed,
// signin event handler, and Profile page agree.
export function identityBadgesForEmail(email: string | null): string[] {
  if (!email) return [];
  const lower = email.toLowerCase();
  const ids: string[] = [];
  const lists: Array<[string, string | undefined]> = [
    ["founder", process.env.FOUNDER_EMAILS],
    ["admin", process.env.ADMIN_EMAILS],
    ["beta", process.env.BETA_EMAILS],
    ["team", process.env.TEAM_EMAILS],
    ["prospect", process.env.PROSPECT_EMAILS],
    ["partner", process.env.PARTNER_EMAILS],
    ["investor", process.env.INVESTOR_EMAILS],
    ["advisor", process.env.ADVISOR_EMAILS],
    ["waitlist", process.env.WAITLIST_EMAILS],
    ["alumni", process.env.ALUMNI_EMAILS],
    ["press", process.env.PRESS_EMAILS],
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

// Derived per-user metric snapshot — the single input to the achievement
// engine. Built by lib/badgeSnapshot.ts from existing tables.
export type MetricSnapshot = {
  draftsGenerated: number;
  timeSavedSec: number;
  threadsLabeled: number;
  toneModesUsed: number;
  gmailConnected: boolean;
  calendarConnected: boolean;
  toneTrained: boolean;
  onboardingComplete: boolean;
  dealHawk: boolean;
  dayOne: boolean;
  founding100: boolean;
  oneYear: boolean;
  geoMilestone: boolean;
};

function isEarned(badge: Badge, s: MetricSnapshot): boolean {
  switch (badge.metric) {
    case "draftsGenerated":
      return s.draftsGenerated >= (badge.threshold ?? 1);
    case "timeSavedSec":
      return s.timeSavedSec >= (badge.threshold ?? 0);
    case "threadsLabeled":
      return s.threadsLabeled >= (badge.threshold ?? 1);
    case "toneModesUsed":
      return s.toneModesUsed >= (badge.threshold ?? 4);
    case "allWiredUp":
      return s.gmailConnected && s.calendarConnected;
    case "toneTrained":
      return s.toneTrained;
    case "dealHawk":
      return s.dealHawk;
    case "dayOne":
      return s.dayOne;
    case "founding100":
      return s.founding100;
    case "oneYear":
      return s.oneYear;
    case "geoMilestone":
      return s.geoMilestone;
    default:
      return false;
  }
}

// All earned achievement badge ids for a given snapshot.
export function earnedAchievementBadges(s: MetricSnapshot): string[] {
  return BADGES.filter((b) => b.kind === "achievement" && isEarned(b, s)).map((b) => b.id);
}

// Current numeric value backing a group's tier metric (0 for boolean groups).
function groupCurrent(group: BadgeGroup, s: MetricSnapshot): number {
  switch (group) {
    case "drafts":
      return s.draftsGenerated;
    case "time_saved":
      return s.timeSavedSec;
    case "organization":
      return s.threadsLabeled;
    case "tone":
      return s.toneModesUsed;
    default:
      return 0;
  }
}

export type GroupProgress = {
  group: BadgeGroup;
  current: number;
  next: { id: string; title: string; threshold: number | null; color: Badge["color"] } | null;
  threshold: number | null;
  pct: number; // 0..1 toward the next tier (1 when the group is complete)
  earnedInGroup: string[];
};

// Progress toward the next unearned tier in a group — mirrors the milestone
// "progress to next" pattern. pct fills within the current tier band.
export function groupProgress(group: BadgeGroup, s: MetricSnapshot): GroupProgress {
  const inGroup = BADGES.filter((b) => b.kind === "achievement" && b.group === group).sort(
    (a, b) => (a.threshold ?? 0) - (b.threshold ?? 0),
  );
  const current = groupCurrent(group, s);
  const earnedInGroup = inGroup.filter((b) => isEarned(b, s)).map((b) => b.id);
  const nextBadge = inGroup.find((b) => !isEarned(b, s)) ?? null;

  let threshold: number | null = null;
  let pct = 1;
  if (nextBadge && typeof nextBadge.threshold === "number") {
    const base =
      [...inGroup]
        .reverse()
        .find(
          (b) =>
            typeof b.threshold === "number" &&
            b.threshold < (nextBadge.threshold as number) &&
            isEarned(b, s),
        )?.threshold ?? 0;
    threshold = nextBadge.threshold;
    pct = Math.max(0, Math.min(1, (current - base) / (threshold - base)));
  } else if (nextBadge) {
    threshold = null;
    pct = 0; // boolean badge not yet earned
  }

  return {
    group,
    current,
    next: nextBadge
      ? {
          id: nextBadge.id,
          title: nextBadge.title,
          threshold: nextBadge.threshold ?? null,
          color: nextBadge.color,
        }
      : null,
    threshold,
    pct,
    earnedInGroup,
  };
}
