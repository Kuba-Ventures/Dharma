// Single source of truth for the time-saved math used by /api/metrics
// (windowed dashboard tile) and /api/cron/awards (cumulative tier progress).
//
// Why these numbers: 3 min per draft (read + craft a reply), 30s per
// classification (triage + apply a label). Conservative; tweak here if user
// research suggests different values.
//
// Drafts source nuance: time-saved uses `UsageEvent.eventType="draft"`, which
// captures every Anthropic draft generation including Polish-mode and drafts
// produced for threads that weren't yet classified. The newer
// `ClassifiedThread.draftCreated` boolean is a per-thread flag used by the
// per-label draft-rate metric (see /api/metrics/by-label) — it intentionally
// undercounts vs. UsageEvent for time-saved purposes.

export const SECONDS_SAVED_PER_DRAFT = 180;
export const SECONDS_SAVED_PER_TAG = 30;

export function timeSavedSeconds(draftCount: number, tagCount: number): number {
  return draftCount * SECONDS_SAVED_PER_DRAFT + tagCount * SECONDS_SAVED_PER_TAG;
}
