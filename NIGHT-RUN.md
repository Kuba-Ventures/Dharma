# Night Run — Dharma Dashboard Overhaul (Stonebraker)

Started: 2026-05-29 PM
Plan: `~/.claude/plans/dharma-dashboard-serialized-stonebraker.md`
Operating in: unattended auto mode. One commit per phase. Push after each. Update this log after each.

## Ground truth at run start

HEAD at start: `32931f4` (PROJECT.md update — published to `origin/main`).

Today's earlier commits (already shipped, do NOT redo):
- `f8c4d27` — AI Gateway helper covers all 9 Anthropic call sites
- `9e4bd1a` — `ClassifiedThread.labelName` + `draftCreated` populated end-to-end
- `89c1e0c` — Signal producers live (deal_flow / term_sheet / transaction). **Phase 4 will rewrite these to buried_intent + cold_thread.**
- `1faa615` — sentence-case sweep
- `32931f4` — PROJECT.md catches up

Working tree clean. Schema synced to Neon. Prisma client regenerated.

## Open loops at run start (from PROJECT.md)

- Finley actions: CWS review, first external user, Pub/Sub verify, Marketplace listing
- Substantial design: Stripe / subscribe
- External data: cities to 5k
- Deferred: multi-account switching
- Signal cost ceiling (will close in Phase 4)

## Run log

### Phase 0 — Orient (no commits)

Done. Read PROJECT.md, confirmed HEAD `32931f4`, confirmed 5 today-commits are present, pushed baseline to origin/main. Open loops noted above. Proceeding to Phase 1 automatically.

**Audit notes for downstream phases:**

- **Label-count divergence (Phase 2 will fix)**: Dashboard `/api/metrics` returns `emailsTagged: classifiedThread.count(ALL TIME)` but `DashboardMetrics` renders it as a "this week" tile (per the surrounding tiles). Need to window to 7d.
- **Drafts-vs-draftCreated divergence (Phase 2 will document)**: `/api/metrics` derives time-saved from `UsageEvent.eventType="draft"` count (captures Polish-mode); the new `ClassifiedThread.draftCreated` boolean is a per-thread flag that misses Polish-mode and pre-classification drafts. Decision: keep `UsageEvent` as the time-saved source; reserve `draftCreated` for the per-label rate (which is what it's used for in `/api/metrics/by-label`). Extracting `SECONDS_SAVED_PER_*` to `lib/timeSaved.ts` with a comment explaining this.
- **InboxPanel demotion**: `InboxPanel.tsx` is doing double duty as inbox-browser-with-inline-draft. Phase 1 removes it from the dashboard render tree. Inline drafting still works from Gmail (via the Chrome extension + Gmail add-on); the dashboard's role becomes overview, not inbox triage. The brief and the followup question both confirmed this.
- **Signal-kinds rewrite (Phase 4)**: today's `deal_flow / term_sheet / transaction` will be replaced by `buried_intent + cold_thread`. `pattern_shift` deferred — needs a `ContactBaseline` table (per-`from` cadence + sentiment baseline) we don't have. One-paragraph spec to be added in Phase 4 log.
- **Confirm/dismiss feedback loop**: today's `/api/signals/[id]/read` is read-only. Phase 4 will leave a TODO for `/confirm` and `/dismiss` rather than fake the signal — flagged here so Finley knows it's not a tonight-deliverable.
- **`User.signalDetectionEnabled`**: additive boolean schema change in Phase 3. Safe — defaulted, no data loss possible. Will be flagged again before the `prisma db push` runs.

---

(phases 1–5 will be appended below as each lands)
