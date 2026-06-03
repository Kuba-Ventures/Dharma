"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BADGES, type Badge, type GroupProgress } from "../../../lib/badges";
import {
  BADGE_COLOR_BG,
  BADGE_ICON_PATHS,
  BASQUIAT_OUTLINE,
  BASQUIAT_YELLOW,
  JEWEL_FILL,
  JEWEL_STROKE,
} from "../../../lib/badgeIcons";
import Modal from "../ui/Modal";
import BadgeProgressRing from "./BadgeProgressRing";

type Props = {
  earnedIds: string[];
  displayBadgeId: string | null;
  groupProgress?: GroupProgress[];
};

const COLLAPSED_LIMIT = 10;

export default function BadgeCase({
  earnedIds,
  displayBadgeId: initialDisplayId,
  groupProgress = [],
}: Props) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [displayBadgeId, setDisplayBadgeId] = useState(initialDisplayId);
  const earnedSet = new Set(earnedIds);
  const earned = BADGES.filter((b) => earnedSet.has(b.id));
  const locked = BADGES.filter((b) => !earnedSet.has(b.id));

  // The next unearned tiered badge in each group gets a progress ring.
  const nextPctById = new Map<string, number>();
  for (const g of groupProgress) {
    if (g.next && g.threshold != null) nextPctById.set(g.next.id, g.pct);
  }

  async function setDisplay(badgeId: string) {
    setDisplayBadgeId(badgeId);
    await fetch("/api/profile/update", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayBadgeId: badgeId }),
    });
    router.refresh();
  }

  const ordered = [...earned, ...locked];
  const visible = ordered.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = ordered.length - visible.length;

  function chipFor(b: Badge) {
    return (
      <BadgeChip
        key={b.id}
        badge={b}
        earned={earnedSet.has(b.id)}
        isDisplay={b.id === displayBadgeId}
        pct={nextPctById.get(b.id)}
        onSetDisplay={
          earnedSet.has(b.id) && b.id !== displayBadgeId
            ? () => setDisplay(b.id)
            : undefined
        }
      />
    );
  }

  return (
    <>
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
          {visible.map(chipFor)}
        </div>

        {ordered.length > COLLAPSED_LIMIT && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-3 w-full rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.02] py-1.5 text-[12px] text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            See all {ordered.length} badges
            {hiddenCount > 0 && (
              <span className="ml-1 text-white/30">+{hiddenCount}</span>
            )}
          </button>
        )}
      </div>

      <Modal open={showAll} onClose={() => setShowAll(false)} size="lg">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="font-display text-xl text-white">All badges</h3>
          <p className="text-[11px] text-white/40">
            {earned.length} earned · {locked.length} locked
          </p>
        </div>
        <div className="grid max-h-[65vh] grid-cols-3 gap-3 overflow-y-auto pr-2 sm:grid-cols-4 md:grid-cols-5">
          {ordered.map(chipFor)}
        </div>
      </Modal>
    </>
  );
}

function BadgeChip({
  badge,
  earned,
  isDisplay,
  pct,
  onSetDisplay,
}: {
  badge: Badge;
  earned: boolean;
  isDisplay: boolean;
  pct?: number;
  onSetDisplay?: () => void;
}) {
  const basquiat = earned && badge.color === "yellow";
  const showRing = !earned && pct !== undefined;
  const pctLabel = showRing ? ` (${Math.round((pct ?? 0) * 100)}%)` : "";
  const icon = badge.iconImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={badge.iconImage}
      alt=""
      width={40}
      height={40}
      className={earned ? "" : "opacity-40 grayscale"}
    />
  ) : (
    <svg width="40" height="40" viewBox="0 0 14 14" fill="none">
      <path
        d={BADGE_ICON_PATHS[badge.icon]}
        stroke={earned ? JEWEL_STROKE[badge.color] : "currentColor"}
        strokeWidth={basquiat ? 1.6 : earned ? 1.3 : 1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={earned ? JEWEL_FILL[badge.color] : "none"}
        fillOpacity={earned ? 1 : 0}
      />
    </svg>
  );
  return (
    <div
      className={`group relative flex flex-col items-center rounded-card border p-4 transition-opacity ${
        earned
          ? BADGE_COLOR_BG[badge.color]
          : showRing
            ? "border-[color:var(--border-subtle)] bg-white/[0.02] text-white/40"
            : "border-dashed border-[color:var(--border-subtle)] bg-white/[0.02] text-white/30 opacity-60"
      } ${isDisplay ? "ring-2 ring-brand-400" : ""}`}
      title={`${badge.title} — ${earned ? "Earned" : "Locked"}${pctLabel}: ${badge.description}`}
    >
      {showRing ? (
        <div className="relative flex h-12 w-12 items-center justify-center">
          <BadgeProgressRing pct={pct ?? 0} color={JEWEL_FILL[badge.color]} size={48} />
          {icon}
        </div>
      ) : (
        icon
      )}
      <p className={`mt-2 text-center text-[11px] ${earned ? "" : "text-white/40"}`}>
        {badge.title}
      </p>
      <p
        className={`mt-0.5 text-center text-[10px] leading-snug ${
          earned ? "text-white/45" : "text-white/30"
        }`}
      >
        {showRing ? `${Math.round((pct ?? 0) * 100)}% there` : badge.description}
      </p>
      {isDisplay && (
        <span className="absolute -top-1.5 -right-1.5 rounded-full bg-brand-400 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">
          On profile
        </span>
      )}
      {onSetDisplay && (
        <button
          type="button"
          onClick={onSetDisplay}
          className="absolute inset-0 flex items-center justify-center rounded-card bg-[color:var(--bg-app)]/85 text-[11px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity hover:opacity-100 focus:opacity-100"
        >
          Display on profile
        </button>
      )}
    </div>
  );
}
