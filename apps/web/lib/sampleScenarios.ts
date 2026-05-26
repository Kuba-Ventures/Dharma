// Rotating prompts used by the Sample Draft block on the Configuration → Tone
// card. Each scenario is a short, neutral context line that the user's tone
// can be applied against; the renderer picks one based on the current hour so
// the card surfaces variety across sessions, and "Regenerate" advances by one.

export const SAMPLE_SCENARIOS = [
  {
    id: "follow-up-proposal",
    label: "Follow-up on a proposal sent last week",
    prompt:
      "You sent a proposal to a prospect last Tuesday. They haven't responded. Write a 3-sentence follow-up asking for status, no pressure.",
  },
  {
    id: "declining-coffee",
    label: "Declining a coffee invitation politely",
    prompt:
      "An acquaintance asked to grab coffee next week. You don't have time. Decline warmly in 2-3 sentences, leave the door open for later.",
  },
  {
    id: "confirming-meeting",
    label: "Confirming a meeting time",
    prompt:
      "Confirm a 30-minute call Thursday at 2pm ET. Mention you'll send a Google Meet link. 2 sentences.",
  },
  {
    id: "intro-request",
    label: "Asking for an introduction",
    prompt:
      "Ask a mutual contact (named Jordan) to introduce you to a founder at a portfolio company you're researching. 3 sentences, low-friction.",
  },
  {
    id: "thanking-referral",
    label: "Thanking someone for a referral",
    prompt:
      "Thank a contact for referring a potential client your way. Mention the intro went well and you'll keep them posted. 3 sentences.",
  },
  {
    id: "deadline-push",
    label: "Pushing back a deadline by two days",
    prompt:
      "Tell a stakeholder you need to push a Friday deliverable to Tuesday because a dependency slipped. Take ownership; don't grovel. 3 sentences.",
  },
] as const;

export type SampleScenario = (typeof SAMPLE_SCENARIOS)[number];

// Pick a scenario deterministically per hour so the card doesn't churn on
// every render. The user can advance via the Regenerate button.
export function defaultScenarioIndex(now: Date = new Date()): number {
  return Math.floor(now.getTime() / (1000 * 60 * 60)) % SAMPLE_SCENARIOS.length;
}

export function scenarioById(id: string): SampleScenario | undefined {
  return SAMPLE_SCENARIOS.find((s) => s.id === id);
}
