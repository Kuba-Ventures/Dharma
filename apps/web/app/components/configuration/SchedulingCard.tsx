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

type Prefs = {
  defaultDurationMin: number;
  bufferMin: number;
  maxPerDay: number;
};

const DEFAULT_PREFS: Prefs = {
  defaultDurationMin: 30,
  bufferMin: 15,
  maxPerDay: 5,
};

function parsePrefs(raw: string | null): Prefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      defaultDurationMin: parsed.defaultDurationMin ?? DEFAULT_PREFS.defaultDurationMin,
      bufferMin: parsed.bufferMin ?? DEFAULT_PREFS.bufferMin,
      maxPerDay: parsed.maxPerDay ?? DEFAULT_PREFS.maxPerDay,
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
  };
};

export default function SchedulingCard({ initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(parsePrefs(initial.schedulingPreferences));
  const [hours, setHours] = useState<MeetingHour[]>(initial.hours);

  // Detect timezone if user has no value set yet (best-effort).
  const tz =
    initial.timezone ??
    (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");

  async function persistPrefs(next: Prefs) {
    setPrefs(next);
    await fetch("/api/preferences/scheduling", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schedulingPreferences: JSON.stringify(next) }),
    });
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
          <Toggle checked={enabled} onChange={onToggle} aria-label="Toggle Scheduling" />
        </div>

        {enabled && (
          <div className="space-y-5">
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

            <p className="rounded-card border border-[color:var(--border-brand)] bg-brand-400/8 px-4 py-2 text-[12px] text-white/70">
              Dharma will never propose times outside this window or back-to-back without buffer.
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
