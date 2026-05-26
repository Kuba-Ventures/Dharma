"use client";

import { useEffect, useState } from "react";
import MetricTile from "./MetricTile";
import Skeleton from "../ui/Skeleton";

type Metrics = {
  draftsThisWeek: number;
  avgCostPerDraft: number;
  emailsTagged: number;
  totalSpend30d: number;
  timeSavedSecondsThisWeek: number;
  replyRate7d: number | null;
};

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

export default function DashboardMetrics() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Metrics | null) => setData(d))
      .catch(() => null)
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

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <MetricTile
        dismissId="metric-drafts-week"
        label="Drafts this week"
        value={String(data?.draftsThisWeek ?? 0)}
      />
      <MetricTile
        dismissId="metric-reply-rate"
        label="Reply rate (7d)"
        value={
          data?.replyRate7d == null
            ? "—"
            : `${Math.round(data.replyRate7d * 100)}%`
        }
      />
      <MetricTile
        dismissId="metric-time-saved"
        label="Time saved (week)"
        value={formatDuration(data?.timeSavedSecondsThisWeek ?? 0)}
        sub={`Avg ${formatUsd(data?.avgCostPerDraft ?? 0)} per draft`}
      />
    </div>
  );
}
