import { describe, it, expect, afterEach } from "vitest";
import { planForUser } from "./aiLimits";

// planForUser is the pure, env-driven seam that Stripe billing (task #7) will
// later replace. Everything else in aiGuard hits the DB, so we cover the one
// piece that can be tested in isolation.
describe("planForUser", () => {
  const original = process.env.AI_PAID_USER_IDS;
  afterEach(() => {
    if (original === undefined) delete process.env.AI_PAID_USER_IDS;
    else process.env.AI_PAID_USER_IDS = original;
  });

  it("defaults everyone to free when the allowlist is unset", () => {
    delete process.env.AI_PAID_USER_IDS;
    expect(planForUser("user_abc")).toBe("free");
  });

  it("defaults to free when the allowlist is empty", () => {
    process.env.AI_PAID_USER_IDS = "";
    expect(planForUser("user_abc")).toBe("free");
  });

  it("marks an id in the allowlist as paid", () => {
    process.env.AI_PAID_USER_IDS = "user_abc,user_def";
    expect(planForUser("user_abc")).toBe("paid");
    expect(planForUser("user_def")).toBe("paid");
  });

  it("keeps ids not in the allowlist on free", () => {
    process.env.AI_PAID_USER_IDS = "user_abc";
    expect(planForUser("user_xyz")).toBe("free");
  });

  it("tolerates whitespace around ids", () => {
    process.env.AI_PAID_USER_IDS = " user_abc , user_def ";
    expect(planForUser("user_abc")).toBe("paid");
    expect(planForUser("user_def")).toBe("paid");
  });
});
