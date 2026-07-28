// Pure geometry for the Scheduling card's "typical weekday" availability bar.
// No calendar calls: it derives a representative weekday window from the user's
// meeting hours, then places the blocks that recur on a weekday as bands within
// that window. One-off and weekend-only blocks are left off the typical-day bar
// (they still appear in the blocks list below it).

export type DayHour = { dayOfWeek: number; hourStart: number; hourEnd: number };
export type DayBlock = {
  start: string; // "HH:MM" 24h
  end: string;
  label?: string;
  recurrence?: { freq?: string; days?: number[] };
};

export type AvailabilityBand = { startPct: number; widthPct: number; label: string };
export type DayAvailability = {
  startHour: number;
  endHour: number;
  bands: AvailabilityBand[];
};

const WEEKDAYS = [1, 2, 3, 4, 5];

function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

// A block belongs on the typical weekday bar if it recurs on at least one
// weekday: daily, or weekly with a weekday in its `days`.
export function recursOnWeekday(block: DayBlock): boolean {
  const freq = block.recurrence?.freq;
  if (freq === "daily") return true;
  if (freq === "weekly") {
    const days = block.recurrence?.days ?? [];
    return days.some((d) => WEEKDAYS.includes(d));
  }
  return false;
}

export function typicalDayAvailability(
  hours: DayHour[],
  blocks: DayBlock[],
): DayAvailability | null {
  const weekday = hours.filter((h) => WEEKDAYS.includes(h.dayOfWeek));
  const active = weekday.length ? weekday : hours;
  if (active.length === 0) return null;

  const startHour = Math.min(...active.map((h) => h.hourStart));
  const endHour = Math.max(...active.map((h) => h.hourEnd));
  if (!(endHour > startHour)) return null;

  const winStart = startHour * 60;
  const span = (endHour - startHour) * 60;

  const bands: AvailabilityBand[] = [];
  for (const b of blocks) {
    if (!recursOnWeekday(b)) continue;
    const bs = parseHHMM(b.start);
    const be = parseHHMM(b.end);
    if (bs == null || be == null || be <= bs) continue;
    const clampStart = Math.max(bs, winStart);
    const clampEnd = Math.min(be, winStart + span);
    if (clampEnd <= clampStart) continue; // block outside the window
    bands.push({
      startPct: ((clampStart - winStart) / span) * 100,
      widthPct: ((clampEnd - clampStart) / span) * 100,
      label: b.label?.trim() || "Blocked",
    });
  }

  return { startHour, endHour, bands };
}

// "8a" / "1p" / "12p" / "9p" — compact tick labels for the bar's time axis.
export function shortHour(hour24: number): string {
  const h = ((hour24 % 24) + 24) % 24;
  const suffix = h < 12 ? "a" : "p";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${suffix}`;
}
