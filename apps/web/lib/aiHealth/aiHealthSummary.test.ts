import { describe, it, expect } from "vitest";
import type { StoredAiServiceCheck } from "./aiHealthAlerts";
import {
  incidentsFromChecks,
  summarizeAiServiceHealth,
  timelineSlotsForChecks,
  uptimePercentForChecks,
} from "./aiHealthSummary";

function storedCheck(checkedAt: string, status: StoredAiServiceCheck["status"]): StoredAiServiceCheck {
  return { service: "claude", status, failureKind: status === "down" ? "out_of_credits" : null, failureDetail: null, checkedAt, alertSent: null };
}

const checksNewestFirst = [
  storedCheck("2026-10-21T23:30:00.000Z", "working"),
  storedCheck("2026-10-21T23:20:00.000Z", "down"),
  storedCheck("2026-10-21T23:10:00.000Z", "down"),
  storedCheck("2026-10-21T23:00:00.000Z", "working"),
];

describe("incidentsFromChecks", () => {
  it("groups consecutive down checks into one incident", () => {
    expect(incidentsFromChecks(checksNewestFirst)).toEqual([
      {
        startedAtIso: "2026-10-21T23:10:00.000Z",
        endedAtIso: "2026-10-21T23:30:00.000Z",
        failureKind: "out_of_credits",
        failureDetail: null,
      },
    ]);
  });

  it("leaves an incident open while it is still down", () => {
    expect(incidentsFromChecks(checksNewestFirst.slice(1))[0].endedAtIso).toBeNull();
  });
});

describe("uptimePercentForChecks", () => {
  it("ignores unknown checks", () => {
    expect(uptimePercentForChecks([...checksNewestFirst, storedCheck("2026-10-21T22:50:00.000Z", "unknown")])).toBe(50);
    expect(uptimePercentForChecks([storedCheck("2026-10-21T22:50:00.000Z", "unknown")])).toBeNull();
  });
});

describe("timelineSlotsForChecks", () => {
  it("marks a slot down if any check in it was down", () => {
    const windowStart = Date.parse("2026-10-21T23:00:00.000Z");
    const windowEnd = Date.parse("2026-10-21T23:40:00.000Z");
    expect(timelineSlotsForChecks(checksNewestFirst, windowStart, windowEnd, 4)).toEqual([
      "working",
      "down",
      "down",
      "working",
    ]);
  });
});

describe("summarizeAiServiceHealth", () => {
  it("reports never checked when there are no checks", () => {
    const healthSummary = summarizeAiServiceHealth("claude", [], Date.parse("2026-10-21T23:40:00.000Z"));
    expect(healthSummary.currentStatus).toBe("never_checked");
    expect(healthSummary.timelineSlots.every((timelineSlot) => timelineSlot === "no_data")).toBe(true);
  });
});
