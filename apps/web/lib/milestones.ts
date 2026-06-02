// In-memory milestone library. Each milestone is keyed by slug. Threshold in
// seconds (cumulative time saved required). Templates accept {firstName} and
// {city} placeholders; computeMilestoneCopy fills them in. Universal entries
// (no requiredCity) work for everyone; city-tagged entries are gated.

export type Milestone = {
  id: string; // slug
  category: "intro" | "peak" | "trail" | "city_to_city" | "cultural" | "regional";
  title: string; // template
  description: string; // template
  threshold: number; // seconds saved required
  requiredCity?: string; // e.g. "San Francisco, CA"
  gradient: string;
};

const G_PURPLE = "linear-gradient(135deg, rgba(127,119,221,0.18), rgba(38,33,92,0.45))";
const G_TEAL = "linear-gradient(135deg, rgba(29,158,117,0.20), rgba(127,119,221,0.10))";
const G_CORAL = "linear-gradient(135deg, rgba(216,90,48,0.20), rgba(127,119,221,0.10))";
const G_AMBER = "linear-gradient(135deg, rgba(239,159,39,0.22), rgba(127,119,221,0.10))";

export const MILESTONES: Milestone[] = [
  {
    id: "welcome-aboard",
    category: "intro",
    title: "Welcome aboard.",
    description: "You've set up Dharma. Drafts, labels, and meetings are now on autopilot.",
    threshold: 0,
    gradient: G_PURPLE,
  },
  {
    id: "first-30-min",
    category: "intro",
    title: "30 minutes saved.",
    description: "Half an hour back in your week. Keep going; your first city milestone is close.",
    threshold: 1_800,
    gradient: G_TEAL,
  },
  {
    id: "first-hour",
    category: "intro",
    title: "One hour back.",
    description: "An entire hour returned to {firstName}. You're officially through Apprentice tier.",
    threshold: 3_600,
    gradient: G_TEAL,
  },
  // City-tagged milestones, earned only when user's homeCity matches.
  {
    id: "summit-mt-tam",
    category: "peak",
    title: "Enough time to summit Mt. Tamalpais.",
    description: "{firstName}, you've saved enough time to climb Mt. Tam's east peak, a Bay Area classic at 2,571 ft.",
    threshold: 14_400, // 4h
    requiredCity: "San Francisco, CA",
    gradient: G_CORAL,
  },
  {
    id: "walk-brooklyn-bridge",
    category: "trail",
    title: "Walk the Brooklyn Bridge, round trip.",
    description: "You've saved enough time to walk the bridge and back, twice, with coffee.",
    threshold: 7_200, // 2h
    requiredCity: "New York, NY",
    gradient: G_AMBER,
  },
  {
    id: "summit-mt-mitchell",
    category: "peak",
    title: "Enough time to summit Mt. Mitchell.",
    description: "Eastern US's tallest peak at 6,684 ft. You'd need ~5h round-trip from the parking lot. You've earned it.",
    threshold: 18_000, // 5h
    requiredCity: "Charlotte, NC",
    gradient: G_CORAL,
  },
  {
    id: "walk-lincoln-memorial",
    category: "cultural",
    title: "Walk the National Mall end to end.",
    description: "Capitol to Lincoln Memorial is a 2.3-mile stretch you could now do twice without rushing.",
    threshold: 5_400, // 1.5h
    requiredCity: "Washington, DC",
    gradient: G_AMBER,
  },
  {
    id: "boston-marathon-route",
    category: "trail",
    title: "Walk a quarter of the Boston Marathon route.",
    description: "Hopkinton to Wellesley, 6.5 miles. You've saved the equivalent of a brisk Saturday morning.",
    threshold: 10_800, // 3h
    requiredCity: "Boston, MA",
    gradient: G_TEAL,
  },
  // Universal mid-tier milestones (apply regardless of city).
  {
    id: "five-hours",
    category: "regional",
    title: "Five hours reclaimed.",
    description: "You're officially a Practitioner. An entire half-workday returned.",
    threshold: 18_000,
    gradient: G_TEAL,
  },
  {
    id: "twenty-hours",
    category: "regional",
    title: "Twenty hours reclaimed.",
    description: "Three workdays of email triage, gone. Master tier unlocked.",
    threshold: 72_000,
    gradient: G_CORAL,
  },
];

export function getMilestone(id: string): Milestone | undefined {
  return MILESTONES.find((m) => m.id === id);
}

// Milestone copy never uses em-dashes. Static entries above are written
// without them; this strips any that slip through DB-generated city
// milestones (lib/milestoneGenerator.ts) so the rendered copy stays clean.
export function stripEmDashes(text: string): string {
  return text.replace(/\s*—\s*/g, ", ");
}

export function applyTemplate(
  text: string,
  vars: { firstName?: string | null; city?: string | null },
): string {
  return stripEmDashes(
    text
      .replace(/\{firstName\}/g, vars.firstName ?? "you")
      .replace(/\{city\}/g, vars.city ?? "your city"),
  );
}

export function unlockedMilestoneIds(
  secondsSaved: number,
  homeCity: string | null,
): string[] {
  return MILESTONES.filter((m) => {
    if (secondsSaved < m.threshold) return false;
    if (m.requiredCity && m.requiredCity !== homeCity) return false;
    return true;
  }).map((m) => m.id);
}

export function nextLockedMilestone(
  secondsSaved: number,
  homeCity: string | null,
): Milestone | null {
  return (
    MILESTONES.filter((m) => {
      if (secondsSaved >= m.threshold) return false;
      if (m.requiredCity && m.requiredCity !== homeCity) return false;
      return true;
    }).sort((a, b) => a.threshold - b.threshold)[0] ?? null
  );
}
