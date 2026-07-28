import { describe, it, expect } from "vitest";
import {
  isBlockExpired,
  pruneExpiredBlocks,
  todayISOInZone,
} from "./expiredBlocks";

const TODAY = "2026-07-28";

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
