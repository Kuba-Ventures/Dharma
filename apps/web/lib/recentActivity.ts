// Aggregates events for the dashboard's Recent activity feed and the
// /api/activity/recent route. Mixed stream: drafts created, signals fired,
// milestones unlocked, recent classifications (with label chips).
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
      kind: "milestone";
      at: Date;
      title: string;
      milestoneId: string;
    }
  | {
      kind: "classified";
      at: Date;
      title: string;
      labelName: string | null;
      labelColor: string | null;
    };

export async function getRecentActivity(
  userId: string,
  limit = 20,
): Promise<ActivityEvent[]> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30d

  const [drafts, signals, milestones, classified, labelMappings] = await Promise.all([
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
    prisma.userMilestone.findMany({
      where: { userId, achievedAt: { gte: cutoff } },
      orderBy: { achievedAt: "desc" },
      take: limit,
      select: {
        id: true,
        achievedAt: true,
        milestoneId: true,
        milestone: { select: { title: true } },
      },
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
  for (const m of milestones) {
    events.push({
      kind: "milestone",
      at: m.achievedAt,
      title: `Unlocked: ${m.milestone.title}`,
      milestoneId: m.milestoneId,
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
