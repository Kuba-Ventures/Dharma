// Slim next-milestone row. Renders one line: milestone name + thin progress
// bar + "Xm to go." Server component — no fetch.

type NextMilestone = {
  id: string;
  title: string;
  threshold: number | null;
};

type Props = {
  next: NextMilestone | null;
  cumulativeSecondsSaved: number;
};

function formatShort(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMin = mins % 60;
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`;
}

export default function NextMilestoneStrip({ next, cumulativeSecondsSaved }: Props) {
  if (!next || next.threshold == null) return null;

  const remaining = Math.max(0, next.threshold - cumulativeSecondsSaved);
  const progress =
    next.threshold > 0
      ? Math.min(1, cumulativeSecondsSaved / next.threshold)
      : 1;

  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.12em] text-brand-200">
          Next milestone
        </span>
        <span className="truncate text-sm text-white/85">{next.title}</span>
        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/8">
          <div
            className="absolute inset-y-0 left-0 bg-brand-400"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] text-white/55">
          {formatShort(remaining)} to go
        </span>
      </div>
    </div>
  );
}
