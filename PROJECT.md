# Dharma
*AI-drafted Gmail replies and scheduling, wrapped in a labeled inbox.*

*Last updated: 2026-07-13 22:27 ET by kuba-vault*

---

## TL;DR

Dharma is a Next.js web app + Gmail add-on that watches a user's Gmail, classifies threads into preset labels (VC / PE / Legal / General / Personal / Custom), and drafts replies in the user's tone — including calendar-aware scheduling replies over Google, Microsoft, and Apple free/busy. The product works end to end for the current invite-only cohort. The dominant workstream now is **going public**: the app-side launch requirements are done (AI cost/abuse guardrails, self-serve data deletion, a flag-gated self-serve signup switch, security response headers, a health check, a Limited-Use privacy section), but the actual launch is **blocked externally** on Google restricted-scope verification + a CASA Tier 2 security assessment, which needs decisions and budget from Abhinav Godavarthi (client-side owner of budget/legal/consent-screen/domain). Onboarding is now a 5-step wizard (connect → city → tone → labels → install) with a live Google Workspace Marketplace add-on listing at the end, and a new driver.js product tour greets first-time dashboard users. Most recent code work (2026-07-13, PRs #42/#43/#44) fixed the back-scan labeling pipeline so a freshly-onboarded user actually lands in a labeled inbox — forcing the onboarding scan, only recording a thread as classified once a label lands, and backfilling ~75 inbox threads instead of just the front page.

---

## What it is

**The problem:** Busy operators (founders, VCs, PE associates, lawyers) spend hours triaging inbox and writing routine replies — especially scheduling back-and-forth.
**The solution:** Dharma classifies each new thread into a small set of meaningful Gmail labels, drafts reply text in the user's tone, and (for scheduling threads) pulls multi-calendar availability and writes a ready-to-send reply with concrete time slots.
**The user:** Solo operators and small teams in finance/legal whose inbox is their job — VC/PE first, Legal next.
**The value:** Reclaim ~30-60 min/day of triage and routine writing; never miss a scheduling thread because the calendar work is already done.

---

## Status

- **Phase:** launch prep — app-side go-public work is done; external Google verification / CASA is the gate
- **Engineering lead:** Finley
- **Client-side owner:** Abhinav Godavarthi (budget, legal sign-off, OAuth consent screen, domain, CASA assessor selection)
- **Cadence:** daily commits via a supervised PR factory; async decision doc (`docs/abhinav-questions.md`) is the client channel
- **Next milestone:** Abhinav approves the CASA budget + picks an assessor so the Google verification clock can start (~1-2 months, external)
- **Flags:** on-track (engineering) / blocked (public launch, waiting on Abhinav + Google)

---

## Where we are right now

This week's work fixed why a freshly-onboarded user saw "You're all set, we sorted your inbox" but no label chips actually landed, then deepened the backfill. Three PRs shipped 2026-07-13/14, all merged to `main` and live in prod. **#42** — onboarding's "sort my inbox" back-scan ran non-forced, so any pre-existing `ClassifiedThread` row made it skip the thread (prod log: `scanned=0 tagged=0 skipped=8`); `PersonalizeForm` now sends `force: true` like the manual Sync-inbox button. **#43** — the root cause: the webhook + poll paths recorded a `ClassifiedThread` row even when zero Gmail labels landed (provisioning race with an empty `LabelMapping`, or `matched=null` with Uncategorized off), stranding threads "classified but unlabeled" so non-forced scans skipped them forever; a new pure gate `lib/classifiedThreadGate.ts` (`shouldRecordClassifiedThread`) now records only when a label landed or there was legitimately nothing to apply. **#44** — the back-scan now backfills ~75 inbox threads (env `BACKSCAN_BACKFILL_TARGET`) instead of just the front page: first 25 synchronous, the rest in an `after()` tail, for BOTH onboarding and Sync inbox (previously only onboarding got a tail); also fixed a skip bug where paginating consumed only 25 of the threads a page surfaced. All three correctly returned ESCALATE from factory-review CI (they touch `onboarding/**` and `api/**`) and were merged by a human. #44 verified live on the `mrfinleyunderwood@gmail.com` test account (`scanned=8 tagged=8 skipped=0`; that inbox only holds 8 threads, so the multi-page path wasn't exercised on real data). The launch itself remains externally blocked on Google restricted-scope verification + CASA Tier 2, waiting on Abhinav's budget approval and assessor SOW.

---

## What's built

**Frontend / UI (apps/web)**
- Landing page at `/` (Plus Jakarta Sans headings; Arial elsewhere) — embeds the waitlist form
- Login page (`/login`) — Google OAuth, optional `login_hint` via `?hint=`, calls `signOut()` before `signIn()` to dodge JWT carryover
- **5-step onboarding** at `/onboarding/step-1-connect` → `-2-city` → `-3-tone` → `-4-labels` → `-5-install`, gated by `User.onboardingCompletedAt` (step 5 sets it). Step 2 uses bundled US-cities autocomplete. Step 4 (`LabelPresetPicker`) provisions Dharma label presets into Gmail via `/api/labels/provision`. Step 5 links the live Google Workspace Marketplace add-on listing.
- **Product tour** (`app/components/dashboard/ProductTour.tsx`, driver.js) — ~20-second guided tour anchored to `data-tour` elements on the dashboard, gated by a `tourCompletedAt` flag; replayable via `?tour=1` / Settings. Steps that can't find their anchor are skipped.
- 5-tab app shell under `app/(app)/`: `/dashboard`, `/metrics`, `/configuration`, `/signals`, `/settings`, plus `/profile`
- **Dashboard:** single-scroll six-section hierarchy — Greeting + Sync inbox button + slim `TierStrip` → "Running for you" (ConfigStatusCard trio) → "This week" (DashboardMetrics) → `NextMilestoneStrip` → `ActivityFeed` → `SignalsPeek`
- Metrics: `ReplyRateHero` (7D↔All-time toggle), `TimeSavedChart` with milestone dots, `ReplyRateByLabel` (`?days=7`), `MilestoneTimelineStrip`
- Configuration: `ToneCard` 2x2 grid, `SchedulingCard` numeric hour ranges, `LabelsCard` active-labels list, `SignalDetectionCard` per-user toggle
- Profile: IdentityCard, BadgeCase, MilestoneLibrary, hover-to-set `displayBadgeId`; ProfileChip in sidebar shows a comped/earned tier
- **Tier ladder honors admin comp:** `TierLadder` displays the higher of the time-earned tier and an admin comp set in the Users sheet; shows "Complimentary tier" and drops the time-based progress bar when the comp outranks earned
- Settings hub + sub-pages (Advanced with `DeleteAccountCard`, Hidden stats, Profile-legacy)
- 10 shared UI primitives under `app/components/ui/`; purple-forward design tokens; tier-up confetti; FeedbackButton + ConfirmModal

**Backend / API (apps/web/app/api)**
- `auth/[...nextauth]` — Google OAuth via NextAuth v5; PrismaAdapter wrapped in `lib/adapter.ts` for idempotent Account linking
- **AI cost/abuse guardrails (`lib/aiGuard.ts` + `lib/aiLimits.ts`, #15):** every AI route (`emails/[id]/draft`, `emails/thread-draft`, `preferences/tone/{sample,sync}`, `calendar/google/schedule`, `calendar/rsvp`) plus `classify`/`signalDetector` runs through a guard with per-minute + per-day + per-day-cost caps. Tier-aware: `free` (≈8/min, 60/day, $0.75/day) vs `paid` (30/min, 600/day, $8/day), env-tunable (`AI_FREE_*` / `AI_PAID_*`); `planForUser()` reads an `AI_PAID_USER_IDS` allowlist. Enforcement rides on `UsageEvent` writes.
- `user/delete-account` (#14) — self-serve account + data deletion (`lib/accountDeletion.ts`); also surfaced in Support
- `health` (#21) — deployment health check; poll cron now alerts on failure
- `gmail/webhook` — real-time Pub/Sub push receiver (OIDC-verified against `PUBSUB_PUSH_AUDIENCE`; primary labeling path when a watch is live). Records a `ClassifiedThread` row only when a Gmail label actually landed (or there was legitimately nothing to apply) via the `lib/classifiedThreadGate.ts` gate (#43) — no longer strands threads "classified but unlabeled" during a provisioning race
- `gmail/poll` — Vercel cron (`*/30 * * * *`) safety-net sweep; calls `history.list` per user, does **not** depend on a live Gmail watch, idempotent via `ClassifiedThread` dedupe + `gmailHistoryId` advance. Uses the same `classifiedThreadGate` record-only-when-labeled rule (#43)
- `cron/renew-watches` (`0 7 * * *`) — renews Gmail watches expiring within 48h; emits an ops alert via `lib/opsAlert.ts` on any renewal failure
- `labels/back-scan` — powers "Sync inbox" and onboarding's "sort my inbox" (both now send `force:true`, #42). `scanCore` paginates Gmail inbox pages up to a backfill target (`BACKSCAN_BACKFILL_TARGET`, 75): first 25 synchronous, the remainder in an `after()` tail — for BOTH the Sync-inbox button and onboarding (previously only onboarding got a tail, #44). Lists one page at `maxResults = BACKSCAN_MAX_THREADS` (25) and consumes every unique thread before advancing the page token, at the cost of bounded overshoot (<1 page); classification fans out at `BACKSCAN_CONCURRENCY` (25, #41). Reconciles labels (applies the single best preset label, strips other preset-managed labels) instead of appending
- `labels/*` — CRUD, `preset`, `provision`, `setup-gmail`, `scan-inbox`, `back-scan`, `seed-rules`, `status`, `uncategorized`
- `suggest-times` — Sonnet streaming scheduling reply over multi-calendar free/busy
- `preferences/{tone,scheduling,meeting-hours,signal-detection}`, `user/{me,preferences,extension-token,nps-postpone,ack-tier,dismiss,delete-account}`
- `calendar/{google,microsoft,apple,rsvp}` — connect/disconnect + Google `schedule` (events with Meet links)
- `metrics` (7d-windowed `emailsTagged`, dual `replyRate7d`/`replyRateAllTime`), `metrics/timeseries`, `metrics/by-label`
- `signals`, `signals/[id]` — `buried_intent` via the rewritten detector; legacy kinds still render
- `activity/recent` — dashboard `ActivityFeed` mixed event stream (`lib/recentActivity.ts`)
- `feedback`, `onboarding/*`, `profile/*`, `milestones/*`, `share/milestone/[id]` (Edge OG), `cron/awards` (nightly), `waitlist/join`, `geo/cities`
- SEO: `robots.ts`, `sitemap.ts`, canonical URLs on legal/support pages

**Gmail add-on (apps/gmail-addon)** — the only in-Gmail surface
- Apps Script `Code.gs` deployed via `clasp`; live as deployment **v22**; `DHARMA_API` → `https://www.dharmaautomations.com`
- **Now has a live Google Workspace Marketplace listing** (linked from onboarding step 5)
- Scope audit finding: add-on `gmail.compose` is unused and should be dropped (one fewer restricted scope for CASA)

**Shared packages**
- `@dharma/types`, `@dharma/calendar-core`, `@dharma/providers-google` / `-outlook` / `-apple`, `@dharma/reply-generation`

**Tests & CI**
- Vitest suites: `lib/{aiGuard,labelPresets,timeSaved,cities,sampleScenarios,classifiedThreadGate}.test.ts` + `app/{privacy,terms,support}/page.test.tsx` + onboarding `PersonalizeForm.test.tsx` (asserts the back-scan request body `{ onboarding: true, force: true }`)
- **Supervised PR factory:** PRs are auto-reviewed by `.claude/agents/pr-reviewer.md` against the merge policy in `CLAUDE.md`. Auto-merge is disabled (`FACTORY_AUTOMERGE` unset) pending a supervised soak; only listed low-risk surfaces are ever eligible. Auth, onboarding, API routes, schema, tiers, and AI behavior are always escalate-to-human. Factory-review action pinned to a known-good SHA (#13).

**Database (Neon Postgres via Prisma, `schema.prisma` at repo root)**
- User (+ `firstName`, `homeCity/Lat/Lng`, `timezone`, `toneSummary`, `dismissedTiles[]`, `onboardingStep/CompletedAt`, `tier`, `lastSeenTier`, `displayBadgeId`, `cumulativeSecondsSaved`, `nextNpsPromptAt`, `signalDetectionEnabled`). **No `role` field yet** (relevant to the proposed onboarding feature below).
- GoogleCredential, MicrosoftCredential, AppleCredential (AES-256-GCM encrypted)
- Label, LabelRule, LabelPreset, LabelMapping, ClassifiedThread (`labelName` + `draftCreated`)
- NextAuth Account/Session/VerificationToken; UsageEvent; MeetingHour, MilestoneDef, UserMilestone, BadgeDef, UserBadge, Signal, Feedback

**Infrastructure**
- Vercel hosting (`kuba-ventures` team) at `https://www.dharmaautomations.com`; old `dharma-lake.vercel.app` alias dead (404)
- Three Vercel crons (UTC): `/api/cron/awards` (`0 8 * * *`), `/api/cron/renew-watches` (`0 7 * * *`), `/api/gmail/poll` (`*/30 * * * *`)
- Neon Postgres; Google Cloud Pub/Sub (push → `/api/gmail/webhook`, audience on the live domain); admin Google Sheet via service account
- Security response headers on every route (`next.config.ts`): X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and a **report-only** CSP (GTM/GA4/Vercel analytics need inline/eval; enforcing CSP deferred until reports are clean)
- Analytics: GTM-fronted GA4 (GTM container fires GA4, not in code)

---

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Monorepo | npm workspaces | `apps/*` + `packages/*`, Node >=20 |
| Frontend | Next.js 16.2 (App Router) + React 18.3 + Tailwind 3.4 | `apps/web` |
| Onboarding tour | driver.js 1.4 | `app/components/dashboard/ProductTour.tsx` |
| Auth | NextAuth v5 beta (`^5.0.0-beta.25`) + wrapped Prisma adapter | `lib/adapter.ts` |
| Database | PostgreSQL (Neon) via Prisma 5.22 client | `schema.prisma` at repo root |
| AI — classify/polish/signal/milestone | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | `lib/classify.ts`, `signalDetector.ts`, `milestoneGenerator.ts` |
| AI — reply generation / scheduling / tone | Claude Sonnet (`claude-sonnet-4-20250514`, streaming) | `packages/reply-generation`, `/api/suggest-times` |
| AI cost/abuse guard | `lib/aiGuard.ts` + `lib/aiLimits.ts` | tier-aware per-min/day/cost caps on every AI route |
| AI routing | Vercel AI Gateway (optional, via `AI_GATEWAY_API_KEY`) | `lib/anthropicEndpoint.ts` toggles Gateway vs direct Anthropic |
| Gmail | `googleapis` v173 (Gmail API v1) | `gmail.modify` scope; read/label/draft/history/watch |
| Calendar | Google Calendar + Microsoft Graph + Apple CalDAV (`tsdav` 2.0) | Free/busy + Meet links |
| Hosting | Vercel (`kuba-ventures` team) | `vercel.json` runs `prisma generate && next build`; 3 UTC crons |
| Badges / share cards | Static SVG assets in `public/badges`; earned badges served as JSON | `app/api/badges/[userId]` |
| Gmail add-on | Apps Script via `clasp` (live deployment v22) | `apps/gmail-addon/Code.gs` |
| Tests | Vitest + Testing Library + happy-dom | 8 suites |

---

## Integrations & MCPs

| Integration | Purpose | Cost | Status |
|---|---|---|---|
| Vercel (hosting + functions + cron + Edge OG) | Hosts app, API routes, crons, share-card OG | unknown (Hobby/Pro) | live (`www.dharmaautomations.com`, `kuba-ventures` team) |
| Neon (Postgres) | Primary database | unknown | live |
| Anthropic API (direct, optionally via AI Gateway) | Haiku 4.5 (classify/polish/signal/milestone) + Sonnet (reply/scheduling/tone) | usage-based; tracked in `UsageEvent`; capped by `aiLimits` per-user tier | live |
| Google OAuth | User login | free | live (consent-screen production status: confirm — see risks) |
| Gmail API | Read inbox, apply labels, create drafts, register Watch | free (quota-limited) | live |
| Google Calendar API | Free/busy, create/update/delete events with Meet | free (quota-limited) | live |
| Google Cloud Pub/Sub | Real-time Gmail push (push → `/api/gmail/webhook`, OIDC-verified) | usage-based, unknown | live (`/api/gmail/poll` cron is the fallback) |
| Google Workspace Marketplace | Distribution for the Gmail add-on | unknown | **live listing** (linked from onboarding step 5) |
| Google Sheets (service account) | Admin sheet: Waitlist / Subscribers / Users (tier comp) | free (quota-limited) | live |
| Microsoft Graph | Outlook calendar free/busy | free (quota-limited) | live |
| Apple iCloud CalDAV | iCloud calendar free/busy | free | live |
| Google Analytics 4 (via GTM) | Web analytics | free | live (GTM container fronts GA4) |
| Slack-compatible ops webhook | Watch-renewal + poll-failure alerts via `OPS_ALERT_WEBHOOK_URL` (`lib/opsAlert.ts`) | free | planned (mirror to `console.error` until env set) |
| Stripe | Paid-tier billing | usage/% | planned (blocked on free-vs-paid split decision) |
| CASA Tier 2 assessor (TBD vendor) | Google restricted-scope security assessment | ~$500-$3,000+/yr | planned (blocked on Abhinav budget + assessor pick) |

*Source: no MCP config files found in repo; this table is generated from `.env` references, `lib/adminSheet.ts`, `lib/aiLimits.ts`, `next.config.ts`, `docs/go-public-log.md`, and `docs/abhinav-questions.md`.*

---

## Decisions log

- **2026-07-13 — Back-scan backfills ~75 inbox threads, not just the front page** — `scanCore` now paginates Gmail inbox pages up to `BACKSCAN_BACKFILL_TARGET` (75): first 25 synchronous, the rest in an `after()` tail, for both Sync inbox and onboarding (previously only onboarding got a tail). Lists one page at `maxResults = MAX_THREADS` and consumes every unique thread before advancing the page token — fixes a skip bug where the old code listed 2x messages but consumed only `min(remaining, 25)`, leaving surplus threads behind when the token advanced. Rejected: keeping the front-page-only scan (deeper inbox mail never got labeled). Trade-off accepted: bounded overshoot of <1 page. (PR #44)
- **2026-07-13 — Record a `ClassifiedThread` row only when a label actually lands** — The webhook + poll paths upserted a `ClassifiedThread` unconditionally, even when zero Gmail labels were applied (empty `LabelMapping` during a provisioning race, or `matched=null` with Uncategorized disabled), stranding threads "classified but unlabeled" so any non-forced back-scan skipped them forever. New pure gate `lib/classifiedThreadGate.ts` (`shouldRecordClassifiedThread`) records only when a label landed or there was legitimately nothing to apply, else logs and defers. This was the root cause behind the "all set but no labels" onboarding symptom. Rejected: always recording (the original bug) and always deferring (would re-classify no-op threads forever). (PR #43)
- **2026-07-13 — Onboarding back-scan runs forced, like the manual Sync-inbox button** — Onboarding's "sort my inbox" ran non-forced, so any pre-existing `ClassifiedThread` row made it skip that thread (prod log: `[back-scan] done in 0ms · scanned=0 tagged=0 skipped=8`). `PersonalizeForm` now sends `force: true`. Rejected: leaving it non-forced (users hit "You're all set" with an unlabeled inbox). (PR #42)
- **2026-07-06 — TierLadder displays the higher of earned vs admin-comped tier** — `lib/effectiveTier.ts` reads a comp set in the Users-sheet Tier column (live, ~60s cache) and returns whichever outranks the time-earned tier, mirroring the awards cron's comp-up rule so a comp shows on dashboard/profile within ~60s. When a comp outranks earned, `TierLadder` labels it "Complimentary tier" and drops the time-based progress bar (it would read wrong). A same/lower/blank sheet value has no effect. (branch `fix/tier-ladder-comp`, `5074a90`)
- **2026-07-05 — Ship CSP as report-only first, not enforcing** — The app loads GTM/GA4 + Vercel analytics with inline scripts, so an enforcing `Content-Security-Policy` risks breaking the site. Report-only surfaces violations in the browser console without blocking, so the policy can be tightened once reports are clean. The other headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) enforce immediately. HSTS is left to Vercel. (PR #24)
- **2026-07-05 — Free + paid tiers; labeling stays free, drafting/scheduling/signals are the paid hook** — Monetization decided as free + paid (price TBD). The guard is already tier-aware (`aiLimits`, `AI_FREE_*`/`AI_PAID_*`), free ≈ 60 AI actions/$0.75 per day, so auto-labeling is affordable to give away. Maps onto the existing `planForUser()` seam; Stripe just flips free↔paid. Rejected: a single flat plan. (`docs/abhinav-questions.md`)
- **2026-07-05 — Self-serve signup ships behind a default-off flag** — `SELF_SERVE_SIGNUP` gates public signup so the code can land now and the launch is a one-env-var flip once Google verification clears, rather than a code push under time pressure. Default off keeps the 100-user testing cap safe. (PR #17)
- **2026-07-05 — Guardrail every AI path before going public** — A public, unauthenticated-ish surface with LLM calls is a cost/abuse liability, so `aiGuard` wraps every AI route with per-minute/day/cost caps keyed on `UsageEvent`, tier-aware via `planForUser`. Rejected: a single global ceiling — too blunt across free vs paid. (PR #15)
- **2026-07-05 — Fix the `uuid` vuln at the source with a `googleapis` 144→173 major bump** — The only `npm audit` high-sev was a transitive `uuid` chain via `googleapis`; a clean fix needed the breaking major bump plus live Gmail/Calendar regression QA rather than a forced resolution. (PR #20)
- **2026-06-22 — Re-attach `/api/gmail/poll` as a `*/30` Vercel cron fallback that doesn't depend on a live Gmail watch** — The Pub/Sub-push-only labeling path is single-point-of-failure: when a watch lapses or a push is rejected, labeling stops silently. The poll cron calls `history.list` directly per user, advances `gmailHistoryId`, and relies on `ClassifiedThread` dedupe to cooperate with the webhook. Rejected: watch renewal alone (fails on orphaned tokens) and the local-only `scripts/poller.mjs`. (PR #10, `9ce85a6`)
- **2026-06-22 — Alert loudly on Gmail watch-renewal failures via `lib/opsAlert.ts`** — A failed renewal means that user's inbox silently stops being labeled within 7 days. `renew-watches` now posts a per-failure ops alert and always mirrors to `console.error`. Rejected: log-only — the outage was invisible for days precisely because nothing surfaced it. (PR #10, `9ce85a6`)
- **2026-06-22 — "Sync inbox" reconciles labels instead of appending** — `applyGmailLabels` was add-only, so repeated forced re-syncs piled every label onto each thread. It gained a `removeLabelIds` arg; back-scan now applies the single best preset label and strips other preset-managed labels, reconciling the user-defined `Label` set the same way. Rejected: clearing all labels before re-applying (flicker + loses still-matching user labels). (PR #11, `d95699e`)
- **2026-06-22 — Repoint the Pub/Sub push endpoint + audience to the live domain, not patch around the 403** — The migration left the push subscription's endpoint URL and `PUBSUB_PUSH_AUDIENCE` on the dead `dharma-lake` domain, so the OIDC audience check rejected every push. Fixed at the source rather than loosening webhook auth. Rejected: disabling audience verification (would accept forged pushes).
- **2026-06-15 — Retire the Chrome extension entirely** — Deleted `apps/chrome-extension/` (`9793a9b`). Never published, so removing it breaks nothing in the wild; the Gmail add-on is now the sole in-Gmail surface. Shared endpoints (`/api/user/me`, `/api/user/extension-token`, `/api/emails/thread-draft`) kept — the add-on + web app depend on them. Rejected: maintaining two parallel Gmail surfaces.
- **2026-06-15 — Production moves to the `dharmaautomations.com` custom domain** — The Vercel project moved to the `kuba-ventures` team, killing the old `dharma-lake.vercel.app` auto-alias (now 404). Live production is `https://www.dharmaautomations.com`; apex 308-redirects to www. Rejected: continuing to rely on the Vercel auto-alias.
- **2026-06-15 — Repoint the Gmail add-on to the new domain (clasp v22)** — `DHARMA_API` had `dharma-lake.vercel.app` hardcoded, so "Polish draft" 404'd after the team move. Repointed to `www.dharmaautomations.com` (`1395fc2`), shipped as clasp deployment v22 (create-version + deploy -i, not just clasp push).
- **2026-05-29 (PM) — `buried_intent` is the first shipped signal kind; `cold_thread` and `pattern_shift` deferred** — Detector rewrite replaced `deal_flow`/`term_sheet`/`transaction` with `buried_intent`. `cold_thread` needs a cron sweep to fire; `pattern_shift` is blocked on a `ContactBaseline` table that doesn't exist. Both tracked as open loops.
- **2026-05-29 (PM) — Per-user signal toggle + `SIGNAL_DAILY_LIMIT` cap replace a single global ceiling** — `User.signalDetectionEnabled` lets users opt out; `SIGNAL_DAILY_LIMIT` (default 100/UTC-day/user) bounds spend. Rejected: a single global cap.
- **2026-05-29 (PM) — `Tier` type is now `string`, not a literal union** — `lib/tiers.ts` keeps `TIERS` as the single runtime source; `TierLadder` grids off `TIERS.length`. Rejected: keeping the literal union.
- **2026-05-29 (PM) — Dashboard is one scroll, not a grid** — Rejected a 2-column grid that mixed status with activity and buried the milestone strip on small screens.
- **2026-05-29 (PM) — `/api/metrics` `emailsTagged` is 7d-windowed** — Was all-time (a bug). Returns both `replyRate7d` and `replyRateAllTime`.
- **2026-05-29 (PM) — Time-saved constants live in one file** — `apps/web/lib/timeSaved.ts` is the source for `/api/metrics`, `/api/metrics/timeseries`, `/api/cron/awards`. Rejected: per-route inline constants (drift).
- **2026-05-29 (PM) — Ship a starter milestone library (9 entries), not the full 50** — Seeded 3h-250h thresholds via `scripts/seed-starter-milestones.mjs`. Rejected: blocking on full-library curation.
- **2026-05-29 (AM) — "Logical candy" redesign closed** — Shipped the 12-step plan plus admin Google Sheet, share-card OG, `UserMilestone` persistence, tier-up confetti, on-demand city milestones, jewel-tone badges, NPS prompt, Profile sidebar tab. Rejected: shipping behind a feature flag.
- **2026-05-29 — Milestones generated per-city on demand** — First user to set a city triggers Haiku to write 6 city milestones into `MilestoneDef`; cached for later users (~$0.001/city). Rejected: pre-seeding all US metros.
- **2026-05-29 — Jewel-tone palette + Basquiat-style Founder crown** — Hardcoded SVG fills; Founder badge gets yellow fill + heavy black outline. Rejected: `currentColor` theming.
- **2026-05-29 — Display-badge picker is a hover overlay on earned badges** — Rejected: a separate settings page.
- **2026-05-29 — Profile gets its own sidebar tab** — Moved off `/settings/profile` to `/profile`.
- **2026-05-26 — Auth.js JWT carryover fix** — `lib/adapter.ts` upserts Account by `(userId, provider)`; `signIn` callback rejects mismatched emails; login page `signOut()` before `signIn()`; `scripts/relink-google-account.mjs` recovery hatch.
- **2026-05-26 — IA: 5-tab sidebar + Profile** — Dashboard / Metrics / Configuration / Signals / Settings, plus Profile.
- **2026-05-26 — Admin sheet over a custom admin UI** — Waitlist + Subscribers + Users tabs, auto-headered/backfilled by cron. Rejected: a Next.js admin route.
- **2026-05-26 — Built-in preset labels are flat (no "Dharma/" prefix)** — Custom preset name optional; blank = flat top-level labels.
- **2026-05-20 — Sync Inbox force-reclassifies** — Re-runs the classifier on recent threads even if previously classified.
- **2026-05-19 — Custom preset over open-ended label CRUD.**
- **2026-05-19 — Classifier prompt: decisive single-label, temperature 0.**
- **2026-05-19 — Metrics moved to its own tab.**
- **2026-05-19 — Industry-preset labels added (VC / PE / Legal / General).**
- **2026-05-18 — Use Arial site-wide, scope Plus Jakarta Sans to landing page.**
- **2026-05-18 — Remove em-dashes from all user-facing copy and AI prompts.**
- **2026-04-30 — Submit Chrome extension to Chrome Web Store** — (later reversed: extension retired 2026-06-15).
- **2026-04 — Apple Calendar uses app-specific password, not OAuth.**
- **2026-04 — Anthropic API called directly via `fetch`, no SDK.**

---

## Open loops

- [ ] **BLOCKER (external) — CASA Tier 2 budget + assessor** — Abhinav approves ~$500-$3,000+/yr budget, confirms who pays, and signs an assessor SOW (from the App Defense Alliance list). Finley sources 2-3 quotes. Google's restricted-scope verification clock can't start until this is done. — Abhinav
- [ ] **Confirm the Google OAuth consent screen is "In production" (not Testing)** — Testing mode expires all refresh tokens every 7 days, which would re-break labeling weekly. Now Abhinav's surface (consent-screen owner). — Abhinav
- [ ] **Abhinav's legal sign-off on the Limited-Use privacy copy (#16)** — draft is written; can't un-draft + deploy without it. — Abhinav
- [ ] **Approve/edit the free-vs-paid feature split + price points** — unblocks the Stripe build (#7). — Abhinav
- [ ] **Record the demo video** — script is done (`docs/demo-video-script.md`); covers every scope + the client-ID-in-URL requirement, needed for Google verification. — Finley/Abhinav
- [ ] **Drop the unused add-on `gmail.compose` scope** — one fewer restricted scope for CASA (scope-audit finding #3). — Finley
- [ ] **Proposed onboarding upgrade (scoping only, NOT built):** capture name + role at onboarding, map role → label preset automatically, back-scan the inbox at onboarding so users land in an already-labeled inbox, and handle the Gmail add-on install. Requires a new `role` field on `User` (none exists today). Two known constraints: (1) a whole-inbox relabel isn't feasible synchronously — the back-scan now targets ~75 threads via an `after()` tail (`BACKSCAN_BACKFILL_TARGET=75`), with the first 25 synchronous on stateless Vercel functions (#44); (2) the Gmail add-on can't be auto-installed — it requires a user Marketplace install or an admin domain-wide install. — Finley
- [ ] Build Stripe billing on the `planForUser()` seam once pricing is approved (#7). — Finley
- [ ] Set `OPS_ALERT_WEBHOOK_URL` in prod so watch-renewal + poll-failure alerts page out instead of only landing in logs. — Finley
- [ ] Turn on `FACTORY_AUTOMERGE` after a supervised soak of the PR factory. — Finley
- [ ] Tighten the CSP from report-only to enforcing once violation reports are clean. — Finley
- [ ] Re-auth any users still carrying orphaned refresh tokens from the OAuth client change (`unauthorized_client` on watch renewal). — Finley
- [ ] Historical backfill past the ~75-thread back-scan target (optional — `BACKSCAN_BACKFILL_TARGET`, raised from 25 in #44). — Finley
- [ ] `cold_thread` detector (reserved; needs a cron sweep) and `pattern_shift` detector (blocked on a `ContactBaseline` table). — Finley
- [ ] Signal confirm/dismiss feedback endpoints (TODO in `lib/signalDetector.ts`). — Finley
- [ ] Full 50-entry milestone library (starter set of 9 shipped). — Finley
- [ ] Multi-account switching (deferred; Chrome profiles cover the gap). — Finley

### Recently closed
- [x] Back-scan labeling pipeline: force onboarding scan (#42), record `ClassifiedThread` only when a label lands (#43), backfill ~75 threads on onboarding + Sync inbox (#44) — fixes "all set but no labels" (2026-07-13)
- [x] TierLadder honors admin-sheet comped tier (2026-07-06, `5074a90`)
- [x] Security response headers + report-only CSP (2026-07-05, PR #24)
- [x] Limited-Use privacy section + accurate scope disclosures (2026-07-05, PR #16 — code merged; deploy still gated on legal sign-off)
- [x] Health check + poll-failure alert + self-serve deletion in support (2026-07-05, PR #21)
- [x] `googleapis` 144→173 bump clearing the uuid vuln (2026-07-05, PR #20)
- [x] Self-serve signup behind `SELF_SERVE_SIGNUP` flag, default off (2026-07-05, PR #17)
- [x] AI cost/abuse guardrails on all AI paths (2026-07-05, PR #15)
- [x] Self-serve data deletion, Settings → Advanced (2026-07-05, PR #14)
- [x] SEO canonicals/sitemap/robots to fix GSC "duplicate without canonical" (2026-07-05, PR #12)
- [x] Pin factory-review action to a known-good SHA (2026-07-05, PR #13)
- [x] Restore the broken auto-labeling pipeline + poll-cron fallback + label reconcile (2026-06-22, PRs #10/#11)
- [x] Retire the Chrome extension; migrate prod to `www.dharmaautomations.com`; add-on on v22 (2026-06-15)
- [x] Dashboard single-scroll re-layout, metrics accuracy, config polish, signal rewrite, gamification scale-ready (2026-05-29 PM)
- [x] "Logical candy" redesign, onboarding, Profile/milestones/badges, admin sheet, share-card OG (2026-05-29)
- [x] Auth.js JWT carryover bug (2026-05-26)

---

## Risks & known issues

- **Public launch is externally gated** — Google restricted-scope verification + CASA Tier 2 run ~1-2 months on Google's + an assessor's clock and can't start until Abhinav approves budget and picks an assessor. Everything app-side is ready; the bottleneck is a client decision.
- **OAuth consent screen production status unconfirmed** — if it's still in "Testing," Google expires every refresh token every 7 days and labeling re-breaks weekly. Now Abhinav's surface. The poll cron + renewal alerting blunt impact but don't fix root cause.
- **CSP is report-only, not enforcing** — it surfaces violations but blocks nothing yet; real XSS protection waits on tightening to an enforcing policy.
- **AI guardrails depend on `UsageEvent` writes + the `AI_*` envs being set in prod** — any AI path that forgets `logUsage` is invisible to the caps, and unset envs fall back to defaults. Confirm the guardrail envs before flipping `SELF_SERVE_SIGNUP`.
- **PR factory auto-merge is off, and should stay off until soaked** — `FACTORY_AUTOMERGE` unset. This is a paying client's product with Gmail/Calendar/OAuth access; the merge policy in `CLAUDE.md` escalates auth/onboarding/API/schema/tier/AI changes to a human.
- **Real-time labeling is single-point-of-failure on the Gmail watch** — a lapsed watch falls back to the `*/30` poll cron, which lags up to 30 min vs. seconds for a live push.
- **`cold_thread` / `pattern_shift` are unbuilt** — `buried_intent` is the only live signal kind.
- **`next-auth` is on a 5.0 beta** (`^5.0.0-beta.25`) — pin carefully on breaking releases.
- **Prisma version split** — web app on client/CLI `^5.22.0`; confirm `prisma generate` uses the runtime-expected version.
- **`scripts/poller.mjs` is local-only** — production labeling fallback is the `/api/gmail/poll` cron.

---

## Links

- **Live URL:** https://www.dharmaautomations.com (apex 308-redirects to www)
- **Old URL (dead):** https://dharma-lake.vercel.app — 404 since the Vercel team move to `kuba-ventures`
- **Gmail add-on:** live Google Workspace Marketplace listing (linked from onboarding step 5)
- **Staging:** not configured / not documented in repo
- **Go-public work log:** `docs/go-public-log.md`
- **Client decision doc:** `docs/abhinav-questions.md`
- **CASA checklist:** `docs/casa-verification-checklist.md`
- **Demo-video script:** `docs/demo-video-script.md`
- **AI guardrails spec:** `docs/ai-guardrails.md`
- **Data-deletion spec:** `docs/data-deletion.md`
- **Self-serve signup spec:** `docs/self-serve-signup.md`
- **Monitoring:** `docs/monitoring.md`
- **System diagram:** `docs/architecture/dharma_system_diagram.md`
- **Merge policy / PR factory:** `CLAUDE.md` + `.claude/agents/pr-reviewer.md`
- **DB schema:** `schema.prisma` (repo root)

---

## Changelog

- **2026-07-13:** Back-scan / labeling pipeline fixes, three PRs merged to `main` and live in prod. #42 — onboarding's "sort my inbox" now sends `force: true` so it labels the inbox instead of skipping already-`ClassifiedThread` rows (`PersonalizeForm.tsx`; test asserts `{ onboarding: true, force: true }`). #43 — root cause: new pure gate `lib/classifiedThreadGate.ts` (`shouldRecordClassifiedThread`, unit-tested) makes the webhook + poll paths record a `ClassifiedThread` only when a Gmail label actually landed, no longer stranding threads "classified but unlabeled" during a provisioning race. #44 — `scanCore` backfills ~75 inbox threads (`BACKSCAN_BACKFILL_TARGET`) via a synchronous first 25 + `after()` tail, now for both Sync inbox and onboarding; fixed a pagination skip bug (listed 2x messages but consumed only 25). All three returned ESCALATE from factory-review (touch `onboarding/**` + `api/**`) and were human-merged. #44 verified live on the `mrfinleyunderwood@gmail.com` test account (`scanned=8 tagged=8 skipped=0`; 8-thread inbox, so multi-page path not exercised on real data). Back-scan env knobs: `BACKSCAN_CONCURRENCY` (25, from #41), `BACKSCAN_MAX_THREADS` (25), `BACKSCAN_BACKFILL_TARGET` (75).
- **2026-07-06:** kuba-vault pass. Recorded the tier-comp fix (`5074a90`, branch `fix/tier-ladder-comp`): `TierLadder` now displays the higher of the time-earned tier and an admin comp from the Users-sheet Tier column via `lib/effectiveTier.ts` (~60s cache), labeling it "Complimentary tier" and dropping the progress bar when comped. Folded in the full go-public workstream that landed since the last update (see 2026-07-05 entries below), the 5-step onboarding wizard (connect → city → tone → labels → install) gated by `onboardingCompletedAt` with a live Marketplace add-on listing at step 5, the driver.js product tour, the new `Personal` label preset, and the supervised PR-factory merge policy. Re-scoped Status to "launch prep" with Abhinav Godavarthi as the client-side owner of the external verification blockers. Retired the stale "no automated tests" risk — 8 Vitest suites now exist. Added the proposed (not built) onboarding upgrade — name + role → auto preset + inbox back-scan — with its two constraints (back-scan capped at 25 threads / 45s; add-on can't auto-install).
- **2026-07-05:** Go-public engineering track landed on `main`. AI cost/abuse guardrails on every AI path (`lib/aiGuard.ts` + `lib/aiLimits.ts`, tier-aware free/paid caps, PR #15). Self-serve data deletion in Settings → Advanced + `/api/user/delete-account` + Support (PRs #14/#21). Self-serve signup behind a default-off `SELF_SERVE_SIGNUP` flag (PR #17). `/api/health` check + poll-failure alerting (PR #21). `googleapis` 144→173 bump clearing the transitive `uuid` high-sev vuln (PR #20). Security response headers + report-only CSP in `next.config.ts` (PR #24). Limited-Use privacy section + corrected scope disclosures (PR #16 — merged; deploy gated on Abhinav's legal sign-off). SEO canonicals/sitemap/robots (PR #12). Factory-review action pinned to a known-good SHA (PR #13). Decision docs added: `abhinav-questions.md` (CASA budget/assessor, free+paid split, pricing), `go-public-log.md`, `casa-verification-checklist.md`, `demo-video-script.md`. Owners recorded: Abhinav = budget/legal/consent-screen/domain; Finley = engineering.
- **2026-06-22:** Production incident — auto-labeling had silently stopped after the `dharma-lake` → `dharmaautomations.com` migration broke the pipeline three ways (dead Pub/Sub push endpoint/audience → 403; orphaned OAuth refresh tokens → `unauthorized_client`; lapsed Gmail watch hidden behind a stale `gmailWatchExpiry`). Fixed: repointed the Pub/Sub push endpoint + audience to the live domain, re-authed the affected account, backfilled 10 stuck threads. Hardening: PR #10 (`9ce85a6`) re-attached `/api/gmail/poll` as a `*/30` Vercel cron that survives a lapsed watch + added `lib/opsAlert.ts` renewal-failure alerts; PR #11 (`d95699e`) made "Sync inbox" reconcile labels instead of appending. `b966b53` scrubbed the last `dharma-lake` URLs.
- **2026-06-15:** Chrome extension retired (`9793a9b`); Vercel project moved to the `kuba-ventures` team, killing the old `dharma-lake.vercel.app` alias (production now `https://www.dharmaautomations.com`); Gmail add-on repointed off the dead alias (`1395fc2`) and shipped as clasp deployment v22.
- **2026-05-29 (late PM, 5-phase auto-loop):** Dashboard single-scroll re-layout + `/api/activity/recent`; metrics accuracy (7d `emailsTagged`, dual reply-rate) + `timeSaved.ts` consolidation; Configuration polish (2x2 tone grid, numeric scheduling, active-labels, `SignalDetectionCard`) + `signalDetectionEnabled`; signal rewrite to `buried_intent` + `SIGNAL_DAILY_LIMIT`; gamification scale-ready (`Tier = string`, dynamic `TierLadder`, 9-milestone starter seed).
- **2026-05-29 (PM, prior session):** AI Gateway centralization (`lib/anthropicEndpoint.ts`); per-thread reply rate by label; signal producers v1 (later superseded); sentence-case audit.
- **2026-05-29:** "Logical candy" redesign closed — 5-tab IA, purple design tokens + 10 UI primitives, 4-step onboarding, Profile + milestones + badges, Signals scaffold, admin Google Sheet, share-card OG, tier-up confetti, on-demand city milestones, NPS prompt.
- **2026-05-26:** Auth.js JWT-carryover bug fixed (`lib/adapter.ts`, `signIn` dual guard, `signOut`-then-`signIn`, relink script). Preset labels flattened, Custom preset name optional, `gmail.modify` scope restored.
- **2026-05-21:** Initial PROJECT.md superdoc generated by kuba-vault.
