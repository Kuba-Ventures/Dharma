// Industry-preset Gmail labels. Each preset is a list of labels Dharma will
// create in the user's Gmail when they toggle Tabs & Labels ON.
//
// Colors: `colorKey` maps to the Gmail palette via GMAIL_COLORS in lib/gmail.ts
// (Gmail rejects hex values outside its supported palette). `displayHex` is the
// hex shown in the dashboard UI chip — it does not need to match Gmail's palette.
// The original spec hex values are used for display; we mapped each one to the
// nearest valid Gmail color for actual provisioning.

export type PresetKey = "VC" | "PE" | "Legal" | "General";

export interface PresetLabel {
  /** Full label name as it will appear in Gmail (e.g. "Dharma/Portfolio"). */
  name: string;
  /** Short label key used for classification prompts (the part after "Dharma/"). */
  shortName: string;
  /** Gmail palette color key — must match a key in lib/gmail.ts GMAIL_COLORS. */
  colorKey: "green" | "red" | "orange" | "blue" | "purple" | "teal" | "yellow" | "gray";
  /** Hex used in the dashboard chip preview (does not need to match Gmail's palette). */
  displayHex: string;
}

export const HIGH_PRIORITY_NAME = "Dharma/High-Priority";

export const LABEL_PRESETS: Record<PresetKey, PresetLabel[]> = {
  VC: [
    { name: "Dharma/Portfolio",     shortName: "Portfolio",     colorKey: "green",  displayHex: "#16a765" },
    { name: "Dharma/Deal-Flow",     shortName: "Deal-Flow",     colorKey: "red",    displayHex: "#fb4c2f" },
    { name: "Dharma/LP-Relations",  shortName: "LP-Relations",  colorKey: "blue",   displayHex: "#4a86e8" },
    { name: "Dharma/Internal",      shortName: "Internal",      colorKey: "purple", displayHex: "#8e63ce" },
    { name: "Dharma/High-Priority", shortName: "High-Priority", colorKey: "orange", displayHex: "#ffad47" },
  ],
  PE: [
    { name: "Dharma/Portfolio-Co",  shortName: "Portfolio-Co",  colorKey: "green",  displayHex: "#16a765" },
    { name: "Dharma/Deal",          shortName: "Deal",          colorKey: "red",    displayHex: "#fb4c2f" },
    { name: "Dharma/Diligence",     shortName: "Diligence",     colorKey: "blue",   displayHex: "#4a86e8" },
    { name: "Dharma/Internal",      shortName: "Internal",      colorKey: "purple", displayHex: "#8e63ce" },
    { name: "Dharma/High-Priority", shortName: "High-Priority", colorKey: "orange", displayHex: "#ffad47" },
  ],
  Legal: [
    { name: "Dharma/Contracts",     shortName: "Contracts",     colorKey: "red",    displayHex: "#fb4c2f" },
    { name: "Dharma/Client",        shortName: "Client",        colorKey: "green",  displayHex: "#16a765" },
    { name: "Dharma/Internal",      shortName: "Internal",      colorKey: "purple", displayHex: "#8e63ce" },
    { name: "Dharma/High-Priority", shortName: "High-Priority", colorKey: "orange", displayHex: "#ffad47" },
  ],
  General: [
    { name: "Dharma/Respond",       shortName: "Respond",       colorKey: "red",    displayHex: "#fb4c2f" },
    { name: "Dharma/Meeting",       shortName: "Meeting",       colorKey: "blue",   displayHex: "#4a86e8" },
    { name: "Dharma/Informational", shortName: "Informational", colorKey: "purple", displayHex: "#8e63ce" },
    { name: "Dharma/High-Priority", shortName: "High-Priority", colorKey: "orange", displayHex: "#ffad47" },
  ],
};

export const PRESET_KEYS: PresetKey[] = ["VC", "PE", "Legal", "General"];

export function isPresetKey(s: string): s is PresetKey {
  return (PRESET_KEYS as string[]).includes(s);
}
