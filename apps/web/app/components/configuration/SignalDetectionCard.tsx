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

type Props = {
  initial: { enabled: boolean };
};

export default function SignalDetectionCard({ initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [pending, setPending] = useState(false);

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
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconTile tone="brand">
            <span className="text-brand-200">{SIGNAL_ICON}</span>
          </IconTile>
          <div>
            <h3 className="font-display text-lg text-white">Signal detection</h3>
            <div className="mt-1">
              <StatusPill tone={enabled ? "active" : "muted"}>
                {enabled ? "Active · Haiku pass per thread" : "Off"}
              </StatusPill>
            </div>
            <p className="mt-2 max-w-md text-[12px] text-white/55">
              Surfaces emails worth your attention (buried intent and cold
              threads) in the Signals tab. Costs ≈ $0.001 per classified
              thread and is capped daily per user.
            </p>
          </div>
        </div>
        <Toggle
          checked={enabled}
          onChange={onToggle}
          disabled={pending}
          aria-label="Toggle signal detection"
        />
      </div>
    </Card>
  );
}
