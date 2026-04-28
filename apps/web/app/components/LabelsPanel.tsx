"use client";

import { useState, useEffect } from "react";

// ── Industry presets ───────────────────────────────────────────────────────

type IndustryKey = "pe" | "vc" | "rfa";

interface PresetLabel {
  name: string;
  description: string;
  color: string;
  colorKey: string;
}

const INDUSTRY_PRESETS: Record<IndustryKey, { label: string; presets: PresetLabel[] }> = {
  pe: {
    label: "Private Equity",
    presets: [
      { name: "Keep Warm",                  description: "Relationship to maintain — not ready yet",        color: "#f5e6a0", colorKey: "yellow" },
      { name: "Interested — Info Received",  description: "Target has shown interest and sent materials",   color: "#a0c8f5", colorKey: "blue"   },
      { name: "LOI Issued",                 description: "Letter of Intent sent to target",                 color: "#c8a0f5", colorKey: "purple" },
      { name: "Client Intro",               description: "Introduction made to a client or LP",             color: "#a0f5c8", colorKey: "teal"   },
      { name: "Due Diligence",              description: "Active diligence process underway",               color: "#f5c8a0", colorKey: "orange" },
      { name: "Closing",                    description: "Deal nearing final close",                        color: "#a0f5c8", colorKey: "teal"   },
      { name: "Portfolio Company",          description: "Existing portfolio company communication",        color: "#a0c8f5", colorKey: "blue"   },
      { name: "LP Update",                  description: "Limited partner updates and reporting",           color: "#c0c0c0", colorKey: "gray"   },
    ],
  },
  vc: {
    label: "Venture Capital",
    presets: [
      { name: "Approached",                 description: "Initial outreach made to founder or company",     color: "#a0c8f5", colorKey: "blue"   },
      { name: "Letter Sent",                description: "Formal interest letter or memo delivered",        color: "#c8a0f5", colorKey: "purple" },
      { name: "Target Profiles Secured",    description: "Company profile or deck received for review",    color: "#a0f5c8", colorKey: "teal"   },
      { name: "Term Sheet",                 description: "Term sheet issued or under negotiation",          color: "#f5c8a0", colorKey: "orange" },
      { name: "Portfolio Update",           description: "Updates from existing portfolio companies",       color: "#a0c8f5", colorKey: "blue"   },
      { name: "Deal Flow",                  description: "Inbound deal flow and sourcing threads",          color: "#f5e6a0", colorKey: "yellow" },
      { name: "Pass",                       description: "Reviewed and decided not to pursue",              color: "#c0c0c0", colorKey: "gray"   },
      { name: "LP Communication",           description: "Investor relations and LP correspondence",        color: "#f5a0a0", colorKey: "red"    },
    ],
  },
  rfa: {
    label: "RFA",
    presets: [
      { name: "Client Inquiry",             description: "Direct question or request from a client",        color: "#a0c8f5", colorKey: "blue"   },
      { name: "Research Request",           description: "Request for analysis or research report",         color: "#c8a0f5", colorKey: "purple" },
      { name: "Compliance",                 description: "Regulatory or compliance-related correspondence", color: "#f5a0a0", colorKey: "red"    },
      { name: "Report Delivered",           description: "Research or analysis report sent to client",      color: "#a0f5c8", colorKey: "teal"   },
      { name: "Follow-up Required",         description: "Action item or follow-up pending",                color: "#f5e6a0", colorKey: "yellow" },
      { name: "Meeting Scheduled",          description: "Call or meeting confirmed with a client",         color: "#a0c8f5", colorKey: "blue"   },
      { name: "Prospect",                   description: "Potential new client or engagement",              color: "#c8a0f5", colorKey: "purple" },
    ],
  },
};

// ── Types ──────────────────────────────────────────────────────────────────

interface LabelRecord {
  id: string;
  name: string;
  description: string;
  color: string;
  enabled: boolean;
  gmailLabelId: string | null;
  rules: unknown[];
}

// ── Main component ─────────────────────────────────────────────────────────

export default function LabelsPanel() {
  const [industry, setIndustry] = useState<IndustryKey | "">("");
  const [labels, setLabels] = useState<LabelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ scanned: number; labeled: number } | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("dharma_industry") as IndustryKey | null;
    if (saved && saved in INDUSTRY_PRESETS) setIndustry(saved);
  }, []);

  useEffect(() => {
    fetch("/api/labels")
      .then((r) => r.json())
      .then((data: LabelRecord[]) => { setLabels(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function handleIndustryChange(key: IndustryKey | "") {
    setIndustry(key);
    if (key) localStorage.setItem("dharma_industry", key);
    else localStorage.removeItem("dharma_industry");
    setScanResult(null);
  }

  function findLabel(name: string): LabelRecord | undefined {
    return labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
  }

  async function togglePreset(preset: PresetLabel, enabled: boolean) {
    const existing = findLabel(preset.name);
    if (existing) {
      setLabels((prev) => prev.map((l) => l.id === existing.id ? { ...l, enabled } : l));
      await fetch(`/api/labels/${existing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
    } else if (enabled) {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: preset.name,
          description: preset.description,
          color: preset.color,
          colorKey: preset.colorKey,
        }),
      });
      if (res.ok) {
        const label: LabelRecord = await res.json();
        setLabels((prev) => [...prev, label]);
      }
    }
  }

  async function applyAll() {
    if (!industry) return;
    setApplying(true);
    for (const preset of INDUSTRY_PRESETS[industry].presets) {
      await togglePreset(preset, true);
    }
    setApplying(false);
  }

  async function scanInbox() {
    setScanning(true);
    setScanResult(null);
    try {
      await fetch("/api/labels/seed-rules", { method: "POST" });
      await fetch("/api/labels/setup-gmail", { method: "POST" });
      const refreshed = await fetch("/api/labels").then((r) => r.json()) as LabelRecord[];
      setLabels(refreshed);
      const res = await fetch("/api/labels/scan-inbox", { method: "POST" });
      const data = await res.json() as { scanned: number; labeled: number };
      setScanResult(data);
    } catch {
      setScanResult(null);
    }
    setScanning(false);
  }

  const presets = industry ? INDUSTRY_PRESETS[industry].presets : [];

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 space-y-4 h-full">

      {/* Industry selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-white/40 shrink-0">Industry</label>
        <select
          value={industry}
          onChange={(e) => handleIndustryChange(e.target.value as IndustryKey | "")}
          style={{ colorScheme: "dark" }}
          className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-white/25 cursor-pointer"
        >
          <option value="">Select industry…</option>
          {(Object.entries(INDUSTRY_PRESETS) as [IndustryKey, { label: string }][]).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        {industry && (
          <button
            onClick={applyAll}
            disabled={applying}
            className="text-xs px-3 py-1.5 rounded-full bg-[#b57bff]/10 border border-[#b57bff]/30 text-[#b57bff]/80 hover:bg-[#b57bff]/15 hover:text-[#b57bff] transition-colors disabled:opacity-40 shrink-0"
          >
            {applying ? "Applying…" : "Apply all"}
          </button>
        )}
      </div>

      {/* Preset labels */}
      {!industry && (
        <p className="text-xs text-white/25">Select an industry to see label presets</p>
      )}

      {industry && (
        <div className="space-y-1.5">
          {loading ? (
            <p className="text-xs text-white/25 py-2">Loading…</p>
          ) : (
            presets.map((preset) => {
              const existing = findLabel(preset.name);
              const isOn = existing ? existing.enabled : false;
              return (
                <div
                  key={preset.name}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] border border-white/[0.05] px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: preset.color }} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white/80 truncate">#{preset.name}</p>
                      <p className="text-[10px] text-white/30 truncate mt-0.5">{preset.description}</p>
                    </div>
                  </div>
                  <Toggle enabled={isOn} onChange={(v) => togglePreset(preset, v)} />
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Scan row */}
      <div className={`flex items-center justify-between gap-4 ${industry ? "border-t border-white/[0.06] pt-3" : ""}`}>
        <p className="text-xs text-white/25">Labels apply to new emails automatically</p>
        <button
          onClick={scanInbox}
          disabled={scanning}
          className="text-xs bg-white/[0.07] hover:bg-white/[0.12] text-white/60 hover:text-white/80 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0"
        >
          {scanning ? (
            <>
              <span className="inline-block w-2.5 h-2.5 border border-white/30 border-t-white/70 rounded-full animate-spin" />
              Scanning…
            </>
          ) : "Scan inbox"}
        </button>
      </div>

      {scanResult && (
        <div className="text-xs text-[#b57bff] bg-[#b57bff]/10 border border-[#b57bff]/20 rounded-xl px-4 py-2 text-center">
          Scanned {scanResult.scanned} emails — labeled {scanResult.labeled}
        </div>
      )}

    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      role="switch"
      aria-checked={enabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        enabled ? "bg-[#b57bff]/70" : "bg-white/[0.12]"
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
