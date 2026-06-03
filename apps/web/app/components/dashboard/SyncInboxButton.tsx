"use client";

import { useState } from "react";

const ICON = (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path
      d="M2 7a5 5 0 0 1 9-3M12 7a5 5 0 0 1-9 3M11 2v3h-3M3 12V9h3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function SyncInboxButton() {
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [resultText, setResultText] = useState<string | null>(null);

  async function sync() {
    if (state === "syncing") return;
    setState("syncing");
    setResultText(null);
    try {
      const res = await fetch("/api/labels/back-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      if (!res.ok) {
        // Surface the server's actionable message (e.g. "reconnect Google",
        // "Gmail is rate-limiting") instead of a bare "Sync failed".
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setState("error");
        setResultText(err.error ?? "Sync failed");
        setTimeout(() => setState("idle"), 6000);
        return;
      }
      const data = (await res.json()) as {
        scanned: number;
        tagged: number;
        incomplete?: boolean;
      };
      setState("done");
      setResultText(
        data.incomplete
          ? `✓ Tagged ${data.tagged} of ${data.scanned} — run again for the rest`
          : `✓ Scanned ${data.scanned}, tagged ${data.tagged}`,
      );
      setTimeout(() => {
        setState("idle");
        setResultText(null);
      }, 4500);
    } catch {
      setState("error");
      setResultText("Sync failed — check your connection");
      setTimeout(() => setState("idle"), 6000);
    }
  }

  const label =
    state === "syncing"
      ? "Syncing…"
      : state === "done"
        ? resultText ?? "Synced"
        : state === "error"
          ? resultText ?? "Sync failed"
          : "Sync inbox";

  return (
    <button
      type="button"
      onClick={sync}
      disabled={state === "syncing"}
      className={`flex items-center gap-2 rounded-btn border px-3 py-1.5 text-sm transition-colors ${
        state === "done"
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
          : state === "error"
            ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
            : "border-[color:var(--border-brand)] bg-brand-400 text-white hover:bg-brand-600 disabled:opacity-60"
      }`}
    >
      <span className={state === "syncing" ? "animate-spin" : ""}>{ICON}</span>
      {label}
    </button>
  );
}
