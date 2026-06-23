# Dharma
*AI-drafted Gmail replies and scheduling, wrapped in a labeled inbox.*

*Last updated: 2026-06-22 by kuba-vault*

---

## TL;DR

Dharma is a Next.js web app + Gmail add-on stack that watches a user's Gmail, classifies threads into preset labels (VC, PE, Legal, General, Custom), and helps draft replies — including calendar-aware scheduling replies that read free/busy from Google, Microsoft, and Apple. Tonight (2026-06-22) was a production incident: auto-labeling had silently stopped because the earlier `dharma-lake` → `dharmaautomations.com` prod migration broke the Gmail labeling pipeline in three ways (dead Pub/Sub push endpoint + audience, orphaned OAuth refresh tokens, and a lapsed Gmail watch hiding behind a stale DB expiry). It's fixed: the Pub/Sub push endpoint/audience were repointed to the live domain, the affected account was re-authed, and two PRs landed to harden against recurrence — a `/api/gmail/poll` cron fallback that doesn't depend on a live watch (PR #10) and a label-reconcile fix so "Sync inbox" replaces rather than accumulates labels (PR #11). Phase is post-MVP iteration. One HIGH-priority follow-up remains: confirm the Google OAuth consent screen is "In production" (Testing mode expires all refresh tokens every 7 days and would re-break labeling weekly).

---

## What it is

**The problem:** Busy operators (founders, VCs, PE associates, lawyers) spend hours triaging inbox and writing routine replies — especially scheduling back-and-forth.
**The solution:** Dharma classifies each new thread into a small set of meaningful Gmail labels, drafts reply text in the user's tone, and (for scheduling threads) pulls multi-calendar availability and writes a ready-to-send reply with concrete time slots.
**The user:** Solo operators and small teams in finance/legal whose inbox is their job — primarily Robbie's network (VC/PE first, Legal next).
**The value:** Reclaim ~30-60 min/day of triage and routine writing; never miss a scheduling thread because the calendar work is already done.

---

## Status

- **Phase:** post-MVP iteration (Chrome extension retired; production migrated to a custom domain; Gmail add-on is the sole in-Gmail surface)
- **Engagement manager:** self-directed (Finley)
- **Lead:** Finley
- **Cadence:** daily commits; no formal external client cadence
- **Next milestone:** confirm the Google OAuth consent screen is "In production" (HIGH priority — Testing mode expires all refresh tokens every 7 days), then re-auth the two remaining orphaned-token users
- **Flags:** shipping (labeling pipeline restored 2026-06-22)

---

## Where we are right now

Tonight (2026-06-22) was a production incident: the inbox stopped being labeled. Root cause was fallout from the earlier `dharma-lake` → `dharmaautomations.com` prod migration (the Vercel project move to `kuba-ventures`), which broke the Gmail labeling pipeline three ways: (1) the Google Pub/Sub push subscription's endpoint URL + `PUBSUB_PUSH_AUDIENCE` still pointed at the dead `dharma-lake` domain, so every push to `/api/gmail/webhook` was rejected on an OIDC audience mismatch (403); (2) the OAuth client changed in the migration, orphaning stored refresh tokens so the Gmail watch renewal threw `unauthorized_client` for affected users; (3) the user's own Gmail watch had lapsed but carried a stale future `gmailWatchExpiry` in the DB, so the daily renew-watches cron skipped it silently — no watch, no pushes, no labels. Resolution: repointed the Pub/Sub push endpoint + audience to `https://www.dharmaautomations.com/api/gmail/webhook` (GCP Pub/Sub console + Vercel env) and redeployed, confirming pushes now authorize; re-authed the affected Google account (disconnect at myaccount.google.com → reconnect), which re-armed a fresh watch via `setupGmailWatch` in `auth.ts` — real-time labeling now works within seconds of new mail. Two hardening PRs landed and deployed: PR #10 (`9ce85a6`) added a poll-cron fallback that does not depend on a live watch plus ops alerting on watch-renewal failures; PR #11 (`d95699e`) fixed "Sync inbox" piling labels on threads. The user's 10 stuck inbox threads were backfilled via one forced "Sync inbox". Next concrete step: confirm the OAuth consent screen is "In production" (Testing mode expires refresh tokens every 7 days, which would re-break labeling for everyone weekly), then have `patrick@qsbsrollover.com` and `brady@qsbsrollover.com` re-auth to clear their orphaned tokens.

---

## What's built

**Frontend / UI (apps/web)**
- Landing page at `/` (Plus Jakarta Sans headings; Arial elsewhere) — four-feature positioning
- Login page (`/login`) — Google OAuth, optional `login_hint` via `?hint=` URL param, calls `signOut()` before `signIn()` to dodge JWT carryover
- 4-step onboarding at `/onboarding/step-1-connect`, `/step-2-city`, `/step-3-tone`, `/step-4-labels` with bundled US-cities autocomplete (~240 metros, 5k aspirational)
- 5-tab app shell under `app/(app)/`: `/dashboard`, `/metrics`, `/configuration`, `/signals`, `/settings`, plus `/profile`
- **Dashboard (rebuilt 2026-05-29 PM):** single-scroll six-section hierarchy: Greeting + Sync inbox button + slim `TierStrip` → "Running for you" (ConfigStatusCard trio) → "This week" (DashboardMetrics, links to /metrics) → `NextMilestoneStrip` → `ActivityFeed` → `SignalsPeek`. New components in `apps/web/app/components/dashboard/`. `MilestoneHero`, `InboxPanel`, and `QuickActions` are no longer rendered (files retained).
- Metrics: `ReplyRateHero` with new 7D↔All-time toggle, `TimeSavedChart` with milestone dots, `ReplyRateByLabel` (now `?days=7` for parity with dashboard), `MilestoneTimelineStrip`
- **Configuration (polished 2026-05-29 PM):** `ToneCard` is now a 2x2 selectable-card grid (DB-stable keys preserved). `SchedulingCard` shows numeric hour ranges per day. `LabelsCard` renders an "Active labels · last 7 days" list with per-label tagged counts. New `SignalDetectionCard` with per-user on/off toggle.
- Profile: IdentityCard, BadgeCase (top 10 + "See all" modal), MilestoneLibrary (top 5 + modal), hover-on-earned-badge sets `displayBadgeId`
- ProfileChip in sidebar: avatar with display-badge overlay, badge title bold, tier muted underneath
- Settings hub + sub-pages (Advanced, Hidden stats, Profile-legacy)
- 10 shared UI primitives under `app/components/ui/`; purple-forward design tokens (`--brand-50..900`, surface/text/label palette)
- Tier-up confetti (~80 LOC canvas, brand palette)
- FeedbackButton + ConfirmModal

**Backend / API (apps/web/app/api)**
- `auth/[...nextauth]` — Google OAuth via NextAuth v5; PrismaAdapter wrapped in `lib/adapter.ts` for idempotent Account linking
- `emails/thread-draft`, `emails/recent`, `emails/[id]` — draft/polish, dashboard preview
- `gmail/webhook` — real-time Pub/Sub push receiver (verifies OIDC token against `PUBSUB_PUSH_AUDIENCE`; the primary labeling path when a watch is live)
- **`gmail/poll` (now a Vercel cron, `*/30 * * * *`, hardened 2026-06-22):** safety-net sweep across all connected accounts. Calls Gmail `history.list` per user and does **not** depend on a live Gmail watch, so it keeps labeling even if a watch lapses or a push is dropped. Idempotent — advances each user's `gmailHistoryId` and the `ClassifiedThread` dedupe prevents double-labeling, so it cooperates safely with the webhook. Auto-seeds `gmailHistoryId` for accounts that connected but never got seeded. Auth via `x-cron-secret` header or `Authorization: Bearer <CRON_SECRET>`. `scripts/poller.mjs` remains as a local-only manual hitter.
- `cron/renew-watches` (`0 7 * * *`) — renews any Gmail watch expiring within 48h (re-seeds if `gmailHistoryId` missing). **New 2026-06-22:** emits an ops alert via `lib/opsAlert.ts` when any renewal fails (an `unauthorized_client` here means the user must re-auth, else their inbox silently stops being labeled)
- **`labels/back-scan` (reconcile fix, 2026-06-22):** powers the "Sync inbox" button (`force:true` re-classifies recent threads under the current preset, capped at the 25 most-recent threads). Now reconciles labels instead of appending — applies the single best preset label and strips any *other* preset-managed label, and does the same within the user-defined `Label` set — so re-syncs replace rather than accumulate. One forced sync after deploy self-heals pre-existing label pileup.
- `suggest-times` — Sonnet streaming scheduling reply over multi-calendar free/busy
- `labels/*` — CRUD, `preset`, `provision`, `setup-gmail`, `scan-inbox`, `back-scan`, `seed-rules`, `status`
- `preferences/{tone,scheduling,meeting-hours,signal-detection}`, `user/{me,preferences,extension-token,nps-postpone,ack-tier,dismiss}`
- **New 2026-05-29 PM:** `PATCH /api/preferences/signal-detection` flips `User.signalDetectionEnabled`
- `calendar/{google,microsoft,apple,rsvp}` — connect/disconnect + Google `schedule` writes events with Meet links
- `metrics` — `emailsTagged` is now 7d-windowed (was an all-time bug); returns both `replyRate7d` and `replyRateAllTime`
- `metrics/timeseries`, `metrics/by-label` (now `?days=7`-aware so dashboard + Metrics tab can't diverge)
- `signals`, `signals/[id]` — produces `buried_intent` via the rewritten detector; legacy `deal_flow` / `term_sheet` / `transaction` rows still render with legacy chip styling
- **New 2026-05-29 PM:** `activity/recent` powers the dashboard `ActivityFeed` mixed event stream (drafts + signals + milestone unlocks + recent classifications), backed by `apps/web/lib/recentActivity.ts`
- `feedback` — POST writes to `Feedback` table
- `onboarding/*` — step state
- `profile/*`, `milestones/*` — read endpoints for Profile UI
- `share/milestone/[id]` — Edge-runtime OG image generator; public `/share/milestone/[id]` page with OG meta
- `cron/awards` — nightly Vercel cron; per-user try/catch; writes `UserMilestone`, bumps `tier`, backfills the Subscribers tab in the admin sheet
- `waitlist/join` — admin-sheet write
- `geo/cities` — bundled autocomplete

**Gmail add-on (apps/gmail-addon)** — the only in-Gmail surface (the Chrome extension was retired 2026-06-15)
- Apps Script `Code.gs` (~19KB) deployed via `clasp`; live as deployment **v22**
- Sidebar with tone buttons + Polish Draft; calls Dharma API with `GoogleBearer`
- `DHARMA_API` constant points at `https://www.dharmaautomations.com` (repointed off the dead `dharma-lake.vercel.app` alias on 2026-06-15)
- Shared endpoints `/api/user/me`, `/api/user/extension-token`, `/api/emails/thread-draft` are still served by the web app (used by the add-on; previously also by the extension)

**Shared packages**
- `@dharma/types`, `@dharma/calendar-core`, `@dharma/providers-google` / `-outlook` / `-apple`, `@dharma/reply-generation`

**Database (Neon Postgres via Prisma, schema at repo root `schema.prisma`)**
- User (+ `firstName`, `homeCity/Lat/Lng`, `timezone`, `toneSummary`, `dismissedTiles[]`, `onboardingStep/CompletedAt`, `tier`, `lastSeenTier`, `displayBadgeId`, `cumulativeSecondsSaved`, `nextNpsPromptAt`, **new 2026-05-29 PM:** `signalDetectionEnabled Boolean @default(true)`)
- GoogleCredential, MicrosoftCredential, AppleCredential (AES-256-GCM encrypted)
- Label, LabelRule, LabelPreset (VC | PE | Legal | General | Custom), LabelMapping, ClassifiedThread (with `labelName` + `draftCreated`)
- NextAuth Account, Session, VerificationToken
- UsageEvent (token/cost; also the gate behind `SIGNAL_DAILY_LIMIT`)
- `MeetingHour`, `MilestoneDef` (with `requiredCity`), `UserMilestone`, `BadgeDef`, `UserBadge`, `Signal` (now with `title` + `whyItMatters`), `Feedback`

**Infrastructure**
- Vercel hosting (project now on the `kuba-ventures` team) at `https://www.dharmaautomations.com`; old `dharma-lake.vercel.app` alias is dead (404)
- **Three Vercel crons (all UTC) in `apps/web/vercel.json`:** `/api/cron/awards` (`0 8 * * *`, nightly award sweep), `/api/cron/renew-watches` (`0 7 * * *`, Gmail watch renewal + failure alerting), `/api/gmail/poll` (`*/30 * * * *`, labeling fallback that survives a lapsed watch — added 2026-06-22)
- Neon Postgres
- Admin Google Sheet (Waitlist / Subscribers / Debugging) via service account, auto-headered + backfilled
- Google Cloud Pub/Sub for real-time Gmail push — push endpoint + `PUBSUB_PUSH_AUDIENCE` both point at `https://www.dharmaautomations.com/api/gmail/webhook` (repointed off the dead `dharma-lake` domain 2026-06-22; the audience mismatch was rejecting every push with a 403)
- `lib/opsAlert.ts` — optional ops alerting: posts `{ "text": ... }` to `OPS_ALERT_WEBHOOK_URL` (Slack-compatible incoming webhook) and always mirrors to `console.error`; best-effort, never throws

---

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Monorepo | npm workspaces | `apps/*` + `packages/*`, Node >=20 |
| Frontend | Next.js 16.2.1 (App Router) + React 18.3 + Tailwind 3.4 | `apps/web` |
| Design system | Custom tokens (`--brand-50..900`) + 10 shared UI primitives | `apps/web/app/components/ui/` |
| Auth | NextAuth v5 beta + wrapped Prisma adapter | `lib/adapter.ts` makes Account linking idempotent |
| Database | PostgreSQL via Prisma 5.22 client (root devDep Prisma 6.12) | `schema.prisma` at repo root |
| AI — classify/polish/tone | Claude Haiku (`claude-haiku-4-5-20251001`) | Raw `fetch` to Anthropic API |
| AI — scheduling reply | Claude Sonnet streaming | `/api/suggest-times` |
| AI — toneSummary | Claude Sonnet 4 (env-gated) | onboarding step 3 → `User.toneSummary` |
| AI — milestone generation | Claude Haiku | `lib/milestoneGenerator.ts`, on-demand per-city, ~$0.001/city |
| AI — signal detection | Claude Haiku, `buried_intent` kind | `lib/signalDetector.ts`, runs after classify, gated by per-user toggle + `SIGNAL_DAILY_LIMIT` |
| AI routing | Vercel AI Gateway (optional, via `AI_GATEWAY_API_KEY`) | `lib/anthropicEndpoint.ts` flips all 9 fetch sites between Gateway and direct Anthropic |
| Gmail | `googleapis` v144 (Gmail API v1) | Read, label, draft, history, watch; `gmail.modify` scope |
| Calendar | Google Calendar + Microsoft Graph + Apple CalDAV (`tsdav` 2.0.11) | Free/busy + Meet links |
| Hosting | Vercel | `vercel.json` runs `prisma generate && next build` |
| OG / share cards | Vercel Edge runtime | `app/api/share/milestone/[id]` |
| Cron | Vercel cron, UTC | `/api/cron/awards` nightly |
| Gmail add-on | Apps Script via `clasp` (live deployment v22) | `apps/gmail-addon/Code.gs`, points at `www.dharmaautomations.com` |
| Poller | Node script `apps/web/scripts/poller.mjs` | Hits `/api/gmail/poll` on a schedule |

---

## Key files & directories worth knowing

- `NIGHT-RUN.md` — per-phase log for the 2026-05-29 PM auto-loop run; useful pointer for future sessions
- `apps/web/app/components/dashboard/` — new dashboard sections: TierStrip, ConfigStatusCard trio, DashboardMetrics, NextMilestoneStrip, ActivityFeed, SignalsPeek
- `apps/web/lib/recentActivity.ts` — backs `/api/activity/recent`; mixes drafts + signals + milestone unlocks + recent classifications
- `apps/web/lib/timeSaved.ts` — single source of time-saved constants for `/api/metrics`, `/api/metrics/timeseries`, `/api/cron/awards`
- `apps/web/lib/signalDetector.ts` — rewritten around `buried_intent`; `SIGNAL_DAILY_LIMIT` gate; TODO marker for confirm/dismiss feedback endpoints
- `apps/web/lib/anthropicEndpoint.ts` — direct-vs-Gateway toggle for Anthropic
- `apps/web/lib/tiers.ts` — `type Tier = string`; TIERS array stays as runtime source
- `apps/web/scripts/seed-starter-milestones.mjs` — seeded 9 universal milestones (3h–250h) live to Neon
- `apps/web/lib/adapter.ts` — wrapped PrismaAdapter; upserts Account by `(userId, provider)`. The fix at the center of the JWT-carryover saga.
- `apps/web/lib/auth.config.ts`, `auth.ts` — `signIn` callback dual guard (resolved-User email ≠ OAuth profile, JWT cookie email ≠ OAuth profile)
- `apps/web/lib/milestoneGenerator.ts` — Haiku writes 6 city-specific milestones into `MilestoneDef` the first time a user sets a new home city; cached for subsequent users
- `apps/web/lib/milestones.ts`, `milestoneResolution.ts`, `badges.ts`, `badgeIcons.ts` — progression system, jewel-tone badge rendering, Basquiat-style Founder crown
- `apps/web/lib/adminSheet.ts` — service-account writes to Waitlist / Subscribers / Debugging tabs; auto-header + auto-backfill
- `apps/web/lib/cities.ts`, `sampleScenarios.ts` — onboarding inputs
- `apps/web/app/(app)/profile/` and `app/components/profile/` — Profile tab UI
- `apps/web/app/share/milestone/[id]/`, `app/api/share/milestone/[id]/` — public share page + Edge OG generator
- `apps/web/app/api/cron/awards/` — nightly award sweep
- `apps/web/scripts/relink-google-account.mjs` — recovery hatch when an Account row's `providerAccountId` is wrong
- `apps/web/scripts/bump-tier.mjs`, `seed-city-milestones.mjs`, `seed-starter-milestones.mjs`, `trigger-cron.mjs`, `backfill-cumulative.mjs`, `backfill-onboarding.mjs`, `inspect-user.mjs` — operational tooling

---

## Integrations & MCPs

| Integration | Purpose | Cost | Status |
|---|---|---|---|
| Vercel (hosting + functions + cron + Edge OG) | Hosts Next.js app, runs API routes, nightly cron, share-card OG | unknown (Hobby/Pro tier) | live (`www.dharmaautomations.com`; project on `kuba-ventures` team; old `dharma-lake.vercel.app` alias dead) |
| Neon (Postgres) | Primary database | unknown | live |
| Anthropic API (direct, optionally via AI Gateway) | Haiku (classify/polish/tone/milestone-gen/signal) + Sonnet (scheduling, toneSummary) | usage-based; tracked per-event in `UsageEvent`; `SIGNAL_DAILY_LIMIT` caps signal detection at 100/UTC-day/user | live |
| Google OAuth | User login | free | live |
| Gmail API | Read inbox, apply labels, create drafts, register Watch | free (quota-limited) | live |
| Google Calendar API | Free/busy, create events with Meet | free (quota-limited) | live |
| Google Cloud Pub/Sub | Real-time Gmail push notifications (push → `/api/gmail/webhook`, OIDC-verified against `PUBSUB_PUSH_AUDIENCE`) | usage-based, unknown | live (endpoint + audience repointed to `www.dharmaautomations.com` 2026-06-22; `/api/gmail/poll` cron is the fallback) |
| Slack-compatible ops webhook | Watch-renewal failure alerts via `OPS_ALERT_WEBHOOK_URL` (`lib/opsAlert.ts`); mirrors to `console.error` regardless | free | planned (env var not yet set in prod; alerts currently land in logs only) |
| Google Sheets (service account) | Admin sheet: Waitlist / Subscribers / Debugging | free (quota-limited) | live |
| Microsoft Graph | Outlook calendar free/busy | free (quota-limited) | live |
| Apple iCloud CalDAV | iCloud calendar free/busy | free | live |
| Google Workspace Marketplace | Distribution for the Gmail add-on | unknown | not yet listed (deployed via clasp only, deployment v22) |

*Source: no MCP configs found in repo; this table is generated from `.env`/`.env.local` references, the system diagram (`docs/architecture/dharma_system_diagram.md`), and the admin-sheet wiring in `lib/adminSheet.ts`.*

---

## Decisions log

- **2026-06-22 — Re-attach `/api/gmail/poll` as a `*/30` Vercel cron fallback that doesn't depend on a live Gmail watch** — Tonight's incident proved the Pub/Sub-push-only labeling path is single-point-of-failure: when a watch lapses or a push is rejected, labeling stops silently. The poll cron calls `history.list` directly per user, advances `gmailHistoryId`, and relies on `ClassifiedThread` dedupe to cooperate safely with the webhook, so it keeps labeling without a watch. Rejected: relying on watch renewal alone (it can fail on orphaned tokens) and the local-only `scripts/poller.mjs` (no host on Vercel). (PR #10, `9ce85a6`)
- **2026-06-22 — Alert loudly on Gmail watch-renewal failures via `lib/opsAlert.ts`** — A failed renewal (e.g. `unauthorized_client` from orphaned tokens) means that user's inbox silently stops being labeled within 7 days. `renew-watches` now posts a per-failure ops alert to `OPS_ALERT_WEBHOOK_URL` (Slack-compatible) and always mirrors to `console.error`, so the signal is never lost even when no webhook is configured. Rejected: log-only — tonight's outage was invisible for days precisely because nothing surfaced it. (PR #10, `9ce85a6`)
- **2026-06-22 — "Sync inbox" reconciles labels instead of appending** — `applyGmailLabels` was add-only; `force=true` re-classifies all recent threads each run and the LLM is non-deterministic, so repeated "Sync inbox" clicks piled every label onto each thread. `applyGmailLabels` gained an optional `removeLabelIds` arg; back-scan now applies the single best preset label and strips any other preset-managed label (the preset is single-label by design), and reconciles the user-defined `Label` set the same way. One forced sync after deploy self-heals existing pileup. Rejected: clearing all labels before re-applying (would flicker labels off mid-sync and lose user-defined labels that still match). (PR #11, `d95699e`)
- **2026-06-22 — Repoint the Pub/Sub push endpoint + audience to the live domain, not patch around the 403** — The migration left the push subscription's endpoint URL and `PUBSUB_PUSH_AUDIENCE` on the dead `dharma-lake` domain, so the OIDC audience check rejected every push. Fixed at the source (GCP Pub/Sub console + Vercel env) rather than loosening webhook auth. Rejected: disabling audience verification to "just make pushes work" — that would accept forged pushes.
- **2026-06-15 — Retire the Chrome extension entirely** — Deleted `apps/chrome-extension/` (`9793a9b`). The extension was never published to the Chrome Web Store (the Kuba Ventures developer dashboard shows no items), so removing it breaks nothing in the wild. The Gmail add-on is now the sole in-Gmail surface. The shared server endpoints the extension used (`/api/user/me`, `/api/user/extension-token`, `/api/emails/thread-draft`) were intentionally kept — the add-on and web app also depend on them. Rejected: maintaining two parallel Gmail surfaces.
- **2026-06-15 — Production moves to the `dharmaautomations.com` custom domain** — The Vercel project moved to the `kuba-ventures` team, which killed the old auto-alias `dharma-lake.vercel.app` (now 404 DEPLOYMENT_NOT_FOUND). Live production is `https://www.dharmaautomations.com`; the bare apex 308-redirects to www. Rejected: continuing to rely on the Vercel auto-alias as the canonical URL.
- **2026-06-15 — Repoint the Gmail add-on to the new domain (clasp v22)** — The add-on had `dharma-lake.vercel.app` hardcoded in `DHARMA_API`, so "Polish draft" failed with HTTP 404 after the team move. Repointed to `www.dharmaautomations.com` (`1395fc2`) and shipped as clasp deployment v22 (per the gmail-addon-deploy memory: create-version + deploy -i, not just clasp push).
- **2026-05-29 (PM) — `buried_intent` is the first shipped signal kind; `cold_thread` and `pattern_shift` deferred** — Detector rewrite replaced `deal_flow` / `term_sheet` / `transaction` with `buried_intent`. `cold_thread` is reserved in the schema but needs a cron sweep (not inbound-triggered) to fire correctly. `pattern_shift` is blocked on a `ContactBaseline` table that doesn't exist yet. Both are tracked as open loops. Full specs live in `NIGHT-RUN.md`.
- **2026-05-29 (PM) — Per-user signal toggle + `SIGNAL_DAILY_LIMIT` cap together replace a single global ceiling** — `User.signalDetectionEnabled` lets users opt out entirely; `SIGNAL_DAILY_LIMIT` (default 100/UTC-day/user, gated via `UsageEvent` count) bounds spend even for opted-in users. Rejected: a single global cap — too blunt; some users want more, some want none.
- **2026-05-29 (PM) — `Tier` type is now `string`, not a literal union** — Adding a new tier was a multi-file type-change. `lib/tiers.ts` keeps the `TIERS` array as the single runtime source; `TierLadder` grids dynamically off `TIERS.length`. Rejected: keeping the literal union "for safety" — TIERS was already the runtime source, the union was redundant friction.
- **2026-05-29 (PM) — Dashboard is one scroll, not a grid** — Greeting + Sync → Running for you → This week → NextMilestoneStrip → ActivityFeed → SignalsPeek. Rejected: a 2-column grid that mixed status with activity — became hard to read on small screens and buried the milestone strip.
- **2026-05-29 (PM) — `/api/metrics` `emailsTagged` is 7d-windowed** — Was all-time (a bug). Returning both `replyRate7d` and `replyRateAllTime` lets the Metrics tab show a toggle without a second API round-trip.
- **2026-05-29 (PM) — Time-saved constants live in one file** — `apps/web/lib/timeSaved.ts` is the source for `/api/metrics`, `/api/metrics/timeseries`, and `/api/cron/awards`. Rejected: per-route inline constants — drift caused the dashboard label card to disagree with the Metrics tab in earlier sessions.
- **2026-05-29 (PM) — Ship a starter milestone library (9 entries), not the full 50 at once** — Seeded 3h–250h thresholds via `scripts/seed-starter-milestones.mjs` straight to Neon. Structure is ready for extension to the full 50. Rejected: blocking the gamification scale-ready work on full library curation.
- **2026-05-29 (AM) — "Logical candy" redesign closed** — Shipped the 12-step plan at `~/.claude/plans/dharma-product-logical-candy.md` plus session-added work: admin Google Sheet, share-card OG, `UserMilestone` persistence, tier-up confetti, on-demand city milestones, jewel-tone badges, NPS prompt, Profile sidebar tab. Rejected: shipping the redesign behind a feature flag — preview was clean enough to cut straight to main.
- **2026-05-29 — Milestones generated per-city on demand** — First user to set a new home city triggers Haiku to write 6 city-specific milestones into `MilestoneDef`; subsequent users in that city reuse the cached rows (~$0.001 per city total). Rejected: pre-seeding all US metros.
- **2026-05-29 — Jewel-tone palette + Basquiat-style Founder crown** — Hardcoded SVG fills (topaz, amethyst, sapphire, emerald, tanzanite, citrine) with dark strokes; Founder badge gets yellow fill + heavy black outline. Rejected: `currentColor`-driven theming.
- **2026-05-29 — Display-badge picker is a hover overlay on earned badges** — Hovering an earned badge in BadgeCase shows "Display on profile"; click writes `User.displayBadgeId`. Rejected: a separate settings page for badge selection.
- **2026-05-29 — Profile gets its own sidebar tab** — Moved off `/settings/profile` to `/profile`. Profile is high-traffic now that badges are a thing.
- **2026-05-26 — Auth.js JWT carryover fix** — Multi-day bug: `@auth/core` `handle-login.js` silently linked new OAuth grants to a stale session-cookie user, and one Account row had wrong `providerAccountId`. Fix: `lib/adapter.ts` upserts Account by `(userId, provider)`; `signIn` callback rejects mismatched emails; login page calls `signOut()` before `signIn()`; `scripts/relink-google-account.mjs` provides a recovery hatch.
- **2026-05-26 — IA: 5-tab sidebar + Profile** — Dashboard / Metrics / Configuration / Signals / Settings, plus a separate Profile tab. Configuration consolidates Tone / Labels / Scheduling cards.
- **2026-05-26 — Admin sheet over a custom admin UI** — Waitlist + Subscribers + Debugging tabs in a service-account-writable Google Sheet, auto-headered and backfilled by the nightly cron. Rejected: building a Next.js admin route.
- **2026-05-26 — Built-in preset labels are flat (no "Dharma/" prefix)** — Custom preset name is optional; blank = flat top-level labels.
- **2026-05-20 — Sync Inbox force-reclassifies** — Switching presets used to only affect new mail; Sync Inbox re-runs the classifier on recent threads even if previously classified.
- **2026-05-19 — Custom preset over open-ended label CRUD** — Custom preset lets a user name their own labels + Gmail folder prefix.
- **2026-05-19 — Classifier prompt: decisive single-label, temperature 0** — Returning `null` too often hurt UX.
- **2026-05-19 — Metrics moved to its own tab.**
- **2026-05-19 — Industry-preset labels added (VC / PE / Legal / General).**
- **2026-05-18 — Use Arial site-wide, scope Plus Jakarta Sans to landing page.**
- **2026-05-18 — Remove em-dashes from all user-facing copy and AI prompts.**
- **2026-04-30 — Submit Chrome extension to Chrome Web Store** — Screenshots at `docs/screenshots/cws/`.
- **2026-04 — Apple Calendar uses app-specific password, not OAuth.**
- **2026-04 — Anthropic API called directly via `fetch`, no SDK.**

---

## Open loops

- [ ] **HIGH — Verify the Google OAuth consent screen is set to "In production" (not Testing)** — in Testing mode Google expires all refresh tokens every 7 days, which would re-break labeling for every user weekly. Top priority follow-up from tonight's incident — Finley
- [ ] **Re-auth `patrick@qsbsrollover.com` and `brady@qsbsrollover.com`** — both still have orphaned tokens (`unauthorized_client`) from the OAuth client change; their inboxes won't label until they disconnect + reconnect — Finley
- [ ] Set `OPS_ALERT_WEBHOOK_URL` in prod env so watch-renewal failures page out instead of only landing in logs (optional) — Finley
- [ ] Deeper historical backfill beyond the 25-most-recent-threads cap in `/api/labels/back-scan` (optional future work) — Finley
- [ ] First external user test of preset-label + Sync Inbox flow, via the Gmail add-on against `www.dharmaautomations.com` — Finley
- [ ] List Gmail add-on on Google Workspace Marketplace (currently `clasp`-only, deployment v22) — Finley
- [ ] **Six decisions flagged for review** in `NIGHT-RUN.md` end-of-run section — Finley
- [ ] **`cold_thread` detector** — reserved kind but needs a cron sweep (not inbound-triggered) to fire. Full spec in `NIGHT-RUN.md`.
- [ ] **`pattern_shift` detector** — blocked on a `ContactBaseline` table that doesn't yet exist. Full spec in `NIGHT-RUN.md`.
- [ ] **Signal confirm/dismiss feedback endpoints** — TODO marker left in `lib/signalDetector.ts`. Needs API + UI affordance + write path back to `Signal` (and ideally feeds a confidence-calibration loop).
- [ ] **Full 50-entry milestone library** — Starter set of 9 shipped tonight (3h–250h). Structure is ready for the full curation pass.
- [ ] Multi-account switching (GitHub-style, ProfileChip dropdown) — needs custom NextAuth session-token cookie handling. Deferred; Chrome profiles cover the gap.
- [ ] Stripe / subscribe action — Subscribers-tab promotion fires once an endpoint exists. Needs plan/pricing decisions before code.
- [ ] Cities autocomplete: extended set up to ~240; ~5k still aspirational. Needs a US Cities dataset (Census / simplemaps) to be vendored.

### Recently closed
- [x] Restore the broken auto-labeling pipeline (2026-06-22) — repointed Pub/Sub push endpoint + audience to the live domain, re-authed the affected account, backfilled 10 stuck threads
- [x] Poll-cron labeling fallback that survives a lapsed Gmail watch + ops alerting on renewal failures (2026-06-22, PR #10)
- [x] "Sync inbox" label reconcile fix — re-syncs replace rather than accumulate labels (2026-06-22, PR #11)
- [x] Scrub remaining `dharma-lake.vercel.app` references from in-repo source — `support/page.tsx`, `relink-google-account.mjs`, `trigger-cron.mjs` (2026-06-22, `b966b53`)
- [x] Retire the Chrome extension; delete `apps/chrome-extension/` (2026-06-15) — was never published; add-on is the sole in-Gmail surface
- [x] Migrate production to `www.dharmaautomations.com` after the Vercel team move; old `dharma-lake.vercel.app` alias dead (2026-06-15)
- [x] Repoint Gmail add-on off the dead alias, fixing the "Polish draft" 404; shipped clasp v22 (2026-06-15)
- [x] Dashboard re-layout to single-scroll six-section hierarchy (2026-05-29 PM, Phase 1)
- [x] `/api/metrics` accuracy (7d `emailsTagged`) + dual 7D/All-time reply rate + `timeSaved.ts` consolidation (2026-05-29 PM, Phase 2)
- [x] Configuration polish: 2x2 tone grid, numeric scheduling hours, active-labels list, `SignalDetectionCard` (2026-05-29 PM, Phase 3)
- [x] Per-user `signalDetectionEnabled` toggle (2026-05-29 PM, Phase 3)
- [x] `SIGNAL_DAILY_LIMIT` cost ceiling + signal rewrite around `buried_intent` (2026-05-29 PM, Phase 4) — closes the "signal-detector cost ceiling" loop from the prior PROJECT.md
- [x] Gamification scale-ready: `Tier = string`, `TierLadder` dynamic, 9-milestone starter seed live to Neon (2026-05-29 PM, Phase 5)
- [x] Migrate Anthropic calls to Vercel AI Gateway (2026-05-29) — `lib/anthropicEndpoint.ts` toggles direct vs Gateway via `AI_GATEWAY_API_KEY`; all 9 fetch sites migrated.
- [x] Per-thread reply rate by label (2026-05-29) — `ClassifiedThread.labelName` + `draftCreated` populated by gmail/poll, gmail/webhook, labels/back-scan; flipped from thread-draft + [id]/draft.
- [x] Signal producers v1 (2026-05-29) — superseded by tonight's Phase 4 rewrite around `buried_intent`.
- [x] Sentence-case audit (2026-05-29)
- [x] Milestone-generator prompt grounding (2026-05-29)
- [x] A11y focus sweep (2026-05-29)
- [x] Cities autocomplete: extended to ~240 cities (2026-05-29)
- [x] 12-step "logical candy" product redesign (2026-05-29)
- [x] Auth.js JWT carryover bug (2026-05-26)
- [x] Admin Google Sheet (Waitlist + Subscribers + Debugging) (2026-05-26)
- [x] Onboarding flow (`/onboarding/step-1..4`) (2026-05-26)
- [x] Profile + milestones + badges system (2026-05-26..29)
- [x] Share-card OG generator at `/share/milestone/[id]` (2026-05-29)
- [x] Nightly Vercel cron at `/api/cron/awards` (2026-05-26)

---

## Risks & known issues

- **OAuth consent screen may still be in "Testing" mode** — if so, Google expires every user's refresh token every 7 days, which would re-break labeling for all users weekly (exactly the orphaned-token failure mode seen tonight). Unverified — top-priority follow-up. The poll cron and renewal alerting added tonight blunt the impact but don't fix the root cause.
- **`patrick@qsbsrollover.com` and `brady@qsbsrollover.com` have orphaned refresh tokens** — `unauthorized_client` on watch renewal after the OAuth client change. Their inboxes won't label until they re-auth. Now surfaced via the renew-watches ops alert (if `OPS_ALERT_WEBHOOK_URL` is set; otherwise logs only).
- **Real-time labeling is single-point-of-failure on the Gmail watch** — if a watch lapses (and tonight showed a stale `gmailWatchExpiry` can hide that from the renewal cron), the only thing keeping labels flowing is the `*/30` poll cron, which lags up to 30 min vs. seconds for a live push.
- **`cold_thread` and `pattern_shift` shipped as `null` from the brief** — `buried_intent` is the only live signal kind. Existing `deal_flow` / `term_sheet` / `transaction` rows still render with legacy chip styling.
- **`SIGNAL_DAILY_LIMIT` enforcement depends on `UsageEvent` writes landing on the same UTC day** — any signal path that forgets `logUsage` is invisible to the gate.
- **`next-auth` is on a 5.0 beta** (`^5.0.0-beta.25`) — pin carefully on breaking releases.
- **Prisma version split** — root devDep `prisma@^6.12.0`, web app devDep + client `^5.22.0`. Confirm `prisma generate` uses the version expected at runtime.
- **`scripts/poller.mjs` is local-only** — the production labeling fallback is now the `/api/gmail/poll` Vercel cron (`*/30`); the script remains a manual hitter for debugging.
- **Cost visibility depends on `UsageEvent` writes** — any code path that forgets `logUsage` is invisible in Metrics.
- **No automated tests visible** in `apps/web` (only `scripts/test-poll.mjs` for the poller).

---

## Links

- **Live URL:** https://www.dharmaautomations.com (apex `dharmaautomations.com` 308-redirects to www)
- **Old URL (dead):** https://dharma-lake.vercel.app — 404 DEPLOYMENT_NOT_FOUND since the Vercel team move to `kuba-ventures`
- **Settings (add-on token):** https://www.dharmaautomations.com/settings
- **Share-card example:** https://www.dharmaautomations.com/share/milestone/[id]
- **Staging:** not configured (or not documented in repo)
- **Admin Google Sheet:** referenced via service account in `lib/adminSheet.ts` (URL in env)
- **Tonight's plan:** `~/.claude/plans/dharma-dashboard-serialized-stonebraker.md`
- **Tonight's per-phase log:** `/Users/finley/Code/Dharma Code/NIGHT-RUN.md`
- **Redesign plan (closed):** `~/.claude/plans/dharma-product-logical-candy.md`
- **System diagram:** `docs/architecture/dharma_system_diagram.md`
- **DB schema:** `/Users/finley/Code/Dharma Code/schema.prisma`

---

## Changelog

- **2026-06-22:** Production incident — auto-labeling had silently stopped. Root cause: the `dharma-lake` → `dharmaautomations.com` migration broke the labeling pipeline three ways — (1) the Pub/Sub push endpoint + `PUBSUB_PUSH_AUDIENCE` still pointed at the dead domain, so every push hit a 403 OIDC audience mismatch; (2) the OAuth client changed, orphaning refresh tokens (`unauthorized_client` on watch renewal); (3) the affected user's Gmail watch had lapsed behind a stale future `gmailWatchExpiry`, so the renewal cron skipped it. Fixes: repointed the Pub/Sub push endpoint + audience to `https://www.dharmaautomations.com/api/gmail/webhook` (GCP + Vercel env) and redeployed; re-authed the affected account to re-arm a fresh watch; backfilled the user's 10 stuck threads via one forced "Sync inbox". Also: `b966b53` scrubbed the last `dharma-lake` URLs from `support/page.tsx` + two scripts. Two hardening PRs landed and deployed:
  - **PR #10 (`9ce85a6`) — `harden(gmail): poll cron fallback + alert on watch-renewal failures`** — re-attached `/api/gmail/poll` as a Vercel cron (`*/30 * * * *`) that calls `history.list` directly and does not depend on a live Gmail watch; added `lib/opsAlert.ts` (posts to `OPS_ALERT_WEBHOOK_URL`, always mirrors to `console.error`); `renew-watches` now fires an ops alert on any renewal failure. `vercel.json` now runs three crons.
  - **PR #11 (`d95699e`) — `fix(labels): reconcile labels on Sync Inbox instead of appending`** — `applyGmailLabels` gained an optional `removeLabelIds` arg; back-scan now reconciles within the single-label preset set and the user-defined `Label` set, so re-syncs replace rather than accumulate labels. Note: the two label-sync buttons differ — "Sync inbox" (top, by the toggle) sends `force:true` and re-classifies/backfills recent threads; "Sync to Gmail" (bottom) is non-forced provisioning that skips already-classified threads.
  - **Open follow-ups:** verify OAuth consent screen is "In production" (HIGH); re-auth `patrick@` and `brady@qsbsrollover.com`; optionally set `OPS_ALERT_WEBHOOK_URL` in prod; optional deeper backfill past the 25-thread back-scan cap.
- **2026-06-15:** Chrome extension retired and production URL migrated. (1) Deleted `apps/chrome-extension/` (`9793a9b`) — never published; shared endpoints `/api/user/me`, `/api/user/extension-token`, `/api/emails/thread-draft` kept for the add-on + web app. (2) Vercel project moved to the `kuba-ventures` team; old `dharma-lake.vercel.app` alias now 404s; production is `https://www.dharmaautomations.com` (apex → www). (3) Gmail add-on repointed off the dead alias (`1395fc2`), fixing the "Polish draft" 404, shipped as clasp deployment v22. Note: stale `dharma-lake` URLs still live in `support/page.tsx` and two scripts (out of scope this run).
- **2026-05-29 (late PM, 5-phase auto-loop run):** Closed five sequential phases against `~/.claude/plans/dharma-dashboard-serialized-stonebraker.md` (per-phase log at `NIGHT-RUN.md`):
  - **Phase 1 (`9b17c05`) — Dashboard re-layout** — single-scroll six-section hierarchy: Greeting + Sync inbox button + slim `TierStrip` → "Running for you" (ConfigStatusCard trio) → "This week" (DashboardMetrics) → `NextMilestoneStrip` → `ActivityFeed` → `SignalsPeek`. New components under `apps/web/app/components/dashboard/`. New `/api/activity/recent` + `lib/recentActivity.ts` power the mixed event stream. Old `MilestoneHero`, `InboxPanel`, `QuickActions` no longer rendered (files retained).
  - **Phase 2 (`8be7093`) — Metrics accuracy + dual view** — `/api/metrics` `emailsTagged` is now 7d-windowed (was an all-time bug). Returns both `replyRate7d` and `replyRateAllTime`. Time-saved constants extracted to `lib/timeSaved.ts` (one source for `/api/metrics`, `/api/metrics/timeseries`, `/api/cron/awards`). New 7D↔All-time toggle on `ReplyRateHero`. Dashboard label status card now uses `/api/metrics/by-label?days=7`.
  - **Phase 3 (`6ab2b08`) — Configuration polish + signal toggle** — `ToneCard` `<select>` replaced with 2x2 selectable-card grid (DB-stable keys preserved). `SchedulingCard` shows numeric hour ranges per day. `LabelsCard` renders "Active labels · last 7 days" with per-label tagged counts. New `SignalDetectionCard` + `PATCH /api/preferences/signal-detection`. Schema addition: `User.signalDetectionEnabled Boolean @default(true)` pushed live to Neon.
  - **Phase 4 (`c6d7621`) — Signal rewrite to `buried_intent` + per-user daily cost cap** — Detector rewritten. Replaced `deal_flow` / `term_sheet` / `transaction` with `buried_intent` (live), plus `cold_thread` (reserved, deferred — needs cron sweep) and `pattern_shift` (deferred — needs `ContactBaseline` table). `SignalPayload` gained `title` + `whyItMatters`. New `SIGNAL_DAILY_LIMIT` env var (default 100/UTC-day/user) gates detection via `UsageEvent` count. Signals page renders new kinds with new chip styling; legacy chip styling retained for older rows.
  - **Phase 5 (`1d53ff7`) — Gamification scale-ready + starter milestone seed** — `lib/tiers.ts` `type Tier = string` (was a 5-string literal union). TIERS array stays as runtime source; adding tiers is a one-line push. `TierLadder.tsx` grid scales dynamically with `TIERS.length`. New `scripts/seed-starter-milestones.mjs` seeded 9 universal milestones (3h–250h thresholds) live to Neon.
  - **End-of-run:** six decisions flagged for Finley's review tomorrow in `NIGHT-RUN.md`.
- **2026-05-29 (PM, prior auto-loop session):** AI Gateway centralization (`lib/anthropicEndpoint.ts`, 9 fetch sites). Per-thread reply rate by label (`ClassifiedThread.labelName` + `draftCreated`). Signal producers v1 (`deal_flow` / `term_sheet` / `transaction`) — superseded tonight by Phase 4 rewrite. Sentence-case audit (3 Toggle aria-labels flipped).
- **2026-05-29:** "Logical candy" redesign closed out. 5-tab IA, purple-forward design tokens + 10 UI primitives, Configuration tab, Dashboard + Metrics redesigns, 4-step onboarding, Profile + milestones + badges, Signals scaffold, Settings hub, FeedbackButton + `/api/feedback`, Sonnet 4 `toneSummary`, nightly cron at `/api/cron/awards`. Session-added: admin Google Sheet, share-card OG generator, `UserMilestone` persistence, tier-up confetti + `lastSeenTier`, on-demand city milestones via Haiku, jewel-tone badge rendering + Basquiat Founder crown, BadgeCase + MilestoneLibrary collapse + "See all" modals, hover-to-set `displayBadgeId`, Profile moved to its own sidebar tab, NPS prompt for users with >=10 drafts. Schema additions (all additive, `db push`): User fields + `MeetingHour`, `MilestoneDef`, `UserMilestone`, `BadgeDef`, `UserBadge`, `Signal`, `Feedback`.
- **2026-05-26:** Auth.js JWT-carryover bug fixed (`lib/adapter.ts` wraps PrismaAdapter, `signIn` dual guard, login page `signOut`-then-`signIn`, `scripts/relink-google-account.mjs` recovery hatch). Also: built-in preset labels flattened (no "Dharma/" prefix), Custom preset name optional, `gmail.modify` scope restored, Google account-linking by verified email.
- **2026-05-21:** Initial PROJECT.md superdoc generated by kuba-vault — scanned monorepo, Prisma schema, system diagram, recent git history, and CWS submission screenshots.
