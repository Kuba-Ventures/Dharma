import { describe, it, expect } from "vitest";
import {
  resolveOnboardingFlow,
  stepUrlsForFlow,
  onboardingStepUrl,
  flowForNewUser,
  V1_STEP_URLS,
  V2_STEP_URLS,
} from "./onboardingFlow";

describe("resolveOnboardingFlow", () => {
  it("resolves 'v2' only for the exact string, everything else to v1", () => {
    expect(resolveOnboardingFlow("v2")).toBe("v2");
    expect(resolveOnboardingFlow("v1")).toBe("v1");
    expect(resolveOnboardingFlow(null)).toBe("v1");
    expect(resolveOnboardingFlow(undefined)).toBe("v1");
    expect(resolveOnboardingFlow("V2")).toBe("v1"); // case-sensitive
    expect(resolveOnboardingFlow("garbage")).toBe("v1");
    expect(resolveOnboardingFlow("")).toBe("v1");
  });
});

describe("stepUrlsForFlow", () => {
  it("returns the 5-step v1 set and the 4-step v2 set", () => {
    expect(stepUrlsForFlow("v1")).toEqual(V1_STEP_URLS);
    expect(stepUrlsForFlow("v2")).toEqual(V2_STEP_URLS);
    expect(V1_STEP_URLS).toHaveLength(5);
    expect(V2_STEP_URLS).toHaveLength(4);
  });

  it("shares step 1 (connect) across both flows and diverges at step 2", () => {
    expect(V1_STEP_URLS[0]).toBe(V2_STEP_URLS[0]);
    expect(V1_STEP_URLS[0]).toBe("/onboarding/step-1-connect");
    expect(V1_STEP_URLS[1]).toBe("/onboarding/step-2-city");
    expect(V2_STEP_URLS[1]).toBe("/onboarding/step-2-quiz");
  });
});

describe("onboardingStepUrl", () => {
  it("maps in-range steps to the flow's URL", () => {
    expect(onboardingStepUrl("v1", 0)).toBe("/onboarding/step-1-connect");
    expect(onboardingStepUrl("v1", 1)).toBe("/onboarding/step-2-city");
    expect(onboardingStepUrl("v2", 1)).toBe("/onboarding/step-2-quiz");
    expect(onboardingStepUrl("v2", 3)).toBe("/onboarding/step-4-inbox");
  });

  it("clamps out-of-range, negative, fractional, and non-finite steps", () => {
    expect(onboardingStepUrl("v1", 99)).toBe(V1_STEP_URLS[4]); // last
    expect(onboardingStepUrl("v2", 99)).toBe(V2_STEP_URLS[3]); // last
    expect(onboardingStepUrl("v1", -3)).toBe(V1_STEP_URLS[0]); // first
    expect(onboardingStepUrl("v1", 2.9)).toBe(V1_STEP_URLS[2]); // trunc → 2
    expect(onboardingStepUrl("v1", NaN)).toBe(V1_STEP_URLS[0]); // first
    expect(onboardingStepUrl("v1", Infinity)).toBe(V1_STEP_URLS[0]); // first
  });
});

describe("flowForNewUser", () => {
  it("maps the env flag to a flow", () => {
    expect(flowForNewUser(true)).toBe("v2");
    expect(flowForNewUser(false)).toBe("v1");
  });
});
