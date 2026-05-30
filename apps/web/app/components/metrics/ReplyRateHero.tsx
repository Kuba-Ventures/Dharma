"use client";

import { useEffect, useState } from "react";
import DismissibleCard from "../ui/DismissibleCard";
import Skeleton from "../ui/Skeleton";

type Metrics = {
  replyRate7d: number | null;
  replyRateAllTime: number | null;
  draftsThisWeek: number;
};

type Window = "7d" | "all";

export default function ReplyRateHero() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowKey, setWindowKey] = useState<Window>("7d");

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Metrics | null) => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-44" />;

  const rateRaw = windowKey === "7d" ? data?.replyRate7d : data?.replyRateAllTime;
  const rate = rateRaw == null ? null : Math.round(rateRaw * 100);
  const eyebrow = windowKey === "7d" ? "Reply rate (7d)" : "Reply rate (all-time)";
  const subline =
    rate == null
      ? "Send a few drafts and your reply rate will populate here."
      : windowKey === "7d"
        ? `Recipients have replied to ${rate}% of the ${data?.draftsThisWeek ?? 0} drafts Dharma generated for you this week.`
        : `Across all drafts Dharma has generated for you, ${rate}% have received a reply.`;

  return (
    <DismissibleCard dismissId="metrics-replyrate-hero">
      <div
        className="rounded-hero border border-[color:var(--border-brand)] px-6 py-7"
        style={{
          background:
            "linear-gradient(135deg, rgba(127,119,221,0.18), rgba(29,158,117,0.10))",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
            {eyebrow}
          </p>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-0.5">
            {(["7d", "all"] as Window[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindowKey(w)}
                className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                  windowKey === w
                    ? "bg-brand-400 text-white"
                    : "text-white/55 hover:text-white"
                }`}
              >
                {w === "7d" ? "7d" : "All-time"}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 font-display text-5xl text-white">
          {rate == null ? "—" : `${rate}%`}
        </p>
        <p className="mt-3 max-w-xl text-sm text-white/70">{subline}</p>
        <p className="mt-3 text-[11px] text-white/40">
          Reply-rate lift vs. your manual baseline is coming in v2.
        </p>
      </div>
    </DismissibleCard>
  );
}
