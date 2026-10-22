import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../lib/aiHealth/aiHealthJob", () => ({ runAiHealthCheck: vi.fn() }));

describe("/api/cron/ai-health caching", () => {
  it("can never be served from a Next.js cache", async () => {
    const routeModule = await import("./route");
    expect(routeModule.dynamic).toBe("force-dynamic");
    expect(routeModule.fetchCache).toBe("force-no-store");
  });
});
