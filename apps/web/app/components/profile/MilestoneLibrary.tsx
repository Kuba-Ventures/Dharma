"use client";

import { useState } from "react";
import { applyTemplate, type Milestone } from "../../../lib/milestones";
import ShareCardButton from "./ShareCardButton";

type Props = {
  secondsSaved: number;
  homeCity: string | null;
  firstName: string | null;
  tier: string;
  milestones: Milestone[];
};

const COLLAPSED_LIMIT = 5;

function formatSeconds(s: number): string {
  if (s < 3600) return `${Math.round(s / 60)}m`;
  const hours = Math.floor(s / 3600);
  const mins = Math.round((s % 3600) / 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

export default function MilestoneLibrary({
  secondsSaved,
  homeCity,
  firstName,
  tier,
  milestones,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const unlocked = milestones
    .filter((m) => {
      if (secondsSaved < m.threshold) return false;
      if (m.requiredCity && m.requiredCity !== homeCity) return false;
      return true;
    })
    .sort((a, b) => b.threshold - a.threshold); // most impressive first

  const locked = milestones
    .filter((m) => {
      if (secondsSaved >= m.threshold) return false;
      if (m.requiredCity && m.requiredCity !== homeCity) return false;
      return true;
    })
    .sort((a, b) => a.threshold - b.threshold); // nearest first

  // Unlocked first, then locked. Cap to COLLAPSED_LIMIT unless expanded.
  const ordered = [...unlocked, ...locked];
  const visible = expanded ? ordered : ordered.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = ordered.length - visible.length;
  const unlockedSet = new Set(unlocked.map((m) => m.id));

  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Milestones
        </p>
        <p className="text-[11px] text-white/40">
          {unlocked.length} unlocked · {locked.length} to go
        </p>
      </div>

      {!homeCity && (
        <p className="mb-4 rounded-btn border border-[color:var(--border-brand)] bg-brand-400/8 px-3 py-2 text-[12px] text-white/70">
          Set your home city above to unlock local landmarks.
        </p>
      )}

      <div className="space-y-2">
        {visible.map((m) =>
          unlockedSet.has(m.id) ? (
            <div
              key={m.id}
              className="rounded-card border border-[color:var(--border-subtle)] p-3"
              style={{ background: m.gradient }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-white">
                  {applyTemplate(m.title, { firstName, city: homeCity })}
                </p>
                <ShareCardButton
                  milestoneId={m.id}
                  firstName={firstName}
                  city={homeCity}
                  tier={tier}
                  secondsSaved={secondsSaved}
                />
              </div>
              <p className="mt-1 text-[12px] text-white/70">
                {applyTemplate(m.description, { firstName, city: homeCity })}
              </p>
            </div>
          ) : (
            <div
              key={m.id}
              className="rounded-card border border-dashed border-[color:var(--border-subtle)] bg-white/[0.02] p-3"
            >
              <p className="text-sm text-white/50">
                {applyTemplate(m.title, { firstName, city: homeCity })}
              </p>
              <p className="mt-1 text-[12px] text-white/40">
                {formatSeconds(Math.max(m.threshold - secondsSaved, 0))} to go
              </p>
            </div>
          ),
        )}
      </div>

      {ordered.length > COLLAPSED_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.02] py-1.5 text-[12px] text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
        >
          {expanded ? "Show fewer" : `See all ${ordered.length} milestones`}
          {!expanded && hiddenCount > 0 && (
            <span className="ml-1 text-white/30">+{hiddenCount}</span>
          )}
        </button>
      )}
    </div>
  );
}
