import { describe, it, expect } from "vitest";
import { getRelevantTimeWindow, addDaysCivil, zonedMidnightUTC } from "./schedulingWindow";

describe("zonedMidnightUTC", () => {
  it("maps EDT (summer) midnight to 04:00 UTC", () => {
    expect(zonedMidnightUTC("2026-07-31").toISOString()).toBe("2026-07-31T04:00:00.000Z");
  });
  it("maps EST (winter) midnight to 05:00 UTC", () => {
    expect(zonedMidnightUTC("2026-01-15").toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });
});

describe("addDaysCivil", () => {
  it("rolls across month boundaries", () => {
    expect(addDaysCivil("2026-07-31", 1)).toBe("2026-08-01");
  });
  it("goes backward", () => {
    expect(addDaysCivil("2026-08-01", -1)).toBe("2026-07-31");
  });
});

describe("getRelevantTimeWindow — the 11 PM ET regression", () => {
  // Email sent 11:15 PM ET on Jul 30 (= 2026-07-31T03:15:54Z). "tomorrow" must
  // resolve to Jul 31 ET, NOT Aug 1 (the UTC-bucketing bug).
  const lateNightSend = new Date("2026-07-31T03:15:54.000Z");

  it('resolves "tomorrow" to the Eastern next day, not the UTC one', () => {
    const { timeMin, timeMax } = getRelevantTimeWindow("are you free tomorrow at 4pm?", lateNightSend);
    // Jul 31 ET day = [Jul 31 04:00Z, Aug 1 04:00Z], which contains 4pm ET Jul 31.
    expect(timeMin).toBe("2026-07-31T04:00:00.000Z");
    expect(timeMax).toBe("2026-08-01T04:00:00.000Z");
    const fourPmET = new Date("2026-07-31T20:00:00.000Z"); // 4pm EDT
    expect(fourPmET.getTime()).toBeGreaterThanOrEqual(new Date(timeMin).getTime());
    expect(fourPmET.getTime()).toBeLessThan(new Date(timeMax).getTime());
  });

  it('resolves "today" to the Eastern send day', () => {
    const { timeMin, timeMax } = getRelevantTimeWindow("can we talk today?", lateNightSend);
    expect(timeMin).toBe("2026-07-30T04:00:00.000Z");
    expect(timeMax).toBe("2026-07-31T04:00:00.000Z");
  });
});
