"use client";

import { useEffect, useState } from "react";

// Mirrors lib/labelPresets.ts — kept locally so this component does not depend
// on server-only imports. Update both if the spec changes.
type PresetKey = "VC" | "PE" | "Legal" | "General";
const PRESET_KEYS: PresetKey[] = ["VC", "PE", "Legal", "General"];

interface PresetLabel {
  name: string;
  displayHex: string;
}

const PRESET_LABELS: Record<PresetKey, PresetLabel[]> = {
  VC: [
    { name: "Dharma/Portfolio",     displayHex: "#16a765" },
    { name: "Dharma/Deal-Flow",     displayHex: "#fb4c2f" },
    { name: "Dharma/LP-Relations",  displayHex: "#4a86e8" },
    { name: "Dharma/Internal",      displayHex: "#8e63ce" },
    { name: "Dharma/High-Priority", displayHex: "#ffad47" },
  ],
  PE: [
    { name: "Dharma/Portfolio-Co",  displayHex: "#16a765" },
    { name: "Dharma/Deal",          displayHex: "#fb4c2f" },
    { name: "Dharma/Diligence",     displayHex: "#4a86e8" },
    { name: "Dharma/Internal",      displayHex: "#8e63ce" },
    { name: "Dharma/High-Priority", displayHex: "#ffad47" },
  ],
  Legal: [
    { name: "Dharma/Contracts",     displayHex: "#fb4c2f" },
    { name: "Dharma/Client",        displayHex: "#16a765" },
    { name: "Dharma/Internal",      displayHex: "#8e63ce" },
    { name: "Dharma/High-Priority", displayHex: "#ffad47" },
  ],
  General: [
    { name: "Dharma/Respond",       displayHex: "#fb4c2f" },
    { name: "Dharma/Meeting",       displayHex: "#4a86e8" },
    { name: "Dharma/Informational", displayHex: "#8e63ce" },
    { name: "Dharma/High-Priority", displayHex: "#ffad47" },
  ],
};

interface StatusResponse {
  preset: PresetKey | null;
  enabled: boolean;
  count: number;
}

export default function PresetLabelsPanel() {
  const [preset, setPreset] = useState<PresetKey>("VC");
  const [provisioned, setProvisioned] = useState(0);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [savingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    fetch("/api/labels/status")
      .then((r) => r.json())
      .then((data: StatusResponse) => {
        if (data.preset) setPreset(data.preset);
        setProvisioned(data.count);
      })
      .catch(() => null);
  }, []);

  async function handlePresetChange(next: PresetKey) {
    setPreset(next);
    setResult(null);
    setSavingPreset(true);
    try {
      await fetch("/api/labels/preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset: next }),
      });
    } finally {
      setSavingPreset(false);
    }
  }

  async function applyToGmail() {
    setApplying(true);
    setResult(null);
    try {
      const res = await fetch("/api/labels/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setResult(err.error ?? "Failed to apply labels");
      } else {
        const data = await res.json() as { created: number; linked: number; total: number };
        setProvisioned(data.total);
        const created = data.created;
        const linked = data.linked;
        const parts: string[] = [];
        if (created) parts.push(`${created} created`);
        if (linked) parts.push(`${linked} already existed`);
        setResult(
          `✓ ${data.total} labels in your Gmail (${parts.join(", ") || "no changes"}). Future emails will be auto-tagged.`
        );
      }
    } catch {
      setResult("Failed to apply labels");
    } finally {
      setApplying(false);
    }
  }

  const currentLabels = PRESET_LABELS[preset];

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 flex flex-col gap-3 h-full">
      <div className="flex items-center gap-3">
        <label className="text-xs text-white/40 shrink-0">Preset</label>
        <select
          value={preset}
          onChange={(e) => handlePresetChange(e.target.value as PresetKey)}
          disabled={savingPreset || applying}
          style={{ colorScheme: "dark" }}
          className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-white/25 cursor-pointer disabled:opacity-50"
        >
          {PRESET_KEYS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.05]">
        {currentLabels.map((label) => (
          <div key={label.name} className="bg-white/[0.02] flex items-center gap-2.5 px-3.5 py-2.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: label.displayHex }}
            />
            <span className="text-xs font-medium text-white/75">{label.name}</span>
          </div>
        ))}
      </div>

      {result && (
        <p className="text-xs text-[#b57bff] bg-[#b57bff]/10 border border-[#b57bff]/20 rounded-xl px-4 py-2">
          {result}
        </p>
      )}

      {!result && provisioned > 0 && (
        <p className="text-[10px] text-white/30">
          {provisioned} labels currently provisioned in Gmail.
        </p>
      )}

      <button
        onClick={applyToGmail}
        disabled={applying}
        className="w-full py-2.5 text-xs font-medium rounded-xl bg-[#b57bff]/15 border border-[#b57bff]/30 text-[#b57bff] hover:bg-[#b57bff]/22 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {applying ? "Creating labels in Gmail…" : `Apply ${preset} labels to Gmail`}
      </button>
    </div>
  );
}
