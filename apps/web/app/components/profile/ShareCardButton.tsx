"use client";

import { useState } from "react";

type Props = {
  milestoneId: string;
  firstName: string | null;
  city: string | null;
  tier: string;
  secondsSaved: number;
};

export default function ShareCardButton({
  milestoneId,
  firstName,
  city,
  tier,
  secondsSaved,
}: Props) {
  const [copied, setCopied] = useState(false);

  function buildShareUrl(): string {
    const params = new URLSearchParams();
    if (firstName) params.set("name", firstName);
    if (city) params.set("city", city);
    params.set("tier", tier);
    if (secondsSaved > 0) params.set("s", String(secondsSaved));
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/share/milestone/${milestoneId}?${params.toString()}`;
  }

  async function handleShare() {
    const url = buildShareUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="text-[11px] font-medium text-brand-200 transition-colors hover:text-brand-100"
    >
      {copied ? "Copied" : "Share"}
    </button>
  );
}
