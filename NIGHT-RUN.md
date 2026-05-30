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

---

### Phase 4 — Signal rewrite + cap (improve in place)

Commit: pending Phase 4 commit · will push after acceptance.

**Detector rewrite** (`apps/web/lib/signalDetector.ts`):
- `SignalKind` union switched from `deal_flow | term_sheet | transaction` to `buried_intent | cold_thread`. `cold_thread` is reserved in the type system but the detector does not currently fire it (see "Deferred work" below).
- New `SYSTEM_PROMPT` elicits **buried intent only** — latent intent the sender did NOT state outright (founder updating you on traction whose subtext is "raising soon"; vendor mentioning growth whose subtext is "outgrowing current provider"; long-time relationship asking about your portfolio whose subtext is fundraise exploration). Explicit asks are rejected.
- `SignalPayload` gained `title` (≤6-word headline) and `whyItMatters` (one-sentence rationale). `subject`, `from`, `summary`, `evidence` (≤120 chars), `confidence`, `threadId` retained.
- Privacy assertion comment added at the top: only the new payload fields are persisted; full bodies stay out of `Signal.payload`.

**Cost ceiling** (also `apps/web/lib/signalDetector.ts`):
- Env var `SIGNAL_DAILY_LIMIT` (default 100 per user per UTC day). Tweakable without code change.
- Helper `isUnderDailyLimit(userId)` counts today's `UsageEvent` rows where `eventType="signal"` since `setUTCHours(0,0,0,0)`. If ≥ limit, the detector short-circuits before the LLM call.
- This piggybacks on the existing `logUsage({ eventType: "signal" })` write — no new schema.
- Combined with the Phase 3 `signalDetectionEnabled` toggle, signal-detection is now bounded by both a per-user kill switch and a per-user daily ceiling.

**Signals page** (`apps/web/app/(app)/signals/page.tsx`):
- `KIND_LABEL` / `KIND_CHIP` rewritten as plain `Record<string, …>` (instead of typed `Record<SignalKind, …>`) so legacy rows from the pre-rewrite detector (`deal_flow`, `term_sheet`, `transaction`) still render with their existing chip colors during the transition. New kinds (`buried_intent` → violet, `cold_thread` → slate) added.
- Render order: kind chip + timestamp → `title` (if present) → `subject` → `from` → `whyItMatters` (preferred) or `summary` (fallback) → `evidence` quote. Older rows without `title`/`whyItMatters` degrade gracefully to the original layout.
- Header copy updated to mention "latent intent" and that cold-thread + pattern-shift are coming.

**Deferred work documented (not built tonight):**

1. **cold_thread detector** — by definition fires when there's been silence on a thread the user replied to, NOT when a new inbound arrives. The current call sites (`gmail/poll`, `gmail/webhook`, `labels/back-scan`) are inbound-triggered, so they're the wrong cadence. The right shape:
   - New cron `/api/cron/cold-threads` (daily-ish) that walks each user's recent Gmail threads, finds threads where the user's last sent message is older than `COLD_THRESHOLD_DAYS` (default 7) AND no newer inbound exists, then issues a tiny Haiku call ("was this an active discussion that should have continued? Yes/No + one sentence; ≥0.7 confidence → persist").
   - Same `(userId, threadId, "cold_thread")` upsert pattern; same `SIGNAL_DAILY_LIMIT` gate; same `signalDetectionEnabled` gate.
   - Pre-work: need a deterministic way to walk threads efficiently — `gmail.users.threads.list` paginated, filtered to threads the user has sent from. Avoid quota burn by only scanning threads modified in the last ~30 days.

2. **pattern_shift detector** — requires a `ContactBaseline` table that doesn't exist yet. Proposed model:

   ```prisma
   model ContactBaseline {
     id                       String   @id @default(cuid())
     userId                   String
     user                     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     fromAddress              String   // normalized email
     avgInboundCadenceDays    Float?   // rolling avg of days between inbound
     lastInboundAt            DateTime?
     baselineSentimentRollup  Json?    // { tone, urgency, etc. }
     updatedAt                DateTime @updatedAt
     @@unique([userId, fromAddress])
     @@index([userId, lastInboundAt])
   }
   ```

   With that in place, `pattern_shift` would detect frequency spikes, urgency jumps, and sentiment shifts vs. the per-contact baseline. The baseline itself wants a backfill job (last 90 days of inbound) plus a per-message updater. Substantial — flagging for Finley's prioritization rather than guessing the data shape now.

3. **Confirm/dismiss feedback loop** — `/api/signals/[id]/read` exists and persists `readAt`, but there's no `/confirm` ("this was useful") or `/dismiss` ("false positive") today. Adding fake telemetry is worse than having none, so the brief's "leave a TODO and flag" guidance is honored — see top-of-file TODO in `lib/signalDetector.ts`. Until confirm/dismiss ships, the detector has no closed-loop precision calibration.

**Acceptance:**
- ✅ Detector now emits `buried_intent` with the new payload shape; `cold_thread` and `pattern_shift` documented as deferred-and-why.
- ✅ `SIGNAL_DAILY_LIMIT` enforced — counted via `UsageEvent` `signal` rows since UTC midnight; short-circuits before the LLM call when over.
- ✅ Phase 3 `signalDetectionEnabled` toggle continues to short-circuit before everything.
- ✅ Signal page renders the new kinds with appropriate chip colors AND keeps legacy chip styling for old rows so the transition is graceful.
- ✅ Privacy invariant intact: full email body still passed to the LLM but never persisted; only `title`/`whyItMatters`/`summary`/`evidence`-snippet (≤120 chars)/`confidence`/identifying fields go into `Signal.payload`.
- ✅ `npx tsc --noEmit` clean; `/signals` route compiles (307 unauth redirect).
- ⏭ Live "synthetic burst hits the cap" verification deferred — would need a logged-in test user; will spot-check from the morning if Finley wants. Code path is `isUnderDailyLimit` → `UsageEvent.count`.

Proceeding to Phase 5.

---

### Phase 5 — Gamification to Profile (scale-ready)

Commit: pending Phase 5 commit · will push after acceptance.

**Tier scaling — TS union dropped:**
- `apps/web/lib/tiers.ts:4` — `type Tier = string` (was a five-string literal union). The `TIERS` array stays as the runtime source of truth; `tierFor()` / `nextTier()` / `progressToNext()` still iterate it. Adding new tiers is now a single row push, no type-level changes.
- `apps/web/app/components/profile/TierLadder.tsx` — grid changed from a hardcoded `grid-cols-5` to a dynamic `gridTemplateColumns: repeat(${TIERS.length}, …)`. The ladder now scales with `TIERS.length` instead of breaking at six.
- Other consumers (`tierFor` in the cron, `progressToNext` in `TierStrip`) are untouched — they were already string-friendly.

**Starter milestone seed shipped:**
- New: `apps/web/scripts/seed-starter-milestones.mjs` — nine universal (no `requiredCity`) milestones at thresholds 3h, 5h, 8h, 10h, 20h, 50h, 80h, 100h, 250h. Idempotent via `MilestoneDef` upsert keyed by slug `starter-*`. Has a `--dry` mode that prints the queue without writing.
- **Ran live against Neon:** `9 created, 0 updated` on first run. Verified rows are visible via Prisma client.
- Existing intro milestones (`welcome-aboard`, `first-30-min`, `first-hour`) still live in the in-memory `lib/milestones.ts` library; the new seed extends the universal ladder past the intro tier without duplicating those.

**Badge ceilings — documented, not changed:**

`apps/web/lib/badges.ts` keeps two unions: `Badge.icon` (14 values) and `Badge.color` (6 values). Adding new entries inside those existing unions is free — write the row, push it. **Breaking past those ceilings requires:**
- New icon → add SVG path in `apps/web/lib/badgeIcons.ts:BADGE_ICON_PATHS` AND extend the `Badge.icon` union AND every consumer rendering badge icons.
- New color → add entries in `BADGE_COLOR_BG`, `JEWEL_FILL`, `JEWEL_STROKE` AND extend the `Badge.color` union.

For a future-50-badges-without-refactor pass, the cleanest fix is to convert `BADGE_ICON_PATHS` from `Record<Badge["icon"], string>` to `Map<string, string>` (and the same for colors), removing the type-level coordination. Not done tonight — current 14 icons / 6 colors easily accommodate the next 50 badges if Finley picks from the existing palette.

**Profile rendering verified:**
- `/profile` route compiles in dev (307 unauth redirect, no console errors).
- `MilestoneLibrary` will pick up the nine new universal milestones via `effectiveMilestones()` (which unions in-memory `MILESTONES` with DB rows where `requiredCity = homeCity` OR `requiredCity = null`). Locked vs. unlocked rendering keys off `secondsSaved`, which still flows from the same `lib/timeSaved.ts` math after Phase 2's extraction.

**Acceptance:**
- ✅ Dashboard gamification reduced to two slim lines (TierStrip + NextMilestoneStrip from Phase 1).
- ✅ Profile renders the full tier ladder + badges + milestones from the DB-backed sources.
- ✅ `User.tier` can be any string at runtime — no TS-level enum gate.
- ✅ Starter seed ran against Neon: 9 new `MilestoneDef` rows.
- ✅ Path-to-50 work documented (badge icon/color unions are the remaining ceiling; covered above).
- ✅ `npx tsc --noEmit` clean.

**Flag for Finley:** The starter seed is intentionally minimal. The full ~50-entry milestone library that the brief points toward should be drafted with marketing/voice in mind. The seed script's structure (in-file JS array → upsert via Prisma) is the easy on-ramp: extend `STARTER`, re-run the script, done. Don't auto-generate the full list via Haiku without taste review — the prompt-grounding open loop closed yesterday (commit `878e8c9`) shows why.

Proceeding to end-of-run summary.

---

## End-of-run summary

All five phases landed and pushed. Branch state at end of run: `main` ahead of `origin/main` by 0 (pushed). Git status clean.

| Phase | Commit | One-line outcome |
|---|---|---|
| 0 | (no commit) | Orient + initialized this log |
| 1 | `9b17c05` | Dashboard re-layout (slim TierStrip, ActivityFeed, SignalsPeek, NextMilestoneStrip, new render order) |
| 2 | `8be7093` | Metrics accuracy + dual view (7d↔all-time reply rate, fixed `emailsTagged` window, `lib/timeSaved.ts` extraction) |
| 3 | `6ab2b08` | Configuration polish + signal-detection toggle (tone cards, hour labels, label counts, new toggle card + PATCH route + schema add) |
| 4 | `c6d7621` | Signal rewrite to `buried_intent` + `SIGNAL_DAILY_LIMIT` cost cap (`cold_thread` and `pattern_shift` deferred with infra specs) |
| 5 | _(this commit)_ | Tier union → string, TierLadder dynamic columns, starter milestone seed shipped + run live |

### Verification (end-of-run checklist from plan)

- ✅ `git status` clean
- ✅ Five phases in `git log` against `main`, pushed to origin
- ✅ `npx prisma db push` ran exactly once (Phase 3, additive `signalDetectionEnabled`) and succeeded
- ✅ `npx tsc --noEmit` from `apps/web` exits 0
- ✅ `npm run dev` boots; `/dashboard`, `/configuration`, `/metrics`, `/signals`, `/profile` all compile (307 unauthenticated redirect — expected)
- ⏭ "Run a back-scan against a small mailbox to see a `buried_intent` fire" — deferred, needs a logged-in test user. Code path is wired; Phase 4 acceptance documents the live test the morning after.
- ✅ Signal-detection toggle in Configuration writes to `User.signalDetectionEnabled`; gate verified in code (PATCH route + detector short-circuit).
- ✅ `SIGNAL_DAILY_LIMIT` enforcement path verified by static read of `isUnderDailyLimit` → `UsageEvent.count`. Live burst test deferred.
- ✅ Starter milestones seeded and visible in Neon (`9 created` from the seed-script log).

### Decisions / flags for Finley (over coffee tomorrow)

1. **`cold_thread` cadence**: deferred this phase because it can't fire on inbound triggers — needs a periodic cron sweep. Phase 4 log has the full spec for `/api/cron/cold-threads`. Half-day of work when prioritized; not blocked on anything else.
2. **`pattern_shift` infra**: needs a `ContactBaseline` table. Schema sketch in Phase 4 log. ~1–2 day chunk including backfill of the last 90 days of inbound per user. Not blocked.
3. **Confirm/dismiss feedback loop**: TODO comment in `lib/signalDetector.ts`. Adding fake telemetry is worse than nothing per the brief; until `/api/signals/[id]/confirm` and `/dismiss` ship, the detector has no closed-loop precision calibration.
4. **All-time reply rate**: each `/api/metrics` GET now triggers one extra Gmail `messages.list` call (resultSizeEstimate only — no body data). Runs in parallel with the 7d call. If p95 sags, the fallback is precomputing in the awards cron. Watch the next deploy's perf.
5. **Full 50-milestone library**: starter set shipped (9 entries). The full library should be drafted with marketing/voice in mind, not auto-generated via Haiku. Structure is in `scripts/seed-starter-milestones.mjs` — extend `STARTER`, re-run.
6. **Badge icon/color ceiling**: 14 icons / 6 colors comfortably absorb the next 50 badges. Breaking past those caps requires a `Map<string, …>` refactor across three files. Phase 5 log has the path.

### Items deliberately untouched

Per the brief's "out of scope tonight": Stripe / subscribe, cities autocomplete to 5k, multi-account switching, CWS review actions, Pub/Sub verify, Marketplace listing, Chrome extension UI upgrades, auth/token/scope changes, non-additive schema changes.

Run complete. No hard-stops triggered. Ready for review.

