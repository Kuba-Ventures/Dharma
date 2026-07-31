import { describe, it, expect } from "vitest";
import { resolveRecipientName, signOffName, fromDisplayFirstName } from "./recipientName";

describe("signOffName", () => {
  it("pulls the name after a sign-off", () => {
    expect(signOffName("Sounds good.\n\nThanks,\nJoe")).toBe("Joe");
  });
  it("ignores a formal signature block below the -- delimiter", () => {
    const body = "Let me know.\n\nThanks,\nJoe\n\n-- \nFinley Underwood\nB.S. in Commerce";
    expect(signOffName(body)).toBe("Joe");
  });
  it("takes only the first name from a full name", () => {
    expect(signOffName("Best,\nJoe Martinez")).toBe("Joe");
  });
  it("returns empty when there's no clear sign-off name", () => {
    expect(signOffName("Are you free tomorrow at 4pm?")).toBe("");
  });
});

describe("fromDisplayFirstName", () => {
  it("uses the display name", () => {
    expect(fromDisplayFirstName('"Finley Underwood" <f@x.com>')).toBe("Finley");
    expect(fromDisplayFirstName("Finley Underwood <f@x.com>")).toBe("Finley");
  });
  it("ignores a bare email with no display name", () => {
    expect(fromDisplayFirstName("joe@example.com")).toBe("");
  });
});

describe("resolveRecipientName", () => {
  it("prefers the sign-off over the From name", () => {
    expect(resolveRecipientName("Finley Underwood <f@x.com>", "Thanks,\nJoe")).toBe("Joe");
  });
  it("falls back to the From display name", () => {
    expect(resolveRecipientName("Finley Underwood <f@x.com>", "Are you free tomorrow?")).toBe("Finley");
  });
  it("returns empty when neither is available", () => {
    expect(resolveRecipientName("nobody@example.com", "no signature here")).toBe("");
  });
});
