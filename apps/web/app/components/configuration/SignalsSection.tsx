"use client";

import { useState } from "react";
import Card from "../ui/Card";
import StatusPill from "../ui/StatusPill";
import IconTile from "../ui/IconTile";
import Toggle from "../ui/Toggle";

const SIGNAL_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M8 1l1.8 5L15 8l-5.2 2L8 15l-1.8-5L1 8l5.2-2L8 1z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

// Illustrative signals shown while detection is still rolling out. These are
// fixed examples (not the viewer's mail) so every account sees the same
// preview of what the surface will look like once producers are live.
const EXAMPLE_SIGNALS: {
  kindLabel: string;
  chipClass: string;
  title: string;
  subject: string;
  from: string;
  whyItMatters: string;
  evidence: string;
}[] = [
  {
    kindLabel: "Buried intent",
    chipClass: "bg-violet-500/15 text-violet-200 border-violet-500/30",
    title: "A founder update that's really a soft raise",
    subject: "Q2 numbers + a few updates",
    from: "Founder <founder@example.com>",
    whyItMatters:
      "Traction is up and to the right and they're name-dropping new hires. The subtext is a round is coming; a warm reply now beats a cold pitch later.",
    evidence:
      "\"We're seeing strong pull and starting to think about what's next on the team side.\"",
  },
  {
    kindLabel: "Cold thread",
    chipClass: "bg-slate-500/15 text-slate-200 border-slate-500/30",
    title: "An overdue reply that's about to go stale",
    subject: "Re: intro to the Anderson team",
    from: "Counsel <counsel@example.com>",
    whyItMatters:
      "You said you'd loop back after the call. It's been nine days and the other side is waiting, which quietly stalls the intro.",
    evidence:
      "\"No rush, but let me know once you've had a chance to connect with them.\"",
  },
  {
    kindLabel: "Buried intent",
    chipClass: "bg-violet-500/15 text-violet-200 border-violet-500/30",
    title: "An ask hidden inside a thank-you note",
    subject: "Thanks again for yesterday",
    from: "LP <lp@example.com>",
    whyItMatters:
      "Reads like a courtesy note, but the last line is a real request to be introduced to one of your portfolio companies.",
    evidence:
      "\"Would love to hear more about how the Helix team is thinking about distribution.\"",
  },
];

export default function SignalsSection({ enabled: initialEnabled }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [hero, ...rest] = EXAMPLE_SIGNALS;

  async function onToggle(next: boolean) {
    setPending(true);
    const prev = enabled;
    setEnabled(next);
    try {
      const res = await fetch("/api/preferences/signal-detection", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) setEnabled(prev);
    } catch {
      setEnabled(prev);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card variant="bare">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconTile tone="brand">
            <span className="text-brand-200">{SIGNAL_ICON}</span>
          </IconTile>
          <div>
            <h3 className="font-display text-lg text-white">Signals</h3>
            <div className="mt-1">
              <StatusPill tone={enabled ? "active" : "muted"}>
                {enabled ? "Active · Haiku pass per thread" : "Off"}
              </StatusPill>
            </div>
          </div>
        </div>
        <Toggle
          checked={enabled}
          onChange={onToggle}
          disabled={pending}
          aria-label="Toggle signal detection"
        />
      </div>

      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-white/60">
          Latent intent your inbox would otherwise bury, kept separate from
          rule-based labels. Surfaces emails worth your attention (buried intent
          and cold threads) in the Signals tab. Costs ≈ $0.001 per classified
          thread and is capped daily per user.
        </p>

        {/* Featured example — one vivid signal, fully rendered, so the value
            of the feature is obvious before it's even live. */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${hero.chipClass}`}
            >
              {hero.kindLabel}
            </span>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/40">
              Example
            </span>
          </div>
          <div className="overflow-hidden rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card-elevated)]">
            <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
              <p className="text-sm font-medium text-white">{hero.title}</p>
            </div>
            <div className="p-4">
              <p className="text-[12px] text-white/55">{hero.subject}</p>
              <p className="mt-0.5 text-[11px] text-white/45">{hero.from}</p>
              <p className="mt-3 rounded-card border border-brand-400/25 bg-brand-400/10 px-3 py-2.5 text-[13px] leading-relaxed text-white/85">
                {hero.whyItMatters}
              </p>
              <p className="mt-3 border-l-2 border-white/15 pl-3 text-[12px] italic text-white/50">
                {hero.evidence}
              </p>
            </div>
          </div>
        </div>

        {/* Remaining examples in an even two-up grid. */}
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.08em] text-white/40">
            More examples
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rest.map((s) => (
              <div
                key={s.title}
                className="rounded-card border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--bg-card-elevated)] p-3 opacity-90"
              >
                <div className="mb-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${s.chipClass}`}
                  >
                    {s.kindLabel}
                  </span>
                </div>
                <p className="text-[13px] font-medium text-white">{s.title}</p>
                <p className="text-[11px] text-white/50">{s.subject}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="rounded-card border border-[color:var(--border-brand)] bg-brand-400/8 px-4 py-2 text-[12px] text-white/70">
          Signal surfacing is still rolling out — these are examples, not your
          mail.
        </p>
      </div>
    </Card>
  );
}
