// Check if the most recent test-pipeline email is in the user's inbox and
// what labels are on it. Use to verify Phase 3.

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
const messageId = process.argv[3];

const prisma = new PrismaClient();
const cred = await prisma.googleCredential.findUnique({ where: { email } });
const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
auth.setCredentials({
  access_token: cred.accessToken,
  refresh_token: cred.refreshToken,
  expiry_date: cred.expiresAt.getTime(),
});
auth.on("tokens", async (tokens) => {
  await prisma.googleCredential.update({
    where: { email },
    data: { accessToken: tokens.access_token ?? cred.accessToken, expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3_600_000) },
  });
});

const gmail = google.gmail({ version: "v1", auth });

if (messageId) {
  const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "metadata", metadataHeaders: ["From", "Subject", "Date"] });
  console.log(JSON.stringify({
    id: res.data.id,
    threadId: res.data.threadId,
    labelIds: res.data.labelIds,
    snippet: res.data.snippet,
    headers: res.data.payload?.headers,
  }, null, 2));
} else {
  const list = await gmail.users.messages.list({ userId: "me", q: "subject:Dharma push-pipeline test", maxResults: 5 });
  console.log(JSON.stringify(list.data, null, 2));
}
await prisma.$disconnect();
