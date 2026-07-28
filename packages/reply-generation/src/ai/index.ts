import type { TimeSlot } from "@dharma/types";
import { formatSlot } from "../index";

export interface UsageReport {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// Generates a short reply confirming a specific proposed time works.
export async function* generateConfirmationReply(
  slot: TimeSlot,
  originalRequest: string,
  timezone = "America/New_York",
  onUsage?: (usage: UsageReport) => void | Promise<void>
): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const formatted = formatSlot(slot, timezone);

  const systemPrompt = `You write short email replies on behalf of the user.
Rules:
- Write ONLY the email body. No subject line. No preamble.
- Mirror the tone: casual request → casual reply, formal → formal.
- Confirm the proposed time works. Keep it 1-2 sentences.
- Do not sign off with a name.
- Never use em-dashes or en-dashes; use commas or periods instead.`;

  const userMessage = `The person proposed this time and asked if it works:\n\n"${originalRequest}"\n\nThe time ${formatted} is free on my calendar. Write a short reply confirming it works.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  if (!response.body) throw new Error("Anthropic API returned no response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        if (onUsage) await onUsage({ model: "claude-sonnet-4-20250514", inputTokens, outputTokens });
        return;
      }
      try {
        const event = JSON.parse(data) as {
          type: string;
          delta?: { type: string; text: string };
          message?: { usage?: { input_tokens?: number; output_tokens?: number } };
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          // Safety net for the "no em/en dashes" prompt rule: convert any that
          // slip through to commas as the reply streams out.
          yield event.delta.text.replace(/\s*[—–]\s*/g, ", ");
        }
        if (event.type === "message_start" && event.message?.usage?.input_tokens) {
          inputTokens = event.message.usage.input_tokens;
        }
        if (event.type === "message_delta" && event.usage?.output_tokens) {
          outputTokens = event.usage.output_tokens;
        }
      } catch { /* skip malformed chunk */ }
    }
  }
  if (onUsage) await onUsage({ model: "claude-sonnet-4-20250514", inputTokens, outputTokens });
}

export async function* generateAIReply(
  slots: TimeSlot[],
  schedulingRequest: string,
  timezone = "America/New_York",
  allOfferedTimesBusy = false,
  preferences?: string,
  onUsage?: (usage: UsageReport) => void | Promise<void>
): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  // Always display the owner's available times in Eastern time so they read
  // naturally regardless of the sender's timezone.
  const ownerTimezone = "America/New_York";
  const formattedSlots = slots.map((s) => `• ${formatSlot(s, ownerTimezone)}`).join("\n");

  const preferenceLine = preferences
    ? `\n- The user's scheduling preferences: "${preferences}". From the slots listed, select and propose only the 2-3 that best match these preferences. Do not mention or apologize for slots outside the preferred window; just lead with the best ones.`
    : "";

  const systemPrompt = `You write email replies on behalf of the user.

Rules:
- Write ONLY the email body. No subject line. No "Here is a reply:" preamble.
- Mirror the tone of the incoming request: casual request → casual reply, formal → formal.
- Keep it short: 2 to 4 sentences maximum.
- Choose 2-3 of the available time slots and include them naturally in the text. Times are in ET.
- End with a friendly call to action (e.g. "let me know what works").
- Do not sign off with a name; the user will add their own signature.
- NEVER claim the other person's proposed times "don't work" unless explicitly told they conflict.
- Never use em-dashes or en-dashes; use commas or periods instead.${preferenceLine}`;

  const conflict = allOfferedTimesBusy
    ? "Unfortunately those specific times don't work on my calendar, but"
    : "Here are some times that work on my end:";

  const userMessage = `The person sent me this scheduling request:\n\n"${schedulingRequest}"\n\n${conflict}\n${formattedSlots}\n\nWrite a reply.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  if (!response.body) throw new Error("Anthropic API returned no response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        if (onUsage) await onUsage({ model: "claude-sonnet-4-20250514", inputTokens, outputTokens });
        return;
      }

      try {
        const event = JSON.parse(data) as {
          type: string;
          delta?: { type: string; text: string };
          message?: { usage?: { input_tokens?: number; output_tokens?: number } };
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          // Safety net for the "no em/en dashes" prompt rule: convert any that
          // slip through to commas as the reply streams out.
          yield event.delta.text.replace(/\s*[—–]\s*/g, ", ");
        }
        if (event.type === "message_start" && event.message?.usage?.input_tokens) {
          inputTokens = event.message.usage.input_tokens;
        }
        if (event.type === "message_delta" && event.usage?.output_tokens) {
          outputTokens = event.usage.output_tokens;
        }
      } catch {
        // malformed chunk — skip
      }
    }
  }
  if (onUsage) await onUsage({ model: "claude-sonnet-4-20250514", inputTokens, outputTokens });
}
