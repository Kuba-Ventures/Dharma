// Shared identity for the calendar events Dharma mirrors from a user's
// scheduling *blocks* (focus/hold windows created in Configuration →
// Scheduling). These are written by app/api/preferences/scheduling and must be
// distinguishable from real meetings everywhere they surface — the dashboard
// "meetings this week" card in particular must not count or list them (issue
// #86).
//
// Two independent signals identify a block, and an event matching *either* is
// treated as a block:
//   1. extendedProperties.private[DHARMA_BLOCK_EXT_KEY] === "1" — the durable
//      marker stamped on events created going forward.
//   2. description === DHARMA_BLOCK_DESCRIPTION — the stable description every
//      block event (including ones created before the marker existed) carries,
//      so existing blocks are filtered without any calendar migration.

export const DHARMA_BLOCK_EXT_KEY = "dharmaBlock";

export const DHARMA_BLOCK_DESCRIPTION =
  "Created by Dharma. Edit or remove this block in Configuration → Scheduling on your dashboard.";

// Minimal shape we need off a Google Calendar event to classify it. Kept
// structural so callers can pass a full calendar_v3.Schema$Event directly.
type BlockLike = {
  description?: string | null;
  extendedProperties?: {
    private?: { [key: string]: string } | null;
  } | null;
};

export function isDharmaBlockEvent(event: BlockLike): boolean {
  if (event.extendedProperties?.private?.[DHARMA_BLOCK_EXT_KEY] === "1") return true;
  if (event.description?.trim() === DHARMA_BLOCK_DESCRIPTION) return true;
  return false;
}
