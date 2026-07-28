import { describe, it, expect } from "vitest";
import {
  buildEventBody,
  buildRRule,
  calendarErrorMessage,
  effectiveRecurrence,
  parseHHMM,
  resolveAnchor,
  safeParsePrefs,
  type Recurrence,
} from "./blockMirror";
import { DHARMA_BLOCK_DESCRIPTION, DHARMA_BLOCK_EXT_KEY } from "./dharmaBlock";

describe("parseHHMM", () => {
  it("parses a valid time", () => {
    expect(parseHHMM("09:30")).toEqual({ h: 9, m: 30 });
    expect(parseHHMM("23:59")).toEqual({ h: 23, m: 59 });
  });
  it("rejects out-of-range and malformed values", () => {
    expect(parseHHMM("24:00")).toBeNull();
    expect(parseHHMM("12:60")).toBeNull();
    expect(parseHHMM("noon")).toBeNull();
    expect(parseHHMM("")).toBeNull();
  });
});

describe("buildRRule", () => {
  it("returns null for a one-off", () => {
    expect(buildRRule({ freq: "none" })).toBeNull();
  });
  it("builds a daily rule with interval", () => {
    expect(buildRRule({ freq: "daily", interval: 2 })).toBe("RRULE:FREQ=DAILY;INTERVAL=2");
  });
  it("defaults interval to 1 when missing or invalid", () => {
    expect(buildRRule({ freq: "monthly" })).toBe("RRULE:FREQ=MONTHLY;INTERVAL=1");
    expect(buildRRule({ freq: "monthly", interval: 0 })).toBe("RRULE:FREQ=MONTHLY;INTERVAL=1");
  });
  it("adds BYDAY for a partial weekly day set, sorted", () => {
    expect(buildRRule({ freq: "weekly", days: [5, 1, 3] })).toBe(
      "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
    );
  });
  it("omits BYDAY when all 7 days are selected", () => {
    expect(buildRRule({ freq: "weekly", days: [0, 1, 2, 3, 4, 5, 6] })).toBe(
      "RRULE:FREQ=WEEKLY;INTERVAL=1",
    );
  });
  it("appends an inclusive UNTIL in UTC", () => {
    expect(buildRRule({ freq: "weekly", days: [1], until: "2026-08-15" })).toBe(
      "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20260815T235959Z",
    );
  });
});

describe("effectiveRecurrence", () => {
  it("returns the block's own recurrence when present", () => {
    const rec: Recurrence = { freq: "daily", interval: 1 };
    expect(effectiveRecurrence({ start: "9:00", end: "10:00", recurrence: rec }, new Set([1]))).toBe(
      rec,
    );
  });
  it("falls back to weekly on active days for legacy blocks", () => {
    expect(
      effectiveRecurrence({ start: "9:00", end: "10:00" }, new Set([1, 3, 5])),
    ).toEqual({ freq: "weekly", interval: 1, days: [1, 3, 5] });
  });
});

describe("resolveAnchor", () => {
  it("uses an explicit date verbatim", () => {
    const d = resolveAnchor({ freq: "none", date: "2026-08-01" });
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(7); // August (0-indexed)
    expect(d?.getDate()).toBe(1);
  });
  it("picks the next matching weekday from a fixed 'now'", () => {
    // 2026-07-28 is a Tuesday (day 2). Asking for Friday (5) should land 3 days later.
    const now = new Date(2026, 6, 28);
    const d = resolveAnchor({ freq: "weekly", days: [5] }, now);
    expect(d?.getDay()).toBe(5);
    expect(d?.getDate()).toBe(31);
  });
  it("returns today for non-weekly with no date", () => {
    const now = new Date(2026, 6, 28);
    const d = resolveAnchor({ freq: "daily" }, now);
    expect(d?.getDate()).toBe(28);
  });
});

describe("buildEventBody", () => {
  const activeDays = new Set([1, 2, 3, 4, 5]);

  it("returns null for invalid times", () => {
    expect(
      buildEventBody({ start: "nope", end: "10:00", recurrence: { freq: "none", date: "2026-08-01" } }, activeDays, "America/New_York"),
    ).toBeNull();
  });

  it("stamps the block marker, description, color and wall-clock times", () => {
    const ev = buildEventBody(
      {
        start: "12:00",
        end: "13:00",
        label: "  Lunch  ",
        colorId: "5",
        recurrence: { freq: "none", date: "2026-08-03" },
      },
      activeDays,
      "America/New_York",
    );
    expect(ev).not.toBeNull();
    expect(ev!.summary).toBe("Lunch");
    expect(ev!.description).toBe(DHARMA_BLOCK_DESCRIPTION);
    expect(ev!.extendedProperties?.private?.[DHARMA_BLOCK_EXT_KEY]).toBe("1");
    expect(ev!.colorId).toBe("5");
    expect(ev!.start).toEqual({ dateTime: "2026-08-03T12:00:00", timeZone: "America/New_York" });
    expect(ev!.end).toEqual({ dateTime: "2026-08-03T13:00:00", timeZone: "America/New_York" });
    // one-off => no recurrence rule
    expect(ev!.recurrence).toBeUndefined();
  });

  it("defaults summary and color when unset, and attaches an RRULE for recurring blocks", () => {
    const ev = buildEventBody(
      { start: "8:00", end: "9:00", mirrorToCalendar: true, recurrence: { freq: "weekly", days: [1, 3] } },
      activeDays,
      "UTC",
      new Date(2026, 6, 28),
    );
    expect(ev!.summary).toBe("Dharma block");
    expect(ev!.colorId).toBe("1"); // Lavender default
    expect(ev!.recurrence).toEqual(["RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE"]);
  });

  it("rejects an out-of-palette colorId, falling back to the default", () => {
    const ev = buildEventBody(
      { start: "8:00", end: "9:00", colorId: "99", recurrence: { freq: "none", date: "2026-08-03" } },
      activeDays,
      "UTC",
    );
    expect(ev!.colorId).toBe("1");
  });
});

describe("calendarErrorMessage", () => {
  it("translates an invalid_grant OAuth failure into a reconnect prompt", () => {
    expect(calendarErrorMessage({ message: "invalid_grant" })).toMatch(/sign out and sign back in/i);
    expect(
      calendarErrorMessage({ response: { data: { error: "invalid_grant" } } }),
    ).toMatch(/sign out and sign back in/i);
  });
  it("surfaces an API error message with its code", () => {
    expect(
      calendarErrorMessage({ code: 404, response: { data: { error: { message: "Not Found" } } } }),
    ).toBe("Not Found (404)");
  });
  it("falls back to a generic message", () => {
    expect(calendarErrorMessage({})).toBe("Unknown calendar error");
  });
});

describe("safeParsePrefs", () => {
  it("returns {} for null / invalid JSON", () => {
    expect(safeParsePrefs(null)).toEqual({});
    expect(safeParsePrefs("{not json")).toEqual({});
  });
  it("parses valid prefs", () => {
    expect(safeParsePrefs('{"maxPerDay":4}')).toEqual({ maxPerDay: 4 });
  });
});
