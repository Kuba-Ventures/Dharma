// Activity-feed types and the pure grouping helper for the dashboard's Recent
// activity feed. Deliberately free of any prisma/DB import so it stays a pure,
// unit-testable module — the data fetching lives in recentActivity.ts, which
// imports these types from here.

export type ActivityEvent =
  | {
      kind: "draft";
      at: Date;
      title: string;
    }
  | {
      kind: "signal";
      at: Date;
      title: string;
      signalKind: string;
      threadId: string | null;
    }
  | {
      kind: "classified";
      at: Date;
      title: string;
      labelName: string | null;
      labelColor: string | null;
    };

// Display row for the feed. Consecutive draft events collapse into a single
// row carrying a count ("Drafted 6 replies"); signals and classifications stay
// as individual rows since each carries distinct information.
export type ActivityRow =
  | { kind: "draft"; at: Date; count: number }
  | Extract<ActivityEvent, { kind: "signal" }>
  | Extract<ActivityEvent, { kind: "classified" }>;

// Collapse runs of adjacent draft events into one counted row. Events arrive
// newest-first, so the first draft in a run carries the most recent timestamp,
// which the group keeps. Pure + order-preserving — safe to unit test.
export function groupActivity(events: ActivityEvent[]): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const e of events) {
    if (e.kind === "draft") {
      const last = rows[rows.length - 1];
      if (last && last.kind === "draft") {
        last.count += 1;
        continue;
      }
      rows.push({ kind: "draft", at: e.at, count: 1 });
    } else {
      rows.push(e);
    }
  }
  return rows;
}
