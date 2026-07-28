import { describe, it, expect } from "vitest";
import { visibleCalendarIds } from "@dharma/calendar-core";

describe("visibleCalendarIds", () => {
  it("includes calendars the user has ticked (selected)", () => {
    expect(
      visibleCalendarIds([
        { id: "primary@example.com", primary: true, selected: true },
        { id: "work@group.calendar.google.com", selected: true },
        { id: "personal@group.calendar.google.com", selected: true },
      ]),
    ).toEqual([
      "primary@example.com",
      "work@group.calendar.google.com",
      "personal@group.calendar.google.com",
    ]);
  });

  it("always keeps primary even when Google omits `selected` on it", () => {
    expect(
      visibleCalendarIds([{ id: "primary@example.com", primary: true }]),
    ).toEqual(["primary@example.com"]);
  });

  it("drops calendars the user has hidden (not selected)", () => {
    expect(
      visibleCalendarIds([
        { id: "primary@example.com", primary: true, selected: true },
        { id: "holidays@group.calendar.google.com", selected: false },
        { id: "muted@group.calendar.google.com" },
      ]),
    ).toEqual(["primary@example.com"]);
  });

  it("drops deleted entries and entries without an id", () => {
    expect(
      visibleCalendarIds([
        { id: "work@group.calendar.google.com", selected: true },
        { id: "old@group.calendar.google.com", selected: true, deleted: true },
        { selected: true },
      ]),
    ).toEqual(["work@group.calendar.google.com"]);
  });

  it("de-dupes repeated ids, preserving first-seen order", () => {
    expect(
      visibleCalendarIds([
        { id: "a@x", selected: true },
        { id: "b@x", selected: true },
        { id: "a@x", selected: true },
      ]),
    ).toEqual(["a@x", "b@x"]);
  });

  it("falls back to ['primary'] when nothing qualifies", () => {
    expect(visibleCalendarIds([])).toEqual(["primary"]);
    expect(visibleCalendarIds([{ id: "hidden@x", selected: false }])).toEqual(["primary"]);
  });
});
