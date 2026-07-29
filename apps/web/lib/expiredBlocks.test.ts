import { describe, it, expect } from "vitest";
import {
  isBlockExpired,
  pruneExpiredBlocks,
  todayISOInZone,
  nowISOInZone,
} from "./expiredBlocks";

const TODAY = "2026-07-28";
const NOW_EVENING = "2026-07-28T21:00"; // 9pm — after a 6:45pm block ends

describe("isBlockExpired", () => {
  it("keeps a block with no recurrence", () => {
    expect(isBlockExpired({}, TODAY)).toBe(false);
  });

  it("expires a one-off dated before today", () => {
    expect(
      isBlockExpired({ recurrence: { freq: "none", date: "2026-07-27" } }, TODAY),
    ).toBe(true);
  });

  it("keeps a one-off dated today (event hasn't fully passed yet)", () => {
    expect(
      isBlockExpired({ recurrence: { freq: "none", date: TODAY } }, TODAY),
    ).toBe(false);
  });

  it("keeps a one-off dated in the future", () => {
    expect(
      isBlockExpired({ recurrence: { freq: "none", date: "2026-08-01" } }, TODAY),
    ).toBe(false);
  });

  it("keeps a one-off with no date (still being edited)", () => {
    expect(isBlockExpired({ recurrence: { freq: "none" } }, TODAY)).toBe(false);
  });

  it("expires a recurring block whose `until` is before today", () => {
    expect(
      isBlockExpired(
        { recurrence: { freq: "weekly", days: undefined, until: "2026-07-27" } as never },
        TODAY,
      ),
    ).toBe(true);
  });

  it("keeps a recurring block whose `until` is today (last run may be today)", () => {
    expect(
      isBlockExpired({ recurrence: { freq: "daily", until: TODAY } }, TODAY),
    ).toBe(false);
  });

  it("keeps an open-ended recurring block (no `until`)", () => {
    expect(isBlockExpired({ recurrence: { freq: "weekly" } }, TODAY)).toBe(false);
  });

  it("ignores a recurring block's past anchor date when there's no `until`", () => {
    expect(
      isBlockExpired(
        { recurrence: { freq: "monthly", date: "2020-01-01" } },
        TODAY,
      ),
    ).toBe(false);
  });

  it("returns false when today is malformed (never prunes on bad input)", () => {
    expect(
      isBlockExpired({ recurrence: { freq: "none", date: "2000-01-01" } }, "nope"),
    ).toBe(false);
  });

  it("ignores malformed date strings", () => {
    expect(
      isBlockExpired({ recurrence: { freq: "none", date: "07/27/2026" } }, TODAY),
    ).toBe(false);
  });
});

describe("isBlockExpired — time-aware one-offs", () => {
  it("clears a same-day one-off once its end time has passed (the 'Gone fishing' case)", () => {
    expect(
      isBlockExpired({ end: "18:45", recurrence: { freq: "none", date: TODAY } }, NOW_EVENING),
    ).toBe(true);
  });

  it("keeps a same-day one-off whose end time is still ahead", () => {
    expect(
      isBlockExpired({ end: "23:00", recurrence: { freq: "none", date: TODAY } }, NOW_EVENING),
    ).toBe(false);
  });

  it("clears exactly at the end minute (inclusive)", () => {
    expect(
      isBlockExpired({ end: "21:00", recurrence: { freq: "none", date: TODAY } }, NOW_EVENING),
    ).toBe(true);
  });

  it("clears a past-dated one-off regardless of time of day", () => {
    expect(
      isBlockExpired({ end: "23:59", recurrence: { freq: "none", date: "2026-07-27" } }, "2026-07-28T00:05"),
    ).toBe(true);
  });

  it("keeps a future-dated one-off even late in the day", () => {
    expect(
      isBlockExpired({ end: "09:00", recurrence: { freq: "none", date: "2026-07-29" } }, NOW_EVENING),
    ).toBe(false);
  });

  it("normalizes a single-digit end hour before comparing", () => {
    expect(
      isBlockExpired({ end: "9:00", recurrence: { freq: "none", date: TODAY } }, "2026-07-28T08:30"),
    ).toBe(false);
    expect(
      isBlockExpired({ end: "9:00", recurrence: { freq: "none", date: TODAY } }, "2026-07-28T10:30"),
    ).toBe(true);
  });

  it("falls back to whole-day when given only a bare day (keeps same-day)", () => {
    expect(
      isBlockExpired({ end: "18:45", recurrence: { freq: "none", date: TODAY } }, TODAY),
    ).toBe(false);
  });

  it("falls back to whole-day when the block has no end time", () => {
    // Same-day, no end, full timestamp → not expired (waits for the date to roll).
    expect(
      isBlockExpired({ recurrence: { freq: "none", date: TODAY } }, NOW_EVENING),
    ).toBe(false);
  });

  it("still treats recurring `until` as whole-day even with a timestamp", () => {
    expect(
      isBlockExpired({ end: "18:45", recurrence: { freq: "daily", until: TODAY } }, NOW_EVENING),
    ).toBe(false);
  });
});

describe("pruneExpiredBlocks", () => {
  it("partitions and preserves order", () => {
    const blocks = [
      { id: "a", recurrence: { freq: "none" as const, date: "2026-07-01" } }, // expired
      { id: "b", recurrence: { freq: "weekly" as const } }, // kept
      { id: "c", recurrence: { freq: "daily" as const, until: "2026-07-20" } }, // expired
      { id: "d", recurrence: { freq: "none" as const, date: "2026-08-15" } }, // kept
    ];
    const { kept, expired } = pruneExpiredBlocks(blocks, TODAY);
    expect(kept.map((b) => b.id)).toEqual(["b", "d"]);
    expect(expired.map((b) => b.id)).toEqual(["a", "c"]);
  });

  it("returns everything when nothing has expired", () => {
    const blocks = [{ recurrence: { freq: "weekly" as const } }];
    const { kept, expired } = pruneExpiredBlocks(blocks, TODAY);
    expect(kept).toHaveLength(1);
    expect(expired).toHaveLength(0);
  });

  it("handles an empty list", () => {
    expect(pruneExpiredBlocks([], TODAY)).toEqual({ kept: [], expired: [] });
  });
});

describe("todayISOInZone", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(todayISOInZone("America/New_York")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reflects the zone: a fixed instant can be two different calendar days", () => {
    // 2026-07-28T03:30:00Z is still 2026-07-27 in New York (UTC-4) but already
    // 2026-07-28 in London.
    const instant = new Date("2026-07-28T03:30:00Z");
    expect(todayISOInZone("America/New_York", instant)).toBe("2026-07-27");
    expect(todayISOInZone("Europe/London", instant)).toBe("2026-07-28");
  });

  it("falls back gracefully on a bad zone", () => {
    expect(todayISOInZone("Not/AZone")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("nowISOInZone", () => {
  it("formats as YYYY-MM-DDTHH:MM", () => {
    expect(nowISOInZone("America/New_York")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("reflects the zone's local wall-clock time", () => {
    // 2026-07-28T03:30:00Z → 2026-07-27 23:30 in New York (UTC-4, EDT) but
    // 2026-07-28 04:30 in London (UTC+1, BST).
    const instant = new Date("2026-07-28T03:30:00Z");
    expect(nowISOInZone("America/New_York", instant)).toBe("2026-07-27T23:30");
    expect(nowISOInZone("Europe/London", instant)).toBe("2026-07-28T04:30");
  });

  it("produces a stamp that orders after a block that ended earlier the same day", () => {
    const instant = new Date("2026-07-29T01:00:00Z"); // 2026-07-28 21:00 in NY
    const now = nowISOInZone("America/New_York", instant);
    expect(isBlockExpired({ end: "18:45", recurrence: { freq: "none", date: "2026-07-28" } }, now)).toBe(true);
  });

  it("falls back gracefully on a bad zone", () => {
    expect(nowISOInZone("Not/AZone")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
