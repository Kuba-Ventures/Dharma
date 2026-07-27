"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DismissibleCard from "../ui/DismissibleCard";
import Skeleton from "../ui/Skeleton";

type Point = {
  date: string;
  draftCount: number;
  tagCount: number;
  secondsSaved: number;
};

type Payload = {
  days: number;
  points: Point[];
  totalSecondsSaved: number;
};

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// Day buckets are keyed "YYYY-MM-DD"; format in UTC so the label doesn't
// slip a day in negative-offset timezones.
function formatDate(dateStr: string): string {
  const iso = dateStr.length <= 10 ? `${dateStr}T00:00:00Z` : dateStr;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

type Props = {
  days?: number;
};

// SVG viewBox geometry (shared by the path builder and the overlay so the
// crosshair dot lands exactly on the line).
const VB_W = 600;
const VB_H = 160;
const TOP_PAD = 10;
const PLOT_H = 130;

function yFracFor(secondsSaved: number, peak: number): number {
  const yView = peak === 0 ? VB_H - TOP_PAD : VB_H - (secondsSaved / peak) * PLOT_H - TOP_PAD;
  return yView / VB_H;
}

export default function TimeSavedChart({ days = 30 }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/metrics/timeseries?days=${days}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Payload | null) => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [days]);

  const path = useMemo(() => buildAreaPath(data?.points ?? []), [data]);
  const peak = useMemo(
    () =>
      (data?.points ?? []).reduce(
        (m, p) => Math.max(m, p.secondsSaved),
        0,
      ),
    [data],
  );

  const points = data?.points ?? [];
  const n = points.length;

  // Up to 6 evenly spaced date ticks across the x-axis.
  const axisTicks = useMemo(() => {
    if (n === 0) return [] as number[];
    const count = Math.min(6, n);
    const idxs = Array.from({ length: count }, (_, k) =>
      Math.round((k / Math.max(count - 1, 1)) * (n - 1)),
    );
    return [...new Set(idxs)];
  }, [n]);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (n === 0 || !plotRef.current) return;
    const rect = plotRef.current.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(Math.min(1, Math.max(0, frac)) * (n - 1));
    setHover(idx);
  }

  if (loading) return <Skeleton className="h-60" />;

  const xFrac = (i: number) => (n <= 1 ? 0 : i / (n - 1));
  const active = hover != null && points[hover] ? points[hover] : null;
  // Keep the tooltip box inside the plot horizontally.
  const tipLeft = hover != null ? Math.min(88, Math.max(12, xFrac(hover) * 100)) : 0;

  return (
    <DismissibleCard dismissId="metrics-timesaved-chart">
      <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
              Time saved · last {days} days
            </p>
            <p className="mt-1 font-display text-2xl text-white">
              {formatDuration(data?.totalSecondsSaved ?? 0)}
            </p>
          </div>
          {active && (
            <div className="text-right">
              <p className="text-[11px] text-white/45">{formatDate(active.date)}</p>
              <p className="font-display text-base text-white">
                {formatDuration(active.secondsSaved)}
              </p>
            </div>
          )}
        </div>

        <div
          ref={plotRef}
          className="relative h-40 w-full"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label={`Time saved trend for the last ${days} days`}
          >
            <defs>
              <linearGradient id="timesaved-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#7F77DD" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#7F77DD" stopOpacity="0" />
              </linearGradient>
            </defs>
            {path && (
              <>
                <path d={path.area} fill="url(#timesaved-fill)" />
                <path
                  d={path.line}
                  fill="none"
                  stroke="#AFA9EC"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </>
            )}
          </svg>

          {/* Hover crosshair + dot (HTML overlay so it isn't distorted by the
              non-uniform SVG scaling). */}
          {active && peak > 0 && (
            <>
              <div
                className="pointer-events-none absolute bottom-0 top-0 w-px bg-white/20"
                style={{ left: `${xFrac(hover!) * 100}%` }}
              />
              <div
                className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#AFA9EC] ring-4 ring-[#AFA9EC]/20"
                style={{
                  left: `${xFrac(hover!) * 100}%`,
                  top: `${yFracFor(active.secondsSaved, peak) * 100}%`,
                }}
              />
              <div
                className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#0c0c16] px-2 py-1 text-[10px] shadow-lg"
                style={{ left: `${tipLeft}%` }}
              >
                <div className="text-white/90">{formatDate(active.date)}</div>
                <div className="text-brand-200">
                  {formatDuration(active.secondsSaved)} saved
                </div>
                <div className="text-white/40">
                  {active.draftCount} draft{active.draftCount === 1 ? "" : "s"} ·{" "}
                  {active.tagCount} tagged
                </div>
              </div>
            </>
          )}
        </div>

        {/* Date axis */}
        {n > 0 && (
          <div className="relative mt-2 h-4">
            {axisTicks.map((i) => {
              const transform =
                i === 0
                  ? "translateX(0)"
                  : i === n - 1
                    ? "translateX(-100%)"
                    : "translateX(-50%)";
              return (
                <span
                  key={i}
                  className="absolute text-[10px] text-white/35"
                  style={{ left: `${xFrac(i) * 100}%`, transform }}
                >
                  {formatDate(points[i].date)}
                </span>
              );
            })}
          </div>
        )}

        {peak === 0 && (
          <p className="mt-2 text-center text-[11px] text-white/40">
            No activity yet. Drafts and tags will populate this curve.
          </p>
        )}
      </div>
    </DismissibleCard>
  );
}

function buildAreaPath(points: Point[]): { line: string; area: string } | null {
  if (points.length === 0) return null;
  const peak = points.reduce((m, p) => Math.max(m, p.secondsSaved), 0);
  if (peak === 0) {
    return { line: "M0 150 L600 150", area: "M0 150 L600 150 L600 160 L0 160 Z" };
  }
  const stepX = VB_W / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: yFracFor(p.secondsSaved, peak) * VB_H,
  }));
  const line = coords
    .map((c, i) => (i === 0 ? `M${c.x} ${c.y}` : `L${c.x} ${c.y}`))
    .join(" ");
  const area = `${line} L${coords[coords.length - 1].x} 160 L0 160 Z`;
  return { line, area };
}
