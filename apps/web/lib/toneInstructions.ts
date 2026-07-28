// Single source of truth for tone-mode drafting instructions.
//
// Keyed by the same strings persisted in User.tone and rendered as cards in
// the configuration ToneCard (see app/components/configuration/ToneCard.tsx).
// Consumed by the draft routes (emails/thread-draft, emails/[id]/draft) and the
// tone sample-draft preview (preferences/tone/sample). Keep the keys in sync
// with TONE_CARDS; changing a key here changes drafting behavior everywhere.
//
// "Scheduling" is intentionally absent: it's handled by a dedicated
// calendar-aware branch in thread-draft, not a plain instruction string.
export const TONE_INSTRUCTIONS: Record<string, string> = {
  "My Tone":
    "Write in a natural, professional but personal tone: direct, warm, not overly formal. Mirror the style of someone who has worked in business for years and writes clearly without corporate jargon.",
  Concise:
    "Write the shortest reply that fully answers. Lead with the answer in the first sentence. No greeting, no pleasantries, no throat-clearing, no filler. Cut every word that isn't load-bearing. 1-3 sentences, ideally 1-2. Do not pad to sound polite.",
  "Formal / Legal":
    "Write in formal, precise language appropriate for legal or official correspondence. Use complete sentences, avoid contractions, and maintain a professional distance.",
  "Casual / Friendly":
    "Write in a warm, conversational tone. It's okay to be a little informal, use contractions, keep it light and approachable.",
};

// The blunt/no-pleasantries modes deliberately omit a sign-off — a "Talk soon,"
// is exactly the pleasantry Concise is meant to cut. Everything else keeps the
// user's usual sign-off.
export function toneUsesSignOff(tone: string): boolean {
  return tone !== "Concise";
}
