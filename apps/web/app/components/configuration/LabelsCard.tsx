"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import StatusPill from "../ui/StatusPill";
import IconTile from "../ui/IconTile";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";
import ConfirmModal from "../ui/ConfirmModal";
import LabelEditor from "./LabelEditor";
import { GMAIL_COLOR_ROWS, DEFAULT_LABEL_COLOR_HEX } from "@/lib/gmailPalette";

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

const PRESETS = ["VC", "PE", "Legal", "General", "Personal", "Custom"] as const;
type Preset = (typeof PRESETS)[number];

type CustomLabel = {
  shortName: string;
  colorKey: string;
  displayHex: string;
};

// Palette + default swatch come from lib/gmailPalette (shared with LabelEditor
// and the server-side color validation in lib/gmail.ts).
const DEFAULT_COLOR_HEX = DEFAULT_LABEL_COLOR_HEX;

// Display-side mirror of LABEL_PRESETS in lib/labelPresets.ts. Hexes are the
// palette values from COLOR_ROWS so the color picker highlights correctly.
// Editing a built-in preset forks it to Custom seeded from this list — keep in
// sync if a preset's labels change server-side.
const BUILT_IN_LABELS: Record<Exclude<Preset, "Custom">, { shortName: string; displayHex: string }[]> = {
  VC: [
    { shortName: "Portfolio", displayHex: "#16a766" },
    { shortName: "Deal-Flow", displayHex: "#fb4c2f" },
    { shortName: "LP-Relations", displayHex: "#4a86e8" },
    { shortName: "Internal", displayHex: "#8e63ce" },
    { shortName: "High-Priority", displayHex: "#ffad47" },
  ],
  PE: [
    { shortName: "Portfolio-Co", displayHex: "#16a766" },
    { shortName: "Deal", displayHex: "#fb4c2f" },
    { shortName: "Diligence", displayHex: "#4a86e8" },
    { shortName: "Internal", displayHex: "#8e63ce" },
    { shortName: "High-Priority", displayHex: "#ffad47" },
  ],
  Legal: [
    { shortName: "Contracts", displayHex: "#fb4c2f" },
    { shortName: "Client", displayHex: "#16a766" },
    { shortName: "Internal", displayHex: "#8e63ce" },
    { shortName: "High-Priority", displayHex: "#ffad47" },
  ],
  General: [
    { shortName: "Respond", displayHex: "#fb4c2f" },
    { shortName: "Meeting", displayHex: "#4a86e8" },
    { shortName: "Informational", displayHex: "#8e63ce" },
    { shortName: "High-Priority", displayHex: "#ffad47" },
  ],
  Personal: [
    { shortName: "Orders", displayHex: "#16a766" },
    { shortName: "Shipping", displayHex: "#4a86e8" },
    { shortName: "Follow-Up", displayHex: "#fb4c2f" },
    { shortName: "Work", displayHex: "#8e63ce" },
    { shortName: "Promotions", displayHex: "#f2c960" },
    { shortName: "Updates", displayHex: "#2da2bb" },
    { shortName: "Likely-Spam", displayHex: "#cf8933" },
    { shortName: "High-Priority", displayHex: "#ffad47" },
  ],
};

// Seed editable rows from a built-in preset. colorKey doubles as the hex the
// API maps to Gmail's palette, so we reuse displayHex for both.
function builtInSeed(p: Preset): CustomLabel[] {
  if (p === "Custom") return [];
  return (BUILT_IN_LABELS[p] ?? []).map((l) => ({
    shortName: l.shortName,
    colorKey: l.displayHex,
    displayHex: l.displayHex,
  }));
}

function parseCustomLabels(raw: unknown): CustomLabel[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => {
      const o = l as Partial<CustomLabel>;
      const shortName = typeof o.shortName === "string" ? o.shortName : "";
      const colorKey = typeof o.colorKey === "string" ? o.colorKey : DEFAULT_COLOR_HEX;
      const displayHex = typeof o.displayHex === "string" ? o.displayHex : colorKey;
      return { shortName, colorKey, displayHex };
    })
    .filter((l) => l.shortName || l.colorKey);
}

type Props = {
  initial: {
    preset: Preset | null;
    enabled: boolean;
    customName: string | null;
    customLabels: unknown;
    provisioned: number;
    uncategorizedEnabled: boolean;
  };
};

const UNCATEGORIZED_HEX = "#999999";

export default function LabelsCard({ initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [preset, setPreset] = useState<Preset>(initial.preset ?? "General");
  const [customName, setCustomName] = useState(initial.customName ?? "");
  const [customLabels, setCustomLabels] = useState<CustomLabel[]>(() => {
    const parsed = parseCustomLabels(initial.customLabels);
    return parsed.length
      ? parsed
      : [{ shortName: "", colorKey: DEFAULT_COLOR_HEX, displayHex: DEFAULT_COLOR_HEX }];
  });
  const [provisioned, setProvisioned] = useState(initial.provisioned);
  const [applying, setApplying] = useState(false);
  const [syncingInbox, setSyncingInbox] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uncategorizedEnabled, setUncategorizedEnabled] = useState(initial.uncategorizedEnabled);
  const [uncategorizedBusy, setUncategorizedBusy] = useState(false);

  async function persistPreset(next: {
    preset?: Preset;
    enabled?: boolean;
    customName?: string;
    customLabels?: CustomLabel[];
  }) {
    await fetch("/api/labels/preset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  async function selectPreset(p: Preset) {
    setPreset(p);
    setErrorMessage(null);
    await persistPreset({
      preset: p,
      enabled: true,
      customName: p === "Custom" ? customName : "",
      ...(p === "Custom" && { customLabels: cleanedCustomLabels() }),
    });
    setEnabled(true);
  }

  function cleanedCustomLabels(): CustomLabel[] {
    return customLabels
      .map((l) => ({ ...l, shortName: l.shortName.trim() }))
      .filter((l) => l.shortName);
  }

  // Persist the editable label list as a Custom preset. Built-in presets are
  // flat (no prefix), so a fork keeps the same Gmail label names — classified
  // mail and provisioned labels carry over untouched.
  async function persistLabels(list: CustomLabel[], prefix: string) {
    await persistPreset({
      preset: "Custom",
      enabled: true,
      customName: prefix,
      customLabels: list.map((l) => ({ ...l, shortName: l.shortName.trim() })).filter((l) => l.shortName),
    });
    setEnabled(true);
  }

  // Edits operate on the active list whether it's a built-in seed or the user's
  // Custom labels. Touching a built-in forks it to Custom so the change sticks.
  function updateLabel(idx: number, patch: Partial<CustomLabel>, persist = false) {
    const wasCustom = preset === "Custom";
    const base = wasCustom ? customLabels : builtInSeed(preset);
    const next = base.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    if (!wasCustom) {
      setPreset("Custom");
      setCustomName("");
    }
    setCustomLabels(next);
    if (persist) void persistLabels(next, wasCustom ? customName : "");
  }

  function addLabel() {
    const wasCustom = preset === "Custom";
    const base = wasCustom ? customLabels : builtInSeed(preset);
    const row = GMAIL_COLOR_ROWS[0];
    const nextColor = row[base.length % row.length];
    const next = [...base, { shortName: "", colorKey: nextColor, displayHex: nextColor }];
    if (!wasCustom) {
      setPreset("Custom");
      setCustomName("");
    }
    setCustomLabels(next);
  }

  function removeLabel(idx: number) {
    const wasCustom = preset === "Custom";
    const base = wasCustom ? customLabels : builtInSeed(preset);
    if (base.length <= 1) return;
    const next = base.filter((_, i) => i !== idx);
    if (!wasCustom) {
      setPreset("Custom");
      setCustomName("");
    }
    setCustomLabels(next);
    void persistLabels(next, wasCustom ? customName : "");
  }

  async function persistCustomState() {
    if (preset !== "Custom") return;
    await persistPreset({
      preset: "Custom",
      customName,
      customLabels: cleanedCustomLabels(),
    });
  }

  async function applyToGmail() {
    setErrorMessage(null);

    if (preset === "Custom") {
      const cleaned = cleanedCustomLabels();
      if (cleaned.length === 0) {
        setErrorMessage("Add at least one custom label before syncing.");
        return;
      }
    }

    setApplying(true);
    setBackfillStatus(null);
    try {
      const payload: Record<string, unknown> = { preset };
      if (preset === "Custom") {
        payload.customName = customName.trim();
        payload.customLabels = cleanedCustomLabels();
      }
      const res = await fetch("/api/labels/provision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = (await res.json()) as { total?: number };
        if (typeof data.total === "number") setProvisioned(data.total);
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(err.error ?? "Failed to sync labels.");
        setApplying(false);
        return;
      }
    } finally {
      setApplying(false);
    }

    // Auto-backfill the last 25 INBOX threads so the user sees what labels
    // will look like on incoming mail. Idempotent: re-running skips threads
    // already in ClassifiedThread.
    setBackfillStatus("Labeling your last 25 inbox threads…");
    try {
      const res = await fetch("/api/labels/back-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        const data = (await res.json()) as { scanned?: number; tagged?: number; skipped?: number };
        const tagged = data.tagged ?? 0;
        const scanned = data.scanned ?? 0;
        const skipped = data.skipped ?? 0;
        setBackfillStatus(
          skipped > 0
            ? `Labeled ${tagged} of ${scanned} new threads. ${skipped} already labeled.`
            : `Labeled ${tagged} of ${scanned} recent threads. Check your inbox.`
        );
      } else {
        setBackfillStatus("Backfill skipped. Labels still apply to new mail.");
      }
    } catch {
      setBackfillStatus("Backfill skipped. Labels still apply to new mail.");
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

  // Delete (or re-add) the Uncategorized catch-all label. The endpoint flips the
  // persisted flag and creates/removes the matching Gmail label.
  async function toggleUncategorized(next: boolean) {
    setUncategorizedBusy(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/labels/uncategorized", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) {
        setUncategorizedEnabled(next);
        refresh();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(err.error ?? "Failed to update the catch-all label.");
      }
    } catch {
      setErrorMessage("Failed to update the catch-all label.");
    } finally {
      setUncategorizedBusy(false);
    }
  }

  async function syncInbox() {
    setSyncingInbox(true);
    setErrorMessage(null);

    if (preset === "Custom" && cleanedCustomLabels().length === 0) {
      setErrorMessage("Add at least one custom label before syncing.");
      setSyncingInbox(false);
      return;
    }

    // 1. Re-provision so colors/names/new labels are pushed to Gmail AND stale
    //    LabelMappings from prior presets are pruned (this is what fixes the
    //    inflated "N provisioned" count).
    setBackfillStatus("Updating labels in Gmail…");
    try {
      const payload: Record<string, unknown> = { preset };
      if (preset === "Custom") {
        payload.customName = customName.trim();
        payload.customLabels = cleanedCustomLabels();
      }
      const provRes = await fetch("/api/labels/provision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!provRes.ok) {
        const err = (await provRes.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(err.error ?? "Sync failed during label provisioning.");
        setBackfillStatus(null);
        setSyncingInbox(false);
        return;
      }
      const provData = (await provRes.json()) as { total?: number };
      if (typeof provData.total === "number") setProvisioned(provData.total);
    } catch {
      setErrorMessage("Sync failed during label provisioning.");
      setBackfillStatus(null);
      setSyncingInbox(false);
      return;
    }

    // 2. Force-classify recent inbox threads under the current preset so
    //    color/name/new-label changes show up on existing mail.
    setBackfillStatus("Re-classifying your last 25 inbox threads…");
    try {
      const res = await fetch("/api/labels/back-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          scanned?: number;
          tagged?: number;
          incomplete?: boolean;
        };
        const tagged = data.tagged ?? 0;
        const scanned = data.scanned ?? 0;
        setBackfillStatus(
          data.incomplete
            ? `Labels synced. Re-classified ${tagged} of ${scanned} — run Sync again for the rest.`
            : `Re-classified ${tagged} of ${scanned} recent threads.`,
        );
      } else {
        // Show the route's actionable error (reconnect / rate-limited) instead
        // of a vague "skipped".
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(err.error ?? "Labels synced, but the inbox re-scan failed. Try Sync again.");
      }
    } catch {
      setErrorMessage("Labels synced, but the inbox re-scan couldn't reach the server. Try Sync again.");
    } finally {
      setSyncingInbox(false);
      refresh();
    }
  }

  async function refresh() {
    const statusRes = await fetch("/api/labels/status")
      .then((r) => r.json())
      .catch(() => null);
    if (statusRes && typeof (statusRes as { count?: number }).count === "number") {
      setProvisioned((statusRes as { count: number }).count);
    }
  }

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  // The rows shown in the editor: a built-in preset's labels (read from the
  // mirror) or the user's Custom list. High-Priority is included because it's a
  // real provisioned label; Uncategorized has its own section below.
  const editableLabels: CustomLabel[] =
    preset === "Custom" ? customLabels : builtInSeed(preset);

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
          <div className="flex items-center gap-2">
            {enabled && (
              <button
                type="button"
                onClick={syncInbox}
                disabled={syncingInbox || applying}
                title="Re-classify your last 25 inbox threads under the current preset"
                className="inline-flex items-center gap-1.5 rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className={syncingInbox ? "animate-spin" : ""}>
                  <path
                    d="M2 6a4 4 0 0 1 7-2.6M10 6a4 4 0 0 1-7 2.6M9 1.5V3.6H6.9M3 10.5V8.4h2.1"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {syncingInbox ? "Syncing…" : "Sync inbox"}
              </button>
            )}
            <Toggle checked={enabled} onChange={onToggle} aria-label="Toggle labels" />
          </div>
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
                  Gmail folder prefix{" "}
                  <span className="text-white/30 normal-case tracking-normal">(optional)</span>
                </span>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onBlur={persistCustomState}
                  placeholder="e.g. Kuba Ventures"
                  className="mt-1 w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/30"
                />
                <p className="mt-1 text-[11px] text-white/40">
                  {customName.trim() ? (
                    <>
                      Labels nest under{" "}
                      <code className="text-white/55">{customName.trim()}/Label-Name</code> in your
                      Gmail sidebar.
                    </>
                  ) : (
                    <>Leave blank for flat top-level labels.</>
                  )}
                </p>
              </label>
            )}

            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-[0.08em] text-white/40">
                  Labels in this preset
                </span>
                {preset !== "Custom" && (
                  <span className="text-[10px] text-white/30">
                    Edit a color or name to customize
                  </span>
                )}
              </div>
              <LabelEditor
                rows={editableLabels}
                onColorChange={(idx, hex) =>
                  updateLabel(idx, { colorKey: hex, displayHex: hex }, true)
                }
                onNameChange={(idx, name) => updateLabel(idx, { shortName: name })}
                onNameCommit={persistCustomState}
                onAdd={addLabel}
                onRemove={removeLabel}
              />
            </div>

            <div>
              <span className="text-[10px] uppercase tracking-[0.08em] text-white/40">
                Catch-all
              </span>
              {uncategorizedEnabled ? (
                <div className="mt-2 flex items-center gap-2.5 rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.02] px-3.5 py-2.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: UNCATEGORIZED_HEX }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-white/75">Uncategorized</span>
                    <p className="text-[11px] text-white/40">
                      Mail that matches no other label gets tagged here instead of going unlabeled.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleUncategorized(false)}
                    disabled={uncategorizedBusy}
                    aria-label="Delete Uncategorized label"
                    className="px-2 text-base leading-none text-white/30 transition-colors hover:text-red-400/70 disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.02] px-3.5 py-2.5">
                  <p className="text-[11px] text-white/40">
                    Unmatched mail stays unlabeled.
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleUncategorized(true)}
                    disabled={uncategorizedBusy}
                    className="shrink-0 text-[11px] text-white/50 transition-colors hover:text-white/80 disabled:opacity-30"
                  >
                    + Add Uncategorized
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="primary" onClick={applyToGmail} disabled={applying}>
                {applying ? "Provisioning…" : "Sync to Gmail"}
              </Button>
              <p className="text-[11px] text-white/40">
                Provisions the preset's labels in your Gmail and starts classifying new mail.
              </p>
            </div>
            {errorMessage && (
              <p className="text-[11px] text-red-300">{errorMessage}</p>
            )}
            {backfillStatus && (
              <p className="text-[11px] text-brand-200">{backfillStatus}</p>
            )}

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
        description="Dharma will stop classifying new mail. Existing Gmail labels stay in place, and you can re-enable anytime."
        confirmLabel="Pause"
        onConfirm={confirmPause}
        onCancel={() => setConfirmingOff(false)}
      />
    </>
  );
}
