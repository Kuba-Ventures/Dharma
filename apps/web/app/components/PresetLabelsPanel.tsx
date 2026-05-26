"use client";

import { useEffect, useState } from "react";

// Mirrors lib/labelPresets.ts — kept locally so this component does not depend
// on server-only imports. Update both if the spec changes.
type PresetKey = "VC" | "PE" | "Legal" | "General" | "Custom";
const PRESET_KEYS: PresetKey[] = ["VC", "PE", "Legal", "General", "Custom"];

interface CustomLabel {
  shortName: string;
  colorKey: string;     // hex like "#cc3a21" (legacy named keys also accepted by the API)
  displayHex: string;
}

interface PresetLabel {
  name: string;        // full Gmail name including prefix
  displayHex: string;
}

// Three vibrancy rows of Gmail's full label palette. Each hex is both the
// background color and the `colorKey` sent to the API.
const COLOR_ROWS: string[][] = [
  ["#cc3a21","#eaa041","#f2c960","#149e60","#3dc789","#2da2bb","#4a86e8","#8e63ce","#b694e8","#e07798"],
  ["#fb4c2f","#ffad47","#fad165","#16a766","#43d692","#4986e7","#a479e2","#f691b3","#cf8933","#653e9b"],
  ["#f2b2a8","#ffc8af","#fce8b3","#b3efd3","#a0eac9","#98d7e4","#b6cff5","#e3d7ff","#d0bcf1","#fbd3e0"],
];

const DEFAULT_COLOR_HEX = "#4a86e8"; // vibrant blue (row 1)

const BUILT_IN_LABELS: Record<Exclude<PresetKey, "Custom">, PresetLabel[]> = {
  VC: [
    { name: "Portfolio",     displayHex: "#16a765" },
    { name: "Deal-Flow",     displayHex: "#fb4c2f" },
    { name: "LP-Relations",  displayHex: "#4a86e8" },
    { name: "Internal",      displayHex: "#8e63ce" },
    { name: "High-Priority", displayHex: "#ffad47" },
  ],
  PE: [
    { name: "Portfolio-Co",  displayHex: "#16a765" },
    { name: "Deal",          displayHex: "#fb4c2f" },
    { name: "Diligence",     displayHex: "#4a86e8" },
    { name: "Internal",      displayHex: "#8e63ce" },
    { name: "High-Priority", displayHex: "#ffad47" },
  ],
  Legal: [
    { name: "Contracts",     displayHex: "#fb4c2f" },
    { name: "Client",        displayHex: "#16a765" },
    { name: "Internal",      displayHex: "#8e63ce" },
    { name: "High-Priority", displayHex: "#ffad47" },
  ],
  General: [
    { name: "Respond",       displayHex: "#fb4c2f" },
    { name: "Meeting",       displayHex: "#4a86e8" },
    { name: "Informational", displayHex: "#8e63ce" },
    { name: "High-Priority", displayHex: "#ffad47" },
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
  const [syncing, setSyncing] = useState(false);

  // Custom preset state
  const [customName, setCustomName] = useState("");
  const [customLabels, setCustomLabels] = useState<CustomLabel[]>([
    { shortName: "", colorKey: DEFAULT_COLOR_HEX, displayHex: DEFAULT_COLOR_HEX },
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
    setCustomLabels((prev) => {
      // Cycle through row 1 so each new row gets a distinct color out of the box.
      const row = COLOR_ROWS[0];
      const next = row[prev.length % row.length];
      return [...prev, { shortName: "", colorKey: next, displayHex: next }];
    });
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

  async function syncInbox() {
    setSyncing(true);
    setResult(null);
    try {
      // 1. Re-apply preset so colors, names, and new labels are pushed to Gmail.
      const provisionPayload: Record<string, unknown> = { preset };
      if (preset === "Custom") {
        const cleaned = customLabels
          .map((l) => ({ ...l, shortName: l.shortName.trim() }))
          .filter((l) => l.shortName);
        if (!customName.trim() || cleaned.length === 0) {
          setResult("Add a preset name and at least one label first.");
          setSyncing(false);
          return;
        }
        provisionPayload.customName = customName.trim();
        provisionPayload.customLabels = cleaned;
      }
      const provRes = await fetch("/api/labels/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(provisionPayload),
      });
      if (!provRes.ok) {
        const err = await provRes.json().catch(() => ({})) as { error?: string };
        setResult(err.error ?? "Sync failed during label setup");
        return;
      }
      const provData = await provRes.json() as {
        total: number;
        created: number;
        updated: number;
        failures?: Array<{ name: string; error: string }>;
      };
      setProvisioned(provData.total);
      if (provData.failures && provData.failures.length > 0) {
        const summary = provData.failures
          .map((f) => `${f.name}: ${f.error}`)
          .join(" | ");
        setResult(`Label sync hit errors → ${summary}`);
        return;
      }

      // 2. Back-scan recent inbox so any messages that arrived before/during
      // setup get classified.
      const scanRes = await fetch("/api/labels/back-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      if (!scanRes.ok) {
        const err = await scanRes.json().catch(() => ({})) as { error?: string };
        setResult(`Labels synced. Back-scan failed: ${err.error ?? "unknown error"}`);
        return;
      }
      const scanData = await scanRes.json() as { scanned: number; tagged: number; skipped: number; total: number };
      const labelBits: string[] = [];
      if (provData.created) labelBits.push(`${provData.created} new`);
      if (provData.updated) labelBits.push(`${provData.updated} updated`);
      setResult(
        `✓ Labels synced${labelBits.length ? ` (${labelBits.join(", ")})` : ""}. ` +
        `Scanned ${scanData.scanned} thread${scanData.scanned === 1 ? "" : "s"}, ` +
        `tagged ${scanData.tagged}${scanData.skipped ? ` (${scanData.skipped} already classified)` : ""}.`
      );
    } catch {
      setResult("Sync failed");
    } finally {
      setSyncing(false);
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
                  selectedHex={label.colorKey}
                  onPick={(hex) => updateLabel(idx, { colorKey: hex, displayHex: hex })}
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
          <p className="text-[11px] text-white/25 px-3.5 py-3">No labels yet. Add some above.</p>
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

      <div className="flex flex-col gap-2">
        <button
          onClick={applyToGmail}
          disabled={applying || syncing}
          className="w-full py-2.5 text-xs font-medium rounded-xl bg-[#b57bff]/15 border border-[#b57bff]/30 text-[#b57bff] hover:bg-[#b57bff]/22 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {applying
            ? "Creating labels in Gmail…"
            : `Apply ${presetIsCustom ? (customName.trim() || "Custom") : preset} labels to Gmail`}
        </button>
        <button
          onClick={syncInbox}
          disabled={applying || syncing}
          title="Push current colors and names to Gmail, then classify recent inbox messages that were missed."
          className="w-full py-2 text-xs font-medium rounded-xl bg-white/[0.04] border border-white/[0.1] text-white/70 hover:bg-white/[0.07] hover:text-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {syncing ? "Syncing inbox…" : "Sync inbox"}
        </button>
      </div>
    </div>
  );
}

function ColorPickerDot({
  selectedHex,
  onPick,
}: {
  selectedHex: string;
  onPick: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-5 h-5 rounded-full border border-white/20 ring-1 ring-black/40"
        style={{ backgroundColor: selectedHex }}
        aria-label="Pick color"
        type="button"
      />
      {open && (
        <div className="absolute z-20 top-7 left-0 bg-[#1f1f1f] border border-white/[0.1] rounded-lg p-2 shadow-lg space-y-1.5">
          {COLOR_ROWS.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1.5">
              {row.map((hex) => (
                <button
                  key={hex}
                  onClick={() => { onPick(hex); setOpen(false); }}
                  className={`w-4 h-4 rounded-full transition-transform ${
                    hex.toLowerCase() === selectedHex.toLowerCase()
                      ? "scale-125 ring-1 ring-white/50"
                      : "opacity-80 hover:opacity-100 hover:scale-110"
                  }`}
                  style={{ backgroundColor: hex }}
                  type="button"
                  aria-label={hex}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
