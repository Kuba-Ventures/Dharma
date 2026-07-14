import { describe, it, expect } from "vitest";
import { shouldRecordClassifiedThread } from "./classifiedThreadGate";

describe("shouldRecordClassifiedThread", () => {
  it("records when a label actually landed", () => {
    expect(
      shouldRecordClassifiedThread({ intendedLabelCount: 1, appliedLabelCount: 1 }),
    ).toBe(true);
  });

  it("records when there was legitimately nothing to apply (no match, Uncategorized off)", () => {
    expect(
      shouldRecordClassifiedThread({ intendedLabelCount: 0, appliedLabelCount: 0 }),
    ).toBe(true);
  });

  it("does NOT record when a label was intended but none landed (mapping not ready)", () => {
    // The provisioning-race case that stranded threads "classified but
    // unlabeled" — see PR #42. Must stay false so the thread is reclassified
    // on a later poll/webhook once the LabelMapping exists.
    expect(
      shouldRecordClassifiedThread({ intendedLabelCount: 2, appliedLabelCount: 0 }),
    ).toBe(false);
  });

  it("records a partial apply (at least one intended label landed)", () => {
    expect(
      shouldRecordClassifiedThread({ intendedLabelCount: 2, appliedLabelCount: 1 }),
    ).toBe(true);
  });
});
