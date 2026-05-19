import { logUsage, type EventType } from "./usage";
import { LABEL_PRESETS, type PresetKey } from "./labelPresets";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

async function callClaude(
  prompt: string,
  maxTokens = 80,
  opts: { userId?: string; eventType?: EventType } = {}
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[classify] ANTHROPIC_API_KEY is not set — classification skipped");
    return "";
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[classify] Anthropic API error ${response.status}: ${body}`);
      return "";
    }
    const data = (await response.json()) as {
      content: Array<{ text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };
    if (opts.userId && opts.eventType && data.usage) {
      await logUsage({
        userId: opts.userId,
        eventType: opts.eventType,
        model: HAIKU_MODEL,
        usage: data.usage,
      });
    }
    return data.content[0]?.text ?? "";
  } catch (err) {
    console.error("[classify] Anthropic API call failed:", err);
    return "";
  }
}

function parseJSON<T>(text: string): T | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

// Maps common timezone abbreviations and city hints to IANA timezone strings.
// Uses regex rather than a Claude call to keep this fast and free.
export function detectTimezoneFromText(text: string): string {
  const t = text.toLowerCase();

  // Explicit abbreviations (check before city names to avoid false positives)
  if (/\b(et|est|edt|eastern time|eastern)\b/.test(t)) return "America/New_York";
  if (/\b(ct|cst|cdt|central time|central)\b/.test(t)) return "America/Chicago";
  if (/\b(mt|mst|mdt|mountain time|mountain)\b/.test(t)) return "America/Denver";
  if (/\b(pt|pst|pdt|pacific time|pacific)\b/.test(t)) return "America/Los_Angeles";
  if (/\b(at|ast|adt|atlantic time|atlantic)\b/.test(t)) return "America/Halifax";
  if (/\b(akt|akst|akdt|alaska)\b/.test(t)) return "America/Anchorage";
  if (/\b(hst|hawaii)\b/.test(t)) return "Pacific/Honolulu";
  if (/\b(gmt|utc)\b/.test(t)) return "UTC";
  if (/\b(bst|london|uk)\b/.test(t)) return "Europe/London";
  if (/\b(cet|amsterdam|paris|berlin|rome|amsterdam)\b/.test(t)) return "Europe/Paris";

  // City / region hints
  if (/san francisco|los angeles|seattle|portland|las vegas|san diego/.test(t)) return "America/Los_Angeles";
  if (/new york|boston|miami|atlanta|philadelphia|toronto|montreal/.test(t)) return "America/New_York";
  if (/chicago|dallas|houston|minneapolis|austin|new orleans/.test(t)) return "America/Chicago";
  if (/denver|salt lake|albuquerque|phoenix/.test(t)) return "America/Denver";

  return "America/New_York"; // default — owner is Eastern
}

export async function classifyEmailLabels(
  subject: string,
  from: string,
  body: string,
  labels: Array<{ name: string; description: string }>,
  userId?: string
): Promise<string[]> {
  if (!labels.length) return [];

  const labelList = labels
    .map((l) => `- ${l.name}: ${l.description}`)
    .join("\n");

  const text = await callClaude(
    `You are an email classifier for a business professional. Label emails from real people about real business situations. Be confident when the match is clear.

SKIP labeling entirely (return []) for:
- GitHub, Vercel, Jira, Linear, Slack, or any developer tool notifications
- Google Calendar invites, acceptances, or meeting updates
- Gemini, AI digest, or automated summary emails
- Newsletters, marketing, or bulk mail
- Any no-reply or automated sender

For real human emails, apply labels that clearly fit. It's fine to apply 1-2 labels when confident.

Labels:\n${labelList}\n\nEmail:\nFrom: ${from}\nSubject: ${subject}\nBody:\n${body.slice(0, 600)}\n\nReturn a JSON array of matching label names ([] if automated or no clear match): ["Label1"]\nJSON only, no explanation.`,
    200,
    { userId, eventType: "classify" }
  );

  const arrMatch = text.match(/\[[\s\S]*?\]/);
  if (!arrMatch) return [];
  try {
    const arr = JSON.parse(arrMatch[0]) as string[];
    const validNames = new Set(labels.map((l) => l.name));
    return arr.filter((n) => validNames.has(n));
  } catch {
    return [];
  }
}

export async function classifyEmail(
  subject: string,
  body: string,
  userId?: string
): Promise<{
  isSchedulingRequest: boolean;
  isTimeConfirmation: boolean;
  durationMinutes: number;
}> {
  const text = await callClaude(
    `Classify this email:\n\nSubject: ${subject}\nBody:\n${body.slice(0, 800)}\n\nReply with JSON only:\n{"isSchedulingRequest": boolean, "isTimeConfirmation": boolean, "durationMinutes": 30|60|90}\n\n- isSchedulingRequest: true if the email is trying to set up a meeting, call, or get-together, even if casual, short, or uses slang like "tmrw", "lmk", "wanna meet", "catch up", "hop on a call", etc.\n- isTimeConfirmation: true if the sender is agreeing to or confirming a specific time that was previously proposed`,
    100,
    { userId, eventType: "classify" }
  );

  return (
    parseJSON<{ isSchedulingRequest: boolean; isTimeConfirmation: boolean; durationMinutes: number }>(text) ?? {
      isSchedulingRequest: false,
      isTimeConfirmation: false,
      durationMinutes: 60,
    }
  );
}

// Extracts all specific meeting times proposed in an email so the poller can
// check each one against the calendar (e.g. an EA offering Tu/Wed/Thu slots).
// Returns null if no concrete times are named (open-ended availability request).
export async function extractProposedTimes(
  subject: string,
  body: string,
  todayISO: string,
  userId?: string
): Promise<Array<{ startISO: string; endISO: string }> | null> {
  const text = await callClaude(
    `Today is ${todayISO}. Does this email propose one or more specific meeting times for the recipient to choose from?\n\nSubject: ${subject}\nBody:\n${body.slice(0, 800)}\n\nIf YES, return a JSON array of every proposed slot:\n[{"startISO":"ISO8601 with tz offset","endISO":"ISO8601 with tz offset"}, ...]\n\nIf the email only asks when the recipient is free (no specific times given), return: null\n\nJSON only, no explanation.`,
    400,
    { userId, eventType: "schedule" }
  );

  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (!arrMatch) return null;
  try {
    const arr = JSON.parse(arrMatch[0]) as Array<{ startISO: string; endISO: string }>;
    const valid = arr.filter((t) => {
      const s = new Date(t.startISO);
      const e = new Date(t.endISO);
      return !isNaN(s.getTime()) && !isNaN(e.getTime());
    });
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

export async function extractConfirmedTime(
  subject: string,
  body: string,
  todayISO: string,
  userId?: string
): Promise<{ startISO: string; endISO: string; title: string } | null> {
  const text = await callClaude(
    `Today's date is ${todayISO}. Extract the confirmed meeting time from this email.\n\nSubject: ${subject}\nBody:\n${body.slice(0, 800)}\n\nReply with JSON only (no explanation):\n{"startISO": "ISO8601 datetime with timezone offset", "endISO": "ISO8601 datetime with timezone offset", "title": "short meeting title"}\n\nIf no specific time can be extracted, reply: {"startISO": null}`,
    150,
    { userId, eventType: "schedule" }
  );

  const parsed = parseJSON<{ startISO: string | null; endISO: string; title: string }>(text);
  if (!parsed?.startISO) return null;

  // Validate the dates
  const start = new Date(parsed.startISO);
  const end = new Date(parsed.endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  return { startISO: parsed.startISO, endISO: parsed.endISO, title: parsed.title };
}

// ── Preset label classifier (Feature 1) ────────────────────────────────────

export interface PresetClassification {
  /** Short label name (e.g. "Portfolio") or null if no clear match. */
  label: string | null;
  /** 0..1 — confidence the email is high-priority / time-sensitive. */
  priority: number;
}

export async function classifyForPreset(
  preset: PresetKey,
  subject: string,
  from: string,
  snippet: string,
  body: string,
  userId: string
): Promise<PresetClassification> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { label: null, priority: 0 };

  const labelNames = LABEL_PRESETS[preset]
    .map((l) => l.shortName)
    .filter((n) => n !== "High-Priority");

  const systemPrompt = `You classify business emails for a ${preset} professional. Return ONLY a JSON object: {"label": "<label_name>", "priority": <0..1>} where label is one of: ${JSON.stringify(labelNames)} (or null if no clear match). Priority is your confidence the email is high-priority/time-sensitive.`;

  const userMessage = `Subject: ${subject}\nFrom: ${from}\nSnippet: ${snippet}\nBody (first 1500 chars): ${body.slice(0, 1500)}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 120,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[classify-preset] Anthropic error ${response.status}: ${errBody}`);
      return { label: null, priority: 0 };
    }

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };
    if (data.usage) {
      await logUsage({ userId, eventType: "classify", model: HAIKU_MODEL, usage: data.usage });
    }

    const text = data.content[0]?.text ?? "";
    const parsed = parseJSON<{ label: string | null; priority: number }>(text);
    if (!parsed) return { label: null, priority: 0 };

    const validNames = new Set(labelNames);
    const label = parsed.label && validNames.has(parsed.label) ? parsed.label : null;
    const priority = typeof parsed.priority === "number" ? parsed.priority : 0;
    return { label, priority };
  } catch (err) {
    console.error("[classify-preset] Failed:", err);
    return { label: null, priority: 0 };
  }
}
