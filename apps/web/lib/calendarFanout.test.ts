import { describe, it, expect, vi, afterEach } from "vitest";
import type { calendar_v3 } from "googleapis";
import { mergeCalendarEvents } from "./calendarFanout";

type EventsListLike = { data: { items?: calendar_v3.Schema$Event[] | null } };

const fulfilled = (
  items: calendar_v3.Schema$Event[] | null,
): PromiseSettledResult<EventsListLike> => ({
  status: "fulfilled",
  value: { data: { items } },
});

const rejected = (reason: unknown): PromiseSettledResult<EventsListLike> => ({
  status: "rejected",
  reason,
});

// Shaped like a googleapis Gaxios error carrying an OAuth invalid_grant.
const invalidGrantError = () => ({
  response: { data: { error: "invalid_grant" } },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mergeCalendarEvents", () => {
  it("concatenates items across all fulfilled calendars", () => {
    const events = mergeCalendarEvents([
      fulfilled([{ id: "a" }, { id: "b" }]),
      fulfilled([{ id: "c" }]),
    ]);
    expect(events.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("treats a null/absent items list as empty", () => {
    expect(mergeCalendarEvents([fulfilled(null), fulfilled([])])).toEqual([]);
  });

  it("tolerates a single unreadable calendar (logs and skips)", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const events = mergeCalendarEvents([
      fulfilled([{ id: "a" }]),
      rejected(new Error("403 on a subscribed calendar")),
      fulfilled([{ id: "b" }]),
    ]);
    expect(events.map((e) => e.id)).toEqual(["a", "b"]);
    expect(err).toHaveBeenCalledOnce();
  });

  it("rethrows invalid_grant instead of returning a misleading empty list", () => {
    // Every calendar fails with a dead grant — must surface, not swallow (#91).
    expect(() =>
      mergeCalendarEvents([rejected(invalidGrantError()), rejected(invalidGrantError())]),
    ).toThrow();
  });

  it("rethrows invalid_grant even when some calendars succeeded", () => {
    expect(() =>
      mergeCalendarEvents([fulfilled([{ id: "a" }]), rejected(invalidGrantError())]),
    ).toThrow();
  });
});
