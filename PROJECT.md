# Dharma
*AI-drafted Gmail replies and scheduling, wrapped in a labeled inbox.*

*Last updated: 2026-05-29 by kuba-vault*

---

## TL;DR

Dharma is a Next.js + Chrome extension + Gmail add-on stack that watches a user's Gmail, classifies threads into preset labels (VC, PE, Legal, General, Custom), and helps draft replies — including calendar-aware scheduling replies that read free/busy from Google, Microsoft, and Apple. The "logical candy" product redesign just closed out: 5-tab navigation, purple-forward design system, onboarding flow, milestone + badge progression, and an admin Google Sheet for waitlist/subscribers. Live at `dharma-lake.vercel.app`. Phase is post-MVP iteration with a launch-prep overhang on Chrome Web Store review (submitted 2026-04-30, outcome still pending).

---

## What it is

**The problem:** Busy operators (founders, VCs, PE associates, lawyers) spend hours triaging inbox and writing routine replies — especially scheduling back-and-forth.
**The solution:** Dharma classifies each new thread into a small set of meaningful Gmail labels, drafts reply text in the user's tone, and (for scheduling threads) pulls multi-calendar availability and writes a ready-to-send reply with concrete time slots.
**The user:** Solo operators and small teams in finance/legal whose inbox is their job — primarily Robbie's network (VC/PE first, Legal next).
**The value:** Reclaim ~30-60 min/day of triage and routine writing; never miss a scheduling thread because the calendar work is already done.

---

## Status

- **Phase:** post-MVP iteration / launch prep (Chrome Web Store submission in flight; product redesign just shipped)
- **Engagement manager:** self-directed (Finley)
- **Lead:** Finley
- **Cadence:** daily commits; no formal external client cadence
- **Next milestone:** CWS approval + first external user end-to-end on the redesigned flow
- **Flags:** shipping

---

## Where we are right now

The "logical candy" product redesign closed this week — ~70 commits on main against the plan at `~/.claude/plans/dharma-product-logical-candy.md`. New IA (Dashboard / Metrics / Configuration / Signals / Settings + Profile), purple-forward design tokens, a 4-step onboarding flow, and a milestone + badge progression system are all live. A nightly Vercel cron awards milestones, writes `UserMilestone` rows, and bumps tiers; the Dashboard fires confetti once when a tier-up is unacknowledged. An admin Google Sheet (Waitlist + Subscribers + Debugging tabs) is auto-headered and backfilled via service account. Share-card OG pages exist at `/share/milestone/[id]`. The multi-day Auth.js JWT-carryover bug is resolved — `lib/adapter.ts` wraps PrismaAdapter to upsert Accounts by `(userId, provider)` and the `signIn` callback rejects mismatched email/profile pairs. Next concrete steps: hear back on CWS, run one real external user through preset → Sync Inbox → draft, and verify the Pub/Sub push path end-to-end.

---

## What's built

**Frontend / UI (apps/web)**
- Landing page at `/` (Plus Jakarta Sans headings; Arial elsewhere) — four-feature positioning
- Login page (`/login`) — Google OAuth, optional `login_hint` via `?hint=` URL param, calls `signOut()` before `signIn()` to dodge JWT carryover
- 4-step onboarding at `/onboarding/step-1-connect`, `/step-2-city`, `/step-3-tone`, `/step-4-labels` with bundled US-cities autocomplete (~60 metros)
- 5-tab app shell under `app/(app)/`: `/dashboard`, `/metrics`, `/configuration`, `/signals`, `/settings`, plus `/profile`
- Dashboard: Greeting + MilestoneHero + 3 dismissable metric tiles + 3 config-status cards + QuickActions + RecentActivity + NPS prompt (>=10 drafts)
- Metrics: ReplyRateHero + TimeSavedChart with milestone dots + ReplyRateByLabel + MilestoneTimelineStrip
- Configuration: consolidates Tone / Labels / Scheduling cards (the old `DashboardWrapper` was deleted)
- Profile: IdentityCard, BadgeCase (top 10 + "See all" modal), MilestoneLibrary (top 5 + modal), hover-on-earned-badge sets `displayBadgeId`
- ProfileChip in sidebar: avatar with display-badge overlay, badge title bold, tier muted underneath
- Settings hub + sub-pages (Advanced, Hidden stats, Profile-legacy)
- 10 shared UI primitives under `app/components/ui/`; purple-forward design tokens (`--brand-50..900`, surface/text/label palette)
- Tier-up confetti (~80 LOC canvas, brand palette)
- FeedbackButton + ConfirmModal

**Backend / API (apps/web/app/api)**
- `auth/[...nextauth]` — Google OAuth via NextAuth v5; PrismaAdapter wrapped in `lib/adapter.ts` for idempotent Account linking
- `emails/thread-draft`, `emails/recent`, `emails/[id]` — draft/polish, dashboard preview
- `gmail/poll` + `gmail/webhook` + `scripts/poller.mjs` — polling default, Pub/Sub push optional
- `suggest-times` — Sonnet streaming scheduling reply over multi-calendar free/busy
- `labels/*` — CRUD, `preset`, `provision`, `setup-gmail`, `scan-inbox`, `back-scan`, `seed-rules`, `status`
- `preferences/{tone,scheduling,meeting-hours}`, `user/{me,preferences,extension-token,nps-postpone,ack-tier,dismiss}`
- `calendar/{google,microsoft,apple,rsvp}` — connect/disconnect + Google `schedule` writes events with Meet links
- `metrics`, `metrics/timeseries`, `metrics/by-label`
- `signals`, `signals/[id]` — scaffold (no producers yet)
- `feedback` — POST writes to `Feedback` table
- `onboarding/*` — step state
- `profile/*`, `milestones/*` — read endpoints for Profile UI
- `share/milestone/[id]` — Edge-runtime OG image generator; public `/share/milestone/[id]` page with OG meta
- `cron/awards` — nightly Vercel cron; per-user try/catch; writes `UserMilestone`, bumps `tier`, backfills the Subscribers tab in the admin sheet
- `waitlist/join` — admin-sheet write
- `geo/cities` — bundled autocomplete

**Chrome extension (apps/chrome-extension)**
- MV3, no build step; injects "Draft reply" + "Polish draft" into Gmail DOM via `content.js`
- Popup pastes HMAC token from `dharma-lake.vercel.app/settings`
- Host permissions: `mail.google.com` + `dharma-lake.vercel.app`

**Gmail add-on (apps/gmail-addon)**
- Apps Script `Code.gs` (~19KB) deployed via `clasp`
- Sidebar with tone buttons + Polish Draft; calls Dharma API with `GoogleBearer`

**Shared packages**
- `@dharma/types`, `@dharma/calendar-core`, `@dharma/providers-google` / `-outlook` / `-apple`, `@dharma/reply-generation`

**Database (Neon Postgres via Prisma, schema at repo root `schema.prisma`)**
- User (+ `firstName`, `homeCity/Lat/Lng`, `timezone`, `toneSummary`, `dismissedTiles[]`, `onboardingStep/CompletedAt`, `tier`, `lastSeenTier`, `displayBadgeId`, `cumulativeSecondsSaved`, `nextNpsPromptAt`)
- GoogleCredential, MicrosoftCredential, AppleCredential (AES-256-GCM encrypted)
- Label, LabelRule, LabelPreset (VC | PE | Legal | General | Custom), LabelMapping, ClassifiedThread
- NextAuth Account, Session, VerificationToken
- UsageEvent (token/cost)
- New for redesign: `MeetingHour`, `MilestoneDef` (with `requiredCity`), `UserMilestone`, `BadgeDef`, `UserBadge`, `Signal`, `Feedback`

**Infrastructure**
- Vercel hosting at `dharma-lake.vercel.app`; nightly cron at `/api/cron/awards` (UTC)
- Neon Postgres
- Admin Google Sheet (Waitlist / Subscribers / Debugging) via service account, auto-headered + backfilled
- Optional Google Cloud Pub/Sub for real-time Gmail push

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
| Gmail | `googleapis` v144 (Gmail API v1) | Read, label, draft, history, watch; `gmail.modify` scope |
| Calendar | Google Calendar + Microsoft Graph + Apple CalDAV (`tsdav` 2.0.11) | Free/busy + Meet links |
| Hosting | Vercel | `vercel.json` runs `prisma generate && next build` |
| OG / share cards | Vercel Edge runtime | `app/api/share/milestone/[id]` |
| Cron | Vercel cron, UTC | `/api/cron/awards` nightly |
| Chrome extension | Vanilla MV3 (no bundler) | `apps/chrome-extension/` |
| Gmail add-on | Apps Script via `clasp` | `apps/gmail-addon/Code.gs` |
| Poller | Node script `apps/web/scripts/poller.mjs` | Hits `/api/gmail/poll` on a schedule |

---

## Key files & directories worth knowing

- `apps/web/lib/adapter.ts` — wrapped PrismaAdapter; upserts Account by `(userId, provider)`. The fix at the center of the JWT-carryover saga.
- `apps/web/lib/auth.config.ts`, `auth.ts` — `signIn` callback dual guard (resolved-User email ≠ OAuth profile, JWT cookie email ≠ OAuth profile)
- `apps/web/lib/milestoneGenerator.ts` — Haiku writes 6 city-specific milestones into `MilestoneDef` the first time a user sets a new home city; cached for subsequent users
- `apps/web/lib/milestones.ts`, `milestoneResolution.ts`, `tiers.ts`, `badges.ts`, `badgeIcons.ts` — progression system, jewel-tone badge rendering, Basquiat-style Founder crown
- `apps/web/lib/adminSheet.ts` — service-account writes to Waitlist / Subscribers / Debugging tabs; auto-header + auto-backfill
- `apps/web/lib/cities.ts`, `sampleScenarios.ts` — onboarding inputs
- `apps/web/app/(app)/profile/` and `app/components/profile/` — Profile tab UI
- `apps/web/app/share/milestone/[id]/`, `app/api/share/milestone/[id]/` — public share page + Edge OG generator
- `apps/web/app/api/cron/awards/` — nightly award sweep
- `apps/web/scripts/relink-google-account.mjs` — recovery hatch when an Account row's `providerAccountId` is wrong
- `apps/web/scripts/bump-tier.mjs`, `seed-city-milestones.mjs`, `trigger-cron.mjs`, `backfill-cumulative.mjs`, `backfill-onboarding.mjs`, `inspect-user.mjs` — operational tooling

---

## Integrations & MCPs

| Integration | Purpose | Cost | Status |
|---|---|---|---|
| Vercel (hosting + functions + cron + Edge OG) | Hosts Next.js app, runs API routes, nightly cron, share-card OG | TBD (Hobby/Pro tier) | live (`dharma-lake.vercel.app`) |
| Neon (Postgres) | Primary database | TBD | live |
| Anthropic API (direct) | Haiku (classify/polish/tone/milestone-gen) + Sonnet (scheduling, toneSummary) | usage-based; tracked per-event in `UsageEvent` | live |
| Google OAuth | User login | free | live |
| Gmail API | Read inbox, apply labels, create drafts, register Watch | free (quota-limited) | live |
| Google Calendar API | Free/busy, create events with Meet | free (quota-limited) | live |
| Google Cloud Pub/Sub | Real-time Gmail push notifications | usage-based, TBD | optional (falls back to polling) |
| Google Sheets (service account) | Admin sheet: Waitlist / Subscribers / Debugging | free (quota-limited) | live |
| Microsoft Graph | Outlook calendar free/busy | free (quota-limited) | live |
| Apple iCloud CalDAV | iCloud calendar free/busy | free | live |
| Chrome Web Store | Distribution for the extension | one-time $5 developer fee | submission in review (filed 2026-04-30) |
| Google Workspace Marketplace | Distribution for the Gmail add-on | TBD | not yet listed (deployed via clasp only) |

*Source: no MCP configs found in repo; this table is generated from `.env`/`.env.local` references, the system diagram (`docs/architecture/dharma_system_diagram.md`), and the admin-sheet wiring in `lib/adminSheet.ts`.*

*Note: CLAUDE.md recommends Vercel AI Gateway with `AI_GATEWAY_API_KEY`. Current code calls Anthropic directly. Migration is still on the open-loop list.*

---

## Decisions log

- **2026-05-29 — "Logical candy" redesign closed** — Shipped the 12-step plan at `~/.claude/plans/dharma-product-logical-candy.md` plus session-added work: admin Google Sheet, share-card OG, `UserMilestone` persistence, tier-up confetti, on-demand city milestones, jewel-tone badges, NPS prompt, Profile sidebar tab. Rejected: shipping the redesign behind a feature flag — preview was clean enough to cut straight to main, and the old `DashboardWrapper` was deleted in the same pass.
- **2026-05-29 — Milestones generated per-city on demand** — First user to set a new home city triggers Haiku to write 6 city-specific milestones into `MilestoneDef`; subsequent users in that city reuse the cached rows (~$0.001 per city total). Rejected: pre-seeding all US metros (waste, and a hand-curated list outdates fast).
- **2026-05-29 — Jewel-tone palette + Basquiat-style Founder crown** — Hardcoded SVG fills (topaz, amethyst, sapphire, emerald, tanzanite, citrine) with dark strokes; Founder badge gets yellow fill + heavy black outline. Rejected: `currentColor`-driven theming — fights Tailwind purge and looks washed out on dark surfaces.
- **2026-05-29 — Display-badge picker is a hover overlay on earned badges** — Hovering an earned badge in BadgeCase shows "Display on profile"; click writes `User.displayBadgeId` and ProfileChip + IdentityCard update via prop-sync. Rejected: a separate settings page for badge selection.
- **2026-05-29 — Profile gets its own sidebar tab** — Moved off `/settings/profile` to `/profile`. Profile is high-traffic now that badges are a thing; burying it in Settings was wrong.
- **2026-05-26 — Auth.js JWT carryover fix** — Multi-day bug: `@auth/core` `handle-login.js` silently linked new OAuth grants to a stale session-cookie user, and one Account row had wrong `providerAccountId`. Fix: `lib/adapter.ts` upserts Account by `(userId, provider)`; `signIn` callback rejects mismatched emails; login page calls `signOut()` before `signIn()`; `scripts/relink-google-account.mjs` provides a recovery hatch.
- **2026-05-26 — IA: 5-tab sidebar + Profile** — Dashboard / Metrics / Configuration / Signals / Settings, plus a separate Profile tab. Replaces the previous kitchen-sink `DashboardWrapper`. Configuration consolidates Tone / Labels / Scheduling cards.
- **2026-05-26 — Admin sheet over a custom admin UI** — Waitlist + Subscribers + Debugging tabs in a service-account-writable Google Sheet, auto-headered and backfilled by the nightly cron. Rejected: building a Next.js admin route — Sheet is faster for Robbie to read and edit by hand.
- **2026-05-26 — Built-in preset labels are flat (no "Dharma/" prefix)** — Custom preset name is optional; blank = flat top-level labels.
- **2026-05-20 — Sync Inbox force-reclassifies** — Switching presets used to only affect new mail; Sync Inbox re-runs the classifier on recent threads even if previously classified.
- **2026-05-19 — Custom preset over open-ended label CRUD** — Custom preset lets a user name their own labels + Gmail folder prefix; keeps the preset rail simple.
- **2026-05-19 — Classifier prompt: decisive single-label, temperature 0** — Returning `null` too often hurt UX; new prompt forces a decisive single-label choice.
- **2026-05-19 — Metrics moved to its own tab.**
- **2026-05-19 — Industry-preset labels added (VC / PE / Legal / General).**
- **2026-05-18 — Use Arial site-wide, scope Plus Jakarta Sans to landing page.**
- **2026-05-18 — Remove em-dashes from all user-facing copy and AI prompts.**
- **2026-04-30 — Submit Chrome extension to Chrome Web Store** — Screenshots at `docs/screenshots/cws/`.
- **2026-04 — Apple Calendar uses app-specific password, not OAuth.**
- **2026-04 — Anthropic API called directly via `fetch`, no SDK.**

---

## Open loops

- [ ] Confirm Chrome Web Store review outcome (submitted 2026-04-30) — Finley
- [ ] First external user test of preset-label + Sync Inbox flow — Finley
- [ ] Verify Pub/Sub push path end-to-end (current default is the poller script) — Finley
- [ ] List Gmail add-on on Google Workspace Marketplace (currently `clasp`-only) — Finley
- [ ] Multi-account switching (GitHub-style, ProfileChip dropdown) — needs custom NextAuth session-token cookie handling (per-account tokens + active-index pointer). Deferred; Chrome profiles cover the gap.
- [ ] Migrate Anthropic calls to Vercel AI Gateway (per CLAUDE.md guidance) — still on direct `fetch`
- [ ] Stripe / subscribe action — Subscribers-tab promotion fires once an endpoint exists
- [ ] Per-thread reply rate by label — needs `ClassifiedThread` schema change
- [ ] Signal producers — Claude deal/term-sheet detection on incoming threads (Signals tab UI exists, no producers yet)
- [ ] A11y sweep — aria labels, keyboard handlers, focus rings
- [ ] Sentence-case audit across new surfaces
- [ ] Cities autocomplete expansion from ~60 metros to ~5k US cities
- [ ] Milestone-generator prompt grounding — Stanley Park / Standing Stone Trail style hallucinations occasionally slip through
- [ ] `apps/web/next-env.d.ts` is uncommitted; decide whether to ignore or commit

### Recently closed
- [x] 12-step "logical candy" product redesign (2026-05-29)
- [x] Auth.js JWT carryover bug (2026-05-26)
- [x] Admin Google Sheet (Waitlist + Subscribers + Debugging) (2026-05-26)
- [x] Onboarding flow (`/onboarding/step-1..4`) (2026-05-26)
- [x] Profile + milestones + badges system (2026-05-26..29)
- [x] Share-card OG generator at `/share/milestone/[id]` (2026-05-29)
- [x] Nightly Vercel cron at `/api/cron/awards` (2026-05-26)
- [x] Loose root screenshots / architecture files moved to `docs/` (2026-05-26)

---

## Risks & known issues

- **Chrome Web Store approval timing unknown** — submission filed April 30; no in-repo tracking of review status. Blocks public distribution.
- **Anthropic calls bypass Vercel AI Gateway** — no automatic failover, no Gateway-side observability, no easy model swap without code change.
- **`next-auth` is on a 5.0 beta** (`^5.0.0-beta.25`) — pin carefully on breaking releases. The JWT-carryover saga exposed real edges in `@auth/core`'s login handler.
- **Prisma version split** — root devDep `prisma@^6.12.0`, web app devDep + client `^5.22.0`. Confirm `prisma generate` uses the version expected at runtime.
- **Polling fallback runs as a Node script** (`scripts/poller.mjs`) — needs a host if Pub/Sub isn't wired up. Vercel cron is the natural home.
- **Cost visibility depends on `UsageEvent` writes** — any code path that forgets `logUsage` is invisible in Metrics.
- **Milestone-generator can hallucinate landmarks** — Stanley Park (wrong city) and Standing Stone Trail (does not exist) have both surfaced; prompt grounding is on the open-loop list.
- **No automated tests visible** in `apps/web` (only `scripts/test-poll.mjs` for the poller).

---

## Links

- **Live URL:** https://dharma-lake.vercel.app
- **Settings (extension token):** https://dharma-lake.vercel.app/settings
- **Share-card example:** https://dharma-lake.vercel.app/share/milestone/[id]
- **Staging:** not configured (or not documented in repo)
- **Chrome Web Store listing:** pending review (submitted 2026-04-30)
- **Admin Google Sheet:** referenced via service account in `lib/adminSheet.ts` (URL in env)
- **Redesign plan:** `~/.claude/plans/dharma-product-logical-candy.md`
- **System diagram:** `docs/architecture/dharma_system_diagram.md`
- **DB schema:** `/Users/finley/Code/Dharma Code/schema.prisma`

---

## Changelog

- **2026-05-29:** "Logical candy" redesign closed out. 5-tab IA, purple-forward design tokens + 10 UI primitives, Configuration tab, Dashboard + Metrics redesigns, 4-step onboarding, Profile + milestones + badges, Signals scaffold, Settings hub, FeedbackButton + `/api/feedback`, Sonnet 4 `toneSummary`, nightly cron at `/api/cron/awards`. Session-added: admin Google Sheet (Waitlist + Subscribers + Debugging), share-card OG generator at `/share/milestone/[id]`, `UserMilestone` persistence, tier-up confetti + `lastSeenTier`, on-demand city milestones via Haiku, jewel-tone badge rendering + Basquiat Founder crown, BadgeCase + MilestoneLibrary collapse + "See all" modals, hover-to-set `displayBadgeId`, Profile moved to its own sidebar tab, NPS prompt for users with >=10 drafts. Schema additions (all additive, `db push`): User fields + `MeetingHour`, `MilestoneDef`, `UserMilestone`, `BadgeDef`, `UserBadge`, `Signal`, `Feedback`.
- **2026-05-26:** Auth.js JWT-carryover bug fixed (`lib/adapter.ts` wraps PrismaAdapter, `signIn` dual guard, login page `signOut`-then-`signIn`, `scripts/relink-google-account.mjs` recovery hatch). Also: built-in preset labels flattened (no "Dharma/" prefix), Custom preset name optional, `gmail.modify` scope restored, Google account-linking by verified email.
- **2026-05-21:** Initial PROJECT.md superdoc generated by kuba-vault — scanned monorepo, Prisma schema, system diagram, recent git history, and CWS submission screenshots.
