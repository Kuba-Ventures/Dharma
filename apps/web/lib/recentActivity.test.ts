import { describe, it, expect } from "vitest";
import { groupActivity, type ActivityEvent } from "./recentActivity";

const at = (iso: string) => new Date(iso);

const draft = (iso: string): ActivityEvent => ({
  kind: "draft",
  at: at(iso),
  title: "Drafted a reply",
});
const signal = (iso: string): ActivityEvent => ({
  kind: "signal",
  at: at(iso),
  title: "Signal detected",
  signalKind: "follow_up",
  threadId: null,
});
const classified = (iso: string, labelName: string): ActivityEvent => ({
  kind: "classified",
  at: at(iso),
  title: "Classified a thread",
  labelName,
  labelColor: "#34d3a6",
});

describe("groupActivity", () => {
  it("returns an empty array for no events", () => {
    expect(groupActivity([])).toEqual([]);
  });

  it("collapses a run of consecutive drafts into one counted row", () => {
    const rows = groupActivity([
      draft("2026-07-28T10:00:00Z"),
      draft("2026-07-28T09:30:00Z"),
      draft("2026-07-28T09:00:00Z"),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "draft", count: 3 });
  });

  it("keeps the most recent timestamp for a draft group (events are newest-first)", () => {
    const rows = groupActivity([
      draft("2026-07-28T10:00:00Z"),
      draft("2026-07-28T09:00:00Z"),
    ]);
    expect(rows[0].at.toISOString()).toBe("2026-07-28T10:00:00.000Z");
  });

  it("leaves a single draft as count 1", () => {
    const rows = groupActivity([draft("2026-07-28T10:00:00Z")]);
    expect(rows[0]).toMatchObject({ kind: "draft", count: 1 });
  });

  it("does not merge drafts separated by another event", () => {
    const rows = groupActivity([
      draft("2026-07-28T10:00:00Z"),
      signal("2026-07-28T09:30:00Z"),
      draft("2026-07-28T09:00:00Z"),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["draft", "signal", "draft"]);
    expect(rows[0]).toMatchObject({ kind: "draft", count: 1 });
    expect(rows[2]).toMatchObject({ kind: "draft", count: 1 });
  });

  it("passes signals and classifications through untouched, preserving order", () => {
    const c = classified("2026-07-28T08:00:00Z", "Product");
    const rows = groupActivity([signal("2026-07-28T09:00:00Z"), c]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toBe(c);
  });
});
