"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import StatusPill from "../ui/StatusPill";
import IconTile from "../ui/IconTile";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";
import ConfirmModal from "../ui/ConfirmModal";

const LABELS_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M3 3h6.5L13 6.5 9.5 10H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="5" cy="6.5" r="1" fill="currentColor" />
  </svg>
);

const PRESETS = ["VC", "PE", "Legal", "General", "Custom"] as const;
type Preset = (typeof PRESETS)[number];

type Props = {
  initial: {
    preset: Preset | null;
    enabled: boolean;
    customName: string | null;
    provisioned: number;
  };
};

export default function LabelsCard({ initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [preset, setPreset] = useState<Preset>(initial.preset ?? "General");
  const [customName, setCustomName] = useState(initial.customName ?? "");
  const [provisioned, setProvisioned] = useState(initial.provisioned);
  const [applying, setApplying] = useState(false);

  async function persistPreset(next: { preset?: Preset; enabled?: boolean; customName?: string }) {
    await fetch("/api/labels/preset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  async function selectPreset(p: Preset) {
    setPreset(p);
    await persistPreset({ preset: p, enabled: true, customName: p === "Custom" ? customName : "" });
    setEnabled(true);
  }

  async function applyToGmail() {
    setApplying(true);
    try {
      const res = await fetch("/api/labels/provision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preset, customName: preset === "Custom" ? customName : undefined }),
      });
      if (res.ok) {
        const data = (await res.json()) as { total?: number };
        if (typeof data.total === "number") setProvisioned(data.total);
      }
    } finally {
      setApplying(false);
    }
  }

  function onToggle(next: boolean) {
    if (!next) {
      setConfirmingOff(true);
      return;
    }
    setEnabled(true);
    persistPreset({ enabled: true });
  }

  async function confirmPause() {
    setEnabled(false);
    setConfirmingOff(false);
    await persistPreset({ enabled: false });
  }

  // Refresh provisioned count on focus
  useEffect(() => {
    function onFocus() {
      fetch("/api/labels/status")
        .then((r) => r.json())
        .then((d: { count?: number }) => {
          if (typeof d.count === "number") setProvisioned(d.count);
        })
        .catch(() => null);
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconTile tone="brand-deep">
              <span className="text-brand-100">{LABELS_ICON}</span>
            </IconTile>
            <div>
              <h3 className="font-display text-lg text-white">Labels</h3>
              <div className="mt-1">
                <StatusPill tone={enabled ? "active" : "muted"}>
                  {enabled
                    ? `Active · ${provisioned} provisioned in Gmail`
                    : "Paused"}
                </StatusPill>
              </div>
            </div>
          </div>
          <Toggle checked={enabled} onChange={onToggle} aria-label="Toggle Labels" />
        </div>

        {enabled && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] uppercase tracking-[0.08em] text-white/40">
                Active preset
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => selectPreset(p)}
                    className={`rounded-btn border px-3 py-1.5 text-xs transition-colors ${
                      preset === p
                        ? "border-[color:var(--border-brand)] bg-brand-400/15 text-brand-200"
                        : "border-[color:var(--border-subtle)] bg-white/[0.04] text-white/60 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {preset === "Custom" && (
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.08em] text-white/40">
                  Custom preset name (Gmail folder prefix)
                </span>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onBlur={() => persistPreset({ preset: "Custom", customName })}
                  placeholder="e.g. Kuba Ventures"
                  className="mt-1 w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/30"
                />
                <p className="mt-1 text-[11px] text-white/40">
                  Leave blank for flat top-level labels.
                </p>
              </label>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="primary" onClick={applyToGmail} disabled={applying}>
                {applying ? "Provisioning…" : "Sync to Gmail"}
              </Button>
              <p className="text-[11px] text-white/40">
                Provisions the preset's labels in your Gmail and starts classifying new mail.
              </p>
            </div>

            <p className="rounded-card border border-[color:var(--border-brand)] bg-brand-400/8 px-4 py-2 text-[12px] text-white/70">
              Labels live in your own Gmail account. Dharma never reads
              messages outside the threads it's classifying.
            </p>
          </div>
        )}
      </Card>

      <ConfirmModal
        open={confirmingOff}
        title="Pause Labels?"
        description="Dharma will stop classifying new mail. Existing Gmail labels stay in place — you can re-enable anytime."
        confirmLabel="Pause"
        onConfirm={confirmPause}
        onCancel={() => setConfirmingOff(false)}
      />
    </>
  );
}
