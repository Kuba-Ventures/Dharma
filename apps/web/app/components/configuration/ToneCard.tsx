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

// The `key` strings are persisted in User.tone and used as keys in the
// TONE_INSTRUCTIONS switches inside the draft routes. Don't rename them —
// UI-label tweaks go in the `label` field below, not in `key`.
const TONE_CARDS: Array<{ key: string; label: string; description: string }> = [
  {
    key: "My Tone",
    label: "My tone",
    description: "Mirror how you actually write. Trained on your sent mail.",
  },
  {
    key: "Concise",
    label: "Concise",
    description: "2-4 sentences. No filler. Get to the point.",
  },
  {
    key: "Formal / Legal",
    label: "Formal / legal",
    description: "Precise, formal language. No contractions.",
  },
  {
    key: "Scheduling",
    label: "Scheduling",
    description: "Calendar-aware replies with concrete time slots.",
  },
];

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
    // Regenerate the sample so what's shown reflects the just-selected tone.
    // Keeps the current scenario so the user can compare tones on the same
    // prompt; advance scenarios only via the explicit Regenerate button.
    setRegenerating(true);
    try {
      const res = await fetch("/api/preferences/tone/sample", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId: SAMPLE_SCENARIOS[scenarioIdx].id }),
      });
      if (res.ok) {
        const data = (await res.json()) as { draft?: string };
        if (data.draft) setDraft(data.draft);
      }
    } finally {
      setRegenerating(false);
    }
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
          <div className="flex items-center gap-2">
            <ResyncButton
              busy={retraining}
              onClick={retrain}
              label="Resync mail"
              busyLabel="Retraining…"
              title="Re-read your sent mail to update your tone summary"
            />
            <Toggle checked={enabled} onChange={onToggle} aria-label="Toggle tone" />
          </div>
        </div>

        {enabled && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
            <div>
              <span className="text-[10px] uppercase tracking-[0.08em] text-white/40">
                Active mode
              </span>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TONE_CARDS.map((opt) => {
                  const active = tone === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => updateTone(opt.key)}
                      className={`rounded-card border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "border-[color:var(--border-brand)] bg-brand-400/12"
                          : "border-[color:var(--border-subtle)] bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                    >
                      <div
                        className={`text-sm ${active ? "text-brand-100" : "text-white/85"}`}
                      >
                        {opt.label}
                      </div>
                      <div className="mt-0.5 text-[11px] text-white/45">
                        {opt.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block">
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

            {(() => {
              const isMyTone = tone === "My Tone";
              const activeCard = TONE_CARDS.find((c) => c.key === tone);
              const eyebrow = isMyTone
                ? "Your voice, summarized"
                : `${activeCard?.label ?? tone} mode`;
              const body = isMyTone
                ? summary || "Retrain on recent emails to learn your voice."
                : activeCard?.description ?? "";
              return (
                <Card variant="elevated">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.08em] text-brand-200">
                      {eyebrow}
                    </span>
                    {isMyTone && !editingSummary && summary && (
                      <button
                        onClick={() => setEditingSummary(true)}
                        className="text-[11px] text-white/40 hover:text-white/70"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {isMyTone && editingSummary ? (
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
                    <p className="text-sm leading-relaxed text-white/80">{body}</p>
                  )}
                </Card>
              );
            })()}
              </div>

              <div>
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
              </div>
            </div>

            <p className="rounded-card border border-[color:var(--border-brand)] bg-brand-400/8 px-4 py-2 text-[12px] text-white/70">
              Dharma reads only your sent mail to learn your voice. Nothing is
              stored beyond the summary; nothing is shared.
            </p>
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

function ResyncButton({
  busy,
  onClick,
  label,
  busyLabel,
  title,
}: {
  busy: boolean;
  onClick: () => void;
  label: string;
  busyLabel: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={title}
      className="flex items-center gap-1.5 rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.05] px-2.5 py-1 text-xs text-white/75 transition-colors hover:bg-white/[0.09] disabled:opacity-60"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 14 14"
        fill="none"
        className={busy ? "animate-spin" : ""}
      >
        <path
          d="M2 7a5 5 0 0 1 9-3M12 7a5 5 0 0 1-9 3M11 2v3h-3M3 12V9h3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {busy ? busyLabel : label}
    </button>
  );
}
