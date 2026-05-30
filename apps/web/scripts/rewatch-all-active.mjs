// One-time recovery: re-register Pub/Sub watch + reset gmailHistoryId for
// every user with at least one enabled Label OR an enabled LabelPreset.
// Resets the historyId so we drop any stale/expired-from-Gmail-buffer
// startHistoryId that's locking the webhook into a 404 loop.
//
// Skips users whose OAuth refresh token has been revoked (unauthorized_client) —
// they'll be re-seeded the next time they sign in.
//
// Usage: cd apps/web && node scripts/rewatch-all-active.mjs [--dry-run]

import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnvFile(p) {
  try {
    const env = readFileSync(p, "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnvFile(resolve(__dirname, "../.vercel/.env.production.local"));

const dryRun = process.argv.includes("--dry-run");
const topic = process.env.GOOGLE_PUBSUB_TOPIC;
if (!topic) {
  console.error("GOOGLE_PUBSUB_TOPIC not set");
  process.exit(1);
}

const prisma = new PrismaClient();

const candidates = await prisma.googleCredential.findMany({
  where: {
    user: {
      OR: [
        { labels: { some: { enabled: true } } },
        { labelPreset: { enabled: true } },
      ],
    },
  },
  select: {
    userId: true,
    email: true,
    accessToken: true,
    refreshToken: true,
    gmailHistoryId: true,
    gmailWatchExpiry: true,
  },
});

console.log(`Found ${candidates.length} candidate(s) with labels or preset enabled`);
if (dryRun) {
  for (const c of candidates) console.log(`  - ${c.email} (current historyId=${c.gmailHistoryId})`);
  await prisma.$disconnect();
  process.exit(0);
}

const results = [];
for (const cred of candidates) {
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ access_token: cred.accessToken, refresh_token: cred.refreshToken });
  const gmail = google.gmail({ version: "v1", auth });

  try {
    const watchRes = await gmail.users.watch({
      userId: "me",
      requestBody: { topicName: topic, labelIds: ["INBOX"] },
    });
    const expiry = new Date(Number(watchRes.data.expiration));
    const profile = await gmail.users.getProfile({ userId: "me" });
    const historyId = String(profile.data.historyId ?? "");

    await prisma.googleCredential.update({
      where: { email: cred.email },
      data: { gmailHistoryId: historyId, gmailWatchExpiry: expiry },
    });
    console.log(`OK ${cred.email} historyId=${historyId} expires=${expiry.toISOString()}`);
    results.push({ email: cred.email, status: "ok", historyId });
  } catch (err) {
    const msg = err?.message ?? String(err);
    console.warn(`FAIL ${cred.email}: ${msg}`);
    results.push({ email: cred.email, status: "fail", error: msg });
  }
}

await prisma.$disconnect();
console.log(`\nDone. ok=${results.filter((r) => r.status === "ok").length} fail=${results.filter((r) => r.status === "fail").length}`);
