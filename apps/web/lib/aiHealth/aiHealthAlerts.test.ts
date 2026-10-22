import { describe, it, expect } from "vitest";
import {
  buildAiServiceAlertEmail,
  decideAiServiceAlert,
  describeDowntime,
  downSinceForIncident,
  parseAiHealthAlertRecipients,
  type StoredAiServiceCheck,
} from "./aiHealthAlerts";
import { classifyAnthropicFailure } from "./aiHealthChecks";

function storedCheck(overrides: Partial<StoredAiServiceCheck> = {}): StoredAiServiceCheck {
  return {
    service: "claude",
    status: "working",
    failureKind: null,
    failureDetail: null,
    checkedAt: "2026-10-21T23:40:00.000Z",
    alertSent: null,
    ...overrides,
  };
}

describe("decideAiServiceAlert", () => {
  it("alerts on the first failed check when the credits run out", () => {
    expect(decideAiServiceAlert({ status: "down", failureKind: "out_of_credits" }, [storedCheck()])).toBe("down");
  });

  it("waits for a second failed check before alerting on an outage blip", () => {
    expect(decideAiServiceAlert({ status: "down", failureKind: "provider_outage" }, [storedCheck()])).toBeNull();
    expect(
      decideAiServiceAlert({ status: "down", failureKind: "provider_outage" }, [
        storedCheck({ status: "down", failureKind: "provider_outage" }),
        storedCheck(),
      ]),
    ).toBe("down");
  });

  it("sends only one down alert while an incident lasts", () => {
    expect(
      decideAiServiceAlert({ status: "down", failureKind: "out_of_credits" }, [
        storedCheck({ status: "down", failureKind: "out_of_credits" }),
        storedCheck({ status: "down", failureKind: "out_of_credits", alertSent: "down" }),
        storedCheck(),
      ]),
    ).toBeNull();
  });

  it("sends a recovered alert only when a down alert went out for that incident", () => {
    expect(
      decideAiServiceAlert({ status: "working", failureKind: null }, [
        storedCheck({ status: "down", failureKind: "out_of_credits", alertSent: "down" }),
        storedCheck(),
      ]),
    ).toBe("recovered");
    expect(
      decideAiServiceAlert({ status: "working", failureKind: null }, [
        storedCheck({ status: "down", failureKind: "provider_outage" }),
        storedCheck(),
      ]),
    ).toBeNull();
  });

  it("does not let an earlier incident's alert silence a new incident", () => {
    expect(
      decideAiServiceAlert({ status: "down", failureKind: "key_rejected" }, [
        storedCheck(),
        storedCheck({ status: "down", failureKind: "out_of_credits", alertSent: "down" }),
      ]),
    ).toBe("down");
  });

  it("never alerts on an unknown check", () => {
    expect(decideAiServiceAlert({ status: "unknown", failureKind: "not_configured" }, [])).toBeNull();
  });
});

describe("downSinceForIncident", () => {
  it("returns the first down check of the current incident", () => {
    expect(
      downSinceForIncident(
        [
          storedCheck({ status: "down", checkedAt: "2026-10-21T23:20:00.000Z" }),
          storedCheck({ status: "down", checkedAt: "2026-10-21T23:10:00.000Z" }),
          storedCheck({ status: "working", checkedAt: "2026-10-21T23:00:00.000Z" }),
          storedCheck({ status: "down", checkedAt: "2026-10-21T22:50:00.000Z" }),
        ],
        "2026-10-21T23:30:00.000Z",
      ),
    ).toBe("2026-10-21T23:10:00.000Z");
  });

  it("falls back to now when nothing earlier was down", () => {
    expect(downSinceForIncident([storedCheck()], "2026-10-21T23:30:00.000Z")).toBe("2026-10-21T23:30:00.000Z");
  });
});

describe("classifyAnthropicFailure", () => {
  it("tells running out of credit apart from other errors", () => {
    expect(
      classifyAnthropicFailure(400, {
        error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." },
      }),
    ).toBe("out_of_credits");
    expect(classifyAnthropicFailure(402, null)).toBe("out_of_credits");
    expect(classifyAnthropicFailure(401, { error: { type: "authentication_error" } })).toBe("key_rejected");
    expect(classifyAnthropicFailure(403, null)).toBe("key_not_allowed");
    expect(classifyAnthropicFailure(429, null)).toBe("rate_limited");
    expect(classifyAnthropicFailure(529, { error: { type: "overloaded_error" } })).toBe("provider_outage");
    expect(classifyAnthropicFailure(400, { error: { type: "invalid_request_error", message: "bad" } })).toBe(
      "unexpected_response",
    );
  });
});

describe("describeDowntime", () => {
  it("reads naturally", () => {
    expect(describeDowntime("2026-10-21T20:00:00.000Z", "2026-10-21T20:01:00.000Z")).toBe("1 minute");
    expect(describeDowntime("2026-10-21T20:00:00.000Z", "2026-10-21T22:00:00.000Z")).toBe("2 hours");
    expect(describeDowntime("2026-10-21T20:00:00.000Z", "2026-10-21T23:25:00.000Z")).toBe("3 hours 25 minutes");
  });
});

describe("buildAiServiceAlertEmail", () => {
  const baseInput = {
    service: "claude" as const,
    downSinceIso: "2026-10-21T20:00:00.000Z",
    nowIso: "2026-10-21T23:00:00.000Z",
    healthPageUrl: "https://www.dharmaautomations.com/admin/health",
  };

  it("says what breaks, who fixes it, and links to the Health page", () => {
    const alertEmail = buildAiServiceAlertEmail({
      ...baseInput,
      alertKind: "down",
      failureKind: "out_of_credits",
      failureDetail: "400: Your credit balance is too low",
    });
    expect(alertEmail.subject).toBe("Dharma is down: Claude says the credit balance is too low");
    expect(alertEmail.text).toContain("cannot draft replies");
    expect(alertEmail.text).toContain("Console > Billing");
    expect(alertEmail.text).toContain(baseInput.healthPageUrl);
    expect(alertEmail.html).toContain(`href="${baseInput.healthPageUrl}"`);
    expect(alertEmail.html).not.toContain("<script");
  });

  it("reports how long a recovered incident lasted", () => {
    const alertEmail = buildAiServiceAlertEmail({
      ...baseInput,
      alertKind: "recovered",
      failureKind: null,
      failureDetail: null,
    });
    expect(alertEmail.subject).toBe("Dharma is back: Claude is working again");
    expect(alertEmail.text).toContain("3 hours");
  });

  it("escapes provider text in the HTML", () => {
    const alertEmail = buildAiServiceAlertEmail({
      ...baseInput,
      alertKind: "down",
      failureKind: "unexpected_response",
      failureDetail: "<b>oops</b>",
    });
    expect(alertEmail.html).toContain("&lt;b&gt;oops&lt;/b&gt;");
  });

  it("never contains an em dash", () => {
    for (const alertKind of ["down", "recovered"] as const) {
      const alertEmail = buildAiServiceAlertEmail({ ...baseInput, alertKind, failureKind: "key_rejected", failureDetail: null });
      expect(alertEmail.text + alertEmail.subject).not.toContain("\u2014");
    }
  });
});

describe("parseAiHealthAlertRecipients", () => {
  it("defaults to Finley and splits a list", () => {
    expect(parseAiHealthAlertRecipients(undefined)).toEqual(["finley@qsbsrollover.com"]);
    expect(parseAiHealthAlertRecipients("  ")).toEqual(["finley@qsbsrollover.com"]);
    expect(parseAiHealthAlertRecipients("A@x.com, b@y.com;not-an-email")).toEqual(["a@x.com", "b@y.com"]);
  });
});
