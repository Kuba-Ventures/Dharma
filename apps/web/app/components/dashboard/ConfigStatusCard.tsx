import Link from "next/link";
import { ReactNode } from "react";
import IconTile from "../ui/IconTile";

type Props = {
  icon: ReactNode;
  iconTone?: "brand" | "brand-deep" | "brand-deeper";
  title: string;
  status: string;
  // Drives the eyebrow color: the active green when true, muted when the
  // feature is paused. Defaults to active to preserve prior behavior.
  active?: boolean;
  stat: ReactNode;
};

export default function ConfigStatusCard({
  icon,
  iconTone = "brand",
  title,
  status,
  active = true,
  stat,
}: Props) {
  return (
    <Link
      href="/configuration"
      className="flex flex-col rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-4 transition-colors hover:bg-[color:var(--bg-card-elevated)]"
    >
      <div className="mb-3 flex items-center gap-3">
        <IconTile tone={iconTone} size="lg">
          <span className="text-brand-200">{icon}</span>
        </IconTile>
        <div className="flex-1">
          {/* Eyebrow status/category above the title — replaces the old
              gray pill. Color reflects active vs paused state. */}
          <p
            className={`text-[10px] font-medium uppercase tracking-[0.13em] ${
              active ? "text-[color:var(--label-2)]" : "text-white/35"
            }`}
          >
            {status}
          </p>
          <p className="mt-0.5 font-display text-sm text-white">{title}</p>
        </div>
      </div>
      {typeof stat === "string" ? (
        <p className="text-[11px] text-white/50">{stat}</p>
      ) : (
        <div className="flex flex-1 flex-col">{stat}</div>
      )}
    </Link>
  );
}
