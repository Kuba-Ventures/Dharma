"use client";

import { useState } from "react";

export default function RestartOnboardingCard() {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestart() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/restart", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Couldn't restart onboarding. Please try again.");
        setBusy(false);
        return;
      }
      // Full navigation (not router.push) so the server re-reads the now-null
      // onboardingCompletedAt and the onboarding layout lets us back in. Both
      // flows (v1/v2) share step-1 as their entry, so this is flow-agnostic.
      window.location.assign("/onboarding/step-1-connect");
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
      <h2 className="text-sm font-medium text-white">Restart onboarding</h2>
      <p className="mt-1 text-[12px] text-white/50">
        Walk through the onboarding flow again from the beginning. This{" "}
        <span className="text-white/70">doesn&apos;t change any of your
        settings</span>{" "}
        — your role, tone, labels, home city, and scheduling preferences all
        stay exactly as they are.
      </p>

      {!armed ? (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="mt-4 rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.06] px-3 py-1.5 text-[13px] text-white/70 transition-colors hover:bg-white/[0.1] hover:text-white"
        >
          Restart onboarding
        </button>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleRestart}
            className="rounded-btn border border-[color:var(--border-brand)] bg-brand-400/15 px-3 py-1.5 text-[13px] font-medium text-brand-100 transition-colors hover:bg-brand-400/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Starting…" : "Start over"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setArmed(false);
              setError(null);
            }}
            className="rounded-btn px-3 py-1.5 text-[13px] text-white/60 transition hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
    </div>
  );
}
