"use client";

import { useEffect, useRef, useState } from "react";

export type MeetingHour = {
  dayOfWeek: number;
  hourStart: number;
  hourEnd: number;
};

// dayOfWeek: 0 = Sunday, 6 = Saturday (matches JS Date.getDay()).
// We render Mon-first because that's the spec, but store sun-first.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  0: "S",
  1: "M",
  2: "T",
  3: "W",
  4: "T",
  5: "F",
  6: "S",
};

type Props = {
  initialHours: MeetingHour[];
  onChange?: (hours: MeetingHour[]) => void;
};

type DayState = {
  active: boolean;
  hourStart: number;
  hourEnd: number;
};

function seedDays(initial: MeetingHour[]): DayState[] {
  const days: DayState[] = Array.from({ length: 7 }, () => ({
    active: false,
    hourStart: 9,
    hourEnd: 17,
  }));
  for (const h of initial) {
    if (h.dayOfWeek < 0 || h.dayOfWeek > 6) continue;
    days[h.dayOfWeek] = {
      active: true,
      hourStart: h.hourStart,
      hourEnd: h.hourEnd,
    };
  }
  // Default for first-time users: Mon-Fri 9-17.
  if (initial.length === 0) {
    for (let d = 1; d <= 5; d++) days[d].active = true;
  }
  return days;
}

export default function MeetingHoursGrid({ initialHours, onChange }: Props) {
  const [days, setDays] = useState<DayState[]>(() => seedDays(initialHours));
  const firstActive = days.find((d) => d.active);
  const [bulkStart, setBulkStart] = useState(firstActive?.hourStart ?? 9);
  const [bulkEnd, setBulkEnd] = useState(firstActive?.hourEnd ?? 17);

  // Push changes upward whenever active blocks change. Skip the very first
  // render so we don't fire a save before the user has touched anything.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const hours: MeetingHour[] = days
      .map((d, i) => ({
        dayOfWeek: i,
        hourStart: d.hourStart,
        hourEnd: d.hourEnd,
        active: d.active,
      }))
      .filter((d) => d.active)
      .map(({ dayOfWeek, hourStart, hourEnd }) => ({
        dayOfWeek,
        hourStart,
        hourEnd,
      }));
    onChange?.(hours);
  }, [days, onChange]);

  function toggleDay(dayIdx: number) {
    setDays((prev) =>
      prev.map((d, i) => (i === dayIdx ? { ...d, active: !d.active } : d)),
    );
  }

  function applyBulk() {
    setDays((prev) =>
      prev.map((d) =>
        d.active ? { ...d, hourStart: bulkStart, hourEnd: bulkEnd } : d,
      ),
    );
  }

  const totalHoursPerWeek = days.reduce(
    (sum, d) => (d.active ? sum + (d.hourEnd - d.hourStart) : sum),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1.5">
        {DISPLAY_ORDER.map((dayIdx) => {
          const d = days[dayIdx];
          return (
            <button
              key={dayIdx}
              type="button"
              onClick={() => toggleDay(dayIdx)}
              aria-pressed={d.active}
              aria-label={`Toggle ${DAY_LABELS[dayIdx]}`}
              className={`flex flex-col items-center rounded-card border px-2 py-3 transition-colors ${
                d.active
                  ? "border-[color:var(--border-brand)] bg-brand-400/12"
                  : "border-[color:var(--border-subtle)] bg-white/[0.02] opacity-50"
              }`}
            >
              <span className="mb-2 text-[10px] uppercase tracking-wide text-white/50">
                {DAY_LABELS[dayIdx]}
              </span>
              <div className="relative h-16 w-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                {d.active && (
                  <div
                    className="absolute inset-x-0 bg-brand-400"
                    style={{
                      top: `${(d.hourStart / 24) * 100}%`,
                      height: `${((d.hourEnd - d.hourStart) / 24) * 100}%`,
                    }}
                  />
                )}
              </div>
              <span className="mt-2 text-[10px] text-white/40">
                {d.active ? `${d.hourStart}–${d.hourEnd}` : "off"}
              </span>
              {d.active && (
                <span className="text-[10px] text-white/30">
                  {d.hourEnd - d.hourStart}h
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HourSelect label="Start" value={bulkStart} onChange={setBulkStart} max={23} />
        <HourSelect label="End" value={bulkEnd} onChange={setBulkEnd} max={24} min={1} />
        <button
          type="button"
          onClick={applyBulk}
          className="rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.09]"
        >
          Apply to active days
        </button>
        <div className="ml-auto text-xs text-white/40">
          {totalHoursPerWeek} hrs/week available
        </div>
      </div>
    </div>
  );
}

function HourSelect({
  label,
  value,
  onChange,
  min = 0,
  max = 24,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const options: number[] = [];
  for (let h = min; h <= max; h++) options.push(h);
  return (
    <label className="flex items-center gap-2 text-xs text-white/60">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-1 text-xs text-white"
      >
        {options.map((h) => (
          <option key={h} value={h}>
            {`${h.toString().padStart(2, "0")}:00`}
          </option>
        ))}
      </select>
    </label>
  );
}
