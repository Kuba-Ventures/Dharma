// Aggregates events for the dashboard's Recent activity feed and the
// /api/activity/recent route. Mixed stream: drafts created, signals fired,
// recent classifications (with label chips).
//
// Server-side helper — read-only. Used both as a direct import from server
// components and as the data source for the public API route.

import { prisma } from "./prisma";

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

export async function getRecentActivity(
  userId: string,
  limit = 20,
): Promise<ActivityEvent[]> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30d

  const [drafts, signals, classified, labelMappings] = await Promise.all([
    prisma.usageEvent.findMany({
      where: { userId, eventType: "draft", createdAt: { gte: cutoff } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, createdAt: true },
    }),
    prisma.signal.findMany({
      where: { userId, createdAt: { gte: cutoff } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, createdAt: true, kind: true, threadId: true, payload: true },
    }),
    prisma.classifiedThread.findMany({
      where: { userId, classifiedAt: { gte: cutoff }, labelName: { not: null } },
      orderBy: { classifiedAt: "desc" },
      take: limit,
      select: { id: true, classifiedAt: true, labelName: true },
    }),
    prisma.label.findMany({
      where: { userId },
      select: { name: true, color: true },
    }),
  ]);

  const colorByName = new Map(labelMappings.map((l) => [l.name, l.color]));

  const events: ActivityEvent[] = [];

  for (const d of drafts) {
    events.push({
      kind: "draft",
      at: d.createdAt,
      title: "Drafted a reply",
    });
  }
  for (const s of signals) {
    const payload = (s.payload ?? {}) as { subject?: string; from?: string };
    const title = payload.subject
      ? `${payload.subject}`
      : payload.from
        ? `Signal from ${payload.from}`
        : "Signal detected";
    events.push({
      kind: "signal",
      at: s.createdAt,
      title,
      signalKind: s.kind,
      threadId: s.threadId,
    });
  }
  for (const c of classified) {
    events.push({
      kind: "classified",
      at: c.classifiedAt,
      title: "Classified a thread",
      labelName: c.labelName,
      labelColor: c.labelName ? (colorByName.get(c.labelName) ?? null) : null,
    });
  }

  events.sort((a, b) => b.at.getTime() - a.at.getTime());
  return events.slice(0, limit);
}
