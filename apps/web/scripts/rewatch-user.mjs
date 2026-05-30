// Re-register a user's Gmail Pub/Sub watch against the current
// GOOGLE_PUBSUB_TOPIC. Surfaces the real error if gmail.users.watch fails
// (setupGmailWatch in lib/gmail.ts swallows it). Updates gmailHistoryId and
// gmailWatchExpiry on success.
//
// Usage: cd apps/web && node scripts/rewatch-user.mjs <email>

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

// Load production env first; do not let stale apps/web/.env (which points at
// the retired dharma-491321 project) win over the live Vercel-stored value.
loadEnvFile(resolve(__dirname, "../.vercel/.env.production.local"));

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/rewatch-user.mjs <email>");
  process.exit(1);
}

const topic = process.env.GOOGLE_PUBSUB_TOPIC;
if (!topic) {
  console.error("GOOGLE_PUBSUB_TOPIC is not set in env — cannot register watch");
  process.exit(1);
}

const prisma = new PrismaClient();

const cred = await prisma.googleCredential.findUnique({ where: { email } });
if (!cred) {
  console.error(`No GoogleCredential for ${email}`);
  process.exit(1);
}

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
auth.setCredentials({
  access_token: cred.accessToken,
  refresh_token: cred.refreshToken,
  expiry_date: cred.expiresAt.getTime(),
});
auth.on("tokens", async (tokens) => {
  await prisma.googleCredential.update({
    where: { email },
    data: {
      accessToken: tokens.access_token ?? cred.accessToken,
      expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3_600_000),
    },
  });
});

const gmail = google.gmail({ version: "v1", auth });

console.log(`Registering watch for ${email} → topic=${topic}`);

try {
  const res = await gmail.users.watch({
    userId: "me",
    requestBody: { topicName: topic, labelIds: ["INBOX"] },
  });
  const expiration = new Date(Number(res.data.expiration));
  const profile = await gmail.users.getProfile({ userId: "me" });
  const historyId = String(profile.data.historyId ?? "");

  await prisma.googleCredential.update({
    where: { email },
    data: { gmailHistoryId: historyId, gmailWatchExpiry: expiration },
  });

  console.log(`OK — historyId=${historyId} watch expires ${expiration.toISOString()}`);
} catch (err) {
  console.error("FAIL — gmail.users.watch threw:");
  console.error(JSON.stringify({
    message: err.message,
    code: err.code,
    errors: err.errors,
    response: err.response?.data,
  }, null, 2));
  process.exit(2);
} finally {
  await prisma.$disconnect();
}
