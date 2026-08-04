import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertMock = vi.fn();
const findManyMock = vi.fn();
const findUniqueMock = vi.fn();
const deleteManyMock = vi.fn();
const deleteMock = vi.fn();
const updateMock = vi.fn();

vi.mock("./prisma", () => ({
  prisma: {
    learnedLabel: {
      upsert: (...a: unknown[]) => upsertMock(...a),
      findMany: (...a: unknown[]) => findManyMock(...a),
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      deleteMany: (...a: unknown[]) => deleteManyMock(...a),
      delete: (...a: unknown[]) => deleteMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
    },
  },
}));

import {
  parseSender,
  learnLabel,
  resolveLearnedLabels,
  unlearnLabel,
  isUserLabelId,
  DOMAIN_PROMOTION_THRESHOLD,
} from "./smartLabels";

beforeEach(() => {
  for (const m of [upsertMock, findManyMock, findUniqueMock, deleteManyMock, deleteMock, updateMock]) m.mockReset();
});

describe("parseSender", () => {
  it("parses a display-name + angle-bracket address", () => {
    expect(parseSender("Jim Underwood <jimunderdog44@yahoo.com>")).toEqual({
      address: "jimunderdog44@yahoo.com",
      domain: "yahoo.com",
    });
  });

  it("parses a bare address", () => {
    expect(parseSender("notifications@vercel.com")).toEqual({
      address: "notifications@vercel.com",
      domain: "vercel.com",
    });
  });

  it("lowercases and strips mailto:", () => {
    expect(parseSender("mailto:Bot@Vercel.COM")).toEqual({
      address: "bot@vercel.com",
      domain: "vercel.com",
    });
  });

  it("handles a name without brackets by picking the address token", () => {
    expect(parseSender("Jim jim@yahoo.com")).toEqual({
      address: "jim@yahoo.com",
      domain: "yahoo.com",
    });
  });

  it("returns nulls for junk / missing address", () => {
    expect(parseSender("")).toEqual({ address: null, domain: null });
    expect(parseSender("no address here")).toEqual({ address: null, domain: null });
    expect(parseSender("@nolocalpart.com")).toEqual({ address: null, domain: null });
    expect(parseSender("bob@localhost")).toEqual({ address: null, domain: null }); // no dot in domain
  });
});

describe("isUserLabelId", () => {
  it("accepts user labels, rejects system labels", () => {
    expect(isUserLabelId("Label_123")).toBe(true);
    for (const sys of ["INBOX", "STARRED", "IMPORTANT", "CATEGORY_PERSONAL", "UNREAD", "SENT"]) {
      expect(isUserLabelId(sys)).toBe(false);
    }
  });
});

describe("learnLabel", () => {
  it("upserts both an address and a domain association", async () => {
    upsertMock.mockResolvedValue({});
    await learnLabel({
      userId: "u1",
      from: "Jim <jim@yahoo.com>",
      labelName: "Family",
      gmailLabelId: "Label_9",
    });
    expect(upsertMock).toHaveBeenCalledTimes(2);
    const keys = upsertMock.mock.calls.map((c) => (c[0] as any).where.userId_senderKey_labelName.senderKey);
    expect(keys).toContain("jim@yahoo.com");
    expect(keys).toContain("@yahoo.com");
    const addressCreate = upsertMock.mock.calls.find(
      (c) => (c[0] as any).create.senderKey === "jim@yahoo.com"
    )![0] as any;
    expect(addressCreate.create.matchType).toBe("address");
    expect(addressCreate.create.gmailLabelId).toBe("Label_9");
  });

  it("no-ops on an unparseable sender", async () => {
    await learnLabel({ userId: "u1", from: "garbage", labelName: "Family" });
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

describe("resolveLearnedLabels", () => {
  it("applies exact-address matches immediately", async () => {
    findManyMock.mockResolvedValue([
      { labelName: "Family", gmailLabelId: "Label_9", matchType: "address", sampleCount: 1 },
    ]);
    const out = await resolveLearnedLabels("u1", "jim@yahoo.com");
    expect(out).toEqual([{ labelName: "Family", gmailLabelId: "Label_9" }]);
  });

  it("suppresses domain matches below the promotion threshold", async () => {
    findManyMock.mockResolvedValue([
      { labelName: "Integrations", gmailLabelId: "Label_5", matchType: "domain", sampleCount: DOMAIN_PROMOTION_THRESHOLD - 1 },
    ]);
    expect(await resolveLearnedLabels("u1", "bot@vercel.com")).toEqual([]);
  });

  it("applies domain matches at/above the threshold", async () => {
    findManyMock.mockResolvedValue([
      { labelName: "Integrations", gmailLabelId: "Label_5", matchType: "domain", sampleCount: DOMAIN_PROMOTION_THRESHOLD },
    ]);
    expect(await resolveLearnedLabels("u1", "bot@vercel.com")).toEqual([
      { labelName: "Integrations", gmailLabelId: "Label_5" },
    ]);
  });

  it("dedupes by label name, preferring the address match's gmailLabelId", async () => {
    findManyMock.mockResolvedValue([
      { labelName: "Integrations", gmailLabelId: "Label_domain", matchType: "domain", sampleCount: 5 },
      { labelName: "Integrations", gmailLabelId: "Label_addr", matchType: "address", sampleCount: 1 },
    ]);
    const out = await resolveLearnedLabels("u1", "bot@vercel.com");
    expect(out).toEqual([{ labelName: "Integrations", gmailLabelId: "Label_addr" }]);
  });

  it("returns nothing for an unparseable sender (no query)", async () => {
    expect(await resolveLearnedLabels("u1", "junk")).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

describe("unlearnLabel", () => {
  it("deletes the address row and decrements the domain row", async () => {
    deleteManyMock.mockResolvedValue({ count: 1 });
    findUniqueMock.mockResolvedValue({ id: "d1", sampleCount: 3 });
    await unlearnLabel({ userId: "u1", from: "jim@yahoo.com", labelName: "Family" });
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { userId: "u1", senderKey: "jim@yahoo.com", labelName: "Family" },
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { sampleCount: { decrement: 1 } },
    });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("deletes the domain row when it would drop to zero", async () => {
    deleteManyMock.mockResolvedValue({ count: 1 });
    findUniqueMock.mockResolvedValue({ id: "d1", sampleCount: 1 });
    await unlearnLabel({ userId: "u1", from: "jim@yahoo.com", labelName: "Family" });
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "d1" } });
    expect(updateMock).not.toHaveBeenCalled();
  });
});

// Regression: Smart Labeling must never break core labeling. Before this, a DB
// error in resolveLearnedLabels (most importantly the LearnedLabel table not
// yet migrated after #121 shipped) threw out of the shared apply block and
// skipped the message's rule/AI labels entirely — labeling silently stopped.
describe("fault isolation — DB errors never throw", () => {
  const dbError = () => Promise.reject(new Error('relation "LearnedLabel" does not exist'));

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("resolveLearnedLabels degrades to [] when the query fails", async () => {
    findManyMock.mockImplementation(dbError);
    await expect(resolveLearnedLabels("u1", "jim@yahoo.com")).resolves.toEqual([]);
  });

  it("learnLabel swallows a DB error instead of throwing", async () => {
    upsertMock.mockImplementation(dbError);
    await expect(
      learnLabel({ userId: "u1", from: "jim@yahoo.com", labelName: "Family" })
    ).resolves.toBeUndefined();
  });

  it("unlearnLabel swallows a DB error instead of throwing", async () => {
    deleteManyMock.mockImplementation(dbError);
    await expect(
      unlearnLabel({ userId: "u1", from: "jim@yahoo.com", labelName: "Family" })
    ).resolves.toBeUndefined();
  });
});
