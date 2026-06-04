import { describe, it, expect } from "vitest";
import {
  SECONDS_SAVED_PER_DRAFT,
  SECONDS_SAVED_PER_TAG,
  timeSavedSeconds,
} from "./timeSaved";

describe("timeSaved", () => {
  it("uses the documented per-action constants (3 min/draft, 30s/tag)", () => {
    expect(SECONDS_SAVED_PER_DRAFT).toBe(180);
    expect(SECONDS_SAVED_PER_TAG).toBe(30);
  });

  it("returns 0 when nothing happened", () => {
    expect(timeSavedSeconds(0, 0)).toBe(0);
  });

  it("counts drafts at 180s each", () => {
    expect(timeSavedSeconds(2, 0)).toBe(360);
  });

  it("counts tags at 30s each", () => {
    expect(timeSavedSeconds(0, 4)).toBe(120);
  });

  it("sums drafts and tags", () => {
    // 3 drafts (540s) + 5 tags (150s) = 690s
    expect(timeSavedSeconds(3, 5)).toBe(690);
  });

  it("stays consistent with the exported constants", () => {
    const drafts = 7;
    const tags = 11;
    expect(timeSavedSeconds(drafts, tags)).toBe(
      drafts * SECONDS_SAVED_PER_DRAFT + tags * SECONDS_SAVED_PER_TAG,
    );
  });
});
