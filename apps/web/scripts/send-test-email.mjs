// Send a test email to the test inbox via Gmail API (from→to same address).
// Verifies the push pipeline by triggering a real "new message" event.
//
// Usage: cd apps/web && node scripts/send-test-email.mjs <email>

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

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/send-test-email.mjs <email>");
  process.exit(1);
}

const prisma = new PrismaClient();
const cred = await prisma.googleCredential.findUnique({ where: { email } });
if (!cred) {
  console.error(`No GoogleCredential for ${email}`);
  process.exit(1);
}

const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
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

const stamp = new Date().toISOString();
const subject = `[Dharma push-pipeline test ${stamp}]`;
// Make the From address a different address so msg.from doesn't include user's
// email and the webhook handler doesn't skip it (lib/gmail.ts:133).
// Spoof a third-party address using a separate sender — actually we can't do
// that without SMTP credentials, so instead we'll send normally but include
// "Dharma push-pipeline test" in the subject so we can grep for it.
const mime = [
  `From: ${email}`,
  `To: ${email}`,
  `Subject: ${subject}`,
  `Content-Type: text/plain; charset=utf-8`,
  ``,
  `Phase-3 end-to-end test message. Sent ${stamp}. If you see this labeled in <5s, the pipeline works.`,
].join("\r\n");

const raw = Buffer.from(mime).toString("base64url");

const res = await gmail.users.messages.send({
  userId: "me",
  requestBody: { raw },
});
console.log(JSON.stringify({ sentAt: stamp, messageId: res.data.id, threadId: res.data.threadId, subject }, null, 2));
await prisma.$disconnect();
