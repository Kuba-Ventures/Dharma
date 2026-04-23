import { createHmac, timingSafeEqual } from "crypto";

export function generateExtensionToken(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET!;
  const hmac = createHmac("sha256", secret).update(userId).digest("hex");
  return Buffer.from(`${userId}:${hmac}`).toString("base64url");
}

export function verifyExtensionToken(token: string): string | null {
  try {
    const secret = process.env.NEXTAUTH_SECRET!;
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) return null;
    const userId = decoded.slice(0, colonIdx);
    const hmac = decoded.slice(colonIdx + 1);
    const expected = createHmac("sha256", secret).update(userId).digest("hex");
    if (!timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null;
    return userId;
  } catch {
    return null;
  }
}
