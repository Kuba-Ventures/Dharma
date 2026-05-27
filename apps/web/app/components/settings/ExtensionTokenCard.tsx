"use client";

import { useEffect, useState } from "react";

export default function ExtensionTokenCard() {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/user/extension-token")
      .then((r) => r.json())
      .then((d: { token?: string }) => setToken(d.token ?? null))
      .catch(() => null);
  }, []);

  function copy() {
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-card border border-[color:var(--border-subtle)] bg-[color:var(--bg-card)] p-5">
      <h2 className="text-sm font-medium text-white">Chrome extension token</h2>
      <p className="mt-1 text-[12px] text-white/50">
        Paste this into the Dharma Chrome extension to enable one-click
        drafting from Gmail.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 select-all truncate rounded-btn border border-[color:var(--border-subtle)] bg-black/30 px-3 py-2 font-mono text-xs text-white/50">
          {token ?? "Loading…"}
        </div>
        <button
          onClick={copy}
          disabled={!token}
          className="shrink-0 rounded-btn border border-[color:var(--border-subtle)] bg-white/[0.06] px-3 py-2 text-xs text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white disabled:opacity-30"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
