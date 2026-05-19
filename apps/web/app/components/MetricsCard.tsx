"use client";

import { useEffect, useState } from "react";

interface Metrics {
  draftsThisWeek: number;
  avgCostPerDraft: number;
  emailsTagged: number;
  totalSpend30d: number;
}

export default function MetricsCard() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Metrics | null) => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Cell
          label="Drafts this week"
          value={loading ? "…" : String(data?.draftsThisWeek ?? 0)}
        />
        <Cell
          label="Avg cost per draft"
          value={loading ? "…" : formatUsd(data?.avgCostPerDraft ?? 0)}
        />
        <Cell
          label="Emails tagged"
          value={loading ? "…" : String(data?.emailsTagged ?? 0)}
        />
        <Cell
          label="Total spend (30d)"
          value={loading ? "…" : formatUsd(data?.totalSpend30d ?? 0)}
        />
        <Cell label="Time saved" value="Coming soon" muted />
        <Cell label="Reply rate" value="Coming soon" muted />
      </div>
    </div>
  );
}

function Cell({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{label}</p>
      {muted ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/30">{value}</span>
          <span className="text-[9px] uppercase tracking-widest text-white/25 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded-full">
            soon
          </span>
        </div>
      ) : (
        <p className="text-base font-medium text-white">{value}</p>
      )}
    </div>
  );
}

function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
