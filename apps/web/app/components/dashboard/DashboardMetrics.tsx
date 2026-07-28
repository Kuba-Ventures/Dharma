"use client";

import { useEffect, useState } from "react";
import MetricTile from "./MetricTile";
import Skeleton from "../ui/Skeleton";
import BadgeProgressRing from "../profile/BadgeProgressRing";
import { JEWEL_FILL } from "../../../lib/badgeIcons";
import type { GroupProgress } from "../../../lib/badges";

type Metrics = {
  draftsThisWeek: number;
  avgCostPerDraft: number;
  emailsTagged: number;
  totalSpend30d: number;
  timeSavedSecondsThisWeek: number;
  replyRate7d: number | null;
};

type BadgeApi = { earned: string[]; groups: GroupProgress[] };

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// Small "progress to next badge" line for a metric tile's sub slot.
function NextBadgeSub({ group }: { group?: GroupProgress }) {
  if (!group || !group.next) return null;
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative inline-flex h-4 w-4 shrink-0">
        <BadgeProgressRing pct={group.pct} color={JEWEL_FILL[group.next.color]} size={16} />
      </span>
      <span className="truncate">
        Next: {group.next.title} · {Math.round(group.pct * 100)}%
      </span>
    </span>
  );
}

export default function DashboardMetrics() {
  const [data, setData] = useState<Metrics | null>(null);
  const [badges, setBadges] = useState<BadgeApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/metrics")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/badges/me")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([m, b]: [Metrics | null, BadgeApi | null]) => {
        setData(m);
        setBadges(b);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  const draftsGroup = badges?.groups.find((g) => g.group === "drafts");
  const timeGroup = badges?.groups.find((g) => g.group === "time_saved");

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <MetricTile
        dismissId="metric-drafts-week"
        label="Drafts this week"
        value={String(data?.draftsThisWeek ?? 0)}
        sub={draftsGroup?.next ? <NextBadgeSub group={draftsGroup} /> : undefined}
      />
      {data?.replyRate7d == null ? (
        <MetricTile
          dismissId="metric-reply-rate"
          label="Reply rate (7d)"
          value="Not enough replies yet"
          sub="Resumes once your replies land"
          muted
        />
      ) : (
        <MetricTile
          dismissId="metric-reply-rate"
          label="Reply rate (7d)"
          value={`${Math.round(data.replyRate7d * 100)}%`}
        />
      )}
      <MetricTile
        dismissId="metric-time-saved"
        label="Time saved (week)"
        value={formatDuration(data?.timeSavedSecondsThisWeek ?? 0)}
        sub={timeGroup?.next ? <NextBadgeSub group={timeGroup} /> : undefined}
      />
    </div>
  );
}
