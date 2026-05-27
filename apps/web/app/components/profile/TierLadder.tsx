import { TIERS, type Tier, progressToNext } from "../../../lib/tiers";

type Props = {
  secondsSaved: number;
};

function formatSeconds(s: number): string {
  if (s < 3600) return `${Math.round(s / 60)}m`;
  const hours = Math.floor(s / 3600);
  const mins = Math.round((s % 3600) / 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

export default function TierLadder({ secondsSaved }: Props) {
  const { current, next, progress } = progressToNext(secondsSaved);

  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
            Current tier
          </p>
          <p className="font-display text-2xl text-white">{current}</p>
        </div>
        {next && (
          <p className="text-[12px] text-white/50">
            {formatSeconds(secondsSaved)} saved · {formatSeconds(next.threshold - secondsSaved)} to {next.id}
          </p>
        )}
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {TIERS.map((t) => {
          const idx = TIERS.findIndex((x) => x.id === current);
          const tIdx = TIERS.findIndex((x) => x.id === t.id);
          const reached = tIdx <= idx;
          const isCurrent = t.id === current;
          return (
            <div key={t.id} className="flex flex-col items-center">
              <div
                className={`mb-2 h-1 w-full rounded-full ${
                  reached ? "bg-brand-400" : "bg-white/[0.08]"
                }`}
              />
              <p
                className={`text-[11px] ${
                  isCurrent
                    ? "text-brand-200"
                    : reached
                      ? "text-white/70"
                      : "text-white/30"
                }`}
              >
                {t.id}
              </p>
              <p className="text-[9px] text-white/30">{formatSeconds(t.threshold)}</p>
            </div>
          );
        })}
      </div>

      {next && progress < 1 && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px] text-white/40">
            <span>Progress to {next.id}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-brand-400"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export { type Tier };
