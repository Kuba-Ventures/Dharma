"use client";

import { useEffect, useState } from "react";
import DismissibleCard from "../ui/DismissibleCard";
import Confetti from "../ui/Confetti";

type Active = {
  id: string;
  milestoneId: string;
  achievedAt: string;
  title: string;
  description: string;
  gradient: string;
};

type Next = {
  id: string;
  title: string;
  description: string;
  threshold: number | null;
  gradient: string;
};

type TierUp = { from: string | null; to: string };

type Payload = {
  active: Active | null;
  next: Next | null;
  cumulativeSecondsSaved: number;
  homeCity: string | null;
  firstName: string | null;
  tier: string;
  tierUp: TierUp | null;
};

const MOUNTAIN_ICON = (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path
      d="M2 18 L8 8 L12 14 L15 10 L20 18 Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.15"
    />
  </svg>
);

function formatHours(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMin = mins % 60;
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`;
}

export default function MilestoneHero() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [confettiActive, setConfettiActive] = useState(false);

  useEffect(() => {
    fetch("/api/milestones/active")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Payload | null) => {
        setData(d);
        if (d?.tierUp) {
          // Fire confetti, then acknowledge so it doesn't repeat on next load.
          setConfettiActive(true);
          fetch("/api/user/ack-tier", { method: "POST" }).catch(() => null);
          setTimeout(() => setConfettiActive(false), 2600);
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        className="h-44 animate-pulse rounded-hero border border-[color:var(--border-brand)]"
        style={{
          background:
            "linear-gradient(135deg, rgba(127,119,221,0.15), rgba(29,158,117,0.08))",
        }}
        aria-hidden="true"
      />
    );
  }

  const active = data?.active ?? null;
  const next = data?.next ?? null;
  const tierUp = data?.tierUp ?? null;

  const tierUpBanner = tierUp ? (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-card border border-[color:var(--border-brand)] bg-brand-400/15 px-4 py-2.5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-brand-200">
          Tier up
        </p>
        <p className="mt-0.5 font-display text-base text-white">
          {tierUp.from ?? "Apprentice"} → {tierUp.to}
        </p>
      </div>
      <span className="text-2xl">🎉</span>
    </div>
  ) : null;

  // First-time / no-milestones state.
  if (!active && !next) {
    return (
      <>
        <Confetti active={confettiActive} />
        <DismissibleCard dismissId="milestone-hero-welcome">
          {tierUpBanner}
          <div
            className="rounded-hero border border-[color:var(--border-brand)] px-6 py-7"
            style={{
              background:
                "linear-gradient(135deg, rgba(127,119,221,0.18), rgba(29,158,117,0.08))",
            }}
          >
            <div className="flex items-center gap-2 text-brand-200">
              {MOUNTAIN_ICON}
              <span className="text-[11px] uppercase tracking-[0.08em]">
                Your first milestone
              </span>
            </div>
            <h2 className="mt-3 font-display text-2xl text-white">
              Keep going. Your first milestone is on the way.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/70">
              As you save time replying and triaging, Dharma will surface
              milestones tied to your home city. Confirm your city in Settings
              to personalize them.
            </p>
          </div>
        </DismissibleCard>
      </>
    );
  }

  if (active) {
    return (
      <>
        <Confetti active={confettiActive} />
        <DismissibleCard dismissId={`milestone-hero-${active.milestoneId}`}>
          {tierUpBanner}
          <div
            className="rounded-hero border border-[color:var(--border-brand)] px-6 py-7"
            style={{ background: active.gradient }}
          >
            <div className="flex items-center gap-2 text-brand-200">
              {MOUNTAIN_ICON}
              <span className="text-[11px] uppercase tracking-[0.08em]">
                This week you saved
              </span>
            </div>
            <h2 className="mt-3 font-display text-2xl text-white">
              {active.title}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/75">
              {active.description}
            </p>
          </div>
        </DismissibleCard>
      </>
    );
  }

  // Has next, not yet achieved.
  const remaining = (next!.threshold ?? 0) - (data?.cumulativeSecondsSaved ?? 0);
  return (
    <>
      <Confetti active={confettiActive} />
      <DismissibleCard dismissId={`milestone-hero-next-${next!.id}`}>
        {tierUpBanner}
        <div
          className="rounded-hero border border-[color:var(--border-brand)] px-6 py-7"
          style={{ background: next!.gradient }}
        >
          <div className="flex items-center gap-2 text-brand-200">
            {MOUNTAIN_ICON}
            <span className="text-[11px] uppercase tracking-[0.08em]">
              Next milestone
            </span>
          </div>
          <h2 className="mt-3 font-display text-2xl text-white">
            {next!.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-white/75">
            {next!.description}
            {remaining > 0 && (
              <span className="text-brand-200">
                {" "}
                {formatHours(remaining)} to go.
              </span>
            )}
          </p>
        </div>
      </DismissibleCard>
    </>
  );
}
