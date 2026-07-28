import { describe, it, expect } from "vitest";
import {
  DHARMA_BLOCK_DESCRIPTION,
  DHARMA_BLOCK_EXT_KEY,
  isDharmaBlockEvent,
} from "./dharmaBlock";

describe("isDharmaBlockEvent", () => {
  it("matches on the durable extendedProperties marker", () => {
    expect(
      isDharmaBlockEvent({
        extendedProperties: { private: { [DHARMA_BLOCK_EXT_KEY]: "1" } },
      }),
    ).toBe(true);
  });

  it("matches legacy blocks on the stable description (no marker)", () => {
    expect(isDharmaBlockEvent({ description: DHARMA_BLOCK_DESCRIPTION })).toBe(true);
  });

  it("tolerates surrounding whitespace on the description", () => {
    expect(
      isDharmaBlockEvent({ description: `  ${DHARMA_BLOCK_DESCRIPTION}\n` }),
    ).toBe(true);
  });

  it("does not match a real meeting", () => {
    expect(
      isDharmaBlockEvent({
        description: "Kickoff with the design team",
        extendedProperties: { private: { someOtherApp: "1" } },
      }),
    ).toBe(false);
  });

  it("does not match on an unrelated marker value", () => {
    expect(
      isDharmaBlockEvent({
        extendedProperties: { private: { [DHARMA_BLOCK_EXT_KEY]: "0" } },
      }),
    ).toBe(false);
  });

  it("handles events with no description or extendedProperties", () => {
    expect(isDharmaBlockEvent({})).toBe(false);
    expect(isDharmaBlockEvent({ description: null, extendedProperties: null })).toBe(false);
  });
});
