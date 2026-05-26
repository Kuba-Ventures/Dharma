import { ReactNode } from "react";
import DismissibleCard from "../ui/DismissibleCard";

type Props = {
  dismissId: string;
  label: string;
  value: string;
  sub?: ReactNode;
};

export default function MetricTile({ dismissId, label, value, sub }: Props) {
  return (
    <DismissibleCard dismissId={dismissId}>
      <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.08em] text-white/40">
          {label}
        </p>
        <p className="mt-1 font-display text-2xl text-white">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-white/40">{sub}</p>}
      </div>
    </DismissibleCard>
  );
}
