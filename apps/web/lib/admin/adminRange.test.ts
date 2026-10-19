import { describe, expect, it } from "vitest";
import {
  dayKeyInTimeZone,
  fillDailySeries,
  parseAdminReportingRange,
  percentChange,
  periodsForRange,
  startOfDayInstant,
} from "./adminRange";

describe("adminRange", () => {
  it("defaults unknown ranges to 30d", () => {
    expect(parseAdminReportingRange("7d")).toBe("7d");
    expect(parseAdminReportingRange("bogus")).toBe("30d");
    expect(parseAdminReportingRange(undefined)).toBe("30d");
  });

  it("buckets an instant into its Los Angeles calendar day", () => {
    // 03:00 UTC on Oct 20 is still Oct 19 in Los Angeles.
    expect(dayKeyInTimeZone(new Date("2026-10-20T03:00:00Z"))).toBe("2026-10-19");
  });

  it("finds local midnight across DST", () => {
    expect(startOfDayInstant("2026-10-19").toISOString()).toBe("2026-10-19T07:00:00.000Z");
    expect(startOfDayInstant("2026-12-01").toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });

  it("builds back-to-back current and prior windows ending today", () => {
    const now = new Date("2026-10-19T20:00:00Z");
    const { current, prior } = periodsForRange("7d", now);
    expect(current.dayKeys).toEqual([
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
    ]);
    expect(prior.dayKeys[0]).toBe("2026-10-06");
    expect(prior.end.getTime()).toBe(current.start.getTime());
    expect(current.end).toBe(now);
  });

  it("starts the all-time range at launch", () => {
    const { current } = periodsForRange("all", new Date("2026-10-19T20:00:00Z"));
    expect(current.dayKeys[0]).toBe("2026-03-25");
    expect(current.dayKeys.at(-1)).toBe("2026-10-19");
  });

  it("fills missing days with zero and computes change", () => {
    expect(fillDailySeries(["a", "b", "c"], new Map([["b", 4]]))).toEqual([0, 4, 0]);
    expect(percentChange(116, 100)).toBe(16);
    expect(percentChange(5, 0)).toBeNull();
  });
});
