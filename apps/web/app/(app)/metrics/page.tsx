import { Suspense } from "react";
import ReplyRateHero from "../../components/metrics/ReplyRateHero";
import TimeSavedChart from "../../components/metrics/TimeSavedChart";
import ReplyRateByLabel from "../../components/metrics/ReplyRateByLabel";
import MetricsCard from "../../components/MetricsCard";
import GuidedTour, { type TourStep } from "../../components/GuidedTour";

const METRICS_TOUR: TourStep[] = [
  {
    selector: '[data-tour="metrics-reply-rate"]',
    title: "Reply rate",
    description:
      "How consistently you're replying, and how mail breaks down by label — your at-a-glance health check.",
  },
  {
    selector: '[data-tour="metrics-time-saved"]',
    title: "Time saved",
    description:
      "The hours Dharma has saved you drafting and sorting. This is what drives your tier as it climbs.",
  },
];

export default function MetricsPage() {
  return (
    <div className="max-w-4xl space-y-5">
      <GuidedTour id="metrics" steps={METRICS_TOUR} />
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

      <div data-tour="metrics-reply-rate">
        <Suspense>
          <ReplyRateHero />
        </Suspense>
      </div>

      <div data-tour="metrics-time-saved">
        <Suspense>
          <TimeSavedChart days={30} />
        </Suspense>
      </div>

      <Suspense>
        <ReplyRateByLabel />
      </Suspense>

      <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
        <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Secondary metrics
        </p>
        <MetricsCard />
      </div>
    </div>
  );
}
