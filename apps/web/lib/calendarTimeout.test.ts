import { describe, it, expect, vi } from "vitest";
import { withCalendarTimeout } from "./calendarTimeout";

describe("withCalendarTimeout", () => {
  it("resolves with the call's value when it completes in time", async () => {
    const result = await withCalendarTimeout(async () => "event-123", "insert", 50);
    expect(result).toBe("event-123");
  });

  it("rejects with a timeout error when the call hangs, and aborts the signal", async () => {
    let seenSignal: AbortSignal | undefined;
    const hang = (signal: AbortSignal) => {
      seenSignal = signal;
      // Never resolves on its own — only the timeout can end this.
      return new Promise<string>(() => {});
    };
    await expect(withCalendarTimeout(hang, "insert", 20)).rejects.toThrow(
      /insert timed out after 20ms/,
    );
    // The wrapper aborts the underlying request so gaxios can cancel it.
    expect(seenSignal?.aborted).toBe(true);
  });

  it("propagates the underlying error unchanged when the call rejects fast", async () => {
    const boom = async () => {
      throw new Error("403 insufficient calendar scope");
    };
    await expect(withCalendarTimeout(boom, "insert", 50)).rejects.toThrow(
      "403 insufficient calendar scope",
    );
  });

  it("does not leave a timer that fires after a fast resolve", async () => {
    vi.useFakeTimers();
    try {
      const p = withCalendarTimeout(async () => "ok", "insert", 10_000);
      await vi.advanceTimersByTimeAsync(0);
      await expect(p).resolves.toBe("ok");
      // Advancing past the (cleared) timeout must not throw an unhandled reject.
      await vi.advanceTimersByTimeAsync(20_000);
    } finally {
      vi.useRealTimers();
    }
  });
});
