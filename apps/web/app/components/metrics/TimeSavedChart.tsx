"use client";

import { useEffect, useMemo, useState } from "react";
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

type Milestone = { date: string; title: string };

type Props = {
  days?: number;
  milestones?: Milestone[];
};

export default function TimeSavedChart({ days = 30, milestones = [] }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <Skeleton className="h-60" />;

  const points = data?.points ?? [];
  const milestoneMap = new Map(milestones.map((m) => [m.date, m.title]));

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
        </div>

        <svg
          viewBox="0 0 600 160"
          preserveAspectRatio="none"
          className="h-40 w-full"
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
              {points.map((p, i) => {
                const title = milestoneMap.get(p.date);
                if (!title) return null;
                const x = (i / Math.max(points.length - 1, 1)) * 600;
                const y =
                  160 - (peak === 0 ? 0 : (p.secondsSaved / peak) * 130) - 10;
                return (
                  <g key={p.date}>
                    <circle cx={x} cy={y} r="4" fill="#1D9E75" />
                    <text
                      x={x}
                      y={y - 10}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#AFA9EC"
                    >
                      {title}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </svg>
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
  const stepX = 600 / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: 160 - (p.secondsSaved / peak) * 130 - 10,
  }));
  const line = coords
    .map((c, i) => (i === 0 ? `M${c.x} ${c.y}` : `L${c.x} ${c.y}`))
    .join(" ");
  const area = `${line} L${coords[coords.length - 1].x} 160 L0 160 Z`;
  return { line, area };
}
