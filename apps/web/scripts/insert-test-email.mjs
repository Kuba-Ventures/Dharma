// Insert a test email into the user's INBOX as if it came from an external
// sender, by calling users.messages.insert. Triggers the watch (because the
// new message lands in INBOX). Webhook will see from != user and run label
// classification.
//
// Usage: cd apps/web && node scripts/insert-test-email.mjs <email>

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
if (!email) { console.error("Usage: node scripts/insert-test-email.mjs <email>"); process.exit(1); }

const prisma = new PrismaClient();
const cred = await prisma.googleCredential.findUnique({ where: { email } });
const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
auth.setCredentials({ access_token: cred.accessToken, refresh_token: cred.refreshToken, expiry_date: cred.expiresAt.getTime() });
const gmail = google.gmail({ version: "v1", auth });

const stamp = new Date().toISOString();
// Realistic content matching the "Due Diligence" label
const subject = `Following up on diligence questions [test ${stamp}]`;
const fromAddress = `Alex Chen <alex.chen.test@example.com>`;
const mime = [
  `From: ${fromAddress}`,
  `To: ${email}`,
  `Subject: ${subject}`,
  `Date: ${new Date().toUTCString()}`,
  `Message-ID: <test-${Date.now()}@example.com>`,
  `Content-Type: text/plain; charset=utf-8`,
  ``,
  `Hi Finley,`,
  ``,
  `Following up on our diligence call last week — we have a few more questions on the`,
  `financials. Specifically:`,
  ``,
  `1. Can you share the most recent QSBS rollover schedule?`,
  `2. What's the customer concentration breakdown for the top 5 accounts?`,
  `3. Have you completed the legal review of the LOI yet?`,
  ``,
  `Happy to hop on a call to walk through these.`,
  ``,
  `Thanks,`,
  `Alex`,
].join("\r\n");

const raw = Buffer.from(mime).toString("base64url");

const res = await gmail.users.messages.insert({
  userId: "me",
  internalDateSource: "dateHeader",
  requestBody: {
    raw,
    labelIds: ["INBOX", "UNREAD"],
  },
});

console.log(JSON.stringify({ sentAt: stamp, messageId: res.data.id, threadId: res.data.threadId, subject, from: fromAddress }, null, 2));
await prisma.$disconnect();
