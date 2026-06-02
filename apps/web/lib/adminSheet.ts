// Admin sheet integration. Reads/writes the "Dharma Admin Sheet" via a Google
// service account. Sheet ID comes from ADMIN_SHEET_ID; credential JSON from
// GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY. The sheet must be shared with the
// service account's client_email as Editor.
//
// All writes are append-only (insertDataOption: INSERT_ROWS). The wrapper
// auto-writes header rows on the first append to an empty tab so the sheet
// doesn't need to be set up by hand.

import { google, type sheets_v4 } from "googleapis";
import { JWT } from "google-auth-library";
import { getBadge } from "./badges";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export type TabName = "Waitlist" | "Users" | "Debugging";

export const TAB_HEADERS: Record<TabName, string[]> = {
  Waitlist: ["email", "source_page", "signed_up_at", "user_agent", "converted_at"],
  Users: ["email", "tier", "started_at", "stripe_customer_id", "badges", "notes"],
  Debugging: ["submitted_by_email", "page", "kind", "message", "severity", "submitted_at"],
};

let cachedClient: sheets_v4.Sheets | null = null;

function buildClient(): sheets_v4.Sheets | null {
  const raw = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.warn("[adminSheet] GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY not set");
    return null;
  }
  let key: { client_email: string; private_key: string };
  try {
    key = JSON.parse(raw);
  } catch (err) {
    console.error("[adminSheet] failed to parse service account JSON:", err);
    return null;
  }
  if (!key.client_email || !key.private_key) {
    console.error("[adminSheet] service account JSON missing client_email or private_key");
    return null;
  }
  const auth = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
  });
  return google.sheets({ version: "v4", auth });
}

function client(): sheets_v4.Sheets | null {
  if (!cachedClient) cachedClient = buildClient();
  return cachedClient;
}

function sheetId(): string | null {
  const id = process.env.ADMIN_SHEET_ID;
  if (!id) {
    console.warn("[adminSheet] ADMIN_SHEET_ID not set");
    return null;
  }
  return id;
}

// Ensure row 1 of the given tab matches our header expectations. If row 1 is
// empty, write the headers. If row 1 has content (user already populated it),
// leave it alone — we trust whoever set it up.
export async function ensureHeaders(tab: TabName): Promise<void> {
  const sheets = client();
  const id = sheetId();
  if (!sheets || !id) return;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: `${tab}!1:1`,
  });
  const row1 = res.data.values?.[0] ?? [];
  if (row1.length > 0) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [TAB_HEADERS[tab]] },
  });
}

// Append a row to a tab. Values must match the column order in TAB_HEADERS.
// Returns true on success, false if env vars are missing or the call fails.
// Never throws — callers (waitlist signup, feedback) shouldn't fail because
// the sheet integration is down.
export async function appendRow(tab: TabName, values: (string | number | null)[]): Promise<boolean> {
  const sheets = client();
  const id = sheetId();
  if (!sheets || !id) return false;

  try {
    await ensureHeaders(tab);
    await sheets.spreadsheets.values.append({
      spreadsheetId: id,
      range: `${tab}!A:Z`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values.map((v) => v ?? "")] },
    });
    return true;
  } catch (err) {
    console.error(`[adminSheet] append to ${tab} failed:`, err);
    return false;
  }
}

// Sign-in allowlist gate. The Users tab is the source of truth for who
// can create an account. Cached for 60s to avoid a Sheets API call on every
// OAuth callback. Fails closed (rejects sign-in) if the sheet is unreachable.
let subscriberCache: { emails: Set<string>; expiresAt: number } | null = null;
const SUBSCRIBER_CACHE_TTL_MS = 60_000;

export async function isSubscriber(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  if (subscriberCache && Date.now() < subscriberCache.expiresAt) {
    return subscriberCache.emails.has(normalized);
  }

  const sheets = client();
  const id = sheetId();
  if (!sheets || !id) {
    console.warn("[adminSheet] isSubscriber: sheet client unavailable, rejecting");
    return false;
  }

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: "Users!A2:A",
    });
    const emails = new Set(
      ((res.data.values ?? []) as string[][])
        .map((row) => (row[0] ?? "").trim().toLowerCase())
        .filter(Boolean),
    );
    subscriberCache = { emails, expiresAt: Date.now() + SUBSCRIBER_CACHE_TTL_MS };
    return emails.has(normalized);
  } catch (err) {
    console.error("[adminSheet] isSubscriber: Users read failed:", err);
    return false;
  }
}

// Cached email -> badge-ids map from the Users tab, so admin-assigned identity
// badges show on the profile within ~60s instead of waiting for the nightly
// awards cron. Same 60s TTL as the subscriber cache. Fails open (returns an
// empty map) if the sheet is unreachable — badges just won't appear live.
let badgeCache: { map: Map<string, string[]>; expiresAt: number } | null = null;
const BADGE_CACHE_TTL_MS = 60_000;

async function loadSheetBadges(): Promise<Map<string, string[]>> {
  if (badgeCache && Date.now() < badgeCache.expiresAt) return badgeCache.map;

  const map = new Map<string, string[]>();
  const sheets = client();
  const id = sheetId();
  if (!sheets || !id) return map;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: "Users!A2:E",
    });
    for (const row of (res.data.values ?? []) as string[][]) {
      const email = (row[0] ?? "").trim().toLowerCase();
      if (!email) continue;
      const ids = (row[4] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length > 0) map.set(email, ids);
    }
    badgeCache = { map, expiresAt: Date.now() + BADGE_CACHE_TTL_MS };
  } catch (err) {
    console.error("[adminSheet] loadSheetBadges failed:", err);
  }
  return map;
}

// Identity badges assigned to this email in the Users tab's Badges column.
// Achievement ids typed into the sheet are ignored — those are earned, not
// granted. Used by the Profile page and sidebar chip for live badge display,
// so a badge set in the sheet shows up within ~60s without the cron.
export async function sheetIdentityBadgesForEmail(
  email: string | null | undefined,
): Promise<string[]> {
  if (!email) return [];
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];
  const map = await loadSheetBadges();
  return (map.get(normalized) ?? []).filter(
    (badgeId) => getBadge(badgeId)?.kind === "identity",
  );
}

// Read every row below the header. Returns rows as arrays of strings in the
// order they appear in the sheet. Used by the cron to walk Users and
// award badges.
export async function readRows(tab: TabName): Promise<string[][]> {
  const sheets = client();
  const id = sheetId();
  if (!sheets || !id) return [];

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${tab}!A2:Z`,
    });
    return (res.data.values ?? []) as string[][];
  } catch (err) {
    console.error(`[adminSheet] read of ${tab} failed:`, err);
    return [];
  }
}

// Apply a dropdown (data validation) to a column. Uses non-strict mode so
// the admin can still type comma-separated overrides like "founder,advisor".
// Idempotent — safe to call every cron run.
export async function setColumnDropdown(
  tab: TabName,
  column: string, // e.g. "E"
  allowedValues: string[],
): Promise<void> {
  const sheets = client();
  const id = sheetId();
  if (!sheets || !id) return;

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    const sheet = meta.data.sheets?.find((s) => s.properties?.title === tab);
    const internalSheetId = sheet?.properties?.sheetId;
    if (internalSheetId === null || internalSheetId === undefined) return;

    const colIdx = column.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: {
        requests: [
          {
            setDataValidation: {
              range: {
                sheetId: internalSheetId,
                startRowIndex: 1, // skip header row
                endRowIndex: 10000,
                startColumnIndex: colIdx,
                endColumnIndex: colIdx + 1,
              },
              rule: {
                condition: {
                  type: "ONE_OF_LIST",
                  values: allowedValues.map((v) => ({ userEnteredValue: v })),
                },
                showCustomUi: true,
                strict: false, // warn on bad values, don't block comma-separated input
              },
            },
          },
        ],
      },
    });
  } catch (err) {
    console.error(`[adminSheet] setColumnDropdown on ${tab}!${column} failed:`, err);
  }
}

// Mark a Waitlist row as converted (sets column E to the timestamp). Used
// when a waitlist email gets promoted to a Users row. No-op if the
// email isn't on the waitlist.
export async function markWaitlistConverted(email: string): Promise<void> {
  const sheets = client();
  const id = sheetId();
  if (!sheets || !id) return;

  try {
    const rows = await readRows("Waitlist");
    const idx = rows.findIndex((r) => (r[0] ?? "").toLowerCase() === email.toLowerCase());
    if (idx === -1) return;
    // +2 because rows are 0-indexed and we skip header row 1.
    const rowNumber = idx + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `Waitlist!E${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [[new Date().toISOString()]] },
    });
  } catch (err) {
    console.error("[adminSheet] markWaitlistConverted failed:", err);
  }
}
