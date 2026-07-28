import { describe, it, expect } from "vitest";
import {
  weekAvailability,
  blockWeekdays,
  shortHour,
  type DayHour,
  type DayBlock,
} from "./dayAvailability";

const WEEKDAY_HOURS: DayHour[] = [1, 2, 3, 4, 5].map((d) => ({
  dayOfWeek: d,
  hourStart: 8,
  hourEnd: 21,
}));

describe("blockWeekdays", () => {
  it("maps daily to every day and weekly to its days", () => {
    expect([...blockWeekdays({ start: "8:00", end: "9:00", recurrence: { freq: "daily" } })].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect([...blockWeekdays({ start: "13:00", end: "14:00", recurrence: { freq: "weekly", days: [1, 2, 3, 4, 5] } })]).toEqual([1, 2, 3, 4, 5]);
  });
  it("maps a one-off date to that date's weekday", () => {
    // 2026-07-15 is a Wednesday (day 3)
    expect([...blockWeekdays({ start: "15:00", end: "17:00", recurrence: { freq: "none", date: "2026-07-15" } })]).toEqual([3]);
  });
});

describe("weekAvailability", () => {
  const blocks: DayBlock[] = [
    { start: "08:00", end: "10:30", label: "Internal", hex: "#D50000", recurrence: { freq: "daily" } },
    { start: "13:00", end: "14:00", label: "Lunch", hex: "#0B8043", recurrence: { freq: "weekly", days: [1, 2, 3, 4, 5] } },
    { start: "15:00", end: "17:00", label: "WC Semi", hex: "#0B8043", recurrence: { freq: "none", date: "2026-07-15" } },
  ];

  it("builds a column per active weekday on a shared scale", () => {
    const wk = weekAvailability(WEEKDAY_HOURS, blocks)!;
    expect(wk.scaleStart).toBe(8);
    expect(wk.scaleEnd).toBe(21);
    expect(wk.days.map((d) => d.label)).toEqual(["M", "T", "W", "T", "F"]);
    expect(wk.days[0].openTopPct).toBeCloseTo(0, 5);
    expect(wk.days[0].openHeightPct).toBeCloseTo(100, 5);
  });

  it("puts daily + weekday blocks on every weekday and the one-off only on Wed", () => {
    const wk = weekAvailability(WEEKDAY_HOURS, blocks)!;
    const mon = wk.days.find((d) => d.dayOfWeek === 1)!;
    const wed = wk.days.find((d) => d.dayOfWeek === 3)!;
    expect(mon.bands.map((b) => b.label)).toEqual(["Internal", "Lunch"]);
    expect(wed.bands.map((b) => b.label)).toEqual(["Internal", "Lunch", "WC Semi"]);
    // Internal 8:00-10:30 → 2.5h of 13h from the top
    expect(mon.bands[0].topPct).toBeCloseTo(0, 5);
    expect(mon.bands[0].heightPct).toBeCloseTo((150 / 780) * 100, 3);
    expect(mon.bands[0].hex).toBe("#D50000");
  });

  it("returns null when there are no weekday hours", () => {
    expect(weekAvailability([], [])).toBeNull();
    expect(weekAvailability([{ dayOfWeek: 0, hourStart: 8, hourEnd: 21 }], [])).toBeNull();
  });
});

describe("shortHour", () => {
  it("formats am/pm compactly", () => {
    expect(shortHour(8)).toBe("8a");
    expect(shortHour(13)).toBe("1p");
    expect(shortHour(21)).toBe("9p");
  });
});
