import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for issue #113: makeAuthForUser's "tokens" handler must
// persist a rotated Google refresh token. Google rotates the refresh token on
// every refresh while the OAuth client is in "Testing" publishing status;
// dropping it left the stored token stale after the first refresh, so the next
// refresh failed with invalid_grant (~1h after each login), breaking drafting
// and auto-labeling.

const updateMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("./prisma", () => ({
  prisma: {
    googleCredential: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

// Capture the OAuth2 client's "tokens" listener so the test can drive a refresh.
let tokensHandler: ((tokens: Record<string, unknown>) => unknown) | undefined;

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials = vi.fn();
        on(event: string, handler: (t: Record<string, unknown>) => unknown) {
          if (event === "tokens") tokensHandler = handler;
        }
      },
    },
    gmail: vi.fn(),
    calendar: vi.fn(),
  },
}));

import { makeAuthForUser } from "./gmail";

describe("makeAuthForUser — refresh-token persistence (#113)", () => {
  beforeEach(() => {
    updateMock.mockReset();
    findUniqueMock.mockReset();
    tokensHandler = undefined;
    findUniqueMock.mockResolvedValue({
      userId: "u1",
      accessToken: "old-access",
      refreshToken: "old-refresh",
      expiresAt: new Date(0),
    });
  });

  it("persists a rotated refresh_token when Google returns one", async () => {
    await makeAuthForUser("u1");
    expect(tokensHandler).toBeTypeOf("function");

    await tokensHandler!({
      access_token: "new-access",
      refresh_token: "new-refresh",
      expiry_date: 1000,
    });

    expect(updateMock).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: {
        accessToken: "new-access",
        refreshToken: "new-refresh",
        expiresAt: new Date(1000),
      },
    });
  });

  it("leaves the stored refresh token untouched when the refresh omits one", async () => {
    await makeAuthForUser("u1");

    await tokensHandler!({ access_token: "new-access", expiry_date: 2000 });

    expect(updateMock).toHaveBeenCalledTimes(1);
    const data = (updateMock.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty("refreshToken");
    expect(data.accessToken).toBe("new-access");
    expect(data.expiresAt).toEqual(new Date(2000));
  });

  it("swallows a persistence failure instead of throwing from the emitter", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    updateMock.mockRejectedValueOnce(new Error("db down"));
    await makeAuthForUser("u1");

    await expect(
      tokensHandler!({ access_token: "new-access", refresh_token: "new-refresh" }),
    ).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
