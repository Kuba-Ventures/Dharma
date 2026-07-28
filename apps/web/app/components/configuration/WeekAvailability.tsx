import {
  weekAvailability,
  shortHour,
  type DayHour,
  type DayBlock,
} from "@/lib/dayAvailability";

// View-only week grid for the Scheduling card: five weekday columns on a shared
// time axis, the bookable window shaded, and each day's blocks drawn as colored
// bands (color comes from the block's own event color). Editing happens in the
// controls + blocks list, not here. Renders nothing until weekday hours exist.
export default function WeekAvailability({
  hours,
  blocks,
}: {
  hours: DayHour[];
  blocks: DayBlock[];
}) {
  const wk = weekAvailability(hours, blocks);
  if (!wk) return null;
  const mid = Math.round((wk.scaleStart + wk.scaleEnd) / 2);

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[9px] uppercase tracking-[0.14em] text-white/35">
          Your bookable week
        </span>
        <span className="text-[10px] text-white/35">shaded = open · colored = a block</span>
      </div>

      {/* Day labels sit in their own row above the grid, aligned to each column
          (the w-6 spacer mirrors the time-axis column), instead of overlapping
          the blocks inside each column. */}
      <div className="mb-1 flex gap-1.5">
        <div className="w-6 shrink-0" />
        {wk.days.map((day) => (
          <span
            key={day.dayOfWeek}
            className="flex-1 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-white/55"
          >
            {day.label}
          </span>
        ))}
      </div>

      <div className="flex gap-1.5">
        <div className="flex w-6 shrink-0 flex-col justify-between py-4 text-right text-[8px] text-white/35">
          <span>{shortHour(wk.scaleStart)}</span>
          <span>{shortHour(mid)}</span>
          <span>{shortHour(wk.scaleEnd)}</span>
        </div>

        {wk.days.map((day) => (
          <div
            key={day.dayOfWeek}
            className="relative h-44 flex-1 overflow-hidden rounded-btn border border-[color:var(--border-subtle)]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent 0 calc(100% / 3), rgba(255,255,255,0.05) calc(100% / 3), rgba(255,255,255,0.05) calc(100% / 3 + 1px))",
            }}
          >
            {/* bookable window */}
            <div
              className="absolute inset-x-0"
              style={{
                top: `${day.openTopPct}%`,
                height: `${day.openHeightPct}%`,
                background: "rgba(29,158,117,0.16)",
              }}
            />
            {day.bands.map((b, i) => (
              <div
                key={i}
                title={b.label}
                className="absolute inset-x-[3px] z-10 overflow-hidden rounded-[3px] px-1 text-[7.5px] leading-[1.35] text-white"
                style={{
                  top: `${b.topPct}%`,
                  height: `${b.heightPct}%`,
                  backgroundImage: `repeating-linear-gradient(45deg, ${b.hex}55 0 4px, ${b.hex}22 4px 8px)`,
                  border: `1px solid ${b.hex}aa`,
                }}
              >
                {b.label}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="mt-2 text-[10px] text-white/35">
        Shaded = bookable, colored = your blocks. Edit blocks in the list below.
      </p>
    </div>
  );
}
