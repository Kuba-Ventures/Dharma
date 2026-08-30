# Dharma
*AI-drafted Gmail replies and scheduling, wrapped in a labeled inbox.*

*Last updated: 2026-08-30 by Claude Code*

---

## TL;DR

Dharma is a Next.js web app plus a Gmail add-on that watches a user's Gmail, classifies threads into preset labels (VC / PE / Legal / General / Personal / Custom), and drafts replies in the user's tone, including calendar-aware scheduling replies over Google, Microsoft, and Apple free/busy. The product works end to end for the invite-only cohort. Since mid-July the work has been a **simplification plus reliability pass, not new surface area**. Gamification came out end to end (milestones, the tier ladder, the badge case, share cards); the IA collapsed from five tabs to three (Dashboard, Configuration, Profile & Settings) with Metrics folded into the Dashboard and Signals into Configuration. Two production bugs that silently killed auto-labeling a few hours after login were root-caused and fixed: Google rotates the refresh token, and the old code kept the original, so every Gmail call now routes through one `makeAuthForUser` helper that persists the rotation (#115/#117). Scheduling replies got a correctness run of eight PRs (#104 to #111): read all visible calendars, resolve relative dates against the email's sent date, bucket the busy window in Eastern, never propose a past time, deterministic addressee. The newest feature is **Smart Labeling** (#121/#123): Dharma learns sender to label associations from the user's own labeling and re-applies them, with domain-level learning gated behind a promotion threshold. **Onboarding v2** (connect, quiz, personalize, land in a labeled inbox) shipped back on 2026-07-08/09 behind a default-off `ONBOARDING_V2` flag, with each user pinned to v1 or v2 at entry. The public launch is still **blocked externally** on Google restricted-scope verification plus a CASA Tier 2 assessment, waiting on budget and assessor decisions from Abhinav Godavarthi.

---

## What it is

**The problem:** Busy operators (founders, VCs, PE associates, lawyers) spend hours triaging inbox and writing routine replies — especially scheduling back-and-forth.
**The solution:** Dharma classifies each new thread into a small set of meaningful Gmail labels, drafts reply text in the user's tone, and (for scheduling threads) pulls multi-calendar availability and writes a ready-to-send reply with concrete time slots.
**The user:** Solo operators and small teams in finance/legal whose inbox is their job — VC/PE first, Legal next.
**The value:** Reclaim ~30-60 min/day of triage and routine writing; never miss a scheduling thread because the calendar work is already done.

---

## Status

- **Phase:** launch prep. App-side go-public work is done; external Google verification / CASA is the gate. Engineering time since mid-July has gone to simplification, scheduling correctness, and auth reliability.
- **Engineering lead:** Finley
- **Client-side owner:** Abhinav Godavarthi (budget, legal sign-off, OAuth consent screen, domain, CASA assessor selection)
- **Cadence:** daily commits via a supervised PR factory; async decision doc (`docs/abhinav-questions.md`) is the client channel
- **Next milestone (external):** Abhinav approves the CASA budget and picks an assessor so the Google verification clock can start (~1-2 months, external)
- **Next milestone (engineering):** soak `ONBOARDING_V2`, flip it on for new entrants, then delete the v1 step routes
- **Flags:** on-track (engineering) / blocked (public launch, waiting on Abhinav + Google)

---

## Where we are right now

Three threads ran through August, all merged to `main` and live in prod.

**1. Auto-labeling was dying a few hours after login (#115, #117).** Google rotates the refresh token on some refreshes; the code persisted the access token but kept the original refresh token, so within an hour or so every call started returning `invalid_grant` and labeling stopped silently. #115 persisted the rotated token in the auth path; #117 found the rest of the leak by routing **every** Gmail call through a single `makeAuthForUser(userId)` helper (`lib/gmail.ts`), so no route can build its own client and skip the persistence. Covered by `gmail.tokenRefresh.test.ts` and `gmail.hotPathAuth.test.ts`.

**2. Scheduling replies got a correctness run (#104 to #111).** The symptom was replies proposing times the user was not actually free. Fixes, in order: read every visible calendar rather than just primary (#104), resolve relative dates ("next Tuesday") against the email's sent date rather than now (#105), bucket the busy-check day window in Eastern rather than UTC (#107), never propose a time earlier than the current moment (#108), write an explicit named decline and never invent a greeting name (#109), and make the addressee deterministic plus enforce a working-hours rule (#110). #106 added temporary busy-list logging to root-cause the 4pm miss; #111 removed it.

**3. Smart Labeling shipped (#121, issue #120; hardened by #123).** When a user manually labels a thread, Dharma records the sender to label association in a new `LearnedLabel` table and auto-applies it to future mail from that sender. Two granularities: exact address applies from the first sighting, whole domain only after it crosses `DOMAIN_PROMOTION_THRESHOLD` (2), so one stray label cannot tag an entire domain. Wired into both the webhook and the poll path. #123 then wrapped every Smart Labeling DB call so a failure there degrades to normal classification instead of breaking core labeling.

Alongside those: the product got noticeably smaller. Milestones, the tier progression UI, and the badge case were removed end to end (#52 to #55), Profile merged into "Profile & Settings" (#56), Metrics merged into the Dashboard (#101), and Signals became a Configuration tab (#57). Scheduling blocks became self-maintaining (auto-clear on expiry, stay in the bookable-week grid, real resync). CASA pre-work continued: #118 corrected a wrong scope-audit finding (the add-on's `gmail.compose` is **required**, not droppable) and #119 cleared the npm audit ahead of the DAST scan (14 vulns to 6, remaining are dev-only). The launch itself remains externally blocked on Google restricted-scope verification plus CASA Tier 2.

---

## What's built

**Frontend / UI (apps/web)**
- Landing page at `/` (Plus Jakarta Sans headings; Arial elsewhere), embeds the waitlist form
- Login page (`/login`), Google OAuth, optional `login_hint` via `?hint=`, calls `signOut()` before `signIn()` to dodge JWT carryover; post-login redirect defaults to `/dashboard` rather than the marketing home (#87)
- **Onboarding runs two pinned flows.** v1 (5 steps): connect, city, tone, labels, install. v2 (4 steps): connect, quiz (name / role / city), personalize (tone + labels + sync gate), land in an already-labeled inbox. `User.onboardingFlow` is pinned at entry and **both** layouts route by that pin, never by the ambient env flag, so an in-flight user always finishes the flow they started (`lib/onboardingFlow.ts`). `ONBOARDING_V2` (default off) decides only what new entrants get pinned to. `/api/onboarding/restart` re-runs the wizard without clearing settings (#51).
- **3-tab app shell** under `app/(app)/`: `/dashboard`, `/configuration`, `/settings` ("Profile & Settings"). `/metrics` is a permanent redirect into the Dashboard (#101); `/profile` merged into Settings (#56); Signals lost its tab and became a Configuration panel (#57).
- **Dashboard:** greeting + Sync inbox button, a "Running for you" row (compact cards, eyebrow-label headers, Labels bars carrying names and counts, filled empty states), a merged two-tier metrics strip with cost metrics dropped (#101/#103), the time-saved chart, and Recent activity that groups runs of same-label classifications and draft events (#102/#76). A dead calendar grant surfaces a reconnect prompt instead of a misleading "0 meetings", and hidden events read as "Busy" (#91/#95); scheduling blocks are not counted as meetings (#90).
- **Configuration:** one unified panel with segmented tabs (#68). Tone (two-column layout, richer summary, sample preview obeys the selected mode, Concise is blunter), Labels (rendered as inbox-style Gmail tags; custom colors fall back to `colorKey` rather than gray), Scheduling (vertical week-availability grid with a day-label header row, collapsible block editor, Weekdays / Every day / Weekends recurrence presets, debounced saves with a Saving / Saved indicator), Signals (one vivid example up front plus the per-user detection toggle).
- **Product tour** (`app/components/dashboard/ProductTour.tsx`, driver.js), anchored to `data-tour` elements, gated by `tourCompletedAt` / `toursSeen`; steps whose anchor is missing are skipped
- **Add-on install nudge** (`InstallNudge.tsx` + `lib/addonInstall.ts`), driven by `User.addonInstalledAt`, which is stamped on the first `GoogleBearer`-authenticated add-on call
- 10 shared UI primitives under `app/components/ui/`; purple-forward design tokens; FeedbackButton + ConfirmModal
- **Gamification is gone from the product** (#52 to #55): milestones deleted end to end, the tier ladder and progress bars removed, the badge case dropped from Profile, share cards retired. `User.tier` survives only as an internal entitlement input to the AI guard; Founder is hardcoded for owners.

**Backend / API (apps/web/app/api)**
- `auth/[...nextauth]`, Google OAuth via NextAuth v5; PrismaAdapter wrapped in `lib/adapter.ts` for idempotent Account linking. **Rotated Google refresh tokens are persisted** (#115), so a session no longer dies with `invalid_grant` an hour after login.
- **One Gmail auth path:** every Gmail-touching route goes through `makeAuthForUser(userId)` in `lib/gmail.ts` (#117). Routes cannot construct their own client, which is what let the rotation bug leak back in.
- **AI cost/abuse guardrails (`lib/aiGuard.ts` + `lib/aiLimits.ts`, #15):** every AI route plus `classify` / `signalDetector` runs through a guard with per-minute, per-day, and per-day-cost caps. Tier-aware: `free` (about 8/min, 60/day, $0.75/day) vs `paid` (30/min, 600/day, $8/day), env-tunable (`AI_FREE_*` / `AI_PAID_*`); `planForUser()` reads an `AI_PAID_USER_IDS` allowlist. Enforcement rides on `UsageEvent` writes.
- **Smart Labeling (`lib/smartLabels.ts`, #121/#123):** learns sender to label associations from the user's own labeling into `LearnedLabel` and re-applies them on the webhook and poll paths. Exact-address matches apply from the first sighting; domain matches only after `DOMAIN_PROMOTION_THRESHOLD` (2). Every DB call is wrapped so a Smart Labeling failure cannot break core labeling.
- `gmail/webhook`, real-time Pub/Sub push receiver (OIDC-verified against `PUBSUB_PUSH_AUDIENCE`; primary labeling path when a watch is live). Records a `ClassifiedThread` row only when a Gmail label actually landed via `lib/classifiedThreadGate.ts` (#43).
- `gmail/poll`, Vercel cron (`*/30 * * * *`) safety-net sweep; calls `history.list` per user, does **not** depend on a live Gmail watch, idempotent via `ClassifiedThread` dedupe plus a `gmailHistoryId` advance. Same record-only-when-labeled rule (#43).
- `cron/renew-watches` (`0 7 * * *`), renews Gmail watches expiring within 48h; emits an ops alert via `lib/opsAlert.ts` on failure. `cron/awards` (`0 8 * * *`) still runs the nightly sweep.
- `labels/back-scan`, powers "Sync inbox" and onboarding's inbox landing (both forced, #42). `scanCore` paginates up to `BACKSCAN_BACKFILL_TARGET` (75): first 25 synchronous, the rest in an `after()` tail, for both entry points (#44). Lists a page at `BACKSCAN_MAX_THREADS` (25), fans out at `BACKSCAN_CONCURRENCY` (25), and reconciles labels (applies the single best preset label, strips other preset-managed labels) instead of appending.
- `labels/*`, CRUD plus `preset`, `provision`, `setup-gmail`, `scan-inbox`, `back-scan`, `seed-rules`, `status`, `uncategorized`, and per-label rules
- `suggest-times`, Sonnet streaming scheduling reply over multi-calendar free/busy, now bounded by working hours, the sender's actual free/busy across all visible calendars, and a never-in-the-past rule (#104 to #110)
- `calendar/{google,microsoft,apple,rsvp}`, connect/disconnect plus Google `schedule` (events with Meet links), `calendar/google/sync` (re-mirrors scheduling blocks, #93), and bounded Google calls so "Add to calendar" cannot hang (#47)
- `preferences/{tone,scheduling,meeting-hours,signal-detection}`, `user/{me,preferences,extension-token,nps-postpone,dismiss,dismiss/restore,tour-complete,delete-account}`, `profile/update`
- `metrics` (7d-windowed `emailsTagged`, dual `replyRate7d` / `replyRateAllTime`), `metrics/timeseries`, `metrics/by-label`, `activity/recent`, `emails/recent`
- `signals`, `signals/[id]/read`, `buried_intent` via the rewritten detector
- `user/delete-account` (#14), self-serve account and data deletion (`lib/accountDeletion.ts`); `health` (#21); `feedback`, `waitlist/join`, `geo/cities`, `badges/[userId]`
- SEO: `robots.ts`, `sitemap.ts`, canonical URLs on legal / support pages

**Gmail add-on (apps/gmail-addon)**, the only in-Gmail surface
- Apps Script `Code.gs` deployed via `clasp`; `DHARMA_API` points at `https://www.dharmaautomations.com`
- **Adaptive show-both compose card** (#116): offers draft and rewrite together rather than guessing which the user wants
- Live Google Workspace Marketplace listing; first add-on call stamps `User.addonInstalledAt`
- **Scope correction (#118):** the add-on's `gmail.compose` is **required**, not a drop candidate. It creates drafts via `Gmail.Users.Drafts.create` and replaces a draft body via `PUT .../drafts/{id}`, neither of which `gmail.addons.current.action.compose` covers. The earlier "drop it for CASA" action is cancelled.

**Shared packages**
- `@dharma/types`, `@dharma/calendar-core`, `@dharma/providers-google` / `-outlook` / `-apple`, `@dharma/reply-generation` (which now strips em dashes from every drafted reply, #61)

**Tests & CI**
- 36 Vitest suites (up from 8 in July), covering the auth hot path (`gmail.hotPathAuth`, `gmail.tokenRefresh`), scheduling (`schedulingWindow`, `dayAvailability`, `expiredBlocks`, `blockMirror`, `dharmaBlock`, `calendarFanout`, `calendarTimeout`, `eventTitle`, `recipientName`, `visibleCalendarIds`), labeling (`smartLabels`, `classifiedThreadGate`, `labelPresets`, `labelTextColor`), onboarding (`onboardingFlow`, `rolePresets`, `geoGuess`, `QuizForm`, `PersonalizeForm`, `InboxLanding`), and the pure helpers
- **Supervised PR factory:** PRs are auto-reviewed by `.claude/agents/pr-reviewer.md` against the merge policy in `CLAUDE.md` (`.github/workflows/factory.yml`). Auto-merge stays disabled (`FACTORY_AUTOMERGE` unset) pending a supervised soak; auth, onboarding, API routes, schema, tiers, and AI behavior are always escalate-to-human.

**Database (Neon Postgres via Prisma, `schema.prisma` at repo root)**
- User: identity, location, tone, scheduling, plus `onboardingStep` / `onboardingCompletedAt` / **`onboardingFlow`** (`'v1' | 'v2'` pin) / **`role`** (onboarding role key, see `lib/rolePresets.ts`) / **`addonInstalledAt`** / `tourCompletedAt` / `toursSeen` / `dismissedTiles`, and the residual progression fields (`tier`, `lastSeenTier`, `displayBadgeId`, `cumulativeSecondsSaved`, `nextNpsPromptAt`, `signalDetectionEnabled`)
- GoogleCredential, MicrosoftCredential, AppleCredential (AES-256-GCM encrypted)
- Label, LabelRule, LabelPreset, LabelMapping, ClassifiedThread (`labelName` + `draftCreated`), **LearnedLabel** (`senderKey`, `matchType`, `labelName`, `sampleCount`)
- NextAuth Account / Session / VerificationToken; UsageEvent; MeetingHour, BadgeDef, UserBadge, Signal, Feedback
- **Gone:** `MilestoneDef` and `UserMilestone` (removed with the milestones feature, #52)

**Infrastructure**
- Vercel hosting (`kuba-ventures` team) at `https://www.dharmaautomations.com`; old `dharma-lake.vercel.app` alias dead (404)
- Three Vercel crons (UTC): `/api/cron/awards` (`0 8 * * *`), `/api/cron/renew-watches` (`0 7 * * *`), `/api/gmail/poll` (`*/30 * * * *`)
- Neon Postgres; Google Cloud Pub/Sub (push to `/api/gmail/webhook`, audience on the live domain); admin Google Sheet via service account
- Security response headers on every route (`next.config.ts`): X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and a **report-only** CSP (GTM/GA4/Vercel analytics need inline/eval; enforcing CSP deferred until reports are clean)
- Analytics: GTM-fronted GA4 (the GTM container fires GA4, not code)

---

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Monorepo | npm workspaces | `apps/*` + `packages/*`, Node >=20 |
| Frontend | Next.js 16.2.12 (App Router) + React 18.3 + Tailwind 3.4 | `apps/web`; patched to 16.2.12 in #119 for the Next DoS advisories |
| Onboarding tour | driver.js 1.4 | `app/components/dashboard/ProductTour.tsx` |
| Auth | NextAuth v5 beta (`^5.0.0-beta.25`, locked at beta.32) + wrapped Prisma adapter | `lib/adapter.ts`; rotated refresh tokens persisted (#115/#117) |
| Database | PostgreSQL (Neon) via Prisma 5.22 client | `schema.prisma` at repo root; no versioned migrations (`db push`) |
| AI, classify / polish / signal | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | `lib/classify.ts`, `signalDetector.ts` |
| AI, reply generation / scheduling / tone | Claude Sonnet (`claude-sonnet-4-20250514`, streaming) | `packages/reply-generation`, `/api/suggest-times` |
| AI cost/abuse guard | `lib/aiGuard.ts` + `lib/aiLimits.ts` | tier-aware per-min/day/cost caps on every AI route |
| AI routing | Vercel AI Gateway (optional, via `AI_GATEWAY_API_KEY`) | `lib/anthropicEndpoint.ts` toggles Gateway vs direct Anthropic |
| Gmail | `googleapis` v173 (Gmail API v1) | `gmail.modify` scope; all calls via `makeAuthForUser` |
| Calendar | Google Calendar + Microsoft Graph + Apple CalDAV (`tsdav` 2.0) | Free/busy + Meet links; all visible calendars, not just primary |
| Hosting | Vercel (`kuba-ventures` team) | `vercel.json` runs `prisma generate && next build`; 3 UTC crons |
| Badges | Static SVG assets in `public/badges`, served as JSON | `app/api/badges/[userId]`; no user-facing badge UI since #55 |
| Gmail add-on | Apps Script via `clasp` | `apps/gmail-addon/Code.gs`; adaptive compose card (#116) |
| Tests | Vitest + Testing Library + happy-dom | 36 suites |

---

## Integrations & MCPs

| Integration | Purpose | Cost | Status |
|---|---|---|---|
| Vercel (hosting + functions + cron) | Hosts the app, API routes, and the three crons (share-card OG retired with milestones, #52/#119) | unknown (Hobby/Pro) | live (`www.dharmaautomations.com`, `kuba-ventures` team) |
| Neon (Postgres) | Primary database | unknown | live |
| Anthropic API (direct, optionally via AI Gateway) | Haiku 4.5 (classify/polish/signal) + Sonnet (reply/scheduling/tone) | usage-based; tracked in `UsageEvent`; capped by `aiLimits` per-user tier | live |
| Google OAuth | User login | free | live (consent-screen production status: confirm — see risks) |
| Gmail API | Read inbox, apply labels, create drafts, register Watch | free (quota-limited) | live |
| Google Calendar API | Free/busy, create/update/delete events with Meet | free (quota-limited) | live |
| Google Cloud Pub/Sub | Real-time Gmail push (push → `/api/gmail/webhook`, OIDC-verified) | usage-based, unknown | live (`/api/gmail/poll` cron is the fallback) |
| Google Workspace Marketplace | Distribution for the Gmail add-on | unknown | **live listing** (linked from onboarding; first add-on call stamps `addonInstalledAt`) |
| Google Sheets (service account) | Admin sheet: Waitlist / Subscribers / Users (tier comp, now internal-only) | free (quota-limited) | live |
| Microsoft Graph | Outlook calendar free/busy | free (quota-limited) | live |
| Apple iCloud CalDAV | iCloud calendar free/busy | free | live |
| Google Analytics 4 (via GTM) | Web analytics | free | live (GTM container fronts GA4) |
| Slack-compatible ops webhook | Watch-renewal + poll-failure alerts via `OPS_ALERT_WEBHOOK_URL` (`lib/opsAlert.ts`) | free | planned (mirror to `console.error` until env set) |
| Stripe | Paid-tier billing | usage/% | planned (blocked on free-vs-paid split decision) |
| CASA Tier 2 assessor (TBD vendor) | Google restricted-scope security assessment | ~$500-$3,000+/yr | planned (blocked on Abhinav budget + assessor pick) |

*Source: no MCP config files found in repo; this table is generated from `.env` references, `lib/adminSheet.ts`, `lib/aiLimits.ts`, `next.config.ts`, `docs/go-public-log.md`, and `docs/abhinav-questions.md`.*

---

## Decisions log

- **2026-08-08/09 - CLAUDE.md carries a shared standard block** - Response style, the three-option rule for any visual change, git workflow, and a hard no-em-dash rule live between `<!-- BEGIN STANDARD -->` markers so the block can be synced across repos without hand-merging. (PRs #124/#125)
- **2026-08-03 - Smart Labeling learns from the user, with domain matches gated** - A manual label is a training signal: `LearnedLabel` stores sender to label associations and the webhook plus poll paths re-apply them. Exact-address matches apply from the first sighting; domain matches wait for `DOMAIN_PROMOTION_THRESHOLD` (2) so one stray label cannot tag a whole domain. Rejected: learning at domain granularity immediately (too easy to poison from one mislabel). (PR #121, issue #120)
- **2026-08-04 - Smart Labeling failures degrade, they do not break labeling** - Every Smart Labeling DB call is wrapped so a schema or connection error falls back to normal classification instead of taking down the core path a paying user depends on. (PR #123)
- **2026-08-03 - The add-on's `gmail.compose` is required, not a CASA drop candidate** - The earlier scope audit claimed no `drafts.create` / `.send` existed. It was wrong: the add-on creates drafts via `Gmail.Users.Drafts.create` and replaces a draft body via `PUT .../drafts/{id}`, neither covered by `gmail.addons.current.action.compose`. Dropping the scope would break drafting in production, so the removal action is cancelled. (PR #118)
- **2026-08-03 - Clear the npm audit at the source before the CASA DAST scan** - Removed the orphaned `@vercel/og` (nothing imported it; the route it was credited with does not exist), added root overrides for `postcss` and `sharp`, bumped Next to 16.2.12 and the auth cluster to next-auth beta.32. 14 vulns to 6, and the 6 are dev-only test tooling. (PR #119)
- **2026-07-31 / 08-03 - One Gmail auth helper, and persist the rotated refresh token** - Google rotates the refresh token on some refreshes; the code kept the original, so auth died an hour or a few hours after login and auto-labeling stopped silently. #115 persisted the rotation; #117 routed every Gmail call through `makeAuthForUser(userId)` so no route can build its own client and skip persistence. Rejected: patching each call site (that is how the bug survived the first fix). (PRs #115/#117)
- **2026-07-31 - Scheduling proposals are computed against reality, not improvised** - Eight PRs: read every visible calendar rather than primary (#104), resolve relative dates against the email's sent date (#105), bucket the busy-check day window in Eastern rather than UTC (#107), never propose a time earlier than now (#108), write an explicit named decline and never invent a greeting name (#109), deterministic addressee plus a working-hours rule (#110). Temporary busy-list logging (#106) added to root-cause the 4pm miss, removed in #111.
- **2026-07-30 - Metrics merges into the Dashboard; cost metrics are not a user surface** - The standalone Metrics tab split attention for no benefit, so the two-tier metrics strip and the time-saved chart moved onto the Dashboard and `/metrics` became a permanent redirect. Per-user AI cost was dropped from the strip: it is an operator number, not something a user should have to read. (PRs #101/#103)
- **2026-07-28 - Scheduling blocks expire themselves** - An expired one-off block clears from the card and from the calendar, but stays in the bookable-week grid so the week does not visually reshuffle; "Resync calendar" actually re-mirrors rather than no-opping. A dead calendar grant now surfaces a reconnect prompt instead of rendering a truthful-looking "0 meetings". (PRs #89, #93, #94/#97, #91/#95)
- **2026-07-27/28 - Configuration is one panel with segmented tabs, and Signals lives inside it** - Tone / Labels / Scheduling / Signals as segmented tabs in a unified panel, rather than four cards and a separate sidebar tab for a feature with one live detector. Labels render as inbox-style Gmail tags so the config screen looks like the inbox it controls. (PRs #57 to #72)
- **2026-07-27 - Strip em dashes from every drafted reply** - The house style bans em dashes, and a drafted reply goes out under the user's name, so `lib/stripEmDashes.ts` enforces it at generation time rather than in the prompt alone. (PR #61)
- **2026-07-27 - Remove gamification end to end** - Milestones, the tier ladder, and the badge case were built for engagement that never materialized and were carrying schema, cron, and UI weight (plus an `@vercel/og` share-card dependency with its own CVE chain). Deleted: milestones (#52), tier progression UI (#53/#54), badges in Profile with Founder hardcoded for owners (#55), and Profile merged into "Profile & Settings" with home city dropped (#56). `tier` survives only as an internal entitlement input to `aiGuard`. Rejected: keeping the UI behind a flag. (PRs #52 to #56)
- **2026-07-14/16 - Block saves are debounced, bounded, and legible** - Rapid block edits raced and produced out-of-order writes (#46); an unbounded Google Calendar call could hang "Add to calendar" indefinitely (#47); a meeting-hours save loop produced runaway PUT storms (#48). Fixed with debounce plus response-ordering guards, a call timeout, and a Saving / Saved indicator so the user can see the write land (#50).
- **2026-07-08/09 - Onboarding v2 ships behind a flow pinned per user, not an ambient flag** - `User.onboardingFlow` is stamped at onboarding entry and both layouts route by that stamp, so flipping `ONBOARDING_V2` mid-flight never resumes an in-flight user on the wrong step: whatever flow you start, you finish. v2 re-sequences the wizard to connect, quiz (name / role / city), personalize (tone + labels), land in an already-labeled inbox. Added `User.role` (mapped to a label preset by `lib/rolePresets.ts`) and `User.addonInstalledAt` (stamped on the first add-on call, drives the install nudge). Rejected: routing by the env flag (breaks in-flight users), and auto-installing the add-on (Google requires a user or admin Marketplace install). (PRs #30 to #38, #40)
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

- [ ] **BLOCKER (external), CASA Tier 2 budget + assessor** - Abhinav approves the ~$500-$3,000+/yr budget, confirms who pays, and signs an assessor SOW (from the App Defense Alliance list). Finley sources 2-3 quotes. Google's restricted-scope verification clock cannot start until this is done. (Abhinav)
- [ ] **Confirm the Google OAuth consent screen is "In production" (not Testing)** - Testing mode expires all refresh tokens every 7 days, which would re-break labeling weekly on top of the rotation bug just fixed. (Abhinav)
- [ ] **Abhinav's legal sign-off on the Limited-Use privacy copy (#16)** - the draft is written; it cannot be un-drafted and deployed without sign-off. (Abhinav)
- [ ] **Approve/edit the free-vs-paid feature split + price points** - unblocks the Stripe build (#7). (Abhinav)
- [ ] **Record the demo video** - script is done (`docs/demo-video-script.md`); covers every scope plus the client-ID-in-URL requirement, needed for Google verification. (Finley/Abhinav)
- [ ] **Soak `ONBOARDING_V2`, flip it on, then delete the v1 step routes** - v1 and v2 both live in the tree today; the flag only decides what new entrants get pinned to. (Finley)
- [ ] **Re-triage the remaining npm audit findings before the CASA DAST scan** - 6 left after #119, all dev-only test tooling; confirm the scan agrees. (Finley)
- [ ] Build Stripe billing on the `planForUser()` seam once pricing is approved (#7). (Finley)
- [ ] Set `OPS_ALERT_WEBHOOK_URL` in prod so watch-renewal and poll-failure alerts page out instead of only landing in logs. (Finley)
- [ ] Turn on `FACTORY_AUTOMERGE` after a supervised soak of the PR factory. (Finley)
- [ ] Tighten the CSP from report-only to enforcing once violation reports are clean. (Finley)
- [ ] Re-auth any users still carrying orphaned refresh tokens from the OAuth client change (`unauthorized_client` on watch renewal). (Finley)
- [ ] Historical backfill past the ~75-thread back-scan target (optional, `BACKSCAN_BACKFILL_TARGET`). (Finley)
- [ ] Surface Smart Labeling to the user: there is no UI today for reviewing, correcting, or forgetting a learned association. (Finley)
- [ ] `cold_thread` detector (needs a cron sweep) and `pattern_shift` detector (blocked on a `ContactBaseline` table). (Finley)
- [ ] Signal confirm/dismiss feedback endpoints (TODO in `lib/signalDetector.ts`). (Finley)
- [ ] Multi-account switching (deferred; Chrome profiles cover the gap). (Finley)

### Recently closed
- [x] CLAUDE.md shared standard block + no-em-dash rule (2026-08-08/09, #124/#125)
- [x] Smart Labeling: learn and re-apply sender to label associations, with failures isolated from core labeling (2026-08-03/04, #121/#123)
- [x] CASA pre-work: corrected add-on scope audit (`gmail.compose` is required), npm audit 14 vulns to 6 (2026-08-03, #118/#119)
- [x] Auto-labeling dying hours after login: persist rotated Google refresh tokens, route all Gmail calls through `makeAuthForUser` (2026-07-31 / 08-03, #115/#117)
- [x] Adaptive show-both add-on compose card (2026-07-31, #116)
- [x] Scheduling reply correctness run: visible calendars, relative dates, Eastern bucketing, no past times, named decline, deterministic addressee (2026-07-31, #104 to #111)
- [x] Metrics merged into the Dashboard, activity runs grouped, cost metrics dropped (2026-07-30, #101 to #103)
- [x] Scheduling blocks self-maintain: auto-clear on expiry, stay in the bookable-week grid, real resync, dead-grant reconnect prompt (2026-07-28, #89 to #97)
- [x] Configuration unified into one panel with segmented tabs; Signals folded in (2026-07-27/28, #57 to #72)
- [x] Em dashes banned in every drafted reply (2026-07-27, #61)
- [x] Gamification removed end to end: milestones, tier UI, badge case; Profile merged into Settings (2026-07-27, #52 to #56)
- [x] "Restart onboarding" without clearing settings (2026-07-27, #51)
- [x] Scheduling block saves debounced and bounded; meeting-hours PUT storm fixed (2026-07-14/16, #46 to #50)
- [x] Onboarding v2 (connect, quiz, personalize, land-in-inbox) behind a pinned flow flag, plus `role` / `addonInstalledAt` / `onboardingFlow` schema fields (2026-07-08/09, #30 to #38, #40)
- [x] Back-scan labeling pipeline: force onboarding scan (#42), record `ClassifiedThread` only when a label lands (#43), backfill ~75 threads (#44) (2026-07-13)
- [x] Security response headers + report-only CSP (2026-07-05, PR #24)
- [x] Limited-Use privacy section + accurate scope disclosures (2026-07-05, PR #16, code merged; deploy still gated on legal sign-off)
- [x] Health check + poll-failure alert + self-serve deletion in support (2026-07-05, PR #21)
- [x] Self-serve signup behind `SELF_SERVE_SIGNUP` flag, default off (2026-07-05, PR #17)
- [x] AI cost/abuse guardrails on all AI paths (2026-07-05, PR #15)
- [x] Self-serve data deletion, Settings, Advanced (2026-07-05, PR #14)
- [x] Restore the broken auto-labeling pipeline + poll-cron fallback + label reconcile (2026-06-22, PRs #10/#11)
- [x] Retire the Chrome extension; migrate prod to `www.dharmaautomations.com`; add-on on v22 (2026-06-15)
- [x] Auth.js JWT carryover bug (2026-05-26)

---

## Risks & known issues

- **Public launch is externally gated** - Google restricted-scope verification plus CASA Tier 2 run about 1-2 months on Google's and an assessor's clock, and cannot start until Abhinav approves budget and picks an assessor. Everything app-side is ready; the bottleneck is a client decision.
- **OAuth consent screen production status unconfirmed** - if it is still in "Testing", Google expires every refresh token every 7 days and labeling re-breaks weekly. The poll cron and renewal alerting blunt the impact but do not fix the root cause.
- **Refresh-token rotation is fixed by convention, not by the type system** - the bug came back once because a route built its own Gmail client. Any new Gmail call path that bypasses `makeAuthForUser` reintroduces it; `gmail.hotPathAuth.test.ts` is the guard.
- **Smart Labeling can be confidently wrong** - a domain association promoted at two sightings will label every future thread from that domain, and there is no user-facing way to review or forget a learned association yet. #123 isolates DB failures, not bad learning.
- **Two onboarding flows live in the tree** - v1 and v2 both ship; correctness depends on the `onboardingFlow` pin being read in both layouts. Delete v1 once `ONBOARDING_V2` is soaked.
- **CSP is report-only, not enforcing** - it surfaces violations but blocks nothing; real XSS protection waits on tightening.
- **AI guardrails depend on `UsageEvent` writes plus the `AI_*` envs being set in prod** - any AI path that forgets `logUsage` is invisible to the caps. Confirm the guardrail envs before flipping `SELF_SERVE_SIGNUP`.
- **PR factory auto-merge is off, and should stay off until soaked** - `FACTORY_AUTOMERGE` unset. This is a paying client's product with Gmail/Calendar/OAuth access; the merge policy in `CLAUDE.md` escalates auth, onboarding, API, schema, tier, and AI changes to a human.
- **Real-time labeling is single-point-of-failure on the Gmail watch** - a lapsed watch falls back to the `*/30` poll cron, which lags up to 30 minutes vs seconds for a live push.
- **`cold_thread` / `pattern_shift` are unbuilt** - `buried_intent` is the only live signal kind, and Signals is still presented with static examples.
- **`next-auth` is on a 5.0 beta** (`^5.0.0-beta.25`, resolved to beta.32) - pin carefully on breaking releases.
- **No versioned Prisma migrations** - schema changes go out via `db push`, so there is no migration artifact to roll back to; capture the `prisma migrate diff` SQL in the PR instead.

---

## Links

- **Live URL:** https://www.dharmaautomations.com (apex 308-redirects to www)
- **Old URL (dead):** https://dharma-lake.vercel.app, 404 since the Vercel team move to `kuba-ventures`
- **Gmail add-on:** live Google Workspace Marketplace listing (linked from onboarding)
- **Staging:** not configured / not documented in repo
- **Go-public work log:** `docs/go-public-log.md`
- **Client decision doc:** `docs/abhinav-questions.md`
- **CASA checklist:** `docs/casa-verification-checklist.md`
- **Onboarding v2 build plan:** `docs/onboarding-v2-build-plan.md`
- **Demo-video script:** `docs/demo-video-script.md`
- **AI guardrails spec:** `docs/ai-guardrails.md`
- **Data-deletion spec:** `docs/data-deletion.md`
- **Self-serve signup spec:** `docs/self-serve-signup.md`
- **Monitoring:** `docs/monitoring.md`
- **System diagram:** `docs/architecture/dharma_system_diagram.md`
- **Merge policy / PR factory:** `CLAUDE.md` + `.claude/agents/pr-reviewer.md` + `.github/workflows/factory.yml`
- **DB schema:** `schema.prisma` (repo root)

---

## Changelog

- **2026-08-30:** Full-repo refresh of this doc after seven weeks of unrecorded work (PRs #46 to #125, plus onboarding v2 in #30 to #40, which the 2026-07-13 pass missed). Three August threads: (1) auto-labeling was dying a few hours after login because Google rotates the refresh token and the code kept the original, fixed by persisting the rotation (#115) and routing every Gmail call through one `makeAuthForUser` helper (#117), with `gmail.tokenRefresh` / `gmail.hotPathAuth` tests as the guard; (2) a scheduling correctness run (#104 to #111): all visible calendars, relative dates resolved against the email's sent date, Eastern day bucketing, never propose a past time, explicit named decline, deterministic addressee; (3) Smart Labeling (#121, issue #120), a new `LearnedLabel` model that learns sender to label associations, exact-address from the first sighting and domain only past a promotion threshold of 2, with every DB call wrapped so a failure cannot break core labeling (#123). Product got smaller: gamification removed end to end (#52 to #55), Profile merged into "Profile & Settings" (#56), Metrics merged into the Dashboard (#101 to #103), Signals folded into a unified Configuration panel with segmented tabs (#57 to #72). Scheduling blocks now self-expire, stay in the bookable-week grid, and resync for real (#89 to #97); dead calendar grants surface a reconnect prompt instead of a fake "0 meetings" (#91/#95). Add-on gained an adaptive show-both compose card (#116). CASA pre-work: the add-on's `gmail.compose` is required, not droppable (#118), and npm audit went 14 to 6, all remaining dev-only (#119). Em dashes are stripped from every drafted reply (#61) and the no-em-dash rule joined a shared `CLAUDE.md` standard block (#124/#125). Doc corrections: IA is 3 tabs not 5, `User.role` / `onboardingFlow` / `addonInstalledAt` now exist, `MilestoneDef` / `UserMilestone` and the `share/milestone` Edge OG route are gone, test suites 8 to 36, `scripts/poller.mjs` no longer exists.
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
