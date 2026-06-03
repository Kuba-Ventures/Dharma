// Shared icon paths + color classes for badges. Pulled out of BadgeCase so
// the same renderings work in IdentityCard's avatar overlay too.

import type { Badge } from "./badges";

export const BADGE_ICON_PATHS: Record<Badge["icon"], string> = {
  // Basquiat-style three-peak crown — irregular heights, slight tilt.
  crown: "M2.5 11 L4 3 L6 9 L8 1.5 L10 9 L12 4 L13.5 11.5 Z",
  shield: "M7 1L2 3v4c0 3 2 5 5 6 3-1 5-3 5-6V3L7 1z",
  flask: "M5 2v3L3 11a1.5 1.5 0 0 0 1.5 2h5A1.5 1.5 0 0 0 11 11L9 5V2",
  briefcase: "M2 5h10v7H2zM5 5V3h4v2",
  users:
    "M4 5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8zm6 0a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8zM1.5 11c0-1.7 1.1-2.7 2.5-2.7s2.5 1 2.5 2.7M7.5 11c0-1.7 1.1-2.7 2.5-2.7s2.5 1 2.5 2.7",
  target:
    "M7 1a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z",
  handshake: "M2 7l2-2 2 1 1-1 2 1 2-1 1 2-2 2-2 1-1-1-2 1-2-1-1-2z",
  sparkles: "M7 2v3M7 9v3M2 7h3M9 7h3M3.5 3.5l2 2M8.5 8.5l2 2",
  waveform: "M2 5v4M5 6v3M8 3v8M11 5v4",
  tags: "M2 3h5L11 6 7 10H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
  bolt: "M8 1L3 8h3v5l5-7H8z",
  mountain: "M2 12L6 4l3 5 2-3 3 6z",
  running: "M5 5l2-2 2 3 2 1-2 4-2-3-3 1",
  radar: "M7 7m-4 0a4 4 0 1 0 8 0 4 4 0 1 0-8 0M7 7L4 3",
  // Bar chart — three rising columns (investor).
  chart: "M2 12V8M2 12h10M6 12V5M10 12V2",
  // Compass — diamond needle in a ring (advisor).
  compass: "M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1zM7 4l1.6 3.4L7 10 5.4 7.4 7 4z",
  // Hourglass — pinched waist, sand crossing (waitlist / Early Access).
  hourglass: "M3 2h8M3 12h8M4 2c0 3 6 3 6 5s-6 2-6 5M10 2c0 3-6 3-6 5s6 2 6 5",
  // Graduation cap — mortarboard + tassel (alumni).
  cap: "M1 5l6-2.5L13 5l-6 2.5L1 5zM4 6.5V9.5c0 1 6 1 6 0V6.5M13 5v3",
  // Microphone — capsule on a stand (press).
  mic: "M7 1a2 2 0 0 0-2 2v3a2 2 0 0 0 4 0V3a2 2 0 0 0-2-2zM3.5 6.5A3.5 3.5 0 0 0 10.5 6.5M7 10v3M5 13h4",
};

export const BADGE_COLOR_BG: Record<Badge["color"], string> = {
  amber:
    "bg-[color:var(--label-4)]/12 border-[color:var(--label-4)]/30 text-[color:var(--label-4)]",
  violet:
    "bg-[color:var(--label-7)]/12 border-[color:var(--label-7)]/30 text-[color:var(--label-7)]",
  blue: "bg-[color:var(--label-1)]/12 border-[color:var(--label-1)]/30 text-[color:var(--label-1)]",
  teal: "bg-[color:var(--label-2)]/12 border-[color:var(--label-2)]/30 text-[color:var(--label-2)]",
  brand: "bg-brand-400/12 border-brand-400/30 text-brand-200",
  // Built-in yellow-400 class — guaranteed to compile, no arbitrary-value
  // edge cases. Solid yellow background with a black border.
  yellow: "bg-yellow-400/40 border-black/50 text-yellow-400",
};

// Hardcoded yellow used for the SVG fill so currentColor resolution
// can't leave the crown drawing black.
export const BASQUIAT_YELLOW = "#FBD23D";
export const BASQUIAT_OUTLINE = "#1A1A1A";

// Jewel-tone fills used directly on the SVG path for earned badges, so the
// silhouettes pop as vivid gems instead of faint tinted outlines. Each color
// gets a saturated mid-deep hue + a slightly darker stroke for definition.
export const JEWEL_FILL: Record<Badge["color"], string> = {
  amber: "#F97316", // topaz
  violet: "#8B5CF6", // amethyst
  blue: "#2563EB", // sapphire
  teal: "#10B981", // emerald
  brand: "#6366F1", // tanzanite
  yellow: BASQUIAT_YELLOW,
};

export const JEWEL_STROKE: Record<Badge["color"], string> = {
  amber: "#9A3412", // dark topaz
  violet: "#5B21B6", // dark amethyst
  blue: "#1E3A8A", // dark sapphire
  teal: "#065F46", // dark emerald
  brand: "#3730A3", // dark tanzanite
  yellow: BASQUIAT_OUTLINE,
};
