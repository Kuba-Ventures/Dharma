import { describe, expect, it } from "vitest";
import { formatUsd, netPromoterScore, priorComparisonNote } from "./adminFormatting";
import { monthlyRecurringRevenueUsd } from "./adminVendors";

describe("adminFormatting", () => {
  it("shows cents below $100 and whole dollars above", () => {
    expect(formatUsd(3.123)).toBe("$3.12");
    expect(formatUsd(412.4)).toBe("$412");
    expect(formatUsd(null)).toBe("-");
  });

  it("computes NPS as promoters minus detractors", () => {
    expect(netPromoterScore([10, 9, 8, 7, 3])).toBe(20);
    expect(netPromoterScore([])).toBeNull();
  });

  it("writes a prior-period note", () => {
    expect(priorComparisonNote(116, 100, String)).toBe("prior 100 · +16%");
    expect(priorComparisonNote(5, 0, String)).toBe("prior 0");
  });
});

describe("monthlyRecurringRevenueUsd", () => {
  it("normalizes annual, monthly and discounted subscriptions to a month", () => {
    const price = (unitAmount: number, interval: string) => ({
      unit_amount: unitAmount,
      recurring: { interval, interval_count: 1 },
    });
    expect(
      monthlyRecurringRevenueUsd([
        { id: "a", items: { data: [{ price: price(2000, "month") }] } },
        { id: "b", items: { data: [{ price: price(24000, "year"), quantity: 2 }] } },
        { id: "c", items: { data: [{ price: price(1000, "month") }] }, discount: { coupon: { percent_off: 50 } } },
      ]),
    ).toBe(65);
  });
});
