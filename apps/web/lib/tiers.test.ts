import { describe, it, expect } from "vitest";
import { isComp, tierFor } from "./tiers";

// isComp is the pure comp-up decision shared by effectiveTier (which tier to
// display) and the AI guard (whether an admin comp grants paid limits). The
// I/O around it (reading the sheet Tier) is not unit-tested; this covers the
// ranking logic that decides "is this an admin comp".
describe("isComp", () => {
  it("is a comp when the override outranks the earned tier", () => {
    expect(isComp("Apprentice", "Partner")).toBe(true);
    expect(isComp("Adept", "Master")).toBe(true);
  });

  it("is not a comp when the override equals the earned tier", () => {
    expect(isComp("Master", "Master")).toBe(false);
  });

  it("is not a comp when the override is lower than the earned tier", () => {
    expect(isComp("Master", "Adept")).toBe(false);
  });

  it("is not a comp for a blank override", () => {
    expect(isComp("Apprentice", "")).toBe(false);
  });

  it("is not a comp for an unknown override string", () => {
    expect(isComp("Apprentice", "Wizard")).toBe(false);
  });

  it("treats any real tier above the Apprentice floor as a comp", () => {
    // A brand-new user (0s earned → Apprentice) comped to any real tier.
    const earned = tierFor(0);
    expect(isComp(earned, "Adept")).toBe(true);
  });
});
