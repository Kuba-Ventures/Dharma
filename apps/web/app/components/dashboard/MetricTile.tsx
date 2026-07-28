import { ReactNode } from "react";
import DismissibleCard from "../ui/DismissibleCard";

type Props = {
  dismissId: string;
  label: string;
  value: string;
  sub?: ReactNode;
  // When there's no data to show, render the value as a quieter sentence
  // instead of a big number so an empty tile reads as "pending", not broken.
  muted?: boolean;
};

export default function MetricTile({ dismissId, label, value, sub, muted }: Props) {
  return (
    <DismissibleCard dismissId={dismissId} className="h-full">
      <div className="h-full rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.08em] text-white/40">
          {label}
        </p>
        <p
          className={
            muted
              ? "mt-1 text-sm text-white/50"
              : "mt-1 font-display text-2xl text-white"
          }
        >
          {value}
        </p>
        {sub && <p className="mt-1 text-[11px] text-white/40">{sub}</p>}
      </div>
    </DismissibleCard>
  );
}
