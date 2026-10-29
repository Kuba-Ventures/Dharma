// Read-only prototype of the "who's waiting on you" Monday brief.
// Finds inbox threads from the last N days where a real person wrote last,
// then asks Claude to rank them and write the brief. Prints to the terminal;
// sends, drafts and labels nothing.
// Usage:
//   cd apps/web && vercel env pull .env.local --environment=production
//   node scripts/waiting-on-you.mjs <email> [days=90]

import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";
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
const days = Number(process.argv[3] ?? 90);
if (!email) {
  console.error("Usage: node scripts/waiting-on-you.mjs <email> [days=90]");
  process.exit(1);
}

const MAX_THREADS = 1000;
const MAX_SENT = 500;
const MAX_CANDIDATES = 150;
const MODEL = process.env.WAITING_MODEL ?? "claude-sonnet-5-5";

// WAITING_FROM_CACHE=<file>: skip Gmail and rerun only the Claude step on
// candidates saved earlier with WAITING_CACHE.
if (process.env.WAITING_FROM_CACHE) {
  await writeBrief(JSON.parse(readFileSync(process.env.WAITING_FROM_CACHE, "utf8")));
  process.exit(0);
}

const prisma = new PrismaClient();

const cred = await prisma.googleCredential.findUnique({ where: { email } });
if (!cred) {
  console.error(`No Google credential for ${email}. Sign in to Dharma with it first.`);
  process.exit(1);
}

// Same refresh handling as makeAuthForUser in lib/gmail.ts: persist rotated
// refresh tokens so this script can't break the user's live session (#113).
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
  try {
    await prisma.googleCredential.update({
      where: { userId: cred.userId },
      data: {
        accessToken: tokens.access_token ?? cred.accessToken,
        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3_600_000),
      },
    });
  } catch (err) {
    console.error("[waiting-on-you] Failed to persist refreshed token:", err);
  }
});

const gmail = google.gmail({ version: "v1", auth });
const started = Date.now();

// Gmail allows 6,000 quota units per user per minute (messages.get costs 5,
// threads.get 10). Pace batches to ~70 units/sec and back off on rate limits.
const UNITS_PER_SEC = 70;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const limited = err?.status === 429 || /rate ?limit|quota/i.test(err?.message ?? "");
      if (!limited || attempt >= 6) throw err;
      console.error(`[waiting-on-you] Gmail rate limit hit, waiting 30s (retry ${attempt + 1}/6)`);
      await sleep(30_000);
    }
  }
}

async function inBatches(ids, size, unitCost, fn) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) {
    const batchStart = Date.now();
    const chunk = ids.slice(i, i + size);
    out.push(...(await Promise.all(chunk.map((id) => withRetry(() => fn(id))))));
    const minMs = ((chunk.length * unitCost) / UNITS_PER_SEC) * 1000;
    const elapsed = Date.now() - batchStart;
    if (elapsed < minMs) await sleep(minMs - elapsed);
    if ((i / size) % 10 === 9) console.error(`[waiting-on-you] ${Math.min(i + size, ids.length)}/${ids.length} read`);
  }
  return out;
}

async function listIds(kind, q, cap) {
  const ids = [];
  let pageToken;
  do {
    const res = await withRetry(() => gmail.users[kind].list({ userId: "me", q, maxResults: 500, pageToken }));
    for (const t of res.data[kind] ?? []) ids.push(t.id);
    pageToken = res.data.nextPageToken;
  } while (pageToken && ids.length < cap);
  return ids.slice(0, cap);
}

// 1. Everyone I've written to in the last year, by address and by name, so a
// known person on a new address still counts as a relationship.
const knownAddresses = new Set();
const knownNames = new Set();
const sentIds = await listIds("messages", "in:sent newer_than:365d", MAX_SENT);
const sentMsgs = await inBatches(sentIds, 10, 5, (id) =>
  gmail.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["To", "Cc"] })
);
for (const { data: msg } of sentMsgs) {
  for (const h of msg.payload?.headers ?? []) {
    for (const part of h.value.split(",")) {
      const addr = part.match(/<([^>]+)>/)?.[1] ?? part.trim();
      const name = part.replace(/<[^>]+>/, "").replace(/"/g, "").trim();
      if (addr.includes("@")) knownAddresses.add(addr.toLowerCase());
      if (name && !name.includes("@")) knownNames.add(name.toLowerCase());
    }
  }
}

// 2. All recent threads (not just the inbox), skipping sent, spam, trash and
// Gmail's Promotions and Social tabs.
const q = `newer_than:${days}d -in:sent -in:chats -in:spam -in:trash -category:promotions -category:social`;
const threadIds = await listIds("threads", q, MAX_THREADS);

// 3. Fetch headers only and keep threads where someone else wrote last.
const me = email.toLowerCase();
const header = (msg, name) =>
  msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
const fromMe = (msg) =>
  msg.labelIds?.includes("SENT") || header(msg, "From").toLowerCase().includes(me);
const automated = (msg) => {
  const from = header(msg, "From").toLowerCase();
  return (
    /no-?reply|notifications?@|mailer-daemon|donotreply|alerts?@|news(letter)?@/.test(from) ||
    header(msg, "List-Unsubscribe") !== "" ||
    /bulk|list/i.test(header(msg, "Precedence")) ||
    /auto-/i.test(header(msg, "Auto-Submitted"))
  );
};

const calendar = (msg) =>
  /^(updated )?invitation:|^(accepted|declined|tentatively accepted|canceled event|cancelled event):/i.test(
    header(msg, "Subject")
  );

const candidates = [];
let skippedAutomated = 0;
let skippedMine = 0;
let skippedCalendar = 0;
const threads = await inBatches(threadIds, 7, 10, (id) =>
  gmail.users.threads.get({
    userId: "me",
    id,
    format: "metadata",
    metadataHeaders: ["From", "Subject", "Date", "List-Unsubscribe", "Precedence", "Auto-Submitted"],
  })
);
{
  for (const { data: thread } of threads) {
    const msgs = thread.messages ?? [];
    const last = msgs[msgs.length - 1];
    if (!last) continue;
    if (fromMe(last)) { skippedMine++; continue; }
    if (calendar(last)) { skippedCalendar++; continue; }
    if (automated(last)) { skippedAutomated++; continue; }
    const fromHeader = header(last, "From");
    const fromAddr = (fromHeader.match(/<([^>]+)>/)?.[1] ?? fromHeader).toLowerCase().trim();
    const fromName = fromHeader.replace(/<[^>]+>/, "").replace(/"/g, "").trim().toLowerCase();
    let followUps = 0;
    for (let j = msgs.length - 1; j >= 0 && !fromMe(msgs[j]); j--) followUps++;
    const lastDate = new Date(Number(last.internalDate));
    candidates.push({
      from: fromHeader,
      subject: header(last, "Subject"),
      lastDate: lastDate.toISOString().slice(0, 10),
      daysWaiting: Math.floor((Date.now() - lastDate.getTime()) / 86_400_000),
      messagesSinceMyLastReply: followUps,
      iRepliedInThisThread: msgs.some(fromMe),
      iHaveEmailedThisAddress: knownAddresses.has(fromAddr),
      iHaveEmailedThisName: !!fromName && knownNames.has(fromName),
      snippet: (last.snippet ?? "").slice(0, 160),
    });
  }
}
candidates.sort((a, b) => b.lastDate.localeCompare(a.lastDate));
const sent = candidates.slice(0, MAX_CANDIDATES);
// Optional: save candidates locally (outside the repo) to iterate on the prompt.
if (process.env.WAITING_CACHE) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.WAITING_CACHE, JSON.stringify(sent, null, 1));
}

await writeBrief(sent);
console.log("\n--- Script stats ---");
console.log(`Threads scanned: ${threadIds.length} (cap ${MAX_THREADS}, last ${days} days, all mail minus Promotions/Social)`);
console.log(`Sent messages read for known contacts: ${sentIds.length} (${knownAddresses.size} addresses, ${knownNames.size} names)`);
console.log(`I wrote last: ${skippedMine}; calendar: ${skippedCalendar}; automated: ${skippedAutomated}; candidates: ${candidates.length} (sent ${sent.length} to Claude)`);
console.log(`Model: ${MODEL}; time: ${Math.round((Date.now() - started) / 1000)}s`);

await prisma.$disconnect();

// 4. Ask Claude to rank and write the brief.
async function writeBrief(sent) {
  const prompt = `You are writing a "Monday brief" email for ${email}: who is waiting on them.
  Below are inbox threads from the last ${days} days where someone else wrote last. Some are still noise (automated mail, FYIs, threads that need no reply).

  Each thread says whether the user has ever emailed this sender's address or name in the last year. A known name on a new address is probably the same person (for example a boss writing from a second company domain).

  1. Drop anything that clearly needs no reply from a real person.
  2. Split the rest into two groups:
     - Waiting on you: people the user has a relationship with (has emailed them, or replied in the thread), or a genuine first contact asking for something the user would want (a client, a lead, a partner, someone they offered to help).
     - Cold pitches: sales, recruiting and vendor outreach from people the user has never replied to, however many times they followed up.
  3. Rank "Waiting on you" by business importance: money, deals, partnerships, clients, bosses and colleagues, new leads and hiring first; logistics and casual mail last.
  3. Write the brief:
     - Subject line: "N people are waiting on you"
     - Top 5 at most, one line each: **Name (Company)**, waiting X days, what they want.
     - Then: "Also waiting: N lower-priority threads."
     - Then: "Cold pitches you can ignore: N" with up to 3 sender companies.
     - Under 150 words, no preamble.
  4. Then a short "Test notes" section: how many threads were waiting, cold pitches and dropped as noise, and any you were unsure about and why.

  Threads (JSON):
  ${JSON.stringify(sent, null, 1)}`;

  const gateway = !!process.env.AI_GATEWAY_API_KEY;
  const res = await fetch(
    gateway ? "https://ai-gateway.vercel.sh/v1/messages" : "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": gateway ? process.env.AI_GATEWAY_API_KEY : process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        ...(gateway ? { "x-vercel-ai-gateway-provider": "anthropic" } : {}),
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        messages: [{ role: "user", content: prompt }],
      }),
    }
  );
  if (!res.ok) {
    console.error(`Claude call failed (${res.status}): ${await res.text()}`);
    process.exit(1);
  }
  const body = await res.json();

  const text = (body.content ?? []).map((c) => c.text ?? "").join("\n").trim();
  if (!text) {
    console.error(`Claude returned no text (stop_reason: ${body.stop_reason}, blocks: ${(body.content ?? []).map((c) => c.type).join(", ") || "none"})`);
  }
  console.log(text);
}
