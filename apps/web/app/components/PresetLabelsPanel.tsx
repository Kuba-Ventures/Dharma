"use client";

import { useEffect, useState } from "react";

// Mirrors lib/labelPresets.ts — kept locally so this component does not depend
// on server-only imports. Update both if the spec changes.
type PresetKey = "VC" | "PE" | "Legal" | "General" | "Custom";
const PRESET_KEYS: PresetKey[] = ["VC", "PE", "Legal", "General", "Custom"];

type GmailColorKey = "green" | "red" | "orange" | "blue" | "purple" | "teal" | "yellow" | "gray";

interface CustomLabel {
  shortName: string;
  colorKey: GmailColorKey;
  displayHex: string;
}

interface PresetLabel {
  name: string;        // full Gmail name including prefix
  displayHex: string;
}

const COLOR_PALETTE: { key: GmailColorKey; hex: string }[] = [
  { key: "green",  hex: "#16a765" },
  { key: "red",    hex: "#fb4c2f" },
  { key: "blue",   hex: "#4a86e8" },
  { key: "purple", hex: "#8e63ce" },
  { key: "orange", hex: "#ffad47" },
  { key: "teal",   hex: "#2da2bb" },
  { key: "yellow", hex: "#f2c960" },
  { key: "gray",   hex: "#999999" },
];

const BUILT_IN_LABELS: Record<Exclude<PresetKey, "Custom">, PresetLabel[]> = {
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
  customName: string | null;
  customLabels: CustomLabel[] | null;
}

export default function PresetLabelsPanel() {
  const [preset, setPreset] = useState<PresetKey>("VC");
  const [provisioned, setProvisioned] = useState(0);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [savingPreset, setSavingPreset] = useState(false);

  // Custom preset state
  const [customName, setCustomName] = useState("");
  const [customLabels, setCustomLabels] = useState<CustomLabel[]>([
    { shortName: "", colorKey: "blue", displayHex: "#4a86e8" },
  ]);

  useEffect(() => {
    fetch("/api/labels/status")
      .then((r) => r.json())
      .then((data: StatusResponse) => {
        if (data.preset) setPreset(data.preset);
        if (data.customName) setCustomName(data.customName);
        if (data.customLabels && Array.isArray(data.customLabels) && data.customLabels.length) {
          setCustomLabels(data.customLabels);
        }
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

  function updateLabel(idx: number, patch: Partial<CustomLabel>) {
    setCustomLabels((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLabel() {
    setCustomLabels((prev) => [
      ...prev,
      { shortName: "", colorKey: "purple", displayHex: "#8e63ce" },
    ]);
  }

  function removeLabel(idx: number) {
    setCustomLabels((prev) => prev.filter((_, i) => i !== idx));
  }

  async function applyToGmail() {
    setApplying(true);
    setResult(null);
    try {
      const payload: Record<string, unknown> = { preset };
      if (preset === "Custom") {
        const cleaned = customLabels
          .map((l) => ({ ...l, shortName: l.shortName.trim() }))
          .filter((l) => l.shortName);
        if (!customName.trim()) {
          setResult("Add a preset name (e.g. \"Kuba Ventures\").");
          setApplying(false);
          return;
        }
        if (cleaned.length === 0) {
          setResult("Add at least one label.");
          setApplying(false);
          return;
        }
        payload.customName = customName.trim();
        payload.customLabels = cleaned;
      }
      const res = await fetch("/api/labels/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setResult(err.error ?? "Failed to apply labels");
      } else {
        const data = await res.json() as { created: number; linked: number; total: number; displayName: string };
        setProvisioned(data.total);
        const parts: string[] = [];
        if (data.created) parts.push(`${data.created} created`);
        if (data.linked) parts.push(`${data.linked} already existed`);
        setResult(
          `✓ ${data.total} ${data.displayName} labels in your Gmail (${parts.join(", ") || "no changes"}). Future emails will be auto-tagged.`
        );
      }
    } catch {
      setResult("Failed to apply labels");
    } finally {
      setApplying(false);
    }
  }

  const presetIsCustom = preset === "Custom";
  const previewLabels: PresetLabel[] = presetIsCustom
    ? customLabels
        .filter((l) => l.shortName.trim())
        .map((l) => ({
          name: `${customName.trim() || "Custom"}/${l.shortName.trim()}`,
          displayHex: l.displayHex,
        }))
    : BUILT_IN_LABELS[preset as Exclude<PresetKey, "Custom">];

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

      {presetIsCustom && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/30 uppercase tracking-widest">Preset name</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Kuba Ventures"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-white/25"
            />
            <p className="text-[10px] text-white/25">
              Used as the Gmail folder prefix: <code className="text-white/40">{(customName.trim() || "Name")}/Label-Name</code>
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-white/30 uppercase tracking-widest">Labels</label>
            {customLabels.map((label, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <ColorPickerDot
                  selectedKey={label.colorKey}
                  onPick={(c) => updateLabel(idx, { colorKey: c.key, displayHex: c.hex })}
                />
                <input
                  type="text"
                  value={label.shortName}
                  onChange={(e) => updateLabel(idx, { shortName: e.target.value })}
                  placeholder="follow-up"
                  className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-white/25"
                />
                <button
                  onClick={() => removeLabel(idx)}
                  className="text-white/20 hover:text-red-400/70 transition-colors text-sm leading-none px-1.5"
                  aria-label="Remove label"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={addLabel}
              className="text-[11px] text-white/35 hover:text-white/60 transition-colors text-left"
            >
              + Add label
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.05]">
        {previewLabels.length === 0 ? (
          <p className="text-[11px] text-white/25 px-3.5 py-3">No labels yet — add some above.</p>
        ) : (
          previewLabels.map((label) => (
            <div key={label.name} className="bg-white/[0.02] flex items-center gap-2.5 px-3.5 py-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: label.displayHex }}
              />
              <span className="text-xs font-medium text-white/75">{label.name}</span>
            </div>
          ))
        )}
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
        {applying
          ? "Creating labels in Gmail…"
          : `Apply ${presetIsCustom ? (customName.trim() || "Custom") : preset} labels to Gmail`}
      </button>
    </div>
  );
}

function ColorPickerDot({
  selectedKey,
  onPick,
}: {
  selectedKey: GmailColorKey;
  onPick: (c: { key: GmailColorKey; hex: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = COLOR_PALETTE.find((c) => c.key === selectedKey) ?? COLOR_PALETTE[0];
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-5 h-5 rounded-full border border-white/20 ring-1 ring-black/40"
        style={{ backgroundColor: selected.hex }}
        aria-label="Pick color"
        type="button"
      />
      {open && (
        <div className="absolute z-10 top-7 left-0 bg-[#1f1f1f] border border-white/[0.1] rounded-lg p-1.5 shadow-lg flex gap-1">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c.key}
              onClick={() => { onPick(c); setOpen(false); }}
              className={`w-4 h-4 rounded-full transition-transform ${c.key === selectedKey ? "scale-125 ring-1 ring-white/50" : "opacity-70 hover:opacity-100"}`}
              style={{ backgroundColor: c.hex }}
              type="button"
              aria-label={c.key}
            />
          ))}
        </div>
      )}
    </div>
  );
}
