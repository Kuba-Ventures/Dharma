import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAdminSessionToken,
  isAllowedAdminEmailAddress,
  isCorrectAdminPassword,
  readAdminSessionToken,
  safeAdminRedirectPath,
} from "./adminSession";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.ADMIN_PASSWORD = "correct horse battery staple";
  process.env.ADMIN_ALLOWED_EMAIL_ADDRESSES = "finley@qsbsrollover.com, Owner@Example.com";
  delete process.env.ADMIN_ALLOWED_EMAIL_DOMAINS;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("admin allowlist", () => {
  it("allows listed emails case-insensitively and nobody else", () => {
    expect(isAllowedAdminEmailAddress("Finley@QSBSRollover.com")).toBe(true);
    expect(isAllowedAdminEmailAddress("owner@example.com")).toBe(true);
    expect(isAllowedAdminEmailAddress("someone@qsbsrollover.com")).toBe(false);
    expect(isAllowedAdminEmailAddress("finley@qsbsrollover.com.evil.io")).toBe(false);
    expect(isAllowedAdminEmailAddress("")).toBe(false);
  });

  it("allows a whole domain only when configured", () => {
    process.env.ADMIN_ALLOWED_EMAIL_DOMAINS = "qsbsrollover.com";
    expect(isAllowedAdminEmailAddress("someone@qsbsrollover.com")).toBe(true);
    expect(isAllowedAdminEmailAddress("someone@evilqsbsrollover.com")).toBe(false);
  });

  it("lets nobody in when no allowlist is configured", () => {
    delete process.env.ADMIN_ALLOWED_EMAIL_ADDRESSES;
    expect(isAllowedAdminEmailAddress("finley@qsbsrollover.com")).toBe(false);
  });
});

describe("admin password", () => {
  it("matches the master password exactly", async () => {
    expect(await isCorrectAdminPassword("correct horse battery staple")).toBe(true);
    expect(await isCorrectAdminPassword("correct horse battery")).toBe(false);
    expect(await isCorrectAdminPassword("")).toBe(false);
  });

  it("rejects everything when no password is configured", async () => {
    delete process.env.ADMIN_PASSWORD;
    expect(await isCorrectAdminPassword("")).toBe(false);
  });
});

describe("admin session token", () => {
  it("round-trips the signed-in email", async () => {
    const token = await createAdminSessionToken("Finley@qsbsrollover.com");
    expect((await readAdminSessionToken(token))?.emailAddress).toBe("finley@qsbsrollover.com");
  });

  it("rejects tampered, expired, rotated and de-listed sessions", async () => {
    const token = await createAdminSessionToken("finley@qsbsrollover.com");
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ emailAddress: "finley@qsbsrollover.com", expiresAtSeconds: 9_999_999_999 }),
    ).toString("base64url");
    expect(await readAdminSessionToken(`${forged}.${signature}`)).toBeNull();
    expect(await readAdminSessionToken(`${payload}.${signature}x`)).toBeNull();
    expect(await readAdminSessionToken(token, Date.now() + 8 * 24 * 60 * 60 * 1000)).toBeNull();

    process.env.ADMIN_ALLOWED_EMAIL_ADDRESSES = "owner@example.com";
    expect(await readAdminSessionToken(token)).toBeNull();

    process.env.ADMIN_ALLOWED_EMAIL_ADDRESSES = "finley@qsbsrollover.com";
    process.env.ADMIN_PASSWORD = "rotated password";
    expect(await readAdminSessionToken(token)).toBeNull();
  });
});

describe("safeAdminRedirectPath", () => {
  it("only redirects inside the admin console", () => {
    expect(safeAdminRedirectPath("/admin/growth?range=7d")).toBe("/admin/growth?range=7d");
    expect(safeAdminRedirectPath("https://evil.example/admin")).toBe("/admin/finance");
    expect(safeAdminRedirectPath("//evil.example")).toBe("/admin/finance");
    expect(safeAdminRedirectPath("/administrator")).toBe("/admin/finance");
    expect(safeAdminRedirectPath("/admin/login")).toBe("/admin/finance");
    expect(safeAdminRedirectPath(null)).toBe("/admin/finance");
  });
});
