import { describe, expect, it } from "vitest";
import { isInvalidGrant } from "./googleErrors";

describe("isInvalidGrant", () => {
  it("detects the googleapis Gaxios shape (error as string)", () => {
    expect(
      isInvalidGrant({ response: { data: { error: "invalid_grant" } } }),
    ).toBe(true);
  });

  it("detects a bare message", () => {
    expect(isInvalidGrant({ message: "invalid_grant" })).toBe(true);
  });

  it("ignores unrelated calendar errors", () => {
    expect(
      isInvalidGrant({ response: { data: { error: { message: "Not Found" } } } }),
    ).toBe(false);
    expect(isInvalidGrant({ message: "Rate Limit Exceeded" })).toBe(false);
  });

  it("is safe on null / undefined / non-objects", () => {
    expect(isInvalidGrant(null)).toBe(false);
    expect(isInvalidGrant(undefined)).toBe(false);
    expect(isInvalidGrant("invalid_grant")).toBe(false);
  });
});
