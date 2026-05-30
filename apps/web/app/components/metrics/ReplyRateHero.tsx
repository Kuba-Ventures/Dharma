"use client";

import { useEffect, useState } from "react";
import DismissibleCard from "../ui/DismissibleCard";
import Skeleton from "../ui/Skeleton";

type Metrics = {
  replyRate7d: number | null;
  replyRateAllTime: number | null;
  draftsThisWeek: number;
};

function formatPct(rate: number | null): string {
  return rate == null ? "—" : `${Math.round(rate * 100)}%`;
}

function ReplyRateTile({
  eyebrow,
  rate,
  subline,
}: {
  eyebrow: string;
  rate: number | null;
  subline: string;
}) {
  return (
    <div
      className="flex h-full flex-col rounded-hero border border-[color:var(--border-brand)] px-5 py-6"
      style={{
        background:
          "linear-gradient(135deg, rgba(127,119,221,0.18), rgba(29,158,117,0.10))",
      }}
    >
      <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
        {eyebrow}
      </p>
      <p className="mt-2 font-display text-4xl text-white">{formatPct(rate)}</p>
      <p className="mt-3 text-sm text-white/70">{subline}</p>
    </div>
  );
}

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

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    );
  }

  const week = data?.replyRate7d ?? null;
  const all = data?.replyRateAllTime ?? null;
  const drafts = data?.draftsThisWeek ?? 0;

  const weekSubline =
    week == null
      ? "Send a few drafts and your week's reply rate will populate here."
      : `Recipients have replied to ${Math.round(week * 100)}% of the ${drafts} drafts Dharma generated for you this week.`;

  const allSubline =
    all == null
      ? "Once you've drafted across more than a week, your lifetime reply rate shows up here."
      : `Across every draft Dharma has ever generated for you, ${Math.round(all * 100)}% have a reply.`;

  return (
    <DismissibleCard dismissId="metrics-replyrate-hero">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ReplyRateTile
          eyebrow="Reply rate · this week"
          rate={week}
          subline={weekSubline}
        />
        <ReplyRateTile
          eyebrow="Reply rate · all-time"
          rate={all}
          subline={allSubline}
        />
      </div>
      <p className="mt-3 text-[11px] text-white/40">
        Reply-rate lift vs. your manual baseline is coming in v2.
      </p>
    </DismissibleCard>
  );
}
