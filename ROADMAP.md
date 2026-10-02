# Dharma Roadmap: pass Google restricted-scope verification and open Dharma to the public

*Owner: Finley · Started: 2026-10-02 · Status: live for an invite-only cohort, public launch blocked on Google verification and CASA · last verified against the code 2026-10-02*

## What this is

Dharma (Dharma Automations) watches a user's Gmail, sorts threads into preset labels (VC, PE, Legal, General, Personal, Custom), and drafts replies in the user's tone, including calendar-aware scheduling replies over Google, Microsoft, and Apple free/busy. The audience is operators whose inbox is the job: VC and PE first, then Legal. It is a paying client's product (client owner: Abhinav Godavarthi). Stack: Next.js 16 web app (`apps/web`) with NextAuth v5 beta and Prisma on Neon Postgres, a Gmail add-on in Apps Script (`apps/gmail-addon`), shared packages under `packages/`, Claude for classification and drafting, Vercel hosting and crons at `www.dharmaautomations.com`.

### Status legend

- [ ] not started · [~] in progress · [x] done
- Tags: **(design)** **(build)** **(growth)** **(compliance)**
- ⚠️ = critical path

## Stage 0: Core product (done)

- [x] **(build)** Google OAuth login and onboarding (`apps/web/lib/auth.ts`, `apps/web/app/onboarding/`)
- [x] **(build)** Labeling pipeline: Pub/Sub webhook as the primary path, `*/30` poll cron as the fallback, daily watch renewal (`apps/web/app/api/gmail/webhook`, `apps/web/app/api/gmail/poll`, `apps/web/vercel.json`)
- [x] **(build)** Tone-matched drafting and scheduling replies over multi-calendar free/busy (`packages/reply-generation`, `packages/calendar-core`, `packages/providers-google`, `-outlook`, `-apple`)
- [x] **(build)** Gmail add-on with an adaptive draft-and-rewrite compose card (`apps/gmail-addon`, Kuba-Ventures/Dharma#116)
- [x] **(build)** AI cost and abuse caps on every AI path, tiered free vs paid (`apps/web/lib/aiGuard.ts`, `apps/web/lib/aiLimits.ts`, Kuba-Ventures/Dharma#15)
- [x] **(compliance)** Self-serve account and data deletion (`apps/web/lib/accountDeletion.ts`, `docs/data-deletion.md`, Kuba-Ventures/Dharma#14)
- [x] **(build)** Supervised PR factory; auto-merge stays off until `FACTORY_AUTOMERGE` is set (`.github/workflows/factory.yml`)

## Stage 1: Simplify and stabilize (done)

- [x] **(design)** Gamification removed (milestones, tier ladder, badge case, share cards); app collapsed to three tabs: Dashboard, Configuration, Profile & Settings (Kuba-Ventures/Dharma#52 through #57, #101)
- [x] **(build)** Auto-labeling no longer dies hours after login: rotated refresh tokens persisted, every Gmail call routed through `makeAuthForUser` (Kuba-Ventures/Dharma#115, #117)
- [x] **(build)** Scheduling reply correctness: all visible calendars, relative dates from the sent date, Eastern day window, no past times, named decline, working hours (Kuba-Ventures/Dharma#104 through #111)
- [x] **(build)** Self-maintaining scheduling blocks and a reconnect prompt for dead calendar grants (Kuba-Ventures/Dharma#89 through #97)
- [x] **(build)** Smart Labeling: learn sender-to-label associations and re-apply them, with DB failures isolated from core labeling (`apps/web/lib/smartLabels.ts`, Kuba-Ventures/Dharma#121, #123)

## Stage 2: Google verification and CASA Tier 2 (in progress) ⚠️

Without this, Dharma stays capped at 100 lifetime Google grants (11 used as of Kuba-Ventures/Dharma#98) and shows the "unverified app" warning. Full checklist: `docs/casa-verification-checklist.md`; client decisions: `docs/abhinav-questions.md`.

- [x] **(compliance)** Privacy policy with Limited Use and Anthropic disclosures, code merged (`apps/web/app/privacy/page.tsx`, Kuba-Ventures/Dharma#16)
- [x] **(compliance)** Scope audit: add-on `gmail.compose` confirmed required, not droppable (Kuba-Ventures/Dharma#118)
- [x] **(compliance)** npm audit cut from 14 to 6 findings, remaining ones dev-only per PROJECT.md (Kuba-Ventures/Dharma#119)
- [x] **(compliance)** Security headers and a report-only CSP (`apps/web/next.config.ts`, Kuba-Ventures/Dharma#24)
- [x] **(compliance)** Demo video script written (`docs/demo-video-script.md`)
- [ ] ⚠️ **(compliance)** Abhinav approves the CASA budget and signs an assessor SOW. The verification clock cannot start before this.
- [ ] ⚠️ **(compliance)** Abhinav's legal sign-off on the Limited Use wording, then confirm it is live in production
- [ ] ⚠️ **(compliance)** Confirm the OAuth consent screen is "In production", not Testing (Testing expires refresh tokens every 7 days)
- [ ] **(compliance)** Brand verification, authorized domain, and in-app disclosure at the OAuth grant (`docs/casa-verification-checklist.md` section 2)
- [ ] **(compliance)** Record the demo video
- [ ] **(compliance)** Confirm the residual npm audit findings with the assessor's DAST scan (Kuba-Ventures/Dharma#100)
- [ ] **(compliance)** Assessor DAST scan, self-assessment questionnaire, remediation, letter of validation submitted to Google

## Stage 3: Launch readiness (next)

- [ ] **(build)** Soak `ONBOARDING_V2`, turn it on for new users, delete the v1 step routes (`apps/web/lib/onboardingFlow.ts`; both flows are still in `apps/web/app/onboarding/`)
- [ ] **(build)** Set `OPS_ALERT_WEBHOOK_URL` in production so watch and poll failures page out
- [ ] **(build)** Move the CSP from report-only to enforcing once reports are clean
- [ ] **(build)** Re-auth users still carrying orphaned refresh tokens from the OAuth client change
- [ ] **(design)** Rework the Recent Activity dashboard view and remove "Worth your attention" (Kuba-Ventures/Dharma#96)
- [ ] **(growth)** Turn on `SELF_SERVE_SIGNUP` after verification (`docs/self-serve-signup.md` says not before)

## Stage 4: Billing (blocked on a client decision)

- [ ] **(growth)** Abhinav approves the free vs paid feature split and price points
- [ ] **(build)** Stripe billing on the existing `planForUser()` seam (no Stripe code exists in the repo today)

## Stage 5: Later

- [ ] **(design)** UI to review, correct, or forget Smart Labeling associations (none exists today)
- [ ] **(build)** `cold_thread` signal detector (needs a cron sweep) and `pattern_shift` (needs a `ContactBaseline` table) (`apps/web/lib/signalDetector.ts`)
- [ ] **(build)** Signal confirm and dismiss feedback endpoints (TODO in `apps/web/lib/signalDetector.ts`)
- [ ] **(build)** Historical backfill beyond the ~75-thread back-scan target
- [ ] **(build)** Multi-account switching (deferred; Chrome profiles cover it for now)
- [ ] **(build)** Turn on `FACTORY_AUTOMERGE` after a supervised soak

## Open questions

- Has anything moved on CASA budget, assessor, or legal sign-off since 2026-08-30? Nothing in the repo records it, and the last commit is 2026-08-29.
- Is the consent screen in production mode?
- Kuba-Ventures/Dharma#99 (drop `gmail.compose` from the add-on) was cancelled by Kuba-Ventures/Dharma#118, and Kuba-Ventures/Dharma#122 (harden learned-label lookup) looks fixed by Kuba-Ventures/Dharma#123 (`resolveLearnedLabels` now degrades to `[]`). Both are still open. Close them?
- Has `prisma db push` been run in production for the `LearnedLabel` table? The Vercel build only runs `prisma generate && next build`.
- How many of the 100 Google grants are used today?
