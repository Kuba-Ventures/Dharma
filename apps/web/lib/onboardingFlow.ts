// Onboarding flow-version routing.
//
// A user is pinned to a flow ('v1' | 'v2') on User.onboardingFlow when they
// first enter onboarding, and both layouts route by that pin — NOT by the
// ambient ONBOARDING_V2 env flag. This is what stops a mid-flight flag flip
// from resuming a user on the wrong step: whatever flow you started, you
// finish. A null/unknown pin resolves to 'v1' (the pre-v2 default), so existing
// in-flight users are never reinterpreted as v2.
//
// The v2 routes below don't all exist until later stages; the v2 flow only
// becomes reachable once ONBOARDING_V2 is turned on (final stage), by which
// point the pages ship.

export type OnboardingFlow = "v1" | "v2";

/** v1: connect → city → tone → labels → features/install (5 steps). */
export const V1_STEP_URLS: readonly string[] = [
  "/onboarding/step-1-connect",
  "/onboarding/step-2-city",
  "/onboarding/step-3-tone",
  "/onboarding/step-4-labels",
  "/onboarding/step-5-install",
];

/** v2: connect → quiz → personalize → land-in-inbox (4 steps). */
export const V2_STEP_URLS: readonly string[] = [
  "/onboarding/step-1-connect",
  "/onboarding/step-2-quiz",
  "/onboarding/step-3-personalize",
  "/onboarding/step-4-inbox",
];

/** Total anything not exactly "v2" to v1 — including null, undefined, garbage. */
export function resolveOnboardingFlow(flow: string | null | undefined): OnboardingFlow {
  return flow === "v2" ? "v2" : "v1";
}

export function stepUrlsForFlow(flow: OnboardingFlow): readonly string[] {
  return flow === "v2" ? V2_STEP_URLS : V1_STEP_URLS;
}

/** Resume URL for a (flow, 0-based step), clamped into range. Total on bad input. */
export function onboardingStepUrl(flow: OnboardingFlow, step: number): string {
  const urls = stepUrlsForFlow(flow);
  const i = Number.isFinite(step)
    ? Math.min(Math.max(Math.trunc(step), 0), urls.length - 1)
    : 0;
  return urls[i];
}

/**
 * The flow a NEW user should be pinned to, from the env flag. Pure — the caller
 * reads process.env.ONBOARDING_V2 and passes the boolean, so this stays
 * unit-testable and env-free.
 */
export function flowForNewUser(flagEnabled: boolean): OnboardingFlow {
  return flagEnabled ? "v2" : "v1";
}
