"use client";

import { HTMLAttributes, ReactNode, useState } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  dismissId: string;
  children: ReactNode;
};

export default function DismissibleCard({
  dismissId,
  children,
  className = "",
  ...props
}: Props) {
  const [hidden, setHidden] = useState(false);

  async function dismiss() {
    setHidden(true);
    try {
      await fetch("/api/user/dismiss", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: dismissId }),
      });
    } catch {
      // tile stays hidden locally; will reappear on reload if server failed
    }
  }

  if (hidden) return null;

  return (
    <div className={`relative ${className}`} {...props}>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="absolute top-3 right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/70"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 2L10 10M10 2L2 10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {children}
    </div>
  );
}
