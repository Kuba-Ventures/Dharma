// Onboarding role taxonomy → label-preset mapping.
//
// The onboarding quiz asks the user one required question — their role — and
// derives the label preset from it (VC → VC preset, etc.). `User.role` stores
// the role key as an independent profile signal; the label preset it maps to is
// separately editable afterward and may intentionally diverge (the user can
// override labels in Settings). This module is the SINGLE source for the role
// list, the mapping, and the display metadata the quiz renders — it imports
// PresetKey from labelPresets so the compiler catches drift if a preset is
// renamed or removed.
//
//   role key            label (quiz)          → PresetKey
//   ─────────────────   ───────────────────     ──────────
//   venture-capital     Venture Capital       → VC
//   private-equity      Private Equity        → PE
//   legal               Legal / Attorney      → Legal
//   founder-operator    Founder / Operator    → General
//   personal            Personal use          → Personal
//   other               Other                 → General

import type { PresetKey } from "./labelPresets";

export interface RoleOption {
  /** Stable key stored on User.role and submitted by the quiz. */
  key: string;
  /** Human-facing label rendered as the quiz option. */
  label: string;
  /** Label preset this role derives. Always a built-in preset (never Custom). */
  preset: PresetKey;
}

/** Roles maping to a preset with no dedicated label set fall back to General. */
export const DEFAULT_PRESET: PresetKey = "General";

/** Order here is the order shown in the quiz. */
export const ROLE_OPTIONS: RoleOption[] = [
  { key: "venture-capital", label: "Venture Capital", preset: "VC" },
  { key: "private-equity", label: "Private Equity", preset: "PE" },
  { key: "legal", label: "Legal / Attorney", preset: "Legal" },
  { key: "founder-operator", label: "Founder / Operator", preset: "General" },
  { key: "personal", label: "Personal use", preset: "Personal" },
  { key: "other", label: "Other", preset: "General" },
];

export const ROLE_KEYS: string[] = ROLE_OPTIONS.map((r) => r.key);

/** True when `s` is a known role key. */
export function isRoleKey(s: string): boolean {
  return ROLE_KEYS.includes(s);
}

/**
 * Map a stored/submitted role to its label preset. Unknown, null, or empty
 * roles resolve to DEFAULT_PRESET so provisioning always has a valid preset to
 * work with — the quiz gates on role selection, but this stays total so a
 * stale/hand-edited User.role can never produce an invalid preset.
 */
export function roleToPresetKey(role: string | null | undefined): PresetKey {
  if (!role) return DEFAULT_PRESET;
  const match = ROLE_OPTIONS.find((r) => r.key === role);
  return match ? match.preset : DEFAULT_PRESET;
}
