// Pick a readable text color for a solid label tag given its fill hex. Uses the
// YIQ perceived-brightness formula: bright fills (yellow, light green) get dark
// ink, dark fills (red, violet, teal) get white. Mirrors how Gmail renders its
// own colored labels. Accepts #rgb or #rrggbb; falls back to white on garbage.
const DARK_INK = "#1f2430";
const LIGHT_INK = "#ffffff";

export function readableTextColor(hex: string): string {
  const raw = (hex || "").replace(/^#/, "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (full.length !== 6) return LIGHT_INK;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return LIGHT_INK;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? DARK_INK : LIGHT_INK;
}
