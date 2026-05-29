"use client";

import { useState } from "react";
import { BADGES, type Badge } from "../../../lib/badges";
import {
  BADGE_COLOR_BG,
  BADGE_ICON_PATHS,
  BASQUIAT_OUTLINE,
  BASQUIAT_YELLOW,
} from "../../../lib/badgeIcons";

type Props = {
  earnedIds: string[];
};

const COLLAPSED_LIMIT = 10;

export default function BadgeCase({ earnedIds }: Props) {
  const [expanded, setExpanded] = useState(false);
  const earnedSet = new Set(earnedIds);
  const earned = BADGES.filter((b) => earnedSet.has(b.id));
  const locked = BADGES.filter((b) => !earnedSet.has(b.id));

  // Show earned first, then fill remainder with locked. Cap at COLLAPSED_LIMIT
  // unless expanded.
  const ordered = [...earned, ...locked];
  const visible = expanded ? ordered : ordered.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = ordered.length - visible.length;

  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Badges
        </p>
        <p className="text-[11px] text-white/40">
          {earned.length} earned · {locked.length} locked
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
        {visible.map((b) => (
          <BadgeChip key={b.id} badge={b} earned={earnedSet.has(b.id)} />
        ))}
      </div>

      {ordered.length > COLLAPSED_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.02] py-1.5 text-[12px] text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
        >
          {expanded ? "Show fewer" : `See all ${ordered.length} badges`}
          {!expanded && hiddenCount > 0 && (
            <span className="ml-1 text-white/30">+{hiddenCount}</span>
          )}
        </button>
      )}
    </div>
  );
}

function BadgeChip({ badge, earned }: { badge: Badge; earned: boolean }) {
  return (
    <div
      className={`flex flex-col items-center rounded-card border p-3 transition-opacity ${
        earned
          ? BADGE_COLOR_BG[badge.color]
          : "border-dashed border-[color:var(--border-subtle)] bg-white/[0.02] text-white/30 opacity-60"
      }`}
      title={`${badge.title}: ${badge.description}`}
    >
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
        <path
          d={BADGE_ICON_PATHS[badge.icon]}
          stroke={
            earned && badge.color === "yellow" ? BASQUIAT_OUTLINE : "currentColor"
          }
          strokeWidth={earned && badge.color === "yellow" ? 1.6 : 1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={
            earned && badge.color === "yellow"
              ? BASQUIAT_YELLOW
              : earned
                ? "currentColor"
                : "none"
          }
          fillOpacity={earned && badge.color === "yellow" ? 1 : earned ? 0.2 : 0}
        />
      </svg>
      <p
        className={`mt-2 text-center text-[11px] ${
          earned ? "" : "text-white/40"
        }`}
      >
        {badge.title}
      </p>
    </div>
  );
}
