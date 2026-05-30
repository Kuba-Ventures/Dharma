"use client";

import { useState } from "react";

type Props = {
  firstName: string;
};

export default function NpsPrompt({ firstName }: Props) {
  const [hidden, setHidden] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    if (score == null) return;
    setSubmitting(true);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "nps",
        score,
        message: comment.trim() || undefined,
        page: "/dashboard",
      }),
    });
    setSubmitted(true);
    setTimeout(() => setHidden(true), 1800);
  }

  async function dismiss() {
    setHidden(true);
    await fetch("/api/user/nps-postpone", { method: "POST" }).catch(() => null);
  }

  if (hidden) return null;

  if (submitted) {
    return (
      <div className="rounded-card border border-[color:var(--border-brand)] bg-brand-400/10 px-5 py-4">
        <p className="text-sm text-white">
          Thanks, {firstName} — that's helpful. We'll be back in a month.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-[color:var(--border-brand)] bg-brand-400/8 px-5 py-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
            Quick check
          </p>
          <p className="mt-1 text-sm text-white">
            How likely are you to recommend Dharma to a friend or coworker?
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-[11px] text-white/40 transition-colors hover:text-white/70"
        >
          Not now
        </button>
      </div>

      <div className="mb-3 grid grid-cols-11 gap-1.5">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            onClick={() => setScore(i)}
            className={`rounded-btn py-2 text-[12px] font-medium transition-colors ${
              score === i
                ? "bg-brand-400 text-white"
                : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            {i}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-white/30">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>

      {score != null && (
        <div className="mt-4 space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What's the main reason? (optional)"
            rows={2}
            className="w-full resize-none rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.04] p-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
          />
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={submitting}
              className="rounded-btn bg-brand-400 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
