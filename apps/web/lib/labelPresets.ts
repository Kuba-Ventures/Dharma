// Industry-preset Gmail labels. Each preset is a list of labels Dharma will
// create in the user's Gmail when they toggle Tabs & Labels ON.
//
// Colors: `colorKey` maps to the Gmail palette via GMAIL_COLORS in lib/gmail.ts
// (Gmail rejects hex values outside its supported palette). `displayHex` is the
// hex shown in the dashboard UI chip — it does not need to match Gmail's palette.
// The original spec hex values are used for display; we mapped each one to the
// nearest valid Gmail color for actual provisioning.

export type PresetKey = "VC" | "PE" | "Legal" | "General" | "Personal" | "Custom";
export type BuiltInPresetKey = "VC" | "PE" | "Legal" | "General" | "Personal";

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

// Catch-all label appended to every preset (built-in and custom). Emails that
// match no other label are tagged with this instead of going unlabeled. It is
// never offered to the classifier — it's applied purely as a no-match fallback.
// Gray, so it reads as the "everything else" bucket in the Gmail sidebar.
export const UNCATEGORIZED_NAME = "Uncategorized";
const UNCATEGORIZED_COLOR_KEY: GmailColorKey = "gray";
const UNCATEGORIZED_DISPLAY_HEX = "#999999";

/** Build the Uncategorized PresetLabel, prefixed to match the preset's labels. */
function uncategorizedLabel(labelPrefix: string): PresetLabel {
  return {
    name: labelPrefix ? `${labelPrefix}/${UNCATEGORIZED_NAME}` : UNCATEGORIZED_NAME,
    shortName: UNCATEGORIZED_NAME,
    colorKey: UNCATEGORIZED_COLOR_KEY,
    displayHex: UNCATEGORIZED_DISPLAY_HEX,
  };
}

/**
 * Full Gmail name of the Uncategorized label for a preset — used by the toggle
 * endpoint to provision/delete it without resolving the whole spec.
 */
export function uncategorizedLabelName(args: {
  preset: string;
  customName?: string | null;
}): string {
  const prefix = isBuiltInPresetKey(args.preset) ? "" : sanitizeLabelSegment(args.customName ?? "");
  return uncategorizedLabel(prefix).name;
}

export const LABEL_PRESETS: Record<BuiltInPresetKey, PresetLabel[]> = {
  VC: [
    { name: "Portfolio",     shortName: "Portfolio",     colorKey: "green",   displayHex: "#16a765" },
    { name: "Deal-Flow",     shortName: "Deal-Flow",     colorKey: "red",     displayHex: "#fb4c2f" },
    { name: "LP-Relations",  shortName: "LP-Relations",  colorKey: "blue",    displayHex: "#4a86e8" },
    { name: "Diligence",     shortName: "Diligence",     colorKey: "teal",    displayHex: "#2da2bb" },
    { name: "Intros",        shortName: "Intros",        colorKey: "#43d692", displayHex: "#43d692" },
    { name: "Legal",         shortName: "Legal",         colorKey: "purple",  displayHex: "#8e63ce" },
    { name: "Internal",      shortName: "Internal",      colorKey: "#653e9b", displayHex: "#653e9b" },
    { name: "Follow-Up",     shortName: "Follow-Up",     colorKey: "yellow",  displayHex: "#f2c960" },
    { name: "High-Priority", shortName: "High-Priority", colorKey: "orange",  displayHex: "#ffad47" },
  ],
  PE: [
    { name: "Portfolio-Co",  shortName: "Portfolio-Co",  colorKey: "green",   displayHex: "#16a765" },
    { name: "Deal-Flow",     shortName: "Deal-Flow",     colorKey: "red",     displayHex: "#fb4c2f" },
    { name: "Diligence",     shortName: "Diligence",     colorKey: "teal",    displayHex: "#2da2bb" },
    { name: "LP-Relations",  shortName: "LP-Relations",  colorKey: "blue",    displayHex: "#4a86e8" },
    { name: "Lenders",       shortName: "Lenders",       colorKey: "#cf8933", displayHex: "#cf8933" },
    { name: "Legal",         shortName: "Legal",         colorKey: "purple",  displayHex: "#8e63ce" },
    { name: "Internal",      shortName: "Internal",      colorKey: "#653e9b", displayHex: "#653e9b" },
    { name: "Follow-Up",     shortName: "Follow-Up",     colorKey: "yellow",  displayHex: "#f2c960" },
    { name: "High-Priority", shortName: "High-Priority", colorKey: "orange",  displayHex: "#ffad47" },
  ],
  Legal: [
    { name: "Contracts",        shortName: "Contracts",        colorKey: "red",     displayHex: "#fb4c2f" },
    { name: "Clients",          shortName: "Clients",          colorKey: "green",   displayHex: "#16a765" },
    { name: "Compliance",       shortName: "Compliance",       colorKey: "teal",    displayHex: "#2da2bb" },
    { name: "Filings",          shortName: "Filings",          colorKey: "blue",    displayHex: "#4a86e8" },
    { name: "Opposing-Counsel", shortName: "Opposing-Counsel", colorKey: "#e07798", displayHex: "#e07798" },
    { name: "Billing",          shortName: "Billing",          colorKey: "yellow",  displayHex: "#f2c960" },
    { name: "Internal",         shortName: "Internal",         colorKey: "purple",  displayHex: "#8e63ce" },
    { name: "Follow-Up",        shortName: "Follow-Up",        colorKey: "#43d692", displayHex: "#43d692" },
    { name: "High-Priority",    shortName: "High-Priority",    colorKey: "orange",  displayHex: "#ffad47" },
  ],
  General: [
    { name: "Clients",       shortName: "Clients",       colorKey: "green",   displayHex: "#16a765" },
    { name: "Sales",         shortName: "Sales",         colorKey: "red",     displayHex: "#fb4c2f" },
    { name: "Vendors",       shortName: "Vendors",       colorKey: "blue",    displayHex: "#4a86e8" },
    { name: "Billing",       shortName: "Billing",       colorKey: "yellow",  displayHex: "#f2c960" },
    { name: "Product",       shortName: "Product",       colorKey: "teal",    displayHex: "#2da2bb" },
    { name: "Team-Internal", shortName: "Team-Internal", colorKey: "purple",  displayHex: "#8e63ce" },
    { name: "External",      shortName: "External",      colorKey: "#cf8933", displayHex: "#cf8933" },
    { name: "Follow-Up",     shortName: "Follow-Up",     colorKey: "#43d692", displayHex: "#43d692" },
    { name: "High-Priority", shortName: "High-Priority", colorKey: "orange",  displayHex: "#ffad47" },
  ],
  // For personal (non-work) inboxes: receipts, shipping, money, travel, junk.
  Personal: [
    { name: "Orders",        shortName: "Orders",        colorKey: "green",   displayHex: "#16a765" },
    { name: "Shipping",      shortName: "Shipping",      colorKey: "blue",    displayHex: "#4a86e8" },
    { name: "Finance",       shortName: "Finance",       colorKey: "teal",    displayHex: "#2da2bb" },
    { name: "Travel",        shortName: "Travel",        colorKey: "#e07798", displayHex: "#e07798" },
    { name: "Work",          shortName: "Work",          colorKey: "purple",  displayHex: "#8e63ce" },
    { name: "Promotions",    shortName: "Promotions",    colorKey: "yellow",  displayHex: "#f2c960" },
    { name: "Updates",       shortName: "Updates",       colorKey: "#43d692", displayHex: "#43d692" },
    { name: "Likely-Spam",   shortName: "Likely-Spam",   colorKey: "#cf8933", displayHex: "#cf8933" },
    { name: "High-Priority", shortName: "High-Priority", colorKey: "orange",  displayHex: "#ffad47" },
  ],
};

export const BUILT_IN_PRESET_KEYS: BuiltInPresetKey[] = ["VC", "PE", "Legal", "General", "Personal"];
export const PRESET_KEYS: PresetKey[] = [...BUILT_IN_PRESET_KEYS, "Custom"];

export function isBuiltInPresetKey(s: string): s is BuiltInPresetKey {
  return (BUILT_IN_PRESET_KEYS as string[]).includes(s);
}

export function isPresetKey(s: string): s is PresetKey {
  return (PRESET_KEYS as string[]).includes(s);
}

/** Editor row: the subset of a preset label the shared <LabelEditor> renders. */
export interface EditorRow {
  shortName: string;
  colorKey: string;
}

/**
 * Seed editable rows from a built-in preset. Uses displayHex as the colorKey so
 * the color picker highlights the matching swatch (the palette is keyed by
 * hex), matching how the config LabelsCard forks a built-in for editing.
 */
export function presetEditorRows(preset: BuiltInPresetKey): EditorRow[] {
  return LABEL_PRESETS[preset].map((l) => ({
    shortName: l.shortName,
    colorKey: l.displayHex,
  }));
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
  /** Append the "Uncategorized" catch-all label. Defaults to true. */
  includeUncategorized?: boolean;
}): PresetSpec | null {
  const includeUncategorized = args.includeUncategorized ?? true;

  if (isBuiltInPresetKey(args.preset)) {
    const labels = [...LABEL_PRESETS[args.preset]];
    if (includeUncategorized) labels.push(uncategorizedLabel(""));
    return {
      displayName: args.preset,
      labelPrefix: "",
      labels,
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

  if (includeUncategorized) labels.push(uncategorizedLabel(name));

  return { displayName: name || "Custom", labelPrefix: name, labels };
}
