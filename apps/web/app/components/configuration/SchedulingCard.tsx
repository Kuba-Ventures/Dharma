"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import StatusPill from "../ui/StatusPill";
import IconTile from "../ui/IconTile";
import Toggle from "../ui/Toggle";
import ConfirmModal from "../ui/ConfirmModal";
import MeetingHoursGrid, {
  type MeetingHour,
} from "../MeetingHoursGrid";

const CAL_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect
      x="2"
      y="3.5"
      width="12"
      height="11"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.4"
      fill="none"
    />
    <line x1="2" y1="6.5" x2="14" y2="6.5" stroke="currentColor" strokeWidth="1.4" />
    <line x1="5" y1="2" x2="5" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="11" y1="2" x2="11" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

type BlockedWindow = {
  start: string;
  end: string;
  label?: string;
  mirrorToCalendar?: boolean;
  calendarEventId?: string;
};

type Prefs = {
  defaultDurationMin: number;
  bufferMin: number;
  maxPerDay: number;
  blockedWindows: BlockedWindow[];
};

const DEFAULT_PREFS: Prefs = {
  defaultDurationMin: 30,
  bufferMin: 15,
  maxPerDay: 5,
  blockedWindows: [],
};

function parsePrefs(raw: string | null): Prefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const rawBlocks = Array.isArray(parsed.blockedWindows) ? parsed.blockedWindows : [];
    const blockedWindows: BlockedWindow[] = rawBlocks
      .map((b) => {
        const obj = b as Partial<BlockedWindow>;
        if (typeof obj.start !== "string" || typeof obj.end !== "string") return null;
        return {
          start: obj.start,
          end: obj.end,
          ...(typeof obj.label === "string" && obj.label.trim() ? { label: obj.label.trim() } : {}),
          ...(obj.mirrorToCalendar ? { mirrorToCalendar: true } : {}),
          ...(typeof obj.calendarEventId === "string" ? { calendarEventId: obj.calendarEventId } : {}),
        };
      })
      .filter((b): b is BlockedWindow => b !== null);
    return {
      defaultDurationMin: parsed.defaultDurationMin ?? DEFAULT_PREFS.defaultDurationMin,
      bufferMin: parsed.bufferMin ?? DEFAULT_PREFS.bufferMin,
      maxPerDay: parsed.maxPerDay ?? DEFAULT_PREFS.maxPerDay,
      blockedWindows,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

type Props = {
  initial: {
    enabled: boolean;
    schedulingPreferences: string | null;
    timezone: string | null;
    homeCity: string | null;
    hours: MeetingHour[];
    averageMeetingsPerWeek: number | null;
  };
};

// Hours -> human summary. e.g. "Mon–Sat 7am–10pm; Sun off" or
// "Mon–Fri 9am–5pm" if all weekday rows match.
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function to12h(h: number): string {
  if (h === 0 || h === 24) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}
function summarizeHours(hours: MeetingHour[]): string | null {
  if (hours.length === 0) return null;
  const byDay = new Map<number, { start: number; end: number }>();
  for (const h of hours) byDay.set(h.dayOfWeek, { start: h.hourStart, end: h.hourEnd });

  // Group contiguous active days that share the same hours.
  // Walk Mon..Sun (1..6, 0), build runs.
  const walkOrder = [1, 2, 3, 4, 5, 6, 0];
  const runs: { days: number[]; start: number; end: number }[] = [];
  for (const d of walkOrder) {
    const cur = byDay.get(d);
    if (!cur) continue;
    const last = runs[runs.length - 1];
    if (last && last.start === cur.start && last.end === cur.end) {
      // Only extend if d is the next day in walkOrder after last.days[last.days.length-1]
      const lastDay = last.days[last.days.length - 1];
      const lastIdx = walkOrder.indexOf(lastDay);
      if (walkOrder[lastIdx + 1] === d) {
        last.days.push(d);
        continue;
      }
    }
    runs.push({ days: [d], start: cur.start, end: cur.end });
  }

  return runs
    .map((r) => {
      const dayLabel =
        r.days.length === 1
          ? DAY_NAMES[r.days[0]]
          : `${DAY_NAMES[r.days[0]]}–${DAY_NAMES[r.days[r.days.length - 1]]}`;
      return `${dayLabel} ${to12h(r.start)}–${to12h(r.end)}`;
    })
    .join(", ");
}

export default function SchedulingCard({ initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(parsePrefs(initial.schedulingPreferences));
  const [hours, setHours] = useState<MeetingHour[]>(initial.hours);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Detect timezone if user has no value set yet (best-effort).
  const tz =
    initial.timezone ??
    (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");

  const hoursSummary = summarizeHours(hours);

  async function persistPrefs(next: Prefs) {
    setPrefs(next);
    try {
      const res = await fetch("/api/preferences/scheduling", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schedulingPreferences: JSON.stringify(next) }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { schedulingPreferences?: string | null };
      // Server may have populated calendarEventIds on mirrored blocks.
      // Reflect those back into local state so subsequent edits patch the
      // right event instead of creating duplicates.
      if (typeof data.schedulingPreferences === "string") {
        setPrefs(parsePrefs(data.schedulingPreferences));
      }
    } catch (err) {
      console.error("[scheduling] persistPrefs failed:", err);
    }
  }

  async function persistHours(next: MeetingHour[]) {
    setHours(next);
    await fetch("/api/preferences/meeting-hours", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hours: next }),
    });
  }

  function onToggle(next: boolean) {
    if (!next) {
      setConfirmingOff(true);
      return;
    }
    setEnabled(true);
    fetch("/api/preferences/scheduling", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
  }

  async function syncCalendar() {
    if (syncing) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/calendar/google/sync", { method: "POST" });
      if (res.ok) {
        setSyncMessage("Calendar resynced");
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSyncMessage(data.error ?? "Sync failed");
      }
    } catch {
      setSyncMessage("Sync failed");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  }

  async function confirmPause() {
    setEnabled(false);
    setConfirmingOff(false);
    await fetch("/api/preferences/scheduling", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
  }

  // Debounce hours saves a little so dragging doesn't hammer the API.
  useEffect(() => {
    const handle = setTimeout(() => {
      // No-op: child onChange already saves.
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  return (
    <>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconTile tone="brand-deeper">
              <span className="text-brand-100">{CAL_ICON}</span>
            </IconTile>
            <div>
              <h3 className="font-display text-lg text-white">Scheduling</h3>
              <div className="mt-1">
                <StatusPill tone={enabled ? "active" : "muted"}>
                  {enabled ? "Active · calendar synced" : "Paused"}
                </StatusPill>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={syncCalendar}
              disabled={syncing}
              title="Re-sync your calendar availability"
              className="flex items-center gap-1.5 rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2.5 py-1 text-xs text-white/75 transition-colors hover:bg-white/[0.09] disabled:opacity-60"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 14 14"
                fill="none"
                className={syncing ? "animate-spin" : ""}
              >
                <path
                  d="M2 7a5 5 0 0 1 9-3M12 7a5 5 0 0 1-9 3M11 2v3h-3M3 12V9h3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {syncing ? "Syncing…" : syncMessage ?? "Resync calendar"}
            </button>
            <Toggle checked={enabled} onChange={onToggle} aria-label="Toggle scheduling" />
          </div>
        </div>

        {enabled && (
          <div className="space-y-5">
            {(hoursSummary || initial.averageMeetingsPerWeek !== null) && (
              <div className="rounded-card border border-[color:var(--border-subtle)] bg-white/[0.03] px-4 py-3 text-[12px] text-white/70 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {hoursSummary && (
                  <span>
                    You take meetings <span className="text-white">{hoursSummary}</span>.
                  </span>
                )}
                {initial.averageMeetingsPerWeek !== null && (
                  <span className="text-white/55">
                    About <span className="text-white">{initial.averageMeetingsPerWeek}</span> /
                    week on average (last 4 wks).
                  </span>
                )}
              </div>
            )}

            <Card variant="elevated">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
                  Preferred meeting hours
                </span>
                <span className="text-[11px] text-white/40">
                  {tz}
                  {initial.homeCity ? ` · ${initial.homeCity}` : ""}
                </span>
              </div>
              <MeetingHoursGrid initialHours={hours} onChange={persistHours} />
            </Card>

            <div className="grid grid-cols-3 gap-3">
              <PrefChip
                label="Default duration"
                unit="min"
                value={prefs.defaultDurationMin}
                options={[15, 20, 30, 45, 60]}
                onChange={(v) => persistPrefs({ ...prefs, defaultDurationMin: v })}
              />
              <PrefChip
                label="Buffer between"
                unit="min"
                value={prefs.bufferMin}
                options={[0, 5, 10, 15, 30]}
                onChange={(v) => persistPrefs({ ...prefs, bufferMin: v })}
              />
              <PrefChip
                label="Max meetings / day"
                unit=""
                value={prefs.maxPerDay}
                options={[2, 3, 4, 5, 6, 8]}
                onChange={(v) => persistPrefs({ ...prefs, maxPerDay: v })}
              />
            </div>

            <Card variant="elevated">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
                  No meetings between
                </span>
                <button
                  type="button"
                  onClick={() =>
                    persistPrefs({
                      ...prefs,
                      blockedWindows: [
                        ...prefs.blockedWindows,
                        { start: "12:00", end: "13:00", label: "" },
                      ],
                    })
                  }
                  className="rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/[0.09]"
                >
                  + Add block
                </button>
              </div>
              {prefs.blockedWindows.length === 0 ? (
                <p className="text-[11px] text-white/40">
                  Recurring blocks like lunch or focus time. Toggle <span className="text-white/60">Show on calendar</span> to
                  also create a recurring event in your Google Calendar on active days.
                </p>
              ) : (
                <ul className="space-y-3">
                  {prefs.blockedWindows.map((b, idx) => (
                    <li key={idx} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={b.start}
                          onChange={(e) => {
                            const next = [...prefs.blockedWindows];
                            next[idx] = { ...next[idx], start: e.target.value };
                            persistPrefs({ ...prefs, blockedWindows: next });
                          }}
                          className="rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-1 text-sm text-white"
                        />
                        <span className="text-white/40 text-xs">to</span>
                        <input
                          type="time"
                          value={b.end}
                          onChange={(e) => {
                            const next = [...prefs.blockedWindows];
                            next[idx] = { ...next[idx], end: e.target.value };
                            persistPrefs({ ...prefs, blockedWindows: next });
                          }}
                          className="rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-1 text-sm text-white"
                        />
                        <input
                          type="text"
                          placeholder="Lunch, focus, …"
                          value={b.label ?? ""}
                          onChange={(e) => {
                            const next = [...prefs.blockedWindows];
                            next[idx] = { ...next[idx], label: e.target.value };
                            persistPrefs({ ...prefs, blockedWindows: next });
                          }}
                          className="flex-1 rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-1 text-sm text-white placeholder:text-white/30"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = prefs.blockedWindows.filter((_, i) => i !== idx);
                            persistPrefs({ ...prefs, blockedWindows: next });
                          }}
                          className="text-white/40 hover:text-white/80 text-sm leading-none px-1"
                          aria-label="Remove block"
                        >
                          ×
                        </button>
                      </div>
                      <label className="ml-1 inline-flex items-center gap-2 text-[11px] text-white/60 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!b.mirrorToCalendar}
                          onChange={(e) => {
                            const next = [...prefs.blockedWindows];
                            next[idx] = { ...next[idx], mirrorToCalendar: e.target.checked };
                            persistPrefs({ ...prefs, blockedWindows: next });
                          }}
                          className="accent-brand-400"
                        />
                        Show on calendar
                        {b.mirrorToCalendar && b.calendarEventId && (
                          <span className="text-white/30">· synced</span>
                        )}
                        {b.mirrorToCalendar && !b.calendarEventId && (
                          <span className="text-white/30">· syncing…</span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <p className="rounded-card border border-[color:var(--border-brand)] bg-brand-400/8 px-4 py-2 text-[12px] text-white/70">
              Dharma will never propose times outside this window, inside a blocked range, or
              back-to-back without buffer.
            </p>
          </div>
        )}
      </Card>

      <ConfirmModal
        open={confirmingOff}
        title="Pause Scheduling?"
        description="Dharma will stop proposing meeting times. Your calendar connections stay in place."
        confirmLabel="Pause"
        onConfirm={confirmPause}
        onCancel={() => setConfirmingOff(false)}
      />
    </>
  );
}

function PrefChip({
  label,
  unit,
  value,
  options,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
}) {
  return (
    <Card variant="elevated" className="!p-3">
      <p className="text-[10px] uppercase tracking-[0.08em] text-white/40">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="mt-1 w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2 py-1.5 text-sm text-white"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
            {unit ? ` ${unit}` : ""}
          </option>
        ))}
      </select>
    </Card>
  );
}
