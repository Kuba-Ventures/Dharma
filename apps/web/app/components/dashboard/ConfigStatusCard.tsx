import Link from "next/link";
import { ReactNode } from "react";
import IconTile from "../ui/IconTile";
import StatusPill from "../ui/StatusPill";

type Props = {
  icon: ReactNode;
  iconTone?: "brand" | "brand-deep" | "brand-deeper";
  title: string;
  status: string;
  stat: string;
};

export default function ConfigStatusCard({
  icon,
  iconTone = "brand",
  title,
  status,
  stat,
}: Props) {
  return (
    <Link
      href="/configuration"
      className="block rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-4 transition-colors hover:bg-[color:var(--bg-card-elevated)]"
    >
      <div className="mb-3 flex items-center gap-3">
        <IconTile tone={iconTone} size="lg">
          <span className="text-brand-200">{icon}</span>
        </IconTile>
        <div className="flex-1">
          <p className="font-display text-sm text-white">{title}</p>
          <div className="mt-1">
            <StatusPill tone="active">{status}</StatusPill>
          </div>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="text-white/30"
        >
          <path
            d="M5 3l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-[11px] text-white/50">{stat}</p>
    </Link>
  );
}
