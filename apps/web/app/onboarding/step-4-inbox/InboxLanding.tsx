"use client";

import { useState } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";

type Props = {
  gmailUrl: string;
  marketplaceUrl: string;
  /** Injected for testability; defaults to a real browser navigation. */
  navigate?: (url: string) => void;
};

export default function InboxLanding({
  gmailUrl,
  marketplaceUrl,
  navigate = (url) => window.location.assign(url),
}: Props) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openInbox() {
    if (opening) return;
    setOpening(true);
    setError(null);
    // Stamp completion BEFORE leaving for Gmail. Only navigate on a confirmed
    // 200 — otherwise the user would land in Gmail with onboarding still
    // incomplete and get bounced back in on their next app visit.
    try {
      const res = await fetch("/api/onboarding/advance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });
      if (!res.ok) {
        setError("Couldn't finish setup. Try again.");
        setOpening(false);
        return;
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
      setOpening(false);
      return;
    }
    navigate(gmailUrl);
  }

  return (
    <div className="space-y-4">
      <Card variant="elevated">
        <p className="text-sm leading-relaxed text-white">
          Dharma just sorted the front page of your inbox into the labels you
          picked. New mail gets labeled automatically from here on.
        </p>
        <div className="mt-4">
          <Button variant="primary" onClick={openInbox} disabled={opening}>
            {opening ? "Opening…" : "Open my labeled inbox"}
          </Button>
        </div>
        {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
      </Card>

      <Card variant="elevated">
        <p className="text-[11px] uppercase tracking-[0.08em] text-brand-200">
          Optional: draft replies inside Gmail
        </p>
        <p className="mt-2 text-sm text-white/70">
          Add the Gmail add-on to draft on-brand replies right in Gmail&apos;s
          sidebar. Labeling already works without it.
        </p>
        <a
          href={marketplaceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-btn border border-[color:var(--border-brand)] bg-brand-400/15 px-4 py-2 text-sm font-medium text-brand-100 transition-colors hover:bg-brand-400/25"
        >
          Install the Gmail add-on ↗
        </a>
      </Card>
    </div>
  );
}
