// Admin console sign-in: an email allowlist plus one shared master password.
// No database rows and no NextAuth involvement, so it runs in middleware (Edge)
// and survives a broken DB. The session is a signed cookie whose HMAC key is
// derived from ADMIN_PASSWORD: rotating the password signs everyone out.
//
// Env:
//   ADMIN_PASSWORD                  shared master password (required)
//   ADMIN_ALLOWED_EMAIL_ADDRESSES   comma-separated emails allowed to sign in
//   ADMIN_ALLOWED_EMAIL_DOMAINS     optional comma-separated domains allowed
// With no allowlist configured, nobody can sign in.

export const adminSessionCookieName = "dharma_admin_session";
export const adminSessionLifetimeSeconds = 7 * 24 * 60 * 60;
export const adminHomePath = "/admin/finance";

const sessionKeyDerivationLabel = "dharma-admin-session-v1:";

export type AdminSession = { emailAddress: string; expiresAtSeconds: number };

function normalizeEmailAddress(emailAddress: string): string {
  return emailAddress.trim().toLowerCase();
}

function configuredList(rawList: string | undefined): string[] {
  return (rawList ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmailAddress(candidateEmailAddress: string): boolean {
  const emailAddress = normalizeEmailAddress(candidateEmailAddress);
  const atSignIndex = emailAddress.lastIndexOf("@");
  if (atSignIndex <= 0 || atSignIndex === emailAddress.length - 1) return false;
  const emailDomain = emailAddress.slice(atSignIndex + 1);
  return (
    configuredList(process.env.ADMIN_ALLOWED_EMAIL_ADDRESSES).includes(emailAddress) ||
    configuredList(process.env.ADMIN_ALLOWED_EMAIL_DOMAINS).includes(emailDomain)
  );
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binaryText = "";
  for (const byte of bytes) binaryText += String.fromCharCode(byte);
  return btoa(binaryText).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToText(base64UrlText: string): string {
  const paddedBase64Text = base64UrlText.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (paddedBase64Text.length % 4)) % 4;
  return atob(paddedBase64Text + "=".repeat(paddingLength));
}

async function sha256Bytes(text: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

// Compares digests rather than raw strings so timing leaks neither content nor length.
async function constantTimeTextEquals(firstText: string, secondText: string): Promise<boolean> {
  const [firstDigest, secondDigest] = await Promise.all([sha256Bytes(firstText), sha256Bytes(secondText)]);
  let differenceAccumulator = 0;
  for (let byteIndex = 0; byteIndex < firstDigest.length; byteIndex++) {
    differenceAccumulator |= firstDigest[byteIndex] ^ secondDigest[byteIndex];
  }
  return differenceAccumulator === 0;
}

export async function isCorrectAdminPassword(candidatePassword: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  return constantTimeTextEquals(candidatePassword, adminPassword);
}

async function sessionSigningKey(): Promise<CryptoKey> {
  const derivedKeyBytes = await sha256Bytes(sessionKeyDerivationLabel + (process.env.ADMIN_PASSWORD ?? ""));
  return crypto.subtle.importKey("raw", derivedKeyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function signSessionPayload(encodedPayload: string): Promise<string> {
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    await sessionSigningKey(),
    new TextEncoder().encode(encodedPayload),
  );
  return bytesToBase64Url(new Uint8Array(signatureBuffer));
}

export async function createAdminSessionToken(emailAddress: string, nowMilliseconds = Date.now()): Promise<string> {
  const session: AdminSession = {
    emailAddress: normalizeEmailAddress(emailAddress),
    expiresAtSeconds: Math.floor(nowMilliseconds / 1000) + adminSessionLifetimeSeconds,
  };
  const encodedPayload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  return `${encodedPayload}.${await signSessionPayload(encodedPayload)}`;
}

// Re-checks the allowlist on every read, so removing an email from the env
// var revokes that person's live session on the next request.
export async function readAdminSessionToken(
  sessionToken: string | undefined,
  nowMilliseconds = Date.now(),
): Promise<AdminSession | null> {
  if (!sessionToken || !isAdminPasswordConfigured()) return null;
  const [encodedPayload, providedSignature, ...unexpectedParts] = sessionToken.split(".");
  if (!encodedPayload || !providedSignature || unexpectedParts.length > 0) return null;
  const expectedSignature = await signSessionPayload(encodedPayload);
  if (!(await constantTimeTextEquals(providedSignature, expectedSignature))) return null;
  try {
    const session = JSON.parse(base64UrlToText(encodedPayload)) as AdminSession;
    if (typeof session.emailAddress !== "string" || typeof session.expiresAtSeconds !== "number") return null;
    if (session.expiresAtSeconds * 1000 <= nowMilliseconds) return null;
    if (!isAllowedAdminEmailAddress(session.emailAddress)) return null;
    return session;
  } catch {
    return null;
  }
}

export function safeAdminRedirectPath(requestedPath: string | null | undefined): string {
  if (
    !requestedPath ||
    !(requestedPath === "/admin" || requestedPath.startsWith("/admin/") || requestedPath.startsWith("/admin?")) ||
    requestedPath.startsWith("/admin/login")
  ) {
    return adminHomePath;
  }
  return requestedPath;
}
