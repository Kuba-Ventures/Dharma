"use client";

import { useState } from "react";

const ACTIONS = [
  {
    id: "sync-inbox",
    label: "Sync inbox",
    href: "/configuration",
    primary: true,
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M7 1v6m0 0l-2.5-2.5M7 7l2.5-2.5M2 9v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "manage-labels",
    label: "Manage labels",
    href: "/configuration",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M2.5 3h5.5L11 5.5 8 8H2.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "retrain-tone",
    label: "Retrain tone",
    href: "/configuration",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M2 5v4M5 6v3M8 3v8M11 5v4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "send-feedback",
    label: "Send feedback",
    href: "#feedback",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M2 3h10v6H6.5L3.5 11.5V9H2z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    ),
  },
] as const;

export default function QuickActions() {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-4">
      <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-brand-200">
        Quick actions
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((a) => {
          const isPrimary = "primary" in a && a.primary;
          return (
            <a
              key={a.id}
              href={a.href}
              onMouseEnter={() => setHover(a.id)}
              onMouseLeave={() => setHover(null)}
              className={`flex items-center gap-2 rounded-btn border px-3 py-2 text-sm transition-colors ${
                isPrimary
                  ? "border-[color:var(--border-brand)] bg-brand-400 text-white hover:bg-brand-600"
                  : "border-[color:var(--border-subtle)] bg-white/[0.04] text-white/70 hover:text-white"
              }`}
            >
              <span
                className={
                  isPrimary
                    ? "text-white"
                    : hover === a.id
                    ? "text-brand-200"
                    : "text-white/50"
                }
              >
                {a.icon}
              </span>
              {a.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
