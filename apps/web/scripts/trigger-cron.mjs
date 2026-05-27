// Manually fire /api/cron/awards against production. Pulls CRON_SECRET from
// Vercel's production env vars so you don't have to copy-paste it. Cleans up
// the temp env file when done.
//
// Usage: cd apps/web && node scripts/trigger-cron.mjs

import { execSync } from "node:child_process";
import { readFileSync, unlinkSync, existsSync } from "node:fs";

const TARGET_URL = "https://dharma-lake.vercel.app/api/cron/awards";
const TMP_FILE = ".env.cron-trigger-temp";

try {
  console.log("Pulling production env from Vercel…");
  execSync(`vercel env pull ${TMP_FILE} --environment=production --yes`, {
    stdio: ["ignore", "ignore", "inherit"],
  });

  const envContent = readFileSync(TMP_FILE, "utf-8");
  const match = envContent.match(/^CRON_SECRET=(.+)$/m);
  const secret = match?.[1]?.replace(/^["']|["']$/g, "").trim();

  if (!secret) {
    console.error("CRON_SECRET not found in Vercel production env.");
    console.error("Add it: Vercel → Settings → Environment Variables → CRON_SECRET");
    process.exit(1);
  }

  console.log(`Triggering ${TARGET_URL}…`);
  const res = await fetch(TARGET_URL, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();

  console.log(`\nHTTP ${res.status}`);
  try {
    console.log(JSON.stringify(JSON.parse(body), null, 2));
  } catch {
    console.log(body);
  }
} finally {
  if (existsSync(TMP_FILE)) unlinkSync(TMP_FILE);
}
