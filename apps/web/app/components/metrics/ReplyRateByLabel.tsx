"use client";

import { useEffect, useState } from "react";
import DismissibleCard from "../ui/DismissibleCard";
import Skeleton from "../ui/Skeleton";

type Row = {
  labelName: string;
  color: string;
  tagged: number;
  share: number;
};
type Payload = { rows: Row[]; totalTagged: number; days: number };

export default function ReplyRateByLabel() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/metrics/by-label")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Payload | null) => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-48" />;
  const rows = data?.rows ?? [];
  const max = Math.max(1, ...rows.map((r) => r.tagged));

  return (
    <DismissibleCard dismissId="metrics-by-label">
      <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
            Volume by label · last {data?.days ?? 30} days
          </p>
          <p className="text-[11px] text-white/40">{data?.totalTagged ?? 0} tagged</p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-white/40">
            No labels configured yet. Set up a preset in Configuration to start
            tracking volume by category.
          </p>
        ) : (
          <div className="space-y-2.5">
            {rows.map((r) => (
              <div key={r.labelName} className="flex items-center gap-3">
                <div className="flex w-32 shrink-0 items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                  <span className="truncate text-[12px] text-white/70">
                    {r.labelName}
                  </span>
                </div>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(r.tagged / max) * 100}%`,
                      backgroundColor: r.color,
                    }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right text-[11px] text-white/50">
                  {r.tagged}
                  {r.tagged > 0 && (
                    <span className="ml-1 text-white/30">
                      · {Math.round(r.share * 100)}%
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DismissibleCard>
  );
}
