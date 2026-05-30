// Read-only DB inspection.
// Usage:
//   cd apps/web && vercel env pull .env.local --environment=production
//   node scripts/inspect-user.mjs <email>

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
  console.error("Usage: node scripts/inspect-user.mjs <email>");
  process.exit(1);
}

const prisma = new PrismaClient();

const user = await prisma.user.findUnique({
  where: { email },
  include: {
    accounts: true,
    googleCredential: true,
    sessions: { take: 3 },
  },
});

if (!user) {
  console.log(`No User row for ${email}`);
} else {
  console.log("User:", { id: user.id, email: user.email, createdAt: user.createdAt });
  console.log("Accounts:", user.accounts.map(a => ({
    provider: a.provider,
    providerAccountId: a.providerAccountId,
    hasRefresh: !!a.refresh_token,
    scope: a.scope?.slice(0, 80),
  })));
  console.log("GoogleCredential:", user.googleCredential ? {
    email: user.googleCredential.email,
    hasRefresh: !!user.googleCredential.refreshToken,
    expiresAt: user.googleCredential.expiresAt,
  } : null);
  console.log("Sessions count (sample):", user.sessions.length);
}

// Also check for orphans
const orphanAccounts = await prisma.account.findMany({
  where: { user: { email } },
  select: { id: true, provider: true, providerAccountId: true, userId: true },
});
console.log("\nAll Account rows by email match:", orphanAccounts);

await prisma.$disconnect();
