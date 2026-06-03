"use client";

import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// One coachmark walkthrough of the dashboard, shown once per browser (and to
// every user on their next dashboard load — new users land here right after the
// setup wizard). Append ?tour=1 to the dashboard URL to replay it anytime.
//
// Steps anchor to real dashboard elements via data-tour attributes. Any step
// whose target isn't on the page (e.g. the install nudge after it's dismissed)
// is skipped, so the tour never points at nothing.
const TOUR_KEY = "dharma.tour.v1";

type Step = { selector?: string; title: string; description: string };

const STEPS: Step[] = [
  {
    title: "Welcome to Dharma 👋",
    description:
      "A 20-second tour of how Dharma keeps your inbox on autopilot. You can replay it anytime from Settings.",
  },
  {
    selector: '[data-tour="sync"]',
    title: "Sync your inbox & calendar",
    description:
      "Hit Sync inbox to classify recent mail. If it ever says “reconnect,” sign out and back in once — that re-grants Google access and fixes most sync issues.",
  },
  {
    selector: '[data-tour="config"]',
    title: "Tone, Labels & Scheduling",
    description:
      "These run for you automatically. Click any card to set your writing tone, choose a label preset, or tune how scheduling replies are drafted.",
  },
  {
    selector: '[data-tour="install"]',
    title: "Draft replies inside Gmail",
    description:
      "Install the Dharma add-on to compose in your voice right from Gmail’s sidebar. Labeling and sorting already work without it.",
  },
  {
    selector: '[data-tour="nav-config"]',
    title: "Fine-tune anytime",
    description:
      "Everything lives in Configuration — change presets, tone, and scheduling whenever you like.",
  },
];

export default function ProductTour() {
  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).has("tour");
    let seen = false;
    try {
      seen = localStorage.getItem(TOUR_KEY) != null;
    } catch {
      /* storage unavailable — treat as not-yet-seen */
    }
    if (seen && !forced) return;

    const steps = STEPS.filter(
      (s) => !s.selector || document.querySelector(s.selector),
    ).map((s) => ({
      element: s.selector,
      popover: { title: s.title, description: s.description },
    }));
    // Need at least the welcome step plus one anchored step to be worthwhile.
    if (steps.length < 2) return;

    const markSeen = () => {
      try {
        localStorage.setItem(TOUR_KEY, new Date().toISOString());
      } catch {
        /* ignore */
      }
    };

    const d = driver({
      showProgress: true,
      allowClose: true,
      overlayColor: "#0a0a0f",
      overlayOpacity: 0.72,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Got it",
      steps,
      onDestroyed: markSeen,
    });

    // Let the dashboard paint before highlighting.
    const t = setTimeout(() => d.drive(), 600);
    return () => {
      clearTimeout(t);
      d.destroy();
    };
  }, []);

  return null;
}
