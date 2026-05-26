import { ReactNode } from "react";

type Tone = "active" | "muted" | "warn";

const DOT: Record<Tone, string> = {
  active: "bg-[color:var(--label-2)]",
  muted: "bg-white/30",
  warn: "bg-[color:var(--label-4)]",
};

type Props = {
  tone?: Tone;
  children: ReactNode;
};

export default function StatusPill({ tone = "active", children }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-subtle)] bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}
