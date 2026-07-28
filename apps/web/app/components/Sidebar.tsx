"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Item = {
  label: string;
  href: string;
  icon: ReactNode;
  lockable?: boolean;
};

type Props = {
  locked?: boolean;
  signalCount?: number;
};

const NAV: Item[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    lockable: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" fillOpacity="0.85" />
        <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" fillOpacity="0.85" />
        <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" fill="currentColor" fillOpacity="0.85" />
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" fill="currentColor" fillOpacity="0.85" />
      </svg>
    ),
  },
  {
    label: "Metrics",
    href: "/metrics",
    lockable: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="7" width="3" height="7" rx="0.75" fill="currentColor" fillOpacity="0.85" />
        <rect x="6" y="4" width="3" height="10" rx="0.75" fill="currentColor" fillOpacity="0.85" />
        <rect x="11" y="1" width="3" height="13" rx="0.75" fill="currentColor" fillOpacity="0.85" />
      </svg>
    ),
  },
  {
    label: "Configuration",
    href: "/configuration",
    lockable: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <line x1="1.5" y1="3.5" x2="13.5" y2="3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
        <circle cx="5" cy="3.5" r="1.6" fill="currentColor" />
        <line x1="1.5" y1="7.5" x2="13.5" y2="7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
        <circle cx="10" cy="7.5" r="1.6" fill="currentColor" />
        <line x1="1.5" y1="11.5" x2="13.5" y2="11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
        <circle cx="6.5" cy="11.5" r="1.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Signals",
    href: "/signals",
    lockable: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="1.6" fill="currentColor" />
        <path d="M4.5 4.5 C3.2 6 3.2 9 4.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.85" />
        <path d="M10.5 4.5 C11.8 6 11.8 9 10.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.85" />
        <path d="M2.5 2.5 C0.5 5 0.5 10 2.5 12.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.45" />
        <path d="M12.5 2.5 C14.5 5 14.5 10 12.5 12.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.45" />
      </svg>
    ),
  },
  {
    label: "Profile & Settings",
    href: "/settings",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="5" r="2.6" fill="currentColor" fillOpacity="0.85" />
        <path
          d="M2.2 13.5 C2.2 10.3 4.7 8.5 7.5 8.5 C10.3 8.5 12.8 10.3 12.8 13.5"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
          opacity="0.85"
        />
      </svg>
    ),
  },
];

const LOCK_ICON = (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <rect x="2" y="5" width="7" height="5" rx="0.7" stroke="currentColor" strokeWidth="1" fill="none" />
    <path d="M3.5 5 V3.5 a2 2 0 0 1 4 0 V5" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
  </svg>
);

export default function Sidebar({ locked, signalCount }: Props) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {NAV.map((item) => {
        const itemLocked = !!(locked && item.lockable);
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const badge = item.href === "/signals" ? signalCount : undefined;

        if (itemLocked) {
          return (
            <div
              key={item.href}
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-2.5 rounded-btn border border-transparent px-3 py-2 text-sm text-white/20"
            >
              <span className="text-white/20">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              <span className="text-white/25">{LOCK_ICON}</span>
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            data-tour={item.href === "/configuration" ? "nav-config" : undefined}
            className={`flex items-center gap-2.5 rounded-btn border px-3 py-2 text-sm transition-colors ${
              active
                ? "border-brand-400/30 bg-brand-400/15 text-white"
                : "border-transparent text-white/40 hover:bg-white/[0.04] hover:text-white/80"
            }`}
          >
            <span className={active ? "text-brand-200" : "text-white/40"}>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {typeof badge === "number" && badge > 0 && (
              <span className="rounded-full bg-brand-400 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
