# Dharma Roadmap: pass Google restricted-scope verification and open Dharma to the public

*Owner: Finley · Started: 2026-10-02 · Status: live for an invite-only cohort, public launch blocked on Google verification and CASA · last verified against the code, merged PRs, and production 2026-10-02 · dates are PR merge dates (US Eastern), commit dates where there was no PR, or the date an item first entered PROJECT.md or a repo doc*

## What this is

Dharma (Dharma Automations) watches a user's Gmail, sorts threads into preset labels (VC, PE, Legal, General, Personal, Custom), and drafts replies in the user's tone, including calendar-aware scheduling replies over Google, Microsoft, and Apple free/busy. The audience is operators whose inbox is the job: VC and PE first, then Legal. It is a paying client's product (client owner: Abhinav Godavarthi). Stack: Next.js 16 web app (`apps/web`) with NextAuth v5 beta and Prisma on Neon Postgres, a Gmail add-on in Apps Script (`apps/gmail-addon`), shared packages under `packages/`, Claude for classification and drafting, Vercel hosting and crons at `www.dharmaautomations.com`.

### Status legend

- [ ] not started · [~] in progress · [x] done
- Tags: **(design)** **(build)** **(growth)** **(compliance)**
- ⚠️ = critical path

## Timeline

- **2026-03-25** · First commit ("init"); the web app, reply generation, and calendar packages land the same day
- **2026-03-26** · Gmail inbox monitoring plus Google, Outlook, and Apple calendar integrations (e686dab, 899a561)
- **2026-04-24** · Gmail add-on enters the repo (91a2e47)
- **2026-04-30** · Chrome extension submitted to the Chrome Web Store (PROJECT.md Decisions log)
- **2026-05-29** · "Logical candy" redesign closes: five-tab IA, four-step onboarding, milestones and badges, admin Google Sheet
- **2026-06-03** · Supervised PR factory installed; auto-merge stays off (#3)
- **2026-06-15** · Chrome extension retired; production moves to `www.dharmaautomations.com`; add-on repointed (9793a9b, 1395fc2)
- **2026-06-22** · Auto-labeling outage after the domain move fixed; `*/30` poll cron fallback and renewal alerts added (#10, #11)
- **2026-07-05** · Go-public track starts: AI cost caps (#15), self-serve deletion (#14), signup flag (#17), CASA checklist (#18), and the Abhinav decision doc with the free plus paid tier decision (#19)
- **2026-07-06** · Limited Use privacy copy (#16) and security headers with a report-only CSP (#24) merge
- **2026-07-08** · Onboarding v2 lands behind a per-user pinned flow, default off (#30 to #40, last merged 2026-07-09)
- **2026-07-13** · "All set but no labels" onboarding bug root-caused and fixed; back-scan fills ~75 threads (#42 to #44)
- **2026-07-27** · Pivot to simplification: gamification removed end to end (#52 to #55)
- **2026-07-30** · Metrics folds into the Dashboard, leaving three tabs (#101); verification epic opened at 11 of 100 Google grants used (#98)
- **2026-07-31** · Scheduling replies corrected across eight PRs (#104 to #111); first refresh-token rotation fix (#115)
- **2026-08-03** · Every Gmail call routed through `makeAuthForUser` (#117); CASA scope audit corrected (#118); npm audit 14 to 6 (#119); Smart Labeling ships (#121)
- **2026-08-04** · Smart Labeling failures isolated from core labeling (#123), the last product code merge to date
- **2026-10-02** · `ROADMAP.md` added (#128); stale issues #99 and #122 closed; a fresh `npm audit` finds 6 production findings, 1 critical in `next`

## Stage 0: Core product (done, 2026-03-26 to 2026-07-31)

- [x] **2026-05-29** · **(build)** Google OAuth login and onboarding (`apps/web/lib/auth.ts`, `apps/web/app/onboarding/`)
- [x] **2026-06-22** · **(build)** Labeling pipeline: Pub/Sub webhook as the primary path, `*/30` poll cron as the fallback, daily watch renewal (`apps/web/app/api/gmail/webhook`, `apps/web/app/api/gmail/poll`, `apps/web/vercel.json`, Kuba-Ventures/Dharma#10)
- [x] **2026-03-26** · **(build)** Tone-matched drafting and scheduling replies over multi-calendar free/busy (`packages/reply-generation`, `packages/calendar-core`, `packages/providers-google`, `-outlook`, `-apple`)
- [x] **2026-07-31** · **(build)** Gmail add-on with an adaptive draft-and-rewrite compose card (`apps/gmail-addon`, Kuba-Ventures/Dharma#116)
- [x] **2026-07-05** · **(build)** AI cost and abuse caps on every AI path, tiered free vs paid (`apps/web/lib/aiGuard.ts`, `apps/web/lib/aiLimits.ts`, Kuba-Ventures/Dharma#15)
- [x] **2026-07-05** · **(compliance)** Self-serve account and data deletion (`apps/web/lib/accountDeletion.ts`, `docs/data-deletion.md`, Kuba-Ventures/Dharma#14)
- [x] **2026-06-03** · **(build)** Supervised PR factory; auto-merge stays off until `FACTORY_AUTOMERGE` is set (`.github/workflows/factory.yml`, Kuba-Ventures/Dharma#3)

## Stage 1: Simplify and stabilize (done, 2026-07-28 to 2026-08-04)

- [x] **2026-07-30** · **(design)** Gamification removed (milestones, tier ladder, badge case, share cards); app collapsed to three tabs: Dashboard, Configuration, Profile & Settings (Kuba-Ventures/Dharma#52 through #57, #101)
- [x] **2026-08-03** · **(build)** Auto-labeling no longer dies hours after login: rotated refresh tokens persisted, every Gmail call routed through `makeAuthForUser` (Kuba-Ventures/Dharma#115, #117)
- [x] **2026-07-31** · **(build)** Scheduling reply correctness: all visible calendars, relative dates from the sent date, Eastern day window, no past times, named decline, working hours (Kuba-Ventures/Dharma#104 through #111)
- [x] **2026-07-28** · **(build)** Self-maintaining scheduling blocks and a reconnect prompt for dead calendar grants (Kuba-Ventures/Dharma#89 through #97)
- [x] **2026-08-04** · **(build)** Smart Labeling: learn sender-to-label associations and re-apply them, with DB failures isolated from core labeling (`apps/web/lib/smartLabels.ts`, Kuba-Ventures/Dharma#121, #123)

## Stage 2: Google verification and CASA Tier 2 (in progress, 2026-07-05 to present) ⚠️

Without this, Dharma stays capped at 100 lifetime Google grants (11 used as of Kuba-Ventures/Dharma#98) and shows the "unverified app" warning. Full checklist: `docs/casa-verification-checklist.md`; client decisions: `docs/abhinav-questions.md`.

- [x] **2026-07-06** · **(compliance)** Privacy policy with Limited Use and Anthropic disclosures, code merged (`apps/web/app/privacy/page.tsx`, Kuba-Ventures/Dharma#16)
- [x] **2026-08-03** · **(compliance)** Scope audit: add-on `gmail.compose` confirmed required, not droppable (Kuba-Ventures/Dharma#118)
- [x] **2026-08-03** · **(compliance)** npm audit cut from 14 to 6 findings, remaining ones dev-only per PROJECT.md (Kuba-Ventures/Dharma#119)
- [x] **2026-07-06** · **(compliance)** Security headers and a report-only CSP (`apps/web/next.config.ts`, Kuba-Ventures/Dharma#24)
- [x] **2026-07-05** · **(compliance)** Demo video script written (`docs/demo-video-script.md`, Kuba-Ventures/Dharma#18)
- [ ] **added 2026-07-05** · ⚠️ **(compliance)** Abhinav approves the CASA budget and signs an assessor SOW. The verification clock cannot start before this. (Kuba-Ventures/Dharma#19)
- [~] **started 2026-07-06** · ⚠️ **(compliance)** Abhinav's legal sign-off on the Limited Use wording, then confirm it is live in production (Kuba-Ventures/Dharma#16; the wording was live on production `/privacy` when checked 2026-10-02, sign-off not yet recorded)
- [ ] **added 2026-06-22** · ⚠️ **(compliance)** Confirm the OAuth consent screen is "In production", not Testing (Testing expires refresh tokens every 7 days)
- [ ] **added 2026-07-05** · **(compliance)** Brand verification, authorized domain, and in-app disclosure at the OAuth grant (`docs/casa-verification-checklist.md` section 2, Kuba-Ventures/Dharma#18)
- [ ] **added 2026-07-05** · **(compliance)** Record the demo video (Kuba-Ventures/Dharma#18)
- [ ] **added 2026-10-02** · **(compliance)** Fix the production npm audit findings: 6 as of 2026-10-02, including 3 critical advisories against `next` 16.2.12 (PROJECT.md Open loops)
- [ ] **added 2026-07-30** · **(compliance)** Confirm the residual npm audit findings with the assessor's DAST scan (Kuba-Ventures/Dharma#100)
- [ ] **added 2026-07-05** · **(compliance)** Assessor DAST scan, self-assessment questionnaire, remediation, letter of validation submitted to Google (Kuba-Ventures/Dharma#18)

## Stage 3: Launch readiness (next, 2026-06-22 to present)

- [ ] **added 2026-08-29** · **(build)** Soak `ONBOARDING_V2`, turn it on for new users, delete the v1 step routes (`apps/web/lib/onboardingFlow.ts`; both flows are still in `apps/web/app/onboarding/`)
- [ ] **added 2026-06-22** · **(build)** Set `OPS_ALERT_WEBHOOK_URL` in production so watch and poll failures page out
- [ ] **added 2026-07-06** · **(build)** Move the CSP from report-only to enforcing once reports are clean
- [ ] **added 2026-06-22** · **(build)** Re-auth users still carrying orphaned refresh tokens from the OAuth client change
- [ ] **added 2026-07-29** · **(design)** Rework the Recent Activity dashboard view and remove "Worth your attention" (Kuba-Ventures/Dharma#96)
- [ ] **added 2026-07-05** · **(growth)** Turn on `SELF_SERVE_SIGNUP` after verification (`docs/self-serve-signup.md` says not before, Kuba-Ventures/Dharma#17)

## Stage 4: Billing (blocked on a client decision, 2026-05-29 to present)

- [ ] **added 2026-07-05** · **(growth)** Abhinav approves the free vs paid feature split and price points (Kuba-Ventures/Dharma#19)
- [ ] **added 2026-05-29** · **(build)** Stripe billing on the existing `planForUser()` seam (no Stripe code exists in the repo today)

## Stage 5: Later (2026-05-26 to present)

- [ ] **added 2026-08-29** · **(design)** UI to review, correct, or forget Smart Labeling associations (none exists today)
- [ ] **added 2026-05-29** · **(build)** `cold_thread` signal detector (needs a cron sweep) and `pattern_shift` (needs a `ContactBaseline` table) (`apps/web/lib/signalDetector.ts`)
- [ ] **added 2026-05-29** · **(build)** Signal confirm and dismiss feedback endpoints (TODO in `apps/web/lib/signalDetector.ts`)
- [ ] **added 2026-07-13** · **(build)** Historical backfill beyond the ~75-thread back-scan target
- [ ] **added 2026-05-26** · **(build)** Multi-account switching (deferred; Chrome profiles cover it for now)
- [ ] **added 2026-06-03** · **(build)** Turn on `FACTORY_AUTOMERGE` after a supervised soak (Kuba-Ventures/Dharma#3)

## Open questions

- Has anything moved on CASA budget, assessor, or legal sign-off since 2026-08-30? Nothing in the repo records it as of 2026-10-02, and no product code has merged since 2026-08-04.
- Is the consent screen in production mode?
- Kuba-Ventures/Dharma#99 (drop `gmail.compose` from the add-on) was cancelled by Kuba-Ventures/Dharma#118, and Kuba-Ventures/Dharma#122 (harden learned-label lookup) looks fixed by Kuba-Ventures/Dharma#123 (`resolveLearnedLabels` now degrades to `[]`). Both are still open. Close them? **Answered 2026-10-02:** yes, both closed as completed.
- Has `prisma db push` been run in production for the `LearnedLabel` table? The Vercel build only runs `prisma generate && next build`.
- How many of the 100 Google grants are used today? (11 as of 2026-07-30, per Kuba-Ventures/Dharma#98)
