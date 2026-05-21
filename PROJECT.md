# Dharma
*AI-drafted Gmail replies and scheduling, wrapped in a labeled inbox.*

*Last updated: 2026-05-21 by kuba-vault*

---

## TL;DR

Dharma is a Next.js + Chrome extension + Gmail add-on stack that watches a user's Gmail, classifies incoming threads into industry-preset labels (VC, PE, Legal, General, Custom), and auto-drafts replies — including calendar-aware scheduling replies that read free/busy from Google, Microsoft, and Apple calendars. The web app is deployed at `dharma-lake.vercel.app` on Vercel; the Chrome extension is mid-submission to the Chrome Web Store as of April 30 (screenshots at repo root). Current focus is the preset-label classifier and the Sync Inbox flow that re-tags historical threads when a user switches presets. Project is in active post-MVP iteration with shipping cadence (46 commits in the last 30 days).

---

## What it is

**The problem:** Busy operators (founders, VCs, PE associates, lawyers) spend hours triaging inbox and writing routine replies — especially scheduling back-and-forth.
**The solution:** Dharma classifies each new thread into a small set of meaningful Gmail labels, drafts reply text in the user's tone, and (for scheduling threads) pulls multi-calendar availability and writes a ready-to-send reply with concrete time slots.
**The user:** Solo operators and small teams in finance/legal whose inbox is their job — primarily Robbie's network (VC/PE first, Legal next).
**The value:** Reclaim ~30-60 min/day of triage and routine writing; never miss a scheduling thread because the calendar work is already done.

---

## Status

- **Phase:** post-MVP iteration / launch prep (Chrome Web Store submission in flight)
- **Engagement manager:** self-directed (Finley)
- **Lead:** Finley
- **Cadence:** daily commits; no formal external client cadence
- **Next milestone:** Chrome Web Store approval + first external users on preset-label flow
- **Flags:** shipping

---

## Where we are right now

The preset-label classifier is the active workstream. Last week added Custom preset (user-named label set + Gmail folder prefix), expanded the color picker to Gmail's full 30-color palette, and built a Sync Inbox button that force-reclassifies recent threads when a user changes presets — so switching from VC to Legal actually re-tags the inbox instead of just affecting new mail. The classifier prompt was sharpened (temperature 0 for determinism, decisive single-label output) and made case/hyphen-insensitive after Haiku occasionally returned `"meeting"` instead of `"Meeting"`. Yesterday's fixes are mostly polish: surface Gmail label-create errors in the provision response, handle 409s when a label already exists, and use `#000000` instead of `#1d1d1d` for text on light Gmail label colors. Chrome Web Store submission was filed April 30 (multiple submission screenshots saved at repo root); status of the review is not tracked in the repo. Next concrete steps: confirm CWS approval, then exercise the full preset → sync → draft flow end-to-end with a real user.

---

## What's built

**Frontend / UI (apps/web)**
- Landing page at `/` with Plus Jakarta Sans headings; Arial elsewhere
- Login page (`/login`) → Google OAuth via NextAuth v5
- Dashboard with Tone, Scheduling, Tabs & Labels (with industry presets + Custom), and a separate Metrics tab showing per-event AI cost
- Settings page issues the HMAC extension token for the Chrome extension
- Privacy, Terms, Support static pages

**Backend / API (apps/web/app/api)**
- `auth/[...nextauth]` — Google OAuth login
- `emails/thread-draft` — generate or polish a reply for a given Gmail thread (session, HMAC, or GoogleBearer auth)
- `emails/recent` — last 10 inbox emails for dashboard preview
- `gmail/poll` + `scripts/poller.mjs` — process new Gmail messages for all users (default path)
- `gmail/webhook` — Cloud Pub/Sub push handler (optional real-time mode)
- `suggest-times` — multi-calendar free/busy + streaming Claude Sonnet scheduling reply
- `labels/*` — CRUD, `preset`, `provision`, `setup-gmail`, `scan-inbox`, `back-scan`, `seed-rules`, `status`
- `preferences/tone`, `preferences/scheduling`, `user/preferences`, `user/me`, `user/extension-token`
- `calendar/*` — connect/disconnect Google, Microsoft, Apple; Google `schedule` route creates events with Meet links
- `metrics` — cost dashboard data

**Chrome extension (apps/chrome-extension)**
- MV3, no build step; injects "Draft reply" + "Polish draft" into Gmail DOM via `content.js`
- Popup at `popup.html` for pasting the HMAC token from `dharma-lake.vercel.app/settings`
- Host permissions: `mail.google.com` + `dharma-lake.vercel.app`

**Gmail add-on (apps/gmail-addon)**
- Google Apps Script (`Code.gs`, ~19KB) deployed via `clasp`
- Sidebar panel with tone buttons (purple) and Polish Draft (gray)
- Calls Dharma API with `GoogleBearer` token

**Shared packages**
- `@dharma/types` — TimeSlot, SchedulingRequest, shared types
- `@dharma/calendar-core` — free-slot finder
- `@dharma/providers-google` / `providers-outlook` / `providers-apple` — calendar provider adapters
- `@dharma/reply-generation` — template + AI reply generators

**Database (Neon Postgres via Prisma, schema at repo root `schema.prisma`)**
- User, GoogleCredential, MicrosoftCredential, AppleCredential (AES-256-GCM encrypted)
- Label + LabelRule, LabelPreset (VC | PE | Legal | General | Custom), LabelMapping, ClassifiedThread
- NextAuth Account/Session/VerificationToken
- UsageEvent for token/cost tracking

**Infrastructure**
- Vercel hosting at `dharma-lake.vercel.app`
- Neon Postgres (referenced in system diagram as the DB)
- Optional Google Cloud Pub/Sub topic for real-time Gmail push

---

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Monorepo | npm workspaces | `apps/*` + `packages/*`, Node >=20 |
| Frontend | Next.js 16.2.1 (App Router) + React 18.3 + Tailwind 3.4 | `apps/web` |
| Auth | NextAuth v5 beta + `@auth/prisma-adapter` | Google OAuth; HMAC tokens for extension; GoogleBearer for add-on |
| Database | PostgreSQL via Prisma 5.22 client (root devDep Prisma 6.12) | `schema.prisma` at repo root |
| AI — classify/polish/tone | Claude Haiku (`claude-haiku-4-5-20251001`) | Raw `fetch` to Anthropic API, no SDK |
| AI — scheduling reply | Claude Sonnet (`claude-sonnet-4-20250514`) streaming | `/api/suggest-times` |
| Gmail | `googleapis` v144 (Gmail API v1) | Read, label, draft, history, watch |
| Calendar | Google Calendar API + Microsoft Graph + Apple CalDAV (`tsdav` 2.0.11) | Free/busy aggregation |
| Hosting | Vercel | `vercel.json` runs `prisma generate && next build` |
| Chrome extension | Vanilla MV3 (no bundler) | `apps/chrome-extension/` |
| Gmail add-on | Google Apps Script via `clasp` | `apps/gmail-addon/Code.gs` |
| Poller | Node script `apps/web/scripts/poller.mjs` | Hits `/api/gmail/poll` on a schedule |

---

## Integrations & MCPs

| Integration | Purpose | Cost | Status |
|---|---|---|---|
| Vercel (hosting + functions) | Hosts Next.js app, runs API routes | TBD (Hobby/Pro tier) | live (`dharma-lake.vercel.app`) |
| Neon (Postgres) | Primary database | TBD | live |
| Anthropic API (direct) | Claude Haiku (classify/polish/tone) + Claude Sonnet (scheduling) | usage-based; tracked per-event in `UsageEvent` | live |
| Google OAuth | User login | free | live |
| Gmail API | Read inbox, apply labels, create drafts, register Watch | free (quota-limited) | live |
| Google Calendar API | Free/busy, create events with Meet | free (quota-limited) | live |
| Google Cloud Pub/Sub | Real-time Gmail push notifications | usage-based, TBD | optional (falls back to polling) |
| Microsoft Graph | Outlook calendar free/busy | free (quota-limited) | live |
| Apple iCloud CalDAV | iCloud calendar free/busy | free | live |
| Chrome Web Store | Distribution for the extension | one-time $5 developer fee | submission in review (filed 2026-04-30) |
| Google Workspace Marketplace | Distribution for the Gmail add-on | TBD | not yet listed (deployed via clasp only) |

*Source: no MCP configs found in repo; this table is generated from `.env`/`.env.local` references, the system diagram (`dharma_system_diagram.md`), and Chrome Web Store screenshots at the repo root.*

*Note: CLAUDE.md recommends Vercel AI Gateway with `AI_GATEWAY_API_KEY`. Current code calls Anthropic directly (raw `fetch` to `api.anthropic.com`). Migrating to AI Gateway is a candidate cleanup — not yet done.*

---

## Decisions log

- **2026-05-20 — Sync Inbox force-reclassifies** — Switching presets used to only affect new mail; users couldn't tell their preset change had worked. Decision: Sync Inbox re-runs the classifier on recent threads even if previously classified. Rejected: a separate "re-classify" action — would have added a second button for the same intent.
- **2026-05-19 — Custom preset over open-ended label CRUD** — Added Custom preset that lets a user name their own labels + Gmail folder prefix. Rejected fully-freeform label editor for now: keeping users on the preset rail simplifies the classifier prompt and color picker.
- **2026-05-19 — Classifier prompt: decisive single-label, temperature 0** — Returning `null` too often hurt UX. New prompt forces decisive single-label choice; `null` only as last resort. Temperature 0 for determinism. Rejected multi-label preset classification: legacy `classifyEmailLabels` still supports it for the free-form label list flow, but preset flow is single-label.
- **2026-05-19 — Metrics moved to its own tab** — Dashboard was getting busy. Decision: dedicated Metrics tab for cost/usage charts.
- **2026-05-19 — Industry-preset labels added (VC / PE / Legal / General)** — Replaces generic defaults so the classifier has meaningful categories out of the box.
- **2026-05-18 — Use Arial site-wide, scope Plus Jakarta Sans to landing page** — Originally Jakarta everywhere; readability suffered in dashboard tables.
- **2026-05-18 — Remove em-dashes from all user-facing copy and AI prompts** — Em-dashes read as "written by AI." Stripped server-side from AI replies too.
- **2026-04-30 — Submit Chrome extension to Chrome Web Store** — Filed publisher account + listing. Screenshots of the submission flow saved at repo root (`cws-*.png`) for future reference.
- **2026-04 — Apple Calendar uses app-specific password, not OAuth** — Apple does not offer OAuth for CalDAV. App-specific password is stored AES-256-GCM encrypted using `APPLE_CREDENTIAL_ENCRYPTION_KEY`.
- **2026-04 — Anthropic API called directly via `fetch`, no SDK** — Keeps the dependency surface small; trivial to swap models. Tradeoff: not using AI Gateway yet (see Risks).

---

## Open loops

- [ ] Confirm Chrome Web Store review outcome (submitted 2026-04-30) — Finley
- [ ] List Gmail add-on on Google Workspace Marketplace (currently `clasp`-only)
- [ ] Decide whether to migrate Anthropic calls to Vercel AI Gateway (per CLAUDE.md guidance) — Finley
- [ ] Verify Pub/Sub push path end-to-end (current default appears to be the poller script)
- [ ] First external user test of preset-label + Sync Inbox flow
- [ ] `apps/web/next-env.d.ts` is uncommitted; decide whether to ignore or commit
- [ ] Many uncommitted screenshots (`cws-*.png`, `dharma-*.png`) and `dharma_arch.py` / `dharma_system_diagram.md` are at repo root — decide if these belong in `/docs` or `.gitignore`

---

## Risks & known issues

- **Chrome Web Store approval timing is unknown** — submission filed April 30; no in-repo tracking of review status. Blocks public distribution.
- **Anthropic calls bypass Vercel AI Gateway** — CLAUDE.md recommends AI Gateway for model routing. Current code hardcodes `api.anthropic.com`. Means no automatic model failover, no Gateway-side observability, no easy model swap without code change.
- **`next-auth` is on a 5.0 beta** (`^5.0.0-beta.25`) — fine for now; pin carefully on breaking releases.
- **Prisma version split**: root devDep `prisma@^6.12.0`, web app devDep + client `^5.22.0`. Confirm `prisma generate` uses the version expected at runtime to avoid schema drift.
- **Polling fallback runs server-side as a Node script** (`scripts/poller.mjs`) — needs to be hosted somewhere if Pub/Sub isn't wired up in production. Vercel cron is the natural home (CLAUDE.md notes cron runs in UTC against production URL).
- **Cost visibility depends on `UsageEvent` writes** — if a code path forgets to call `logUsage`, that cost is invisible in the Metrics dashboard.
- **No automated tests visible** in `apps/web` (only `scripts/test-poll.mjs` for the poller).

---

## Links

- **Live URL:** https://dharma-lake.vercel.app
- **Settings (extension token):** https://dharma-lake.vercel.app/settings
- **Staging:** not configured (or not documented in repo)
- **Chrome Web Store listing:** pending review (submitted 2026-04-30)
- **System diagram:** `/Users/finley/Code/Dharma Code/dharma_system_diagram.md`
- **DB schema:** `/Users/finley/Code/Dharma Code/schema.prisma`

---

## Changelog

- **2026-05-21:** Initial PROJECT.md superdoc generated by kuba-vault — scanned monorepo (apps/web, apps/chrome-extension, apps/gmail-addon, packages/*), Prisma schema, system diagram, recent git history (46 commits in 30 days), and CWS submission screenshots.
