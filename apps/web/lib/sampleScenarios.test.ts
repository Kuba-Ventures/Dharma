import { describe, it, expect } from "vitest";
import {
  SAMPLE_SCENARIOS,
  defaultScenarioIndex,
  scenarioById,
} from "./sampleScenarios";

describe("SAMPLE_SCENARIOS data", () => {
  it("has well-formed, uniquely-identified entries", () => {
    expect(SAMPLE_SCENARIOS.length).toBeGreaterThan(0);
    for (const s of SAMPLE_SCENARIOS) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.prompt).toBeTruthy();
    }
    const ids = SAMPLE_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("defaultScenarioIndex", () => {
  it("is deterministic for a fixed instant and within range", () => {
    const now = new Date("2026-06-03T12:00:00.000Z");
    const idx = defaultScenarioIndex(now);
    expect(idx).toBe(defaultScenarioIndex(now));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(SAMPLE_SCENARIOS.length);
  });

  it("advances by one (mod length) each hour", () => {
    const base = new Date("2026-06-03T12:00:00.000Z");
    const nextHour = new Date(base.getTime() + 60 * 60 * 1000);
    const expected = (defaultScenarioIndex(base) + 1) % SAMPLE_SCENARIOS.length;
    expect(defaultScenarioIndex(nextHour)).toBe(expected);
  });

  it("does not churn within the same hour", () => {
    const a = new Date("2026-06-03T12:05:00.000Z");
    const b = new Date("2026-06-03T12:55:00.000Z");
    expect(defaultScenarioIndex(a)).toBe(defaultScenarioIndex(b));
  });
});

describe("scenarioById", () => {
  it("returns the matching scenario", () => {
    const first = SAMPLE_SCENARIOS[0];
    expect(scenarioById(first.id)).toEqual(first);
  });

  it("returns undefined for an unknown id", () => {
    expect(scenarioById("does-not-exist")).toBeUndefined();
  });
});
