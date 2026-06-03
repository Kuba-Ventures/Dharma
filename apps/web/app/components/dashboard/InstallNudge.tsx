"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Live Google Workspace Marketplace listing for the Dharma Gmail add-on.
const MARKETPLACE_URL =
  "https://workspace.google.com/marketplace/app/dharma/63757021962";
// Per-browser dismissal. We don't track whether the add-on is actually
// installed, so this is a nudge the user clears once (install or dismiss).
const DISMISS_KEY = "dharma.installNudgeDismissed";

export default function InstallNudge() {
  // Start hidden; reveal only after confirming it wasn't dismissed. Both SSR
  // and the first client render produce null, so there's no hydration flash
  // for users who already dismissed it.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore — still hide for this session */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex items-start gap-3 rounded-card border border-[color:var(--border-brand)] bg-brand-400/[0.06] px-4 py-3">
      <span className="mt-0.5 shrink-0 text-brand-200" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="3.5" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.5 4.5 9 9.5l6.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">Draft replies right inside Gmail</p>
        <p className="mt-0.5 text-[12px] text-white/55">
          Install the Dharma add-on to compose in your voice from Gmail&apos;s
          sidebar. Labeling and sorting already run automatically.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <a
            href={MARKETPLACE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-btn border border-[color:var(--border-brand)] bg-brand-400/15 px-3 py-1.5 text-[13px] font-medium text-brand-100 transition-colors hover:bg-brand-400/25"
          >
            Install the Gmail add-on ↗
          </a>
          <Link
            href="/settings"
            className="text-[12px] text-white/40 transition-colors hover:text-white/70"
          >
            Details in Settings →
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="-mr-1 shrink-0 rounded-md px-1.5 text-lg leading-none text-white/30 transition-colors hover:text-white/70"
      >
        ×
      </button>
    </div>
  );
}
