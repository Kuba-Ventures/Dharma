import { describe, it, expect } from "vitest";
import {
  anAlertEmailWentOutSince,
  buildAiHealthDailyEmail,
  describeDowntime,
  downSinceForIncident,
  isOutageWorthReporting,
  isRecoveryAwaitingReport,
  pacificDayKey,
  parseAiHealthAlertRecipients,
  reportedIncidentTimes,
  startOfPacificDay,
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

describe("isOutageWorthReporting", () => {
  it("counts running out of credits on the first failed check", () => {
    expect(isOutageWorthReporting({ status: "down", failureKind: "out_of_credits" }, [storedCheck()])).toBe(true);
  });

  it("waits for a second failed check before counting an outage blip", () => {
    expect(isOutageWorthReporting({ status: "down", failureKind: "provider_outage" }, [storedCheck()])).toBe(false);
    expect(
      isOutageWorthReporting({ status: "down", failureKind: "provider_outage" }, [
        storedCheck({ status: "down", failureKind: "provider_outage" }),
        storedCheck(),
      ]),
    ).toBe(true);
  });

  it("keeps reporting an outage that was already emailed, so the next day mentions it again", () => {
    expect(
      isOutageWorthReporting({ status: "down", failureKind: "out_of_credits" }, [
        storedCheck({ status: "down", failureKind: "out_of_credits", alertSent: "down" }),
      ]),
    ).toBe(true);
  });

  it("never counts an unknown or working check", () => {
    expect(isOutageWorthReporting({ status: "unknown", failureKind: "not_configured" }, [])).toBe(false);
    expect(isOutageWorthReporting({ status: "working", failureKind: null }, [])).toBe(false);
  });
});

describe("isRecoveryAwaitingReport", () => {
  it("reports a recovery when the last email said the service was down", () => {
    expect(
      isRecoveryAwaitingReport({ status: "working" }, [
        storedCheck({ status: "working" }),
        storedCheck({ status: "down", alertSent: "down" }),
      ]),
    ).toBe(true);
  });

  it("stays quiet when no email ever said it was down, or the recovery was already reported", () => {
    expect(isRecoveryAwaitingReport({ status: "working" }, [storedCheck({ status: "down" }), storedCheck()])).toBe(false);
    expect(
      isRecoveryAwaitingReport({ status: "working" }, [
        storedCheck({ alertSent: "recovered" }),
        storedCheck({ status: "down", alertSent: "down" }),
      ]),
    ).toBe(false);
  });
});

describe("reportedIncidentTimes", () => {
  it("finds when the reported incident started and when it first worked again", () => {
    expect(
      reportedIncidentTimes(
        [
          storedCheck({ status: "working", checkedAt: "2026-10-22T09:00:00.000Z" }),
          storedCheck({ status: "working", checkedAt: "2026-10-22T08:50:00.000Z" }),
          storedCheck({ status: "down", checkedAt: "2026-10-22T08:40:00.000Z" }),
          storedCheck({ status: "down", checkedAt: "2026-10-22T08:30:00.000Z", alertSent: "down" }),
          storedCheck({ status: "down", checkedAt: "2026-10-22T08:20:00.000Z" }),
          storedCheck({ status: "working", checkedAt: "2026-10-22T08:10:00.000Z" }),
        ],
        "2026-10-22T09:10:00.000Z",
      ),
    ).toEqual({ downSinceIso: "2026-10-22T08:20:00.000Z", recoveredAtIso: "2026-10-22T08:50:00.000Z" });
  });
});

describe("once a Pacific day", () => {
  it("starts the day at Pacific midnight", () => {
    expect(startOfPacificDay(new Date("2026-10-22T05:00:00.000Z")).toISOString()).toBe("2026-10-21T07:00:00.000Z");
    expect(startOfPacificDay(new Date("2026-12-01T12:00:00.000Z")).toISOString()).toBe("2026-12-01T08:00:00.000Z");
    expect(pacificDayKey(new Date("2026-10-22T05:00:00.000Z"))).toBe("2026-10-21");
  });

  it("knows whether an email already went out today", () => {
    const todayStartIso = "2026-10-21T07:00:00.000Z";
    expect(
      anAlertEmailWentOutSince([storedCheck({ checkedAt: "2026-10-21T15:00:00.000Z", alertSent: "down" })], todayStartIso),
    ).toBe(true);
    expect(
      anAlertEmailWentOutSince([storedCheck({ checkedAt: "2026-10-21T06:50:00.000Z", alertSent: "down" })], todayStartIso),
    ).toBe(false);
    expect(anAlertEmailWentOutSince([storedCheck({ checkedAt: "2026-10-21T15:00:00.000Z" })], todayStartIso)).toBe(false);
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

describe("buildAiHealthDailyEmail", () => {
  const healthPageUrl = "https://www.dharmaautomations.com/admin/health";

  it("says what breaks, who fixes it, and links to the Health page", () => {
    const alertEmail = buildAiHealthDailyEmail({
      outages: [
        {
          service: "claude",
          failureKind: "out_of_credits",
          failureDetail: "400: Your credit balance is too low",
          downSinceIso: "2026-10-21T20:00:00.000Z",
        },
      ],
      recoveries: [],
      healthPageUrl,
    });
    expect(alertEmail.subject).toBe("Dharma is down: Claude says the credit balance is too low");
    expect(alertEmail.text).toContain("cannot draft replies");
    expect(alertEmail.text).toContain("Console > Billing");
    expect(alertEmail.text).toContain("at most one of these emails a day");
    expect(alertEmail.text).toContain(healthPageUrl);
    expect(alertEmail.html).toContain(`href="${healthPageUrl}"`);
  });

  it("reports how long a recovered incident lasted", () => {
    const alertEmail = buildAiHealthDailyEmail({
      outages: [],
      recoveries: [
        { service: "claude", downSinceIso: "2026-10-21T20:00:00.000Z", recoveredAtIso: "2026-10-21T23:00:00.000Z" },
      ],
      healthPageUrl,
    });
    expect(alertEmail.subject).toBe("Dharma is back: Claude is working again");
    expect(alertEmail.text).toContain("down for 3 hours");
  });

  it("escapes provider text in the HTML and never contains an em dash", () => {
    const alertEmail = buildAiHealthDailyEmail({
      outages: [
        { service: "claude", failureKind: "unexpected_response", failureDetail: "<b>oops</b>", downSinceIso: "2026-10-21T20:00:00.000Z" },
      ],
      recoveries: [],
      healthPageUrl,
    });
    expect(alertEmail.html).toContain("&lt;b&gt;oops&lt;/b&gt;");
    expect(alertEmail.text + alertEmail.subject).not.toContain("\u2014");
  });
});

describe("parseAiHealthAlertRecipients", () => {
  it("defaults to Finley and splits a list", () => {
    expect(parseAiHealthAlertRecipients(undefined)).toEqual(["finley@qsbsrollover.com"]);
    expect(parseAiHealthAlertRecipients("  ")).toEqual(["finley@qsbsrollover.com"]);
    expect(parseAiHealthAlertRecipients("A@x.com, b@y.com;not-an-email")).toEqual(["a@x.com", "b@y.com"]);
  });
});
