// Pure geometry for the Scheduling card's week-availability grid. No calendar
// calls: it derives a shared time scale from the user's meeting hours, then for
// each active weekday places the open window plus the blocks that fall on that
// day as positioned bands. Percentages are relative to the shared scale so the
// day columns line up against one time axis.

export type DayHour = { dayOfWeek: number; hourStart: number; hourEnd: number };
export type DayBlock = {
  start: string; // "HH:MM" 24h
  end: string;
  label?: string;
  hex?: string; // resolved display color (caller maps colorId → hex)
  recurrence?: { freq?: string; days?: number[]; date?: string };
};

export type WeekBand = { topPct: number; heightPct: number; label: string; hex: string };
export type WeekDayColumn = {
  dayOfWeek: number;
  label: string;
  openTopPct: number;
  openHeightPct: number;
  bands: WeekBand[];
};
export type WeekAvailability = {
  scaleStart: number;
  scaleEnd: number;
  days: WeekDayColumn[];
};

const WEEKDAY_ORDER = [1, 2, 3, 4, 5];
const DOW_LABEL = ["S", "M", "T", "W", "T", "F", "S"];
const DEFAULT_HEX = "#7986CB";

function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

// Which weekdays (0=Sun..6=Sat) a block lands on: daily → all, weekly → its
// days, one-off/monthly → the weekday of its anchor date.
export function blockWeekdays(block: DayBlock): Set<number> {
  const freq = block.recurrence?.freq;
  if (freq === "daily") return new Set([0, 1, 2, 3, 4, 5, 6]);
  if (freq === "weekly") return new Set(block.recurrence?.days ?? []);
  const date = block.recurrence?.date;
  const dm = date ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  if (dm) return new Set([new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3])).getDay()]);
  return new Set();
}

export function weekAvailability(hours: DayHour[], blocks: DayBlock[]): WeekAvailability | null {
  const byDay = new Map<number, { start: number; end: number }>();
  for (const h of hours) {
    if (WEEKDAY_ORDER.includes(h.dayOfWeek)) byDay.set(h.dayOfWeek, { start: h.hourStart, end: h.hourEnd });
  }
  const active = WEEKDAY_ORDER.filter((d) => byDay.has(d));
  if (active.length === 0) return null;

  const scaleStart = Math.min(...active.map((d) => byDay.get(d)!.start));
  const scaleEnd = Math.max(...active.map((d) => byDay.get(d)!.end));
  if (!(scaleEnd > scaleStart)) return null;

  const scaleMin = scaleStart * 60;
  const span = (scaleEnd - scaleStart) * 60;

  const days: WeekDayColumn[] = active.map((d) => {
    const w = byDay.get(d)!;
    const winStart = w.start * 60;
    const winEnd = w.end * 60;
    const bands: WeekBand[] = [];
    for (const b of blocks) {
      if (!blockWeekdays(b).has(d)) continue;
      const bs = parseHHMM(b.start);
      const be = parseHHMM(b.end);
      if (bs == null || be == null || be <= bs) continue;
      const cs = Math.max(bs, winStart);
      const ce = Math.min(be, winEnd);
      if (ce <= cs) continue; // block outside this day's window
      bands.push({
        topPct: ((cs - scaleMin) / span) * 100,
        heightPct: ((ce - cs) / span) * 100,
        label: b.label?.trim() || "Block",
        hex: b.hex || DEFAULT_HEX,
      });
    }
    return {
      dayOfWeek: d,
      label: DOW_LABEL[d],
      openTopPct: ((winStart - scaleMin) / span) * 100,
      openHeightPct: ((winEnd - winStart) / span) * 100,
      bands,
    };
  });

  return { scaleStart, scaleEnd, days };
}

// "8a" / "1p" / "12p" / "9p" — compact tick labels for the time axis.
export function shortHour(hour24: number): string {
  const h = ((hour24 % 24) + 24) % 24;
  const suffix = h < 12 ? "a" : "p";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${suffix}`;
}
