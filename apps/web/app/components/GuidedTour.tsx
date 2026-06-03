"use client";

import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// Reusable per-page coachmark tour. Shown once per account per tour id (gated by
// the user's toursSeen list, checked via /api/user/tour-complete), and on the
// first visit to the page. Append ?tour=1 to the page URL to replay it.
//
// Steps anchor to elements via data-tour selectors; any step whose target isn't
// present is skipped so the tour never points at nothing. Pages render this as
// a client island and pass plain serializable steps.
export type TourStep = { selector: string; title: string; description: string };

export default function GuidedTour({
  id,
  steps,
}: {
  id: string;
  steps: TourStep[];
}) {
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const present = steps.filter((s) => document.querySelector(s.selector));
    if (present.length === 0) return;

    const run = () => {
      if (cancelled) return;
      const d = driver({
        showProgress: present.length > 1,
        allowClose: true,
        overlayColor: "#0a0a0f",
        overlayOpacity: 0.72,
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Got it",
        steps: present.map((s) => ({
          element: s.selector,
          popover: { title: s.title, description: s.description },
        })),
        onDestroyed: () => {
          void fetch("/api/user/tour-complete", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ tour: id }),
          }).catch(() => {});
        },
      });
      const t = setTimeout(() => {
        if (!cancelled) d.drive();
      }, 600);
      cleanup = () => {
        clearTimeout(t);
        d.destroy();
      };
    };

    const forced = new URLSearchParams(window.location.search).has("tour");
    if (forced) {
      run();
    } else {
      // Only auto-show if this account hasn't seen this tour yet.
      fetch("/api/user/tour-complete")
        .then((r) => (r.ok ? r.json() : { toursSeen: [] }))
        .then((data: { toursSeen?: string[] }) => {
          if (!cancelled && !(data.toursSeen ?? []).includes(id)) run();
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [id, steps]);

  return null;
}
