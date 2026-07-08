import { describe, it, expect } from "vitest";
import { isPresetKey } from "./labelPresets";
import {
  ROLE_OPTIONS,
  ROLE_KEYS,
  DEFAULT_PRESET,
  isRoleKey,
  roleToPresetKey,
} from "./rolePresets";

describe("role → preset mapping", () => {
  it("every role maps to a valid PresetKey", () => {
    for (const r of ROLE_OPTIONS) {
      expect(isPresetKey(r.preset)).toBe(true);
    }
  });

  it("never maps a role to Custom (roles derive built-in presets only)", () => {
    for (const r of ROLE_OPTIONS) {
      expect(r.preset).not.toBe("Custom");
    }
  });

  it("maps each known role to its expected preset", () => {
    expect(roleToPresetKey("venture-capital")).toBe("VC");
    expect(roleToPresetKey("private-equity")).toBe("PE");
    expect(roleToPresetKey("legal")).toBe("Legal");
    expect(roleToPresetKey("founder-operator")).toBe("General");
    expect(roleToPresetKey("personal")).toBe("Personal");
    expect(roleToPresetKey("other")).toBe("General");
  });

  it("falls back to DEFAULT_PRESET for null, undefined, empty, or unknown roles", () => {
    expect(roleToPresetKey(null)).toBe(DEFAULT_PRESET);
    expect(roleToPresetKey(undefined)).toBe(DEFAULT_PRESET);
    expect(roleToPresetKey("")).toBe(DEFAULT_PRESET);
    expect(roleToPresetKey("nonsense")).toBe(DEFAULT_PRESET);
    expect(isPresetKey(DEFAULT_PRESET)).toBe(true);
  });
});

describe("role key metadata", () => {
  it("ROLE_KEYS mirrors ROLE_OPTIONS order", () => {
    expect(ROLE_KEYS).toEqual(ROLE_OPTIONS.map((r) => r.key));
  });

  it("exposes exactly the six recommended roles", () => {
    expect(ROLE_KEYS).toEqual([
      "venture-capital",
      "private-equity",
      "legal",
      "founder-operator",
      "personal",
      "other",
    ]);
  });

  it("recognizes known role keys and rejects others", () => {
    expect(isRoleKey("venture-capital")).toBe(true);
    expect(isRoleKey("other")).toBe(true);
    expect(isRoleKey("Nonsense")).toBe(false);
    expect(isRoleKey("VC")).toBe(false); // preset key, not a role key
  });

  it("has unique role keys and human labels", () => {
    expect(new Set(ROLE_KEYS).size).toBe(ROLE_OPTIONS.length);
    const labels = ROLE_OPTIONS.map((r) => r.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
