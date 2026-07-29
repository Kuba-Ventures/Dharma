import { describe, it, expect } from "vitest";
import { eventDisplayTitle } from "./eventTitle";

describe("eventDisplayTitle", () => {
  it("returns the event summary when present", () => {
    expect(eventDisplayTitle({ summary: "Brady <> Finley Weekly" })).toBe(
      "Brady <> Finley Weekly",
    );
  });

  it("trims surrounding whitespace on the summary", () => {
    expect(eventDisplayTitle({ summary: "  Hack Sync \n" })).toBe("Hack Sync");
  });

  it('labels a detail-hidden private event "Busy" (reader access strips the title)', () => {
    // Google returns private events on reader-access calendars with no summary
    // and visibility "private" — its own UIs show these as "Busy".
    expect(eventDisplayTitle({ visibility: "private" })).toBe("Busy");
    expect(eventDisplayTitle({ summary: "   ", visibility: "private" })).toBe("Busy");
  });

  it("keeps the real title of a private event the user can fully see", () => {
    expect(
      eventDisplayTitle({ summary: "Therapy", visibility: "private" }),
    ).toBe("Therapy");
  });

  it('falls back to "(no title)" for a visible but genuinely untitled event', () => {
    expect(eventDisplayTitle({})).toBe("(no title)");
    expect(eventDisplayTitle({ visibility: "default" })).toBe("(no title)");
  });
});
