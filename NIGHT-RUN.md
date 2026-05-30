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

### Phase 1 — Dashboard re-layout

Commit: `9b17c05` · pushed to origin/main.

**Changes:**
- New: `apps/web/app/components/dashboard/TierStrip.tsx` — slim one-line tier + thin bar + `Xm saved · Ym to {next}`. Replaces `MilestoneHero` on the dashboard.
- New: `apps/web/app/components/dashboard/SyncInboxButton.tsx` — client button; POSTs `/api/labels/back-scan` with `force:true`, shows `Syncing… → ✓ Scanned X, tagged Y`.
- New: `apps/web/app/components/dashboard/NextMilestoneStrip.tsx` — slim row for next-locked milestone + thin bar + "Xm to go".
- New: `apps/web/app/components/dashboard/ActivityFeed.tsx` — compact event list with icon + text + optional label chip + relative time.
- New: `apps/web/app/components/dashboard/SignalsPeek.tsx` — count badge + 3 most recent signals + "View all →" link; renders kind chips for both today's three kinds AND Phase 4's incoming `buried_intent` / `cold_thread`.
- New: `apps/web/lib/recentActivity.ts` — mixed-stream aggregator (drafts, signals, milestones, classifications).
- New: `apps/web/app/api/activity/recent/route.ts` — exposes the aggregator (limit param, capped at 50).
- Rewired: `apps/web/app/(app)/dashboard/page.tsx` to the new hierarchy. `MilestoneHero`, `InboxPanel`, `QuickActions` no longer imported here (files retained, just unwired).

**Acceptance:**
- ✅ Render order matches the brief (header → Running for you → This week → NPS conditional → Next milestone → Recent activity → Worth your attention).
- ✅ Large `MilestoneHero` banner gone; tier info is the one-line strip.
- ✅ Config status cards remain interactive (links to `/configuration` preserved).
- ✅ `InboxPanel` no longer rendered on dashboard.
- ✅ Server-rendered; no client-fetch flashes for tier / next milestone / activity / signals.
- ✅ `npx tsc --noEmit` exits clean.
- ✅ `npm run dev` starts; `/dashboard` returns 307 (unauthenticated redirect) — route compiles and renders without errors.
- ⚠ Mobile-width verification deferred — pure CSS grid + flex with `md:` breakpoints. Will re-check after Phase 2 with the full dashboard composed.

Proceeding to Phase 2.

(Note: this Phase 1 log entry was authored after the Phase 1 commit and lands in the Phase 2 commit. Pure paperwork — code-side ground truth is in `9b17c05`. Going forward I'll log inside each phase commit.)

---

### Phase 2 — Metrics accuracy + dual view

Commit: pending Phase 2 commit · will push after acceptance.

**Changes:**
- New: `apps/web/lib/timeSaved.ts` — single source of truth for `SECONDS_SAVED_PER_DRAFT`, `SECONDS_SAVED_PER_TAG`, and `timeSavedSeconds()`. Comment at top documents the UsageEvent-vs-draftCreated divergence (intentional).
- `apps/web/app/api/metrics/route.ts` — three substantive fixes:
  - `emailsTagged` now uses the 7d windowed count, not all-time. Matches the surrounding "this week" tile framing.
  - Added `replyRateAllTime` alongside `replyRate7d`. Computed via a new local `countSentAllTime()` (same Gmail `messages.list` pattern as `countSentInWindow`, no `newer_than:` filter) divided by all-time `UsageEvent` draft count.
  - Imports the shared time-saved constants instead of redefining them locally.
- `apps/web/app/api/cron/awards/route.ts` and `apps/web/app/api/metrics/timeseries/route.ts` — also migrated to `timeSavedSeconds()`. Three call sites for the math, one definition.
- `apps/web/app/components/metrics/ReplyRateHero.tsx` — added a small segmented `7d ↔ All-time` toggle (top-right of the hero). State is local; defaults to 7d. Sub-copy adapts to the selected window.
- `apps/web/app/(app)/dashboard/page.tsx` — Labels status-card stat is now `${mappingCount} provisioned · ${taggedThisWeek} tagged this week`. The `taggedThisWeek` value comes from the same `ClassifiedThread` count the Metrics tab uses, so the dashboard label card and `ReplyRateByLabel` cannot diverge over the same window.

**Acceptance:**
- ✅ `emailsTagged` reports the 7d count on dashboard (previously was all-time).
- ✅ Reply-rate toggle switches between `7d` and `All-time` and recomputes from real data.
- ✅ Time-saved constants exist in exactly one file (`lib/timeSaved.ts`); three call sites import from it.
- ✅ Dashboard label card consumes the same 7d-windowed `ClassifiedThread` count as the Metrics tab.
- ✅ `npx tsc --noEmit` exits clean.

**Flag:** the all-time reply-rate adds one extra Gmail `messages.list` round-trip to every `/api/metrics` GET. The call returns only `resultSizeEstimate` (no body data), so latency should be similar to the existing 7d call — but they run in parallel via `Promise.all`. If this lifts dashboard p95 unacceptably, the right fix is to precompute `User.allTimeReplyRate` + `User.allTimeReplyRateAt` in the nightly cron and serve from cache. Deferring that optimization unless real numbers say otherwise.

Proceeding to Phase 3.

---

### Phase 3 — Configuration polish + signal toggle

Commit: pending Phase 3 commit · will push after acceptance.

**Schema change (additive, applied to Neon via `prisma db push --skip-generate`):**
- `User.signalDetectionEnabled Boolean @default(true)` — defaulted, fully additive, no data loss possible. `prisma generate` ran clean.

**Changes:**
- New: `apps/web/app/api/preferences/signal-detection/route.ts` — `PATCH { enabled: boolean }` updates the new flag.
- New: `apps/web/app/components/configuration/SignalDetectionCard.tsx` — fourth card with `Toggle`, status pill, and a one-line explainer mentioning the per-thread Haiku cost.
- `apps/web/app/(app)/configuration/page.tsx` — selects `signalDetectionEnabled`, mounts `SignalDetectionCard` below Scheduling.
- `apps/web/app/components/configuration/ToneCard.tsx` — `<select>` replaced with a 4-card grid (`TONE_CARDS`). Card `key` values stay verbatim (`My Tone`, `Concise`, `Formal / Legal`, `Scheduling`) since they're stored in `User.tone` and used as keys in the draft routes' `TONE_INSTRUCTIONS`. UI labels are sentence-case via a separate `label` field.
- `apps/web/app/components/configuration/SchedulingCard.tsx` (via `MeetingHoursGrid.tsx`) — each per-day card now shows the numeric range `HH–HH` plus the hours-per-day count beneath it, instead of just `Xh`.
- `apps/web/app/components/configuration/LabelsCard.tsx` — adds an "Active labels · last 7 days" list. Each row: color dot + label name + tagged count. Sources from `/api/metrics/by-label?days=7` (the canonical label-count source). Mounts on initial load and refreshes on window focus alongside the provisioned-count refresh.
- `apps/web/lib/signalDetector.ts` — `detectAndPersistSignal()` now short-circuits if `User.signalDetectionEnabled === false`. The check runs before any LLM call so no token spend or `UsageEvent` gets logged for opted-out users.

**Acceptance:**
- ✅ Tone is card-selectable; selecting a card PATCHes `User.tone` with the same DB-stable key.
- ✅ Scheduling shows `HH–HH` per active day plus the hours-per-day count.
- ✅ Labels card shows active preset + per-label counts (7d) below the preset picker.
- ✅ Signal-detection toggle persists via PATCH; UI rolls back on failure.
- ✅ `prisma db push --skip-generate` succeeded (additive boolean, no `--accept-data-loss` needed).
- ✅ `npx tsc --noEmit` exits clean; `npm run dev` boots and `/configuration` compiles (307 unauth redirect).
- ⚠ End-to-end "off → no new signals" verification deferred to Phase 4's acceptance (which has the detector loop in scope).

Proceeding to Phase 4.


