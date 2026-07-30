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

// Quieter cell for the secondary tier — cost/volume context that supports the
// headline numbers without competing with them.
function SecondaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)]/60 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.08em] text-white/40">{label}</p>
      <p className="mt-1 text-base font-medium tabular-nums text-white/75">{value}</p>
    </div>
  );
}

// Two-tier "how it's going" strip that opens the merged dashboard: three
// headline metrics on top, three quieter cost/volume metrics below. Replaces
// the old standalone Metrics page (reply-rate + time-saved + secondary grid all
// fold into here plus the time-saved chart rendered alongside on the page).
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
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  const draftsGroup = badges?.groups.find((g) => g.group === "drafts");
  const timeGroup = badges?.groups.find((g) => g.group === "time_saved");

  return (
    <div className="space-y-3">
      {/* Primary tier — the headline numbers */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
        <MetricTile
          dismissId="metric-drafts-week"
          label="Drafts this week"
          value={String(data?.draftsThisWeek ?? 0)}
          sub={draftsGroup?.next ? <NextBadgeSub group={draftsGroup} /> : undefined}
        />
      </div>

      {/* Secondary tier — volume context */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <SecondaryCell label="Emails tagged" value={String(data?.emailsTagged ?? 0)} />
      </div>
    </div>
  );
}
