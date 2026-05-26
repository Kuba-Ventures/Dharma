"use client";

import { useEffect, useState } from "react";
import Skeleton from "../ui/Skeleton";

type Item = {
  id: string;
  title: string;
  achievedAt: string;
  gradient: string;
};

export default function MilestoneTimelineStrip() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    // The full /api/milestones endpoint lands in commit 7 alongside the
    // milestone seed. Until then the strip stays empty.
    fetch("/api/milestones/list")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items: Item[] } | null) => setItems(d?.items ?? []))
      .catch(() => setItems([]));
  }, []);

  if (items === null) return <Skeleton className="h-24" />;

  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
      <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-brand-200">
        Milestones
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-white/40">
          Your milestones unlock as you save time. Check back as you use Dharma
          — the first one is just around the corner.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {items.map((it) => (
            <div
              key={it.id}
              className="min-w-[180px] rounded-card border border-[color:var(--border-subtle)] px-3 py-2"
              style={{ background: it.gradient }}
            >
              <p className="font-display text-sm text-white">{it.title}</p>
              <p className="mt-1 text-[10px] text-white/60">
                {new Date(it.achievedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
