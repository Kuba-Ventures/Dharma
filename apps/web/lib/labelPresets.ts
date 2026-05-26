// Industry-preset Gmail labels. Each preset is a list of labels Dharma will
// create in the user's Gmail when they toggle Tabs & Labels ON.
//
// Colors: `colorKey` maps to the Gmail palette via GMAIL_COLORS in lib/gmail.ts
// (Gmail rejects hex values outside its supported palette). `displayHex` is the
// hex shown in the dashboard UI chip — it does not need to match Gmail's palette.
// The original spec hex values are used for display; we mapped each one to the
// nearest valid Gmail color for actual provisioning.

export type PresetKey = "VC" | "PE" | "Legal" | "General" | "Custom";
export type BuiltInPresetKey = "VC" | "PE" | "Legal" | "General";

// Either a named legacy color ("blue", "red", ...) or any Gmail-valid hex like "#cc3a21".
// lib/gmail.ts::resolveGmailColor accepts both forms.
export type GmailColorKey = string;

export interface CustomPresetLabel {
  shortName: string;
  colorKey: GmailColorKey;
  displayHex: string;
}

/** Fully-resolved preset spec the classifier and provisioning routes use. */
export interface PresetSpec {
  /** Human-friendly name for the preset (e.g. "VC" or "Kuba Ventures"). */
  displayName: string;
  /** Prefix prepended to every Gmail label. Empty for built-in presets (flat
   *  top-level labels); set to the user's typed name for Custom presets. */
  labelPrefix: string;
  labels: PresetLabel[];
}

export interface PresetLabel {
  /** Full label name as it will appear in Gmail (e.g. "Portfolio"). */
  name: string;
  /** Short label key used for classification prompts. */
  shortName: string;
  /** Gmail palette color key — must match a key in lib/gmail.ts GMAIL_COLORS. */
  colorKey: GmailColorKey;
  /** Hex used in the dashboard chip preview (does not need to match Gmail's palette). */
  displayHex: string;
}

export const HIGH_PRIORITY_NAME = "High-Priority";

export const LABEL_PRESETS: Record<BuiltInPresetKey, PresetLabel[]> = {
  VC: [
    { name: "Portfolio",     shortName: "Portfolio",     colorKey: "green",  displayHex: "#16a765" },
    { name: "Deal-Flow",     shortName: "Deal-Flow",     colorKey: "red",    displayHex: "#fb4c2f" },
    { name: "LP-Relations",  shortName: "LP-Relations",  colorKey: "blue",   displayHex: "#4a86e8" },
    { name: "Internal",      shortName: "Internal",      colorKey: "purple", displayHex: "#8e63ce" },
    { name: "High-Priority", shortName: "High-Priority", colorKey: "orange", displayHex: "#ffad47" },
  ],
  PE: [
    { name: "Portfolio-Co",  shortName: "Portfolio-Co",  colorKey: "green",  displayHex: "#16a765" },
    { name: "Deal",          shortName: "Deal",          colorKey: "red",    displayHex: "#fb4c2f" },
    { name: "Diligence",     shortName: "Diligence",     colorKey: "blue",   displayHex: "#4a86e8" },
    { name: "Internal",      shortName: "Internal",      colorKey: "purple", displayHex: "#8e63ce" },
    { name: "High-Priority", shortName: "High-Priority", colorKey: "orange", displayHex: "#ffad47" },
  ],
  Legal: [
    { name: "Contracts",     shortName: "Contracts",     colorKey: "red",    displayHex: "#fb4c2f" },
    { name: "Client",        shortName: "Client",        colorKey: "green",  displayHex: "#16a765" },
    { name: "Internal",      shortName: "Internal",      colorKey: "purple", displayHex: "#8e63ce" },
    { name: "High-Priority", shortName: "High-Priority", colorKey: "orange", displayHex: "#ffad47" },
  ],
  General: [
    { name: "Respond",       shortName: "Respond",       colorKey: "red",    displayHex: "#fb4c2f" },
    { name: "Meeting",       shortName: "Meeting",       colorKey: "blue",   displayHex: "#4a86e8" },
    { name: "Informational", shortName: "Informational", colorKey: "purple", displayHex: "#8e63ce" },
    { name: "High-Priority", shortName: "High-Priority", colorKey: "orange", displayHex: "#ffad47" },
  ],
};

export const BUILT_IN_PRESET_KEYS: BuiltInPresetKey[] = ["VC", "PE", "Legal", "General"];
export const PRESET_KEYS: PresetKey[] = [...BUILT_IN_PRESET_KEYS, "Custom"];

export function isBuiltInPresetKey(s: string): s is BuiltInPresetKey {
  return (BUILT_IN_PRESET_KEYS as string[]).includes(s);
}

export function isPresetKey(s: string): s is PresetKey {
  return (PRESET_KEYS as string[]).includes(s);
}

/** Sanitize a user-typed string into something Gmail accepts in a label path. */
function sanitizeLabelSegment(input: string): string {
  return input
    .trim()
    .replace(/[\\/]+/g, " ")        // strip Gmail's nesting separator
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

/**
 * Resolve a preset to its full spec. For built-ins, returns the hardcoded
 * `LABEL_PRESETS` data. For "Custom", builds the spec from the user-supplied
 * labels. If the user provided a preset name, each Gmail label is prefixed
 * with it (so labels nest under a parent folder); if blank, labels are
 * created flat at the top level of the Gmail sidebar.
 */
export function resolvePresetSpec(args: {
  preset: string;
  customName?: string | null;
  customLabels?: unknown;
}): PresetSpec | null {
  if (isBuiltInPresetKey(args.preset)) {
    return {
      displayName: args.preset,
      labelPrefix: "",
      labels: LABEL_PRESETS[args.preset],
    };
  }

  if (args.preset !== "Custom") return null;

  const name = sanitizeLabelSegment(args.customName ?? "");

  const raw = Array.isArray(args.customLabels) ? args.customLabels : [];
  const labels: PresetLabel[] = raw
    .map((l: unknown) => {
      const o = l as Partial<CustomPresetLabel>;
      const shortName = sanitizeLabelSegment(o.shortName ?? "");
      if (!shortName) return null;
      const colorKey: GmailColorKey = (o.colorKey ?? "gray") as GmailColorKey;
      const displayHex = o.displayHex ?? "#999999";
      return {
        name: name ? `${name}/${shortName}` : shortName,
        shortName,
        colorKey,
        displayHex,
      } satisfies PresetLabel;
    })
    .filter((x): x is PresetLabel => x !== null);

  return { displayName: name || "Custom", labelPrefix: name, labels };
}
