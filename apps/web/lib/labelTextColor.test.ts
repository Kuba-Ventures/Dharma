import { describe, it, expect } from "vitest";
import { readableTextColor } from "./labelTextColor";

describe("readableTextColor", () => {
  it("uses dark ink on bright fills", () => {
    expect(readableTextColor("#f2c960")).toBe("#1f2430"); // yellow (Billing)
    expect(readableTextColor("#F0B429")).toBe("#1f2430"); // amber (Follow-Up)
  });

  it("uses white on dark/saturated fills", () => {
    expect(readableTextColor("#E24B4A")).toBe("#ffffff"); // red (High-Priority)
    expect(readableTextColor("#7F77DD")).toBe("#ffffff"); // violet (Team-Internal)
    expect(readableTextColor("#16A765")).toBe("#ffffff"); // green
  });

  it("handles shorthand hex and a leading #", () => {
    expect(readableTextColor("#fff")).toBe("#1f2430");
    expect(readableTextColor("000")).toBe("#ffffff");
  });

  it("falls back to white on invalid input", () => {
    expect(readableTextColor("")).toBe("#ffffff");
    expect(readableTextColor("#zzzzzz")).toBe("#ffffff");
  });
});
