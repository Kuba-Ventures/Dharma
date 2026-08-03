import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for the "labels stop a few hours after login" bug.
//
// The refresh-token-rotation fix (#113) was applied only to makeAuthForUser,
// but the hot-path Gmail calls — getNewMessageIds, getMessage, createDraft,
// getProfileHistoryId, setupGmailWatch, renewGmailWatch — built their own
// OAuth2 client from raw tokens with NO "tokens" listener. When Google rotated
// the refresh token on the first post-expiry refresh (~1h after login), the new
// token was discarded and the stored one went stale, so every later Gmail call
// failed with invalid_grant until the user logged in again.
//
// These tests pin the fix: each hot-path function must go through
// makeAuthForUser, which is proven here by asserting it installs an
// on("tokens") listener AND that a rotated refresh_token gets persisted.

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

// Capture the OAuth2 client's "tokens" listener so each test can confirm the
// call routed through makeAuthForUser (raw-token clients never register one)
// and then drive a rotation through it.
let tokensHandler: ((tokens: Record<string, unknown>) => unknown) | undefined;

const gmailApi = {
  users: {
    history: { list: vi.fn().mockResolvedValue({ data: { history: [] } }) },
    messages: {
      get: vi.fn().mockResolvedValue({
        data: { threadId: "t1", payload: { headers: [] } },
      }),
    },
    drafts: { create: vi.fn().mockResolvedValue({ data: { id: "d1" } }) },
    getProfile: vi.fn().mockResolvedValue({ data: { historyId: "999" } }),
    watch: vi.fn().mockResolvedValue({ data: { expiration: "1700000000000" } }),
  },
};

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
    gmail: vi.fn(() => gmailApi),
    calendar: vi.fn(),
  },
}));

import {
  getNewMessageIds,
  getMessage,
  createDraft,
  getProfileHistoryId,
} from "./gmail";

beforeEach(() => {
  updateMock.mockReset();
  findUniqueMock.mockReset();
  tokensHandler = undefined;
  // expiresAt in the past mirrors the real failure window: an expired access
  // token is exactly when the library refreshes and Google rotates the token.
  findUniqueMock.mockResolvedValue({
    userId: "u1",
    accessToken: "old-access",
    refreshToken: "old-refresh",
    expiresAt: new Date(0),
  });
});

describe("hot-path Gmail calls persist rotated refresh tokens", () => {
  const cases: Array<{ name: string; run: () => Promise<unknown> }> = [
    { name: "getNewMessageIds", run: () => getNewMessageIds("u1", "100") },
    { name: "getMessage", run: () => getMessage("u1", "m1", "me@example.com") },
    { name: "getProfileHistoryId", run: () => getProfileHistoryId("u1") },
    {
      name: "createDraft",
      run: () =>
        createDraft("u1", {
          from: "me@example.com",
          to: "them@example.com",
          subject: "Hi",
          body: "Body",
          threadId: "t1",
          inReplyTo: "<a>",
          references: "<a>",
        }),
    },
  ];

  for (const { name, run } of cases) {
    it(`${name} registers a "tokens" persistence listener (routes through makeAuthForUser)`, async () => {
      await run();
      expect(findUniqueMock).toHaveBeenCalledWith({ where: { userId: "u1" } });
      expect(tokensHandler).toBeTypeOf("function");
    });

    it(`${name} persists a rotated refresh_token instead of dropping it`, async () => {
      await run();
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
  }
});
