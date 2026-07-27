// Slim one-line tier strip on the dashboard. Renders: tier name + thin
// progress bar + "Xm saved · Ym to {next}".

import { progressToNext } from "../../../lib/tiers";

type Props = {
  cumulativeSecondsSaved: number;
  // Optional admin comp from the Users sheet; shown as the tier name when set
  // higher than the earned tier. Progress below stays seconds-based.
  displayTier?: string;
};

function formatShort(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMin = mins % 60;
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`;
}

export default function TierStrip({ cumulativeSecondsSaved, displayTier }: Props) {
  const { current, next, progress } = progressToNext(cumulativeSecondsSaved);
  const remainingSeconds = next ? Math.max(0, next.threshold - cumulativeSecondsSaved) : 0;

  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.12em] text-brand-200">
          {displayTier ?? current}
        </span>
        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/8">
          <div
            className="absolute inset-y-0 left-0 bg-brand-400"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span className="text-[11px] text-white/55">
          {formatShort(cumulativeSecondsSaved)} saved
          {next && (
            <>
              {" · "}
              <span className="text-white/40">
                {formatShort(remainingSeconds)} to {next.id}
              </span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
