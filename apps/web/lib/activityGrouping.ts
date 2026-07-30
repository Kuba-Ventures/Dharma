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
// row carrying a count ("Drafted 6 replies"), and consecutive classifications
// sharing a label collapse the same way ("Classified 3 threads"). Signals stay
// as individual rows since each carries distinct information. Every row carries
// a `count` (1 when not grouped) so the renderer can size labels uniformly.
export type ActivityRow =
  | { kind: "draft"; at: Date; count: number }
  | Extract<ActivityEvent, { kind: "signal" }>
  | (Extract<ActivityEvent, { kind: "classified" }> & { count: number });

// Collapse runs of adjacent events into counted rows: drafts always merge with
// the preceding draft; classifications merge with the preceding classification
// only when they share a label (so "Product ×3" collapses but a Product row
// followed by a Team-Internal row stays two rows). Signals never merge. Events
// arrive newest-first, so the first event in a run carries the most recent
// timestamp, which the group keeps. Pure + order-preserving — safe to unit test.
export function groupActivity(events: ActivityEvent[]): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const e of events) {
    const last = rows[rows.length - 1];
    if (e.kind === "draft") {
      if (last && last.kind === "draft") {
        last.count += 1;
        continue;
      }
      rows.push({ kind: "draft", at: e.at, count: 1 });
    } else if (e.kind === "classified") {
      if (last && last.kind === "classified" && last.labelName === e.labelName) {
        last.count += 1;
        continue;
      }
      rows.push({ ...e, count: 1 });
    } else {
      rows.push(e);
    }
  }
  return rows;
}
