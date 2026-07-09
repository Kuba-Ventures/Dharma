"use client";

import { useState } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";

/** A just-enough handle on the tab we pre-open, so we can aim or close it. */
type TabHandle = { setUrl: (url: string) => void; close: () => void } | null;

type Props = {
  gmailUrl: string;
  marketplaceUrl: string;
  /**
   * Injected for testability. Must be called SYNCHRONOUSLY from the click (so
   * the browser treats it as user-initiated and doesn't block the popup); we
   * then aim it at Gmail once completion confirms. Default opens a blank tab.
   */
  openTab?: () => TabHandle;
};

function defaultOpenTab(): TabHandle {
  const w = window.open("", "_blank");
  if (!w) return null; // popup blocked — fall back handled by caller
  return {
    setUrl: (url) => {
      w.location.href = url;
    },
    close: () => w.close(),
  };
}

export default function InboxLanding({
  gmailUrl,
  marketplaceUrl,
  openTab = defaultOpenTab,
}: Props) {
  const [opening, setOpening] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openInbox() {
    if (opening) return;
    setOpening(true);
    setError(null);
    // Open the new tab NOW, in the click gesture, so it isn't popup-blocked;
    // it's aimed at Gmail only after completion confirms, and closed if it
    // fails (so we never send the user to Gmail still-un-onboarded).
    const tab = openTab();
    try {
      const res = await fetch("/api/onboarding/advance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });
      if (!res.ok) {
        tab?.close();
        setError("Couldn't finish setup. Try again.");
        setOpening(false);
        return;
      }
    } catch {
      tab?.close();
      setError("Couldn't reach the server. Try again.");
      setOpening(false);
      return;
    }
    // Aim the pre-opened tab at Gmail; if the popup was blocked, fall back to a
    // direct open (still a new tab, keeping the Dharma tab intact).
    if (tab) tab.setUrl(gmailUrl);
    else window.open(gmailUrl, "_blank", "noopener");
    setOpening(false);
    setDone(true); // keep the Dharma tab, show a confirmation.
  }

  return (
    <div className="space-y-4">
      <Card variant="elevated">
        <p className="text-sm leading-relaxed text-white">
          Dharma just sorted the front page of your inbox into the labels you
          picked. New mail gets labeled automatically from here on.
        </p>
        {done ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-brand-200">
              Opened your inbox in a new tab. You&apos;re all set. ✓
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="/dashboard" className="text-[13px] text-white/60 transition-colors hover:text-white">
                Go to your dashboard →
              </a>
              <button
                type="button"
                onClick={() => window.open(gmailUrl, "_blank", "noopener")}
                className="text-[12px] text-white/40 transition-colors hover:text-white/70"
              >
                Reopen Gmail
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <Button variant="primary" onClick={openInbox} disabled={opening}>
              {opening ? "Opening…" : "Open my labeled inbox"}
            </Button>
          </div>
        )}
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
