"use client";

import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/user/extension-token")
      .then((r) => r.json())
      .then((d) => setToken(d.token))
      .catch(() => {});
  }, []);

  function copy() {
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-sm text-white/35 mt-0.5">Account and preferences</p>
      </div>

      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-white">Chrome Extension Token</h2>
          <p className="text-xs text-white/40 mt-1">
            Paste this into the Dharma Chrome extension to enable one-click drafting from Gmail.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2 font-mono text-xs text-white/50 truncate select-all">
            {token ?? "Loading…"}
          </div>
          <button
            onClick={copy}
            disabled={!token}
            className="shrink-0 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs text-white/60 hover:text-white transition-colors disabled:opacity-30"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
