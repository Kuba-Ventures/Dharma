"use client";

import { useEffect, useState } from "react";
import DismissibleCard from "../ui/DismissibleCard";
import Skeleton from "../ui/Skeleton";

type Metrics = { replyRate7d: number | null; draftsThisWeek: number };

export default function ReplyRateHero() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Metrics | null) => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-44" />;

  // No baseline yet — until we track manually-written replies, the hero
  // surfaces the absolute Dharma reply rate and explains the comparison is
  // coming. Better than a fake "+X%" number.
  const rate = data?.replyRate7d == null ? null : Math.round(data.replyRate7d * 100);

  return (
    <DismissibleCard dismissId="metrics-replyrate-hero">
      <div
        className="rounded-hero border border-[color:var(--border-brand)] px-6 py-7"
        style={{
          background:
            "linear-gradient(135deg, rgba(127,119,221,0.18), rgba(29,158,117,0.10))",
        }}
      >
        <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Reply rate (7d)
        </p>
        <p className="mt-2 font-display text-5xl text-white">
          {rate == null ? "—" : `${rate}%`}
        </p>
        <p className="mt-3 max-w-xl text-sm text-white/70">
          {rate == null
            ? "Send a few drafts and your reply rate will populate here."
            : `Recipients have replied to ${rate}% of the ${data?.draftsThisWeek ?? 0} drafts Dharma generated for you this week.`}
        </p>
        <p className="mt-3 text-[11px] text-white/40">
          Reply-rate lift vs. your manual baseline is coming in v2.
        </p>
      </div>
    </DismissibleCard>
  );
}
