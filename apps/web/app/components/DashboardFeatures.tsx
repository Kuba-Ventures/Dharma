"use client";

import { useEffect, useState } from "react";

type Tone = "Professional" | "Friendly" | "Casual" | "Formal" | "Concise" | "My Tone";
type Label = "Primary" | "Work" | "Personal" | "Updates" | "Promotions";
type ScheduleType = "Meetings" | "Reminders" | "Focus Blocks" | "Travel" | "Personal";

const TONES: Tone[] = ["Professional", "Friendly", "Casual", "Formal", "Concise", "My Tone"];
const LABELS: Label[] = ["Primary", "Work", "Personal", "Updates", "Promotions"];
const SCHEDULE_TYPES: ScheduleType[] = ["Meetings", "Reminders", "Focus Blocks", "Travel", "Personal"];

interface Props {
  schedulingEnabled: boolean;
  onSchedulingChange: (enabled: boolean) => void;
}

export default function DashboardFeatures({ schedulingEnabled, onSchedulingChange }: Props) {
  const [toneEnabled, setToneEnabled] = useState(false);
  const [selectedTone, setSelectedTone] = useState<Tone | null>(null);
  const [labelsEnabled, setLabelsEnabled] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<Label[]>([]);
  const [selectedScheduleTypes, setSelectedScheduleTypes] = useState<ScheduleType[]>([]);

  // My Tone state
  const [toneProfile, setToneProfile] = useState<string>("");
  const [toneExample, setToneExample] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences/tone")
      .then((r) => r.json())
      .then((data: { tone: string; toneProfile: string | null; toneExample: string | null }) => {
        if (data.tone) {
          setSelectedTone(data.tone as Tone);
          setToneEnabled(true);
        }
        if (data.toneProfile) setToneProfile(data.toneProfile);
        if (data.toneExample) setToneExample(data.toneExample);
      })
      .catch(() => null);
  }, []);

  function toggleLabel(label: Label) {
    setSelectedLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }

  function toggleScheduleType(type: ScheduleType) {
    setSelectedScheduleTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleToneSelect(tone: Tone) {
    const next = tone === selectedTone ? null : tone;
    setSelectedTone(next);
    if (next) {
      await fetch("/api/preferences/tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: next }),
      });
    }
  }

  async function handleSyncEmail() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/preferences/tone/sync", { method: "POST" });
      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        throw new Error(error ?? "Sync failed");
      }
      const data = await res.json() as { summary: string; example: string };
      setToneProfile(data.summary);
      setToneExample(data.example);
      setSelectedTone("My Tone");
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveProfile() {
    setProfileSaving(true);
    await fetch("/api/preferences/tone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toneProfile, toneExample }),
    });
    setProfileSaving(false);
  }

  return (
    <div className="space-y-3">
      {/* Tone */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Email Tone</p>
            <p className="text-xs text-white/30 mt-0.5">Set a writing tone for automated emails</p>
          </div>
          <Toggle enabled={toneEnabled} onChange={setToneEnabled} />
        </div>
        {toneEnabled && (
          <>
            <div className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.06]">
              {TONES.map((tone) => (
                <button
                  key={tone}
                  onClick={() => handleToneSelect(tone)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedTone === tone
                      ? "bg-[#c8f5a0]/15 border-[#c8f5a0]/40 text-[#c8f5a0]"
                      : "bg-white/[0.05] border-white/[0.1] text-white/50 hover:text-white/70 hover:bg-white/[0.08]"
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>

            {selectedTone === "My Tone" && (
              <div className="pt-3 border-t border-white/[0.06] space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/40">
                    {toneProfile
                      ? "Analysed from your sent emails"
                      : "Sync your sent emails to detect your writing style"}
                  </p>
                  <button
                    onClick={handleSyncEmail}
                    disabled={syncing}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/[0.07] border border-white/[0.12] text-white/60 hover:text-white/90 hover:bg-white/[0.11] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {syncing ? (
                      <>
                        <SpinnerIcon />
                        Syncing…
                      </>
                    ) : (
                      <>
                        <SyncIcon />
                        Sync Email
                      </>
                    )}
                  </button>
                </div>

                {syncError && (
                  <p className="text-xs text-red-400/80">{syncError}</p>
                )}

                {toneProfile && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/30 uppercase tracking-wider">Your style</label>
                      <textarea
                        value={toneProfile}
                        onChange={(e) => setToneProfile(e.target.value)}
                        rows={3}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white/80 placeholder-white/20 resize-none focus:outline-none focus:border-white/20 leading-relaxed"
                      />
                    </div>

                    {toneExample && (
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/30 uppercase tracking-wider">Example email</label>
                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-white/50 leading-relaxed whitespace-pre-wrap">
                          {toneExample}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleSaveProfile}
                      disabled={profileSaving}
                      className="text-xs px-3 py-1.5 rounded-full bg-[#c8f5a0]/10 border border-[#c8f5a0]/30 text-[#c8f5a0]/80 hover:bg-[#c8f5a0]/15 hover:text-[#c8f5a0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {profileSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Tabs & Labels */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Tabs & Labels</p>
            <p className="text-xs text-white/30 mt-0.5">Auto-organize emails into tabs and labels</p>
          </div>
          <Toggle enabled={labelsEnabled} onChange={setLabelsEnabled} />
        </div>
        {labelsEnabled && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.06]">
            {LABELS.map((label) => (
              <button
                key={label}
                onClick={() => toggleLabel(label)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedLabels.includes(label)
                    ? "bg-[#c8f5a0]/15 border-[#c8f5a0]/40 text-[#c8f5a0]"
                    : "bg-white/[0.05] border-white/[0.1] text-white/50 hover:text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scheduling */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Scheduling</p>
            <p className="text-xs text-white/30 mt-0.5">Automate scheduling and calendar events</p>
          </div>
          <Toggle enabled={schedulingEnabled} onChange={onSchedulingChange} />
        </div>
        {schedulingEnabled && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.06]">
            {SCHEDULE_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => toggleScheduleType(type)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedScheduleTypes.includes(type)
                    ? "bg-[#c8f5a0]/15 border-[#c8f5a0]/40 text-[#c8f5a0]"
                    : "bg-white/[0.05] border-white/[0.1] text-white/50 hover:text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      aria-checked={enabled}
      role="switch"
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        enabled ? "bg-[#c8f5a0]/70" : "bg-white/[0.12]"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

function SyncIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path
        d="M13.65 2.35A8 8 0 1 0 15 8h-2a6 6 0 1 1-1.06-3.39L10 6h5V1l-1.35 1.35z"
        fill="currentColor"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 animate-spin"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}
