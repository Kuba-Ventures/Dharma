// Gmail's fixed label color palette, grouped into three vibrancy rows for the
// color picker. Gmail rejects any background hex outside this set.
//
// This lives in its own dependency-free module (no googleapis, no prisma) so it
// can be imported by BOTH the server (lib/gmail.ts, which pulls in googleapis)
// and client components (the label editor) without dragging server-only code
// into the client bundle. It is the single source of truth for the swatches —
// lib/gmail.ts re-exports GMAIL_COLOR_ROWS from here so the picker and the
// server-side color validation can never drift apart.
export const GMAIL_COLOR_ROWS: string[][] = [
  ["#cc3a21","#eaa041","#f2c960","#149e60","#3dc789","#2da2bb","#4a86e8","#8e63ce","#b694e8","#e07798"],
  ["#fb4c2f","#ffad47","#fad165","#16a766","#43d692","#4986e7","#a479e2","#f691b3","#cf8933","#653e9b"],
  ["#f2b2a8","#ffc8af","#fce8b3","#b3efd3","#a0eac9","#98d7e4","#b6cff5","#e3d7ff","#d0bcf1","#fbd3e0"],
];

/** Default swatch for a new/blank label row. */
export const DEFAULT_LABEL_COLOR_HEX = "#4a86e8";
