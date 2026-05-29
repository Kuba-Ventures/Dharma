import {
  MILESTONES,
  applyTemplate,
  unlockedMilestoneIds,
} from "../../../lib/milestones";
import ShareCardButton from "./ShareCardButton";

type Props = {
  secondsSaved: number;
  homeCity: string | null;
  firstName: string | null;
  tier: string;
};

function formatSeconds(s: number): string {
  if (s < 3600) return `${Math.round(s / 60)}m`;
  const hours = Math.floor(s / 3600);
  const mins = Math.round((s % 3600) / 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

export default function MilestoneLibrary({
  secondsSaved,
  homeCity,
  firstName,
  tier,
}: Props) {
  const unlockedSet = new Set(unlockedMilestoneIds(secondsSaved, homeCity));

  // Show city-relevant + universal milestones; hide other cities' entries.
  const relevant = MILESTONES.filter(
    (m) => !m.requiredCity || m.requiredCity === homeCity,
  );

  const unlocked = relevant.filter((m) => unlockedSet.has(m.id));
  const locked = relevant.filter((m) => !unlockedSet.has(m.id));

  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Milestones
        </p>
        <p className="text-[11px] text-white/40">
          {unlocked.length} unlocked · {locked.length} to go
        </p>
      </div>

      {!homeCity && (
        <p className="mb-4 rounded-btn border border-[color:var(--border-brand)] bg-brand-400/8 px-3 py-2 text-[12px] text-white/70">
          Set your home city above to unlock local landmarks.
        </p>
      )}

      <div className="space-y-2">
        {unlocked.map((m) => (
          <div
            key={m.id}
            className="rounded-card border border-[color:var(--border-subtle)] p-3"
            style={{ background: m.gradient }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-white">
                {applyTemplate(m.title, { firstName, city: homeCity })}
              </p>
              <ShareCardButton
                milestoneId={m.id}
                firstName={firstName}
                city={homeCity}
                tier={tier}
                secondsSaved={secondsSaved}
              />
            </div>
            <p className="mt-1 text-[12px] text-white/70">
              {applyTemplate(m.description, { firstName, city: homeCity })}
            </p>
          </div>
        ))}

        {locked.map((m) => {
          const remaining = m.threshold - secondsSaved;
          return (
            <div
              key={m.id}
              className="rounded-card border border-dashed border-[color:var(--border-subtle)] bg-white/[0.02] p-3"
            >
              <p className="text-sm text-white/50">
                {applyTemplate(m.title, { firstName, city: homeCity })}
              </p>
              <p className="mt-1 text-[12px] text-white/40">
                {formatSeconds(Math.max(remaining, 0))} to go
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
