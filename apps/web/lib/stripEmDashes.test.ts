import { describe, it, expect } from "vitest";
import { stripEmDashes } from "./stripEmDashes";

describe("stripEmDashes", () => {
  it("turns a spaced em-dash into a comma", () => {
    expect(stripEmDashes("Traction is up — a round is coming")).toBe(
      "Traction is up, a round is coming",
    );
  });

  it("collapses a dash next to an existing comma", () => {
    expect(stripEmDashes("Talk soon, — Finley")).toBe("Talk soon, Finley");
  });

  it("drops a leading dash so a sign-off reads cleanly", () => {
    expect(stripEmDashes("— Alex")).toBe("Alex");
  });

  it("handles en-dashes too", () => {
    expect(stripEmDashes("2 – 4 sentences")).toBe("2, 4 sentences");
  });

  it("leaves ordinary hyphens and ranges alone", () => {
    expect(stripEmDashes("well-known 2-4 follow-up")).toBe(
      "well-known 2-4 follow-up",
    );
  });

  it("is a no-op when there are no em/en dashes", () => {
    const s = "Direct and warm. You usually open with 'Hi,' and sign off with 'Thanks,'.";
    expect(stripEmDashes(s)).toBe(s);
  });
});
