import { ReactNode } from "react";

type Props = {
  step: number;
  total: number;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export default function StepShell({
  step,
  total,
  eyebrow,
  title,
  description,
  children,
}: Props) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${
              // Fill the current step and everything before it, so the final
              // step reads as complete (all bars solid) instead of leaving the
              // last segment faint. The current step gets a subtle ring.
              i < step
                ? "bg-brand-400"
                : i === step
                  ? "bg-brand-400 ring-1 ring-brand-200/40"
                  : "bg-white/[0.08]"
            }`}
          />
        ))}
      </div>
      <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-brand-200">
        {eyebrow} · Step {step + 1} of {total}
      </p>
      <h1 className="font-display text-3xl text-white">{title}</h1>
      {description && (
        <p className="mt-2 text-sm text-white/60">{description}</p>
      )}
      <div className="mt-6">{children}</div>
    </div>
  );
}
