import { Suspense } from "react";
import ReplyRateHero from "../../components/metrics/ReplyRateHero";
import TimeSavedChart from "../../components/metrics/TimeSavedChart";
import ReplyRateByLabel from "../../components/metrics/ReplyRateByLabel";
import MilestoneTimelineStrip from "../../components/metrics/MilestoneTimelineStrip";
import MetricsCard from "../../components/MetricsCard";

export default function MetricsPage() {
  return (
    <div className="max-w-4xl space-y-5">
      <header className="mb-4">
        <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Metrics
        </p>
        <h1 className="font-display text-3xl text-white">How Dharma is doing</h1>
        <p className="mt-2 text-sm text-white/60">
          Time saved, reply rate, and volume by label. Time-range selector and
          export are coming.
        </p>
      </header>

      <Suspense>
        <ReplyRateHero />
      </Suspense>

      <Suspense>
        <TimeSavedChart days={30} />
      </Suspense>

      <Suspense>
        <ReplyRateByLabel />
      </Suspense>

      <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
        <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Secondary metrics
        </p>
        <MetricsCard />
      </div>

      <Suspense>
        <MilestoneTimelineStrip />
      </Suspense>
    </div>
  );
}
