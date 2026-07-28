import { describe, it, expect } from "vitest";
import {
  typicalDayAvailability,
  recursOnWeekday,
  shortHour,
  type DayHour,
  type DayBlock,
} from "./dayAvailability";

const WEEKDAY_HOURS: DayHour[] = [1, 2, 3, 4, 5].map((d) => ({
  dayOfWeek: d,
  hourStart: 8,
  hourEnd: 21,
}));

describe("recursOnWeekday", () => {
  it("includes daily and weekday-weekly blocks", () => {
    expect(recursOnWeekday({ start: "8:00", end: "10:30", recurrence: { freq: "daily" } })).toBe(true);
    expect(recursOnWeekday({ start: "13:00", end: "14:00", recurrence: { freq: "weekly", days: [1, 2, 3, 4, 5] } })).toBe(true);
  });
  it("excludes one-off and weekend-only blocks", () => {
    expect(recursOnWeekday({ start: "15:00", end: "17:00", recurrence: { freq: "none", days: [] } })).toBe(false);
    expect(recursOnWeekday({ start: "9:00", end: "10:00", recurrence: { freq: "weekly", days: [0, 6] } })).toBe(false);
    expect(recursOnWeekday({ start: "9:00", end: "10:00" })).toBe(false);
  });
});

describe("typicalDayAvailability", () => {
  it("derives the weekday window and places recurring blocks as bands", () => {
    const blocks: DayBlock[] = [
      { start: "08:00", end: "10:30", label: "Internal Block", recurrence: { freq: "daily" } },
      { start: "13:00", end: "14:00", label: "Lunch Block", recurrence: { freq: "weekly", days: [1, 2, 3, 4, 5] } },
      { start: "15:00", end: "17:00", label: "WC Semi", recurrence: { freq: "none" } }, // one-off → excluded
    ];
    const a = typicalDayAvailability(WEEKDAY_HOURS, blocks)!;
    expect(a.startHour).toBe(8);
    expect(a.endHour).toBe(21);
    expect(a.bands).toHaveLength(2);
    // Internal 8:00-10:30 → 0% for 2.5/13h
    expect(a.bands[0].startPct).toBeCloseTo(0, 5);
    expect(a.bands[0].widthPct).toBeCloseTo((150 / 780) * 100, 3);
    // Lunch 13:00-14:00 → 5h in
    expect(a.bands[1].startPct).toBeCloseTo((300 / 780) * 100, 3);
    expect(a.bands[1].widthPct).toBeCloseTo((60 / 780) * 100, 3);
  });

  it("clamps a block that runs past the window", () => {
    const a = typicalDayAvailability(WEEKDAY_HOURS, [
      { start: "20:00", end: "23:00", label: "Late", recurrence: { freq: "daily" } },
    ])!;
    // 20:00 start = 12h in; end clamps to 21:00
    expect(a.bands[0].startPct).toBeCloseTo((720 / 780) * 100, 3);
    expect(a.bands[0].widthPct).toBeCloseTo((60 / 780) * 100, 3);
  });

  it("returns null with no hours", () => {
    expect(typicalDayAvailability([], [])).toBeNull();
  });
});

describe("shortHour", () => {
  it("formats am/pm compactly", () => {
    expect(shortHour(8)).toBe("8a");
    expect(shortHour(13)).toBe("1p");
    expect(shortHour(12)).toBe("12p");
    expect(shortHour(21)).toBe("9p");
    expect(shortHour(0)).toBe("12a");
  });
});
