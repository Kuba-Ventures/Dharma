"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function DeleteAccountCard() {
  const [armed, setArmed] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/user/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Deletion failed. Please contact support.");
        setBusy(false);
        return;
      }
      // Session row is already gone server-side; sign out clears the client
      // cookie and lands the (now anonymous) user on the login page.
      await signOut({ redirectTo: "/" });
    } catch {
      setError("Network error. Please try again or contact support.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-red-500/30 bg-red-500/5 p-5">
      <h2 className="text-sm font-medium text-red-300">Delete account</h2>
      <p className="mt-1 text-[12px] text-white/50">
        Permanently deletes your Dharma account and all associated data — Gmail
        and Calendar access, labels, drafting history, and settings. We stop
        watching your inbox and revoke Dharma&apos;s Google access. This cannot
        be undone.
      </p>

      {!armed ? (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="mt-4 rounded-md border border-red-500/40 px-3 py-1.5 text-[13px] text-red-300 transition hover:bg-red-500/10"
        >
          Delete my account
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-[12px] text-white/60">
            Type <span className="font-mono text-red-300">DELETE</span> to confirm:
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              className="mt-1 block w-40 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] px-2 py-1 font-mono text-[13px] text-white outline-none focus:border-red-500/50"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={confirmText !== "DELETE" || busy}
              onClick={handleDelete}
              className="rounded-md bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setArmed(false);
                setConfirmText("");
                setError(null);
              }}
              className="rounded-md px-3 py-1.5 text-[13px] text-white/60 transition hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
