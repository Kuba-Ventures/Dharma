import { google } from "googleapis";
import { prisma } from "./prisma";

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );
}

// Creates an auth client with expiry so the library auto-refreshes stale tokens,
// and persists new tokens back to the database.
export async function makeAuthForUser(userId: string) {
  const cred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!cred) throw new Error(`No Google credential for user ${userId}`);

  const auth = makeOAuth2Client();
  auth.setCredentials({
    access_token: cred.accessToken,
    refresh_token: cred.refreshToken,
    expiry_date: cred.expiresAt.getTime(),
  });

  auth.on("tokens", async (tokens) => {
    await prisma.googleCredential.update({
      where: { userId },
      data: {
        accessToken: tokens.access_token ?? cred.accessToken,
        expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3_600_000),
      },
    });
  });

  return { auth, cred };
}

// Seeds gmailHistoryId from the current Gmail profile so the poller knows
// where to start. If Pub/Sub is configured, also registers a push watch.
export async function setupGmailWatch(
  userId: string,
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth });

  // Always seed historyId from the current profile (needed for polling)
  const profile = await gmail.users.getProfile({ userId: "me" });
  const historyId = String(profile.data.historyId ?? "");

  const update: { gmailHistoryId: string; gmailWatchExpiry?: Date } = { gmailHistoryId: historyId };

  // Optionally register a Pub/Sub push watch if the topic is configured
  const topic = process.env.GOOGLE_PUBSUB_TOPIC;
  if (topic) {
    try {
      const res = await gmail.users.watch({
        userId: "me",
        requestBody: { topicName: topic, labelIds: ["INBOX"] },
      });
      update.gmailWatchExpiry = new Date(Number(res.data.expiration));
      console.log(`[gmail] Pub/Sub watch registered for user ${userId}`);
    } catch (err) {
      console.warn("[gmail] Pub/Sub watch failed (polling will still work):", err);
    }
  }

  await prisma.googleCredential.update({ where: { userId }, data: update });
  console.log(`[gmail] Initialized historyId=${historyId} for user ${userId}`);
}

export async function getNewMessageIds(
  accessToken: string,
  refreshToken: string,
  startHistoryId: string
): Promise<string[]> {
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.history.list({
    userId: "me",
    startHistoryId,
    historyTypes: ["messageAdded"],
    labelId: "INBOX",
  });

  const ids: string[] = [];
  for (const record of res.data.history ?? []) {
    for (const added of record.messagesAdded ?? []) {
      if (added.message?.id) ids.push(added.message.id);
    }
  }
  return ids;
}

export interface ParsedMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  body: string;
  messageIdHeader: string;
  references: string;
}

export async function getMessage(
  accessToken: string,
  refreshToken: string,
  messageId: string,
  userEmail: string
): Promise<ParsedMessage | null> {
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const msg = res.data;
  const headers = msg.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

  const from = get("From");

  // Skip messages sent by the user themselves
  if (from.includes(userEmail)) return null;

  return {
    id: messageId,
    threadId: msg.threadId ?? messageId,
    from,
    subject: get("Subject"),
    body: extractBody(msg.payload),
    messageIdHeader: get("Message-ID"),
    references: get("References"),
  };
}

function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  return "";
}

// Gmail label background colors (must be from Gmail's supported palette).
// Two access paths supported:
//   - Named keys ("blue", "red", ...) for legacy callers (built-in presets).
//   - Hex keys ("#4a86e8", ...) for the new expanded palette.
// Either form resolves to the same { backgroundColor, textColor } pair.
const GMAIL_HEX_TO_TEXT: Record<string, string> = {
  // Row 1 — vibrant
  "#cc3a21": "#ffffff",  "#eaa041": "#ffffff",  "#f2c960": "#000000",
  "#149e60": "#ffffff",  "#3dc789": "#ffffff",  "#2da2bb": "#ffffff",
  "#4a86e8": "#ffffff",  "#8e63ce": "#ffffff",  "#b694e8": "#000000",
  "#e07798": "#ffffff",
  // Row 2 — deep / saturated
  "#fb4c2f": "#ffffff",  "#ffad47": "#ffffff",  "#fad165": "#000000",
  "#16a766": "#ffffff",  "#43d692": "#000000",  "#4986e7": "#ffffff",
  "#a479e2": "#ffffff",  "#f691b3": "#000000",  "#cf8933": "#ffffff",
  "#653e9b": "#ffffff",
  // Row 3 — pastel / soft
  "#f2b2a8": "#822111",  "#ffc8af": "#7a2e0b",  "#fce8b3": "#594c05",
  "#b3efd3": "#0b4f30",  "#a0eac9": "#04502e",  "#98d7e4": "#0d3b44",
  "#b6cff5": "#1c4587",  "#e3d7ff": "#3d188e",  "#d0bcf1": "#41236d",
  "#fbd3e0": "#711a36",
};

const NAMED_COLOR_TO_HEX: Record<string, string> = {
  blue: "#4986e7", purple: "#a479e2", green: "#16a766", teal: "#2da2bb",
  yellow: "#f2c960", orange: "#ff7537", red: "#cc3a21", gray: "#999999",
};

// "#ff7537" and "#999999" are valid Gmail colors used only by legacy presets —
// register them so named lookups still resolve through GMAIL_HEX_TO_TEXT.
Object.assign(GMAIL_HEX_TO_TEXT, { "#ff7537": "#ffffff", "#999999": "#ffffff" });

function resolveGmailColor(colorKey: string): { backgroundColor: string; textColor: string } {
  // Accept hex (with or without "#") or a named key.
  const normalized = colorKey.startsWith("#") ? colorKey.toLowerCase() : `#${colorKey.toLowerCase()}`;
  if (GMAIL_HEX_TO_TEXT[normalized]) {
    return { backgroundColor: normalized, textColor: GMAIL_HEX_TO_TEXT[normalized] };
  }
  const hex = NAMED_COLOR_TO_HEX[colorKey];
  if (hex && GMAIL_HEX_TO_TEXT[hex]) {
    return { backgroundColor: hex, textColor: GMAIL_HEX_TO_TEXT[hex] };
  }
  // Fallback to gray — never reject; Gmail will surface its own error if any.
  return { backgroundColor: "#999999", textColor: "#ffffff" };
}

// Backward-compatible export for callers that read named keys directly.
export const GMAIL_COLORS: Record<string, { backgroundColor: string; textColor: string }> =
  Object.fromEntries(
    Object.entries(NAMED_COLOR_TO_HEX).map(([name, hex]) => [
      name,
      { backgroundColor: hex, textColor: GMAIL_HEX_TO_TEXT[hex] ?? "#ffffff" },
    ])
  );

/** All Gmail-valid background hexes grouped into three vibrancy rows for the picker. */
export const GMAIL_COLOR_ROWS: string[][] = [
  ["#cc3a21","#eaa041","#f2c960","#149e60","#3dc789","#2da2bb","#4a86e8","#8e63ce","#b694e8","#e07798"],
  ["#fb4c2f","#ffad47","#fad165","#16a766","#43d692","#4986e7","#a479e2","#f691b3","#cf8933","#653e9b"],
  ["#f2b2a8","#ffc8af","#fce8b3","#b3efd3","#a0eac9","#98d7e4","#b6cff5","#e3d7ff","#d0bcf1","#fbd3e0"],
];

export async function listGmailLabels(
  userId: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const { auth } = await makeAuthForUser(userId);
    const gmail = google.gmail({ version: "v1", auth });
    const res = await gmail.users.labels.list({ userId: "me" });
    return (res.data.labels ?? [])
      .filter((l) => l.id && l.name)
      .map((l) => ({ id: l.id!, name: l.name! }));
  } catch (err) {
    console.error("[gmail] listGmailLabels failed:", err);
    return [];
  }
}

export async function createGmailLabel(
  userId: string,
  name: string,
  colorKey: string
): Promise<{ id: string | null; error?: string }> {
  try {
    const { auth } = await makeAuthForUser(userId);
    const gmail = google.gmail({ version: "v1", auth });
    const color = resolveGmailColor(colorKey);
    const res = await gmail.users.labels.create({
      userId: "me",
      requestBody: { name, labelListVisibility: "labelShow", messageListVisibility: "show", color },
    });
    return { id: res.data.id ?? null };
  } catch (err: unknown) {
    // 409 → label already exists (often hidden from labels.list); look it up.
    const code = (err as { code?: number })?.code;
    if (code === 409) {
      const existing = await listGmailLabels(userId);
      const found = existing.find((l) => l.name === name);
      if (found) return { id: found.id };
    }
    const errMsg = (err as Error)?.message ?? String(err);
    console.error(`[gmail] createGmailLabel("${name}") failed:`, errMsg);
    return { id: null, error: errMsg };
  }
}

export async function updateGmailLabel(
  userId: string,
  gmailLabelId: string,
  opts: { name?: string; colorKey?: string }
): Promise<boolean> {
  try {
    const { auth } = await makeAuthForUser(userId);
    const gmail = google.gmail({ version: "v1", auth });
    const requestBody: { name?: string; color?: { backgroundColor: string; textColor: string } } = {};
    if (opts.name) requestBody.name = opts.name;
    if (opts.colorKey) requestBody.color = resolveGmailColor(opts.colorKey);
    if (!requestBody.name && !requestBody.color) return true;
    await gmail.users.labels.patch({ userId: "me", id: gmailLabelId, requestBody });
    return true;
  } catch (err) {
    console.error("[gmail] updateGmailLabel failed:", err);
    return false;
  }
}

export async function deleteGmailLabel(
  userId: string,
  gmailLabelId: string
): Promise<void> {
  try {
    const { auth } = await makeAuthForUser(userId);
    const gmail = google.gmail({ version: "v1", auth });
    await gmail.users.labels.delete({ userId: "me", id: gmailLabelId });
  } catch (err) {
    console.warn("[gmail] deleteGmailLabel failed:", err);
  }
}

export interface InboxMessage {
  id: string;
  subject: string;
  from: string;
  snippet: string;
}

export async function listRecentInboxMessages(
  userId: string,
  maxResults = 30
): Promise<InboxMessage[]> {
  const { auth } = await makeAuthForUser(userId);
  const gmail = google.gmail({ version: "v1", auth });

  const listRes = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    maxResults,
  });

  const ids = (listRes.data.messages ?? []).map((m) => m.id!).filter(Boolean);

  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const res = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["Subject", "From"],
      });
      const headers = res.data.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
      return {
        id,
        subject: get("Subject"),
        from: get("From"),
        snippet: res.data.snippet ?? "",
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<InboxMessage> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function applyGmailLabels(
  userId: string,
  messageId: string,
  gmailLabelIds: string[]
): Promise<void> {
  if (!gmailLabelIds.length) return;
  const { auth } = await makeAuthForUser(userId);
  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { addLabelIds: gmailLabelIds },
  });
}

export async function createDraft(
  accessToken: string,
  refreshToken: string,
  opts: {
    from: string;
    to: string;
    subject: string;
    body: string;
    threadId: string;
    inReplyTo: string;
    references: string;
  }
): Promise<void> {
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth });

  const subject = opts.subject.toLowerCase().startsWith("re:")
    ? opts.subject
    : `Re: ${opts.subject}`;

  const refs = [opts.references, opts.inReplyTo].filter(Boolean).join(" ");

  // RFC 2822 date format
  const date = new Date().toUTCString().replace("GMT", "+0000");

  const mime = [
    `MIME-Version: 1.0`,
    `Date: ${date}`,
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${opts.inReplyTo}`,
    `References: ${refs}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    opts.body,
  ].join("\r\n");

  const raw = Buffer.from(mime).toString("base64url");

  await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw, threadId: opts.threadId } },
  });
}

// Approximate count of messages the user sent within the last N days. Used as
// a denominator-free proxy for Reply Rate on the Metrics page. Returns null if
// the Gmail call fails so the UI can show "—" instead of misleading zeros.
export async function countSentInWindow(
  userId: string,
  daysAgo: number
): Promise<number | null> {
  try {
    const { auth } = await makeAuthForUser(userId);
    const gmail = google.gmail({ version: "v1", auth });
    const res = await gmail.users.messages.list({
      userId: "me",
      q: `in:sent newer_than:${daysAgo}d`,
      maxResults: 1,
    });
    return res.data.resultSizeEstimate ?? 0;
  } catch (err) {
    console.error("[gmail] countSentInWindow failed:", err);
    return null;
  }
}
