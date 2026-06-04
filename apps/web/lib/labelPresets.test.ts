import { describe, it, expect } from "vitest";
import {
  BUILT_IN_PRESET_KEYS,
  PRESET_KEYS,
  LABEL_PRESETS,
  UNCATEGORIZED_NAME,
  HIGH_PRIORITY_NAME,
  isBuiltInPresetKey,
  isPresetKey,
  resolvePresetSpec,
  uncategorizedLabelName,
} from "./labelPresets";

describe("preset key guards", () => {
  it("recognizes the five built-in presets but not Custom", () => {
    for (const k of ["VC", "PE", "Legal", "General", "Personal"]) {
      expect(isBuiltInPresetKey(k)).toBe(true);
    }
    expect(isBuiltInPresetKey("Custom")).toBe(false);
    expect(isBuiltInPresetKey("Nonsense")).toBe(false);
  });

  it("treats Custom as a valid preset key but not a built-in", () => {
    expect(isPresetKey("Custom")).toBe(true);
    expect(isPresetKey("VC")).toBe(true);
    expect(isPresetKey("Nonsense")).toBe(false);
  });

  it("keeps PRESET_KEYS = built-ins + Custom", () => {
    expect(PRESET_KEYS).toEqual([...BUILT_IN_PRESET_KEYS, "Custom"]);
  });
});

describe("LABEL_PRESETS data", () => {
  it("defines labels for every built-in key", () => {
    for (const k of BUILT_IN_PRESET_KEYS) {
      expect(LABEL_PRESETS[k].length).toBeGreaterThan(0);
    }
  });

  it("includes a High-Priority label in every preset", () => {
    for (const k of BUILT_IN_PRESET_KEYS) {
      expect(LABEL_PRESETS[k].some((l) => l.name === HIGH_PRIORITY_NAME)).toBe(true);
    }
  });
});

describe("resolvePresetSpec — built-in", () => {
  it("returns the hardcoded labels plus the Uncategorized catch-all by default", () => {
    const spec = resolvePresetSpec({ preset: "VC" });
    expect(spec).not.toBeNull();
    expect(spec!.displayName).toBe("VC");
    expect(spec!.labelPrefix).toBe("");
    expect(spec!.labels.length).toBe(LABEL_PRESETS.VC.length + 1);
    expect(spec!.labels.at(-1)!.name).toBe(UNCATEGORIZED_NAME);
  });

  it("omits Uncategorized when includeUncategorized is false", () => {
    const spec = resolvePresetSpec({ preset: "VC", includeUncategorized: false });
    expect(spec!.labels.length).toBe(LABEL_PRESETS.VC.length);
    expect(spec!.labels.some((l) => l.name === UNCATEGORIZED_NAME)).toBe(false);
  });
});

describe("resolvePresetSpec — custom", () => {
  it("prefixes each label under the custom name", () => {
    const spec = resolvePresetSpec({
      preset: "Custom",
      customName: "Kuba Ventures",
      customLabels: [{ shortName: "Deals", colorKey: "red", displayHex: "#fb4c2f" }],
    });
    expect(spec!.labelPrefix).toBe("Kuba Ventures");
    expect(spec!.displayName).toBe("Kuba Ventures");
    expect(spec!.labels[0].name).toBe("Kuba Ventures/Deals");
    expect(spec!.labels.at(-1)!.name).toBe("Kuba Ventures/Uncategorized");
  });

  it("creates flat labels when no custom name is given", () => {
    const spec = resolvePresetSpec({
      preset: "Custom",
      customName: "",
      customLabels: [{ shortName: "Deals" }],
    });
    expect(spec!.labelPrefix).toBe("");
    expect(spec!.displayName).toBe("Custom");
    expect(spec!.labels[0].name).toBe("Deals");
  });

  it("drops custom labels with an empty short name", () => {
    const spec = resolvePresetSpec({
      preset: "Custom",
      customName: "Acme",
      customLabels: [{ shortName: "" }, { shortName: "Keep" }],
      includeUncategorized: false,
    });
    expect(spec!.labels.map((l) => l.shortName)).toEqual(["Keep"]);
  });

  it("returns null for an unknown preset", () => {
    expect(resolvePresetSpec({ preset: "Nonsense" })).toBeNull();
  });
});

describe("uncategorizedLabelName", () => {
  it("is unprefixed for built-in presets", () => {
    expect(uncategorizedLabelName({ preset: "VC" })).toBe(UNCATEGORIZED_NAME);
  });

  it("is prefixed by the custom name for Custom presets", () => {
    expect(uncategorizedLabelName({ preset: "Custom", customName: "Kuba Ventures" })).toBe(
      `Kuba Ventures/${UNCATEGORIZED_NAME}`,
    );
  });
});
