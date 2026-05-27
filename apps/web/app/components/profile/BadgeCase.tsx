import { BADGES, type Badge } from "../../../lib/badges";

type Props = {
  earnedIds: string[];
};

const ICON_PATHS: Record<Badge["icon"], string> = {
  crown: "M2 11l1-5 3 3 2-5 2 5 3-3 1 5z",
  shield: "M7 1L2 3v4c0 3 2 5 5 6 3-1 5-3 5-6V3L7 1z",
  flask: "M5 2v3L3 11a1.5 1.5 0 0 0 1.5 2h5A1.5 1.5 0 0 0 11 11L9 5V2",
  briefcase: "M2 5h10v7H2zM5 5V3h4v2",
  users: "M4 5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8zm6 0a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8zM1.5 11c0-1.7 1.1-2.7 2.5-2.7s2.5 1 2.5 2.7M7.5 11c0-1.7 1.1-2.7 2.5-2.7s2.5 1 2.5 2.7",
  target: "M7 1a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z",
  handshake: "M2 7l2-2 2 1 1-1 2 1 2-1 1 2-2 2-2 1-1-1-2 1-2-1-1-2z",
  sparkles: "M7 2v3M7 9v3M2 7h3M9 7h3M3.5 3.5l2 2M8.5 8.5l2 2",
  waveform: "M2 5v4M5 6v3M8 3v8M11 5v4",
  tags: "M2 3h5L11 6 7 10H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
  bolt: "M8 1L3 8h3v5l5-7H8z",
  mountain: "M2 12L6 4l3 5 2-3 3 6z",
  running: "M5 5l2-2 2 3 2 1-2 4-2-3-3 1",
  radar: "M7 7m-4 0a4 4 0 1 0 8 0 4 4 0 1 0-8 0M7 7L4 3",
};

const COLOR_BG: Record<Badge["color"], string> = {
  amber: "bg-[color:var(--label-4)]/12 border-[color:var(--label-4)]/30 text-[color:var(--label-4)]",
  violet: "bg-[color:var(--label-7)]/12 border-[color:var(--label-7)]/30 text-[color:var(--label-7)]",
  blue: "bg-[color:var(--label-1)]/12 border-[color:var(--label-1)]/30 text-[color:var(--label-1)]",
  teal: "bg-[color:var(--label-2)]/12 border-[color:var(--label-2)]/30 text-[color:var(--label-2)]",
  brand: "bg-brand-400/12 border-brand-400/30 text-brand-200",
};

export default function BadgeCase({ earnedIds }: Props) {
  const earnedSet = new Set(earnedIds);
  const earned = BADGES.filter((b) => earnedSet.has(b.id));
  const locked = BADGES.filter((b) => !earnedSet.has(b.id));

  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Badges
        </p>
        <p className="text-[11px] text-white/40">
          {earned.length} earned · {locked.length} locked
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
        {earned.map((b) => (
          <BadgeChip key={b.id} badge={b} earned />
        ))}
        {locked.map((b) => (
          <BadgeChip key={b.id} badge={b} earned={false} />
        ))}
      </div>
    </div>
  );
}

function BadgeChip({ badge, earned }: { badge: Badge; earned: boolean }) {
  return (
    <div
      className={`flex flex-col items-center rounded-card border p-3 transition-opacity ${
        earned
          ? COLOR_BG[badge.color]
          : "border-dashed border-[color:var(--border-subtle)] bg-white/[0.02] text-white/30 opacity-60"
      }`}
      title={`${badge.title}: ${badge.description}`}
    >
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
        <path
          d={ICON_PATHS[badge.icon]}
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={earned ? "currentColor" : "none"}
          fillOpacity={earned ? "0.2" : "0"}
        />
      </svg>
      <p
        className={`mt-2 text-center text-[11px] ${
          earned ? "" : "text-white/40"
        }`}
      >
        {badge.title}
      </p>
    </div>
  );
}
