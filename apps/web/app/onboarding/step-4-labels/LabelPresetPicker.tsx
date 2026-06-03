"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";

type Preset = "VC" | "PE" | "Legal" | "General" | "Personal" | "Custom";

const PRESETS: { id: Preset; description: string }[] = [
  { id: "VC", description: "Portfolio · Deal-Flow · LP-Relations · Internal · High-Priority" },
  { id: "PE", description: "Portfolio-Co · Deal · Diligence · Internal · High-Priority" },
  { id: "Legal", description: "Contracts · Client · Internal · High-Priority" },
  { id: "General", description: "Respond · Meeting · Informational · High-Priority" },
  { id: "Personal", description: "Orders · Shipping · Follow-Up · Work · Promotions · Updates · Likely-Spam · High-Priority" },
  { id: "Custom", description: "Define your own preset name and labels." },
];

type Props = {
  initial: { preset: Preset | null; customName: string };
};

export default function LabelPresetPicker({ initial }: Props) {
  const router = useRouter();
  const [preset, setPreset] = useState<Preset | null>(initial.preset);
  const [customName, setCustomName] = useState(initial.customName);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    if (!preset) return;
    setProvisioning(true);
    setError(null);
    try {
      // Save the preset choice (creates the row if missing).
      const presetRes = await fetch("/api/labels/preset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          preset,
          enabled: true,
          ...(preset === "Custom" ? { customName } : {}),
        }),
      });
      if (!presetRes.ok) throw new Error("Failed to save preset");

      // Provision the preset's labels in Gmail.
      const provRes = await fetch("/api/labels/provision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          preset,
          ...(preset === "Custom" ? { customName } : {}),
        }),
      });
      if (!provRes.ok) {
        const err = (await provRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to provision in Gmail");
      }

      // Mark onboarding complete and bounce to dashboard.
      await fetch("/api/onboarding/advance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
      setProvisioning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card variant="elevated">
        <div className="space-y-2">
          {PRESETS.map((p) => {
            const active = preset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`w-full rounded-card border px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-[color:var(--border-brand)] bg-brand-400/12"
                    : "border-[color:var(--border-subtle)] bg-white/[0.02] hover:bg-white/[0.05]"
                }`}
              >
                <p className="text-sm font-medium text-white">{p.id}</p>
                <p className="mt-0.5 text-[12px] text-white/60">{p.description}</p>
              </button>
            );
          })}
        </div>

        {preset === "Custom" && (
          <label className="mt-3 block">
            <span className="text-[10px] uppercase tracking-[0.08em] text-white/40">
              Custom preset name (Gmail folder prefix)
            </span>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Kuba Ventures"
              className="mt-1 w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-3 py-2 text-sm text-white"
            />
            <span className="mt-1 block text-[11px] text-white/40">
              Leave blank for flat top-level labels.
            </span>
          </label>
        )}
      </Card>

      {error && (
        <p className="text-sm text-[color:var(--label-3)]">{error}</p>
      )}

      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={!preset || provisioning}
          onClick={finish}
        >
          {provisioning ? "Provisioning…" : "Finish setup"}
        </Button>
      </div>
    </div>
  );
}
