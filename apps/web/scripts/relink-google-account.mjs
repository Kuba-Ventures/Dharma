// Delete an authenticated user's stale OAuth Account + Session rows so they
// can re-link by signing in again. Use when NextAuth throws
// OAuthAccountNotLinked for a User you know should be signing in — the User
// + their data are preserved, only the Account link record is dropped.
//
// Usage: cd apps/web && node scripts/relink-google-account.mjs <email>

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
try {
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/relink-google-account.mjs <email>");
  process.exit(1);
}

const prisma = new PrismaClient();

const user = await prisma.user.findUnique({
  where: { email },
  select: { id: true, accounts: { select: { id: true, provider: true, providerAccountId: true } } },
});

if (!user) {
  console.error(`No User row for ${email}`);
  process.exit(1);
}

console.log(`User: ${user.id}`);
console.log(`Accounts to delete: ${user.accounts.length}`);
for (const a of user.accounts) {
  console.log(`  - ${a.provider} (providerAccountId=${a.providerAccountId})`);
}

const deletedAccounts = await prisma.account.deleteMany({
  where: { userId: user.id },
});
const deletedSessions = await prisma.session.deleteMany({
  where: { userId: user.id },
});

console.log(`\nDeleted ${deletedAccounts.count} Account row(s) and ${deletedSessions.count} Session row(s).`);
console.log("\nNext: sign in at https://www.dharmaautomations.com/login. NextAuth will create a fresh Account row tied to your existing User. Your data is untouched.");

await prisma.$disconnect();
