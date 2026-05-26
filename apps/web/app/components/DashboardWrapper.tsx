"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PresetLabelsPanel from "./PresetLabelsPanel";

// ── Paste your Gmail add-on install URL here ───────────────────────────────
// For testing: Apps Script editor → Deploy → Test deployments → copy the install link
// For production: your Google Workspace Marketplace listing URL
const ADDON_INSTALL_URL = "https://workspace.google.com/marketplace/app/dharma/63757021962";
// ──────────────────────────────────────────────────────────────────────────
import InboxPanel from "./InboxPanel";

// ── Types ──────────────────────────────────────────────────────────────────

type Tone = "My Tone" | "Concise" | "Formal / Legal" | "Casual / Friendly";

const PRESET_TONES: { id: Tone; description: string; example: string }[] = [
  {
    id: "Concise",
    description: "Brief and direct, no filler",
    example:
      "Hi Sarah,\n\nFollowing up on the proposal. Please advise on next steps by Thursday.\n\nThanks,\nAlex",
  },
  {
    id: "Formal / Legal",
    description: "Structured, precise language for official correspondence",
    example:
      "Dear Ms. Smith,\n\nI am writing to follow up regarding the proposal submitted for your review. Please do not hesitate to contact me should you require any additional information or clarification.\n\nSincerely,\nAlex Park",
  },
  {
    id: "Casual / Friendly",
    description: "Warm and conversational for informal threads",
    example:
      "Hey Sarah!\n\nJust wanted to check in on the proposal, no rush, but let me know how it's looking when you get a chance!\n\nCheers,\nAlex",
  },
];

const ALL_TONES: Tone[] = ["My Tone", "Concise", "Formal / Legal", "Casual / Friendly"];

interface UpcomingEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
}

interface SchedulePatterns {
  preferredWindow: string;
  preferredDays: string;
  typicalDuration: string;
  meetingsPerWeek: string;
  insight: string;
}

interface Props {
  schedulingEnabled: boolean;
  tone: string;
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DashboardWrapper({
  schedulingEnabled: initialSchedulingEnabled,
  tone: initialTone,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const [addonDismissed, setAddonDismissed] = useState(false);
  useEffect(() => {
    setAddonDismissed(localStorage.getItem("dharma_addon_dismissed_v2") === "true");
  }, []);
  function dismissAddon() {
    localStorage.setItem("dharma_addon_dismissed_v2", "true");
    setAddonDismissed(true);
  }

  // Feature toggles
  const [toneEnabled, setToneEnabled] = useState(!!initialTone);
  const [selectedTone, setSelectedTone] = useState<Tone | null>((initialTone as Tone) || null);
  const [labelsEnabled, setLabelsEnabled] = useState(false);
  const [schedulingEnabled, setSchedulingEnabled] = useState(initialSchedulingEnabled);

  // Load Tabs & Labels enabled state from server on mount
  useEffect(() => {
    fetch("/api/labels/status")
      .then((r) => r.json())
      .then((data: { enabled: boolean }) => setLabelsEnabled(!!data.enabled))
      .catch(() => null);
  }, []);

  async function handleLabelsToggle(enabled: boolean) {
    setLabelsEnabled(enabled);
    await fetch("/api/labels/preset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }).catch(() => null);
  }

  // My Tone sync state
  const [toneProfile, setToneProfile] = useState("");
  const [toneExample, setToneExample] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    fetch("/api/preferences/tone")
      .then((r) => r.json())
      .then((data: { toneProfile: string | null; toneExample: string | null }) => {
        if (data.toneProfile) setToneProfile(data.toneProfile);
        if (data.toneExample) setToneExample(data.toneExample);
      })
      .catch(() => null);
  }, []);

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
      await fetch("/api/preferences/tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: "My Tone" }),
      });
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

  const [calSyncing, setCalSyncing] = useState(false);
  const [calSyncStatus, setCalSyncStatus] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<{ upcoming: UpcomingEvent[]; patterns: SchedulePatterns } | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [schedulingPrefs, setSchedulingPrefs] = useState("");
  const [prefsSaving, setPrefsSaving] = useState(false);

  useEffect(() => {
    if (!schedulingEnabled) return;
    setScheduleLoading(true);
    fetch("/api/calendar/google/schedule")
      .then((r) => r.json())
      .then((data: { upcoming: UpcomingEvent[]; patterns: SchedulePatterns; savedPreferences: string | null }) => {
        setScheduleData(data);
        setSchedulingPrefs(data.savedPreferences ?? data.patterns?.preferredWindow ?? "");
      })
      .catch(() => null)
      .finally(() => setScheduleLoading(false));
  }, [schedulingEnabled]);

  async function handleSaveSchedulingPrefs() {
    setPrefsSaving(true);
    await fetch("/api/preferences/scheduling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedulingPreferences: schedulingPrefs }),
    });
    setPrefsSaving(false);
  }

  async function handleCalSync() {
    setCalSyncing(true);
    setCalSyncStatus(null);
    try {
      const res = await fetch("/api/calendar/google/sync", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setCalSyncStatus(body.error ?? "Sync failed. Please try again.");
      } else {
        setCalSyncStatus("Calendar synced successfully");
      }
    } catch {
      setCalSyncStatus("Sync failed. Please try again.");
    } finally {
      setCalSyncing(false);
    }
  }

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleToneSelect(tone: Tone | null) {
    setSelectedTone(tone);
    if (tone) {
      await fetch("/api/preferences/tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone }),
      });
    }
  }

  async function handleSchedulingToggle(enabled: boolean) {
    setSchedulingEnabled(enabled);
    await fetch("/api/preferences/scheduling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  }


  return (
    <div>
      {toast && (
        <div className="text-xs text-brand-400 bg-brand-400/10 border border-brand-400/20 rounded-xl px-4 py-2 text-center mb-3">
          {toast}
        </div>
      )}

      {/* ── Gmail add-on install banner ── */}
      {!addonDismissed && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
              <GmailIcon />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Get Dharma in Gmail</p>
              <p className="text-xs text-white/40 mt-0.5">
                Install the Gmail add-on to draft replies and schedule meetings right from your inbox
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={ADDON_INSTALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-full bg-brand-400/15 border border-brand-400/40 text-brand-400 hover:bg-brand-400/20 transition-colors"
            >
              Install Add-on
            </a>
            <button
              onClick={dismissAddon}
              aria-label="Dismiss"
              className="text-white/20 hover:text-white/50 transition-colors p-1"
            >
              <XIcon />
            </button>
          </div>
        </div>
      )}

      {/* Two-column grid: feature cards left, detail panels right */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "360px 1fr" }}>

        {/* ── Tone card ── */}
        <FeatureCard>
          <FeatureRow
            title="Tone"
            description="Choose how Dharma sounds when writing on your behalf"
            enabled={toneEnabled}
            onToggle={(v) => { setToneEnabled(v); if (!v) setSelectedTone(null); }}
          />
        </FeatureCard>

        {/* Tone detail panel */}
        <div>
          {toneEnabled && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 space-y-3 h-full">
              <div className="flex flex-wrap gap-2">
                {ALL_TONES.map((id) => (
                  <Tag key={id} label={id} active={selectedTone === id}
                    onClick={() => handleToneSelect(selectedTone === id ? null : id)} />
                ))}
              </div>

              {selectedTone === "My Tone" && (
                <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/40">
                      {toneProfile ? "Analysed from your sent emails" : "Sync your sent emails to detect your writing style"}
                    </p>
                    <button
                      onClick={handleSyncEmail}
                      disabled={syncing}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/[0.07] border border-white/[0.12] text-white/60 hover:text-white/90 hover:bg-white/[0.11] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {syncing ? <><SpinnerIcon />Syncing…</> : <><SyncIcon />Sync Email</>}
                    </button>
                  </div>
                  {syncError && <p className="text-xs text-red-400/80">{syncError}</p>}
                  {toneProfile && (
                    <>
                      <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
                        <p className="text-[10px] text-white/20 uppercase tracking-widest">Your style</p>
                        <textarea
                          value={toneProfile}
                          onChange={(e) => setToneProfile(e.target.value)}
                          rows={3}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white/80 resize-none focus:outline-none focus:border-white/20 leading-relaxed"
                        />
                      </div>
                      {toneExample && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-white/20 uppercase tracking-widest">Example email</p>
                          <p className="text-xs text-white/50 leading-relaxed whitespace-pre-wrap bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">{toneExample}</p>
                        </div>
                      )}
                      <button
                        onClick={handleSaveProfile}
                        disabled={profileSaving}
                        className="text-xs px-3 py-1.5 rounded-full bg-brand-400/10 border border-brand-400/30 text-brand-400/80 hover:bg-brand-400/15 hover:text-brand-400 transition-colors disabled:opacity-40"
                      >
                        {profileSaving ? "Saving…" : "Save"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {selectedTone && selectedTone !== "My Tone" && (() => {
                const tone = PRESET_TONES.find((t) => t.id === selectedTone)!;
                return (
                  <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4 space-y-3">
                    <p className="text-xs text-white/40">{tone.description}</p>
                    <div className="border-t border-white/[0.06] pt-3">
                      <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2">Example</p>
                      <p className="text-xs text-white/60 whitespace-pre-line leading-relaxed">{tone.example}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Tabs & Labels card ── */}
        <FeatureCard>
          <FeatureRow
            title="Tabs & Labels"
            description="Auto-tag incoming Gmail with industry-specific labels. Turning off stops classification but leaves existing labels in Gmail."
            enabled={labelsEnabled}
            onToggle={handleLabelsToggle}
          />
        </FeatureCard>

        {/* Labels detail panel */}
        <div>
          {labelsEnabled && <PresetLabelsPanel />}
        </div>

        {/* ── Scheduling card ── */}
        <FeatureCard>
          <FeatureRow
            title="Scheduling"
            description="Detect scheduling requests and send calendar invites automatically"
            enabled={schedulingEnabled}
            onToggle={handleSchedulingToggle}
          />
        </FeatureCard>

        {/* Scheduling detail panel */}
        <div>
          {schedulingEnabled && (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 space-y-4 h-full">
              {/* Sync row */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/40">
                  {calSyncStatus ?? "Sync your calendar to keep availability up to date"}
                </p>
                <button
                  onClick={handleCalSync}
                  disabled={calSyncing}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/[0.07] border border-white/[0.12] text-white/60 hover:text-white/90 hover:bg-white/[0.11] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {calSyncing ? <><SpinnerIcon />Syncing…</> : <><SyncIcon />Sync Calendar</>}
                </button>
              </div>

              {/* My Schedule */}
              <div className="border-t border-white/[0.06] pt-3">
                <p className="text-[10px] text-white/20 uppercase tracking-widest mb-3">My Schedule</p>
                {scheduleLoading ? (
                  <div className="flex items-center gap-2 text-xs text-white/30 py-4 justify-center">
                    <SpinnerIcon />Loading schedule…
                  </div>
                ) : scheduleData ? (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Upcoming meetings */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2">Upcoming</p>
                      {scheduleData.upcoming.length === 0 ? (
                        <p className="text-xs text-white/30">No upcoming events</p>
                      ) : (
                        scheduleData.upcoming.map((ev) => {
                          const start = new Date(ev.start);
                          const dateStr = ev.isAllDay
                            ? start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                            : start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                          const timeStr = ev.isAllDay
                            ? "All day"
                            : start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                          return (
                            <div key={ev.id} className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                              <p className="text-xs text-white/75 truncate">{ev.title}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">{dateStr} · {timeStr}</p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Scheduling patterns */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2">Your patterns</p>

                      {/* Editable preferred time */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-white/20 uppercase tracking-widest">Preferred time</p>
                        <textarea
                          value={schedulingPrefs}
                          onChange={(e) => setSchedulingPrefs(e.target.value)}
                          rows={3}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white/80 resize-none focus:outline-none focus:border-white/20 leading-relaxed"
                        />
                        <button
                          onClick={handleSaveSchedulingPrefs}
                          disabled={prefsSaving}
                          className="text-xs px-3 py-1.5 rounded-full bg-brand-400/10 border border-brand-400/30 text-brand-400/80 hover:bg-brand-400/15 hover:text-brand-400 transition-colors disabled:opacity-40"
                        >
                          {prefsSaving ? "Saving…" : "Save"}
                        </button>
                      </div>

                      <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 space-y-2">
                        <PatternRow label="Preferred days" value={scheduleData.patterns.preferredDays} />
                        <PatternRow label="Typical length" value={scheduleData.patterns.typicalDuration} />
                        <PatternRow label="Meetings/week" value={scheduleData.patterns.meetingsPerWeek} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Inbox panel ── */}
      <div className="mt-6">
        <div className="flex items-center justify-between px-1 mb-2">
          <div>
            <h2 className="text-sm font-medium text-white">Recent Inbox</h2>
            <p className="text-xs text-white/30 mt-0.5">
              Hover an email to draft a reply
              {selectedTone && <span className="text-white/20"> · tone: {selectedTone}</span>}
            </p>
          </div>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl py-1">
          <InboxPanel selectedTone={selectedTone} />
        </div>
      </div>

    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function FeatureCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
      {children}
    </div>
  );
}

function FeatureRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="px-5 py-4 flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-white/35 leading-relaxed">{description}</p>
      </div>
      <Toggle enabled={enabled} onChange={onToggle} />
    </div>
  );
}

function PatternRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] text-white/30 shrink-0">{label}</span>
      <span className="text-[10px] text-white/65 text-right">{value}</span>
    </div>
  );
}

function Tag({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-brand-400/15 border-brand-400/40 text-brand-400"
          : "bg-white/[0.05] border-white/[0.1] text-white/40 hover:text-white/60 hover:bg-white/[0.08]"
      }`}
    >
      {label}
    </button>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      role="switch"
      aria-checked={enabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        enabled ? "bg-brand-400/70" : "bg-white/[0.12]"
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

// ── Icons ──────────────────────────────────────────────────────────────────

function SyncIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path d="M13.65 2.35A8 8 0 1 0 15 8h-2a6 6 0 1 1-1.06-3.39L10 6h5V1l-1.35 1.35z" fill="currentColor" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="shrink-0 animate-spin">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
      <path d="M1 1.5L8 6.5L15 1.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.25" strokeLinecap="round" />
      <rect x="0.5" y="0.5" width="15" height="11" rx="1.5" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

