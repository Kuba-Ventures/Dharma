"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import LabelEditor, { type LabelEditorRow } from "../../components/configuration/LabelEditor";
import { GMAIL_COLOR_ROWS } from "../../../lib/gmailPalette";

type Props = {
  initialTone: { summary: string | null; example: string | null };
  presetKey: string;
  customName: string | null;
  initialRows: LabelEditorRow[];
};

type ToneStatus = "idle" | "training" | "done" | "error";
type SubmitPhase = "idle" | "provisioning" | "labeling";

export default function PersonalizeForm({
  initialTone,
  presetKey,
  customName,
  initialRows,
}: Props) {
  const router = useRouter();

  // Tone (sync was kicked at the quiz; show the result, allow a re-train).
  const [toneStatus, setToneStatus] = useState<ToneStatus>(
    initialTone.summary ? "done" : "idle",
  );
  const [summary, setSummary] = useState(initialTone.summary);
  const [example, setExample] = useState(initialTone.example);
  const [toneError, setToneError] = useState<string | null>(null);

  // Labels.
  const [rows, setRows] = useState<LabelEditorRow[]>(initialRows);

  // Submit / provision + back-scan gate.
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const edited =
    presetKey === "Custom" || JSON.stringify(rows) !== JSON.stringify(initialRows);
  const busy = phase !== "idle";

  async function trainTone() {
    setToneStatus("training");
    setToneError(null);
    try {
      const res = await fetch("/api/preferences/tone/sync", { method: "POST" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Couldn't read your sent mail.");
      }
      const data = (await res.json()) as { summary?: string; example?: string };
      if (data.summary) setSummary(data.summary);
      if (data.example) setExample(data.example);
      setToneStatus("done");
    } catch (e) {
      setToneError(e instanceof Error ? e.message : "Training failed");
      setToneStatus("error");
    }
  }

  function updateRow(idx: number, patch: Partial<LabelEditorRow>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addRow() {
    const row = GMAIL_COLOR_ROWS[0];
    setRows((rs) => [...rs, { shortName: "", colorKey: row[rs.length % row.length] }]);
  }
  function removeRow(idx: number) {
    setRows((rs) => (rs.length <= 1 ? rs : rs.filter((_, i) => i !== idx)));
  }

  async function post(url: string, body: unknown): Promise<Response> {
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function submit() {
    if (busy) return;
    setError(null);

    const cleaned = rows
      .map((r) => ({ ...r, shortName: r.shortName.trim() }))
      .filter((r) => r.shortName);
    if (edited && cleaned.length === 0) {
      setError("Keep at least one label.");
      return;
    }

    // provision persists the LabelPreset (enabled) itself, so no separate
    // preset write is needed. Edited (or already-Custom) → Custom payload;
    // otherwise provision the derived built-in preset.
    const provisionBody = edited
      ? { preset: "Custom", customName: customName ?? "", customLabels: cleaned }
      : { preset: presetKey };

    setPhase("provisioning");
    try {
      const provRes = await post("/api/labels/provision", provisionBody);
      if (!provRes.ok) {
        const err = (await provRes.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? "Couldn't create your labels in Gmail.");
        setPhase("idle");
        return;
      }
    } catch {
      setError("Couldn't reach Gmail. Try again.");
      setPhase("idle");
      return;
    }

    // Synchronous 25-thread back-scan: gate the redirect on it so the inbox is
    // already labeled on arrival. A backfill failure is non-fatal — labels
    // still apply to new mail — so we proceed either way.
    setPhase("labeling");
    try {
      await post("/api/labels/back-scan", {});
    } catch {
      // Non-fatal; continue.
    }

    await post("/api/onboarding/advance", { step: 3 });
    router.push("/onboarding/step-4-inbox");
  }

  return (
    <div className="space-y-4">
      <Card variant="elevated">
        <p className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
          Your voice
        </p>
        {toneStatus === "done" && summary ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-white">{summary}</p>
            {example && (
              <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.04] p-3 font-sans text-[12px] text-white/70">
                {example}
              </pre>
            )}
            <button
              type="button"
              onClick={trainTone}
              className="mt-2 text-[11px] text-white/40 transition-colors hover:text-white/70"
            >
              Re-learn from my sent mail
            </button>
          </>
        ) : toneStatus === "training" ? (
          <div className="mt-2">
            <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-400" />
            </div>
            <p className="text-sm text-white/70">Reading your sent mail…</p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-white/70">
              {toneError ?? "We'll learn your writing style from your sent mail."}
            </p>
            <Button variant="secondary" onClick={trainTone} className="mt-3">
              {toneStatus === "error" ? "Try again" : "Learn my voice"}
            </Button>
          </>
        )}
      </Card>

      <Card variant="elevated">
        <p className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
          Your labels
        </p>
        <p className="mt-1 text-[11px] text-white/40">
          Picked for your role. Rename, recolor, add or remove any.
        </p>
        <LabelEditor
          rows={rows}
          onColorChange={(idx, hex) => updateRow(idx, { colorKey: hex })}
          onNameChange={(idx, name) => updateRow(idx, { shortName: name })}
          onAdd={addRow}
          onRemove={removeRow}
        />
      </Card>

      {error && <p className="text-[11px] text-red-300">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        {busy && (
          <span className="text-[11px] text-brand-200">
            {phase === "provisioning"
              ? "Creating your labels…"
              : "Labeling your inbox…"}
          </span>
        )}
        <Button variant="primary" onClick={submit} disabled={busy}>
          {busy ? "Setting up…" : "Sort my inbox"}
        </Button>
      </div>
    </div>
  );
}
