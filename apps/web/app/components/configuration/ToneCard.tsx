"use client";

import { useState } from "react";
import Card from "../ui/Card";
import StatusPill from "../ui/StatusPill";
import IconTile from "../ui/IconTile";
import Button from "../ui/Button";
import Toggle from "../ui/Toggle";
import ConfirmModal from "../ui/ConfirmModal";
import {
  SAMPLE_SCENARIOS,
  defaultScenarioIndex,
} from "../../../lib/sampleScenarios";

const TONE_OPTIONS = ["My Tone", "Concise", "Formal / Legal", "Scheduling"];

const TONE_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M2 5v6M5 7v4M8 3v10M11 6v6M14 8v3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

type Props = {
  initial: {
    tone: string;
    toneProfile: string | null;
    toneSummary: string | null;
    toneExample: string | null;
    inferredSignOff: string | null;
  };
};

export default function ToneCard({ initial }: Props) {
  const [enabled, setEnabled] = useState(!!initial.tone);
  const [confirmingOff, setConfirmingOff] = useState(false);
  const [tone, setTone] = useState(initial.tone || "Concise");
  const [signOff, setSignOff] = useState(initial.inferredSignOff ?? "");
  const [summary, setSummary] = useState(
    initial.toneSummary ?? initial.toneProfile ?? "",
  );
  const [editingSummary, setEditingSummary] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [scenarioIdx, setScenarioIdx] = useState(defaultScenarioIndex());
  const [draft, setDraft] = useState<string | null>(initial.toneExample);
  const [regenerating, setRegenerating] = useState(false);

  const scenario = SAMPLE_SCENARIOS[scenarioIdx];

  async function updateTone(next: string) {
    setTone(next);
    await fetch("/api/preferences/tone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tone: next }),
    });
  }

  async function saveSummary() {
    setEditingSummary(false);
    await fetch("/api/preferences/tone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toneSummary: summary }),
    });
  }

  async function saveSignOff(next: string) {
    await fetch("/api/preferences/tone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inferredSignOff: next }),
    });
  }

  async function retrain() {
    setRetraining(true);
    try {
      const res = await fetch("/api/preferences/tone/sync", { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as {
          summary?: string;
          example?: string;
          signOff?: string;
        };
        if (data.summary) setSummary(data.summary);
        if (data.example) setDraft(data.example);
        if (data.signOff) setSignOff(data.signOff);
      }
    } finally {
      setRetraining(false);
    }
  }

  async function regenerate() {
    const next = (scenarioIdx + 1) % SAMPLE_SCENARIOS.length;
    setScenarioIdx(next);
    setRegenerating(true);
    try {
      const res = await fetch("/api/preferences/tone/sample", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId: SAMPLE_SCENARIOS[next].id }),
      });
      if (res.ok) {
        const data = (await res.json()) as { draft?: string };
        if (data.draft) setDraft(data.draft);
      }
    } finally {
      setRegenerating(false);
    }
  }

  function onToggle(next: boolean) {
    if (!next) {
      setConfirmingOff(true);
      return;
    }
    setEnabled(true);
    updateTone(tone || "Concise");
  }

  async function confirmPause() {
    setEnabled(false);
    setConfirmingOff(false);
    await fetch("/api/preferences/tone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tone: "" }),
    });
  }

  return (
    <>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconTile>
              <span className="text-brand-200">{TONE_ICON}</span>
            </IconTile>
            <div>
              <h3 className="font-display text-lg text-white">Tone</h3>
              <div className="mt-1">
                <StatusPill tone={enabled ? "active" : "muted"}>
                  {enabled
                    ? summary
                      ? "Active · trained on your sent mail"
                      : "Active · using preset"
                    : "Paused"}
                </StatusPill>
              </div>
            </div>
          </div>
          <Toggle checked={enabled} onChange={onToggle} aria-label="Toggle Tone" />
        </div>

        {enabled && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <label className="flex-1">
                <span className="text-[10px] uppercase tracking-[0.08em] text-white/40">
                  Active mode
                </span>
                <select
                  value={tone}
                  onChange={(e) => updateTone(e.target.value)}
                  className="mt-1 w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-3 py-2 text-sm text-white"
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex-1">
                <span className="text-[10px] uppercase tracking-[0.08em] text-white/40">
                  Sign-off
                </span>
                <input
                  type="text"
                  value={signOff}
                  onChange={(e) => setSignOff(e.target.value)}
                  onBlur={() => saveSignOff(signOff)}
                  placeholder="Thanks,"
                  className="mt-1 w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/30"
                />
              </label>
            </div>

            <Card variant="elevated">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
                  Your voice, summarized
                </span>
                {!editingSummary && summary && (
                  <button
                    onClick={() => setEditingSummary(true)}
                    className="text-[11px] text-white/40 hover:text-white/70"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingSummary ? (
                <div className="space-y-2">
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="w-full resize-none rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.04] p-2 text-sm text-white"
                    rows={3}
                  />
                  <Button size="sm" variant="primary" onClick={saveSummary}>
                    Save
                  </Button>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-white/80">
                  {summary || "Retrain on recent emails to learn your voice."}
                </p>
              )}
            </Card>

            <Card variant="elevated">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
                  Sample draft · re: {scenario.label.toLowerCase()}
                </span>
                <button
                  onClick={regenerate}
                  disabled={regenerating}
                  className="text-[11px] text-white/40 hover:text-white/70 disabled:opacity-40"
                >
                  {regenerating ? "Generating…" : "Regenerate"}
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/80">
                {draft || "Regenerate to see a sample in your tone."}
              </pre>
            </Card>

            <div className="flex gap-2 pt-1">
              <Button variant="primary" onClick={retrain} disabled={retraining}>
                {retraining ? "Retraining…" : "Retrain on recent emails"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ConfirmModal
        open={confirmingOff}
        title="Pause Tone?"
        description="Drafts will fall back to a neutral default style. You can re-enable anytime."
        confirmLabel="Pause"
        onConfirm={confirmPause}
        onCancel={() => setConfirmingOff(false)}
      />
    </>
  );
}
