import {
  typicalDayAvailability,
  shortHour,
  type DayHour,
  type DayBlock,
} from "@/lib/dayAvailability";

// A one-line "typical weekday" availability bar for the Scheduling card: the
// bookable window (from meeting hours) shaded open, with weekday-recurring
// blocks carved out as hatched bands. Purely derived from settings the card
// already has (no calendar fetch). Renders nothing until hours exist.
export default function AvailabilityBar({
  hours,
  blocks,
}: {
  hours: DayHour[];
  blocks: DayBlock[];
}) {
  const day = typicalDayAvailability(hours, blocks);
  if (!day) return null;
  const mid = Math.round((day.startHour + day.endHour) / 2);

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[9px] uppercase tracking-[0.14em] text-white/35">
          A typical weekday
        </span>
        <span className="text-[10px] text-white/35">
          open · <span className="text-white/45">hatched = a block</span>
        </span>
      </div>
      <div
        className="relative h-6 w-full overflow-hidden rounded-btn border border-[color:var(--border-subtle)]"
        style={{ background: "rgba(29,158,117,0.16)" }}
        role="img"
        aria-label={`Typical weekday availability from ${shortHour(day.startHour)} to ${shortHour(day.endHour)} with ${day.bands.length} blocked ${day.bands.length === 1 ? "period" : "periods"}`}
      >
        {day.bands.map((b, i) => (
          <div
            key={i}
            title={b.label}
            className="absolute inset-y-0"
            style={{
              left: `${b.startPct}%`,
              width: `${b.widthPct}%`,
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0, rgba(255,255,255,0.10) 4px, rgba(255,255,255,0.02) 4px, rgba(255,255,255,0.02) 8px)",
              borderLeft: "1px solid rgba(255,255,255,0.14)",
              borderRight: "1px solid rgba(255,255,255,0.14)",
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-white/35">
        <span>{shortHour(day.startHour)}</span>
        <span>{shortHour(mid)}</span>
        <span>{shortHour(day.endHour)}</span>
      </div>
    </div>
  );
}
