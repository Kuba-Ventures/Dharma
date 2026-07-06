# Go-Public Work Log

Running log of the work to take Dharma from invite-only (100-user testing cap)
to fully public. Newest entries at the top. Task numbers refer to the tracked
plan (see also `casa-verification-checklist.md`).

## Status at a glance (2026-07-05)

**App-side launch requirements — DONE (all merged to main):**
- ✅ Cost/abuse guardrails on all AI paths (#6, PR #15)
- ✅ Data deletion on request (#9, PR #14)
- ✅ Self-serve signup switch, flag-gated OFF (#8, PR #17)
- ✅ OAuth scope audit (#3)

**In flight:**
- 📝 Privacy Limited-Use policy (#5, PR #16) — **draft, blocked on Abhinav's legal sign-off**
- 📄 Demo-video script written (#4) — awaits a human to record
- 🟡 Security pre-work (#10) — automated pass done; `googleapis` bump remains

**The bottleneck — external, needs Abhinav:**
- ⛔ Google restricted-scope verification + CASA Tier 2 (#1/#2). Runs ~1–2
  months on Google's + an assessor's clock. Blocked until Abhinav assigns
  owners, approves the CASA budget, and picks an assessor.

**Not started (not blocking launch):**
- Stripe billing (#7) — needs the free-vs-paid feature split decision
- Reliability monitoring (#11)
- Support channel (#12)

**The launch flip, once verification clears:**
`SELF_SERVE_SIGNUP=true` + confirm `AI_*` guardrail envs are set.

---

## Log

### 2026-07-05 — Session: app-side hardening for public launch

**Shipped (merged):**
- **#14 data deletion** — `POST /api/user/delete-account` → `lib/accountDeletion.ts`:
  stops Gmail watch, revokes Google grant, removes allowlist row, cascade-deletes
  all user data. Danger Zone card in Settings → Advanced. Docs: `data-deletion.md`.
- **#15 AI guardrails** — `lib/aiGuard.ts` + `lib/aiLimits.ts`: kill switch,
  global 24h spend ceiling, per-user free/paid limits (burst + daily count +
  cost), built on existing `UsageEvent` data. Wired into 6 user AI routes (429/503)
  + classify/signal pipelines (soft-skip). `planForUser()` is the Stripe seam.
  Docs: `ai-guardrails.md`.
- **#17 self-serve signup** — `SELF_SERVE_SIGNUP` flag in `auth.ts` signIn gate;
  `provisionUser()` auto-adds to the Users allowlist + converts waitlist. Default
  OFF. Docs: `self-serve-signup.md`.

**Prepared (open / awaiting humans):**
- **#16 privacy** (draft PR) — Limited Use section, corrected scopes, calendar-event
  disclosure. Blocked on Abhinav's legal sign-off before un-drafting + deploying.
- **#4 demo-video script** — `demo-video-script.md`, shot-by-shot, covers every
  scope + the client-ID-in-URL requirement. Awaits recording.

**Findings / decisions:**
- Scope audit (#3): all web scopes justified; `spreadsheets` is a service-account
  scope (not on the user consent screen); **add-on `gmail.compose` is unused** and
  should be dropped (one fewer restricted scope for CASA).
- Security pre-work (#10): secrets clean (none in git, no `.env` tracked). `npm
  audit` = 7 vulns (6 mod, 1 high), all transitive `uuid` via `googleapis` — clean
  fix needs a breaking `googleapis` major bump + regression test (not yet done;
  risky without live Gmail/Calendar QA).
- Monetization (#7): decided **free + paid**; price TBD. Guardrails are tier-aware
  and ready; Stripe build waits on the free-vs-paid feature split.
- Owners: **Abhinav Godavarthi** = budget/legal/consent-screen/domain; **Finley**
  = engineering. Recorded in `casa-verification-checklist.md`.

**Confirmed capabilities (answering an earlier question):** Dharma can read the
calendar and **create/update/delete** events — live via `api/preferences/scheduling`
(insert/patch/delete) and `api/calendar/rsvp` (patch). Scopes `calendar.readonly`
+ `calendar.events` are granted at sign-in.
