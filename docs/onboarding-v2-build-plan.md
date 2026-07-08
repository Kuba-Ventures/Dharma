# Onboarding v2 — Build Plan

*Status: implementation plan, reviewed via `/plan-eng-review` (architecture + code quality + tests + performance + outside voice). Decisions below are locked. Derived from the "Onboarding v2 — Quiz + Gmail-first redirect" scoping doc, reconciled against the code on branch `chore/labels-editor-auth-prompt-tour-copy` (HEAD `331b0c0`).*
*Owner: Finley. Every stage is escalate-to-human per `CLAUDE.md` merge policy. No auto-merge.*

---

## 0. Corrections to the scoping doc (read first)

The scoping doc was written against a stale mental model. These assumptions are wrong and reshape the work from "greenfield build" to "restructure of an existing flow":

1. **Onboarding is already a 5-step server-persisted wizard** (`step-1-connect → step-2-city → step-3-tone → step-4-labels → step-5-install`, `StepShell` chrome, per-step persistence to `User`, resume-on-refresh working). The dashboard is already the *end* reward gated on `User.onboardingCompletedAt` (`apps/web/app/(app)/layout.tsx:45-54`), not the entry point. v2 re-sequences + re-themes this wizard.
2. **The `LabelsCard` editable-label editor is already committed on the current branch** (`331b0c0`), not uncommitted WIP on `fix/tier-ladder-comp`. Build on the current-branch editor.
3. **`toneSummary` is gated off in alpha** (`ENABLE_SONNET_COPY`, `api/preferences/tone/sync/route.ts:205-254`). The live prefill field is `User.toneProfile`. Tone prefill already works via step-3's `POST /api/preferences/tone/sync` (reads 15 sent emails on `gmail.modify`); we're relocating it, not building it.

---

## 1. Locked architecture decisions (from review)

These supersede any looser phrasing elsewhere in this doc.

### 1.1 Schema — three new nullable fields
`db push` (this repo has no versioned migrations). All additive + nullable → safe, no data migration.

```prisma
model User {
  // ...
  role            String?     // human-facing role taxonomy; maps to PresetKey via lib/rolePresets.ts
  addonInstalledAt DateTime?  // stamped on first GoogleBearer add-on call; drives nudge state
  onboardingFlow   String?    // 'v1' | 'v2' — pinned at onboarding entry; layouts route by THIS, not the env flag
}
```
Even though additive-nullable is low-risk, capture the `prisma migrate diff` SQL in the PR description for a rollback reference, and run `db push` against a preview/branch DB before prod. `db push` leaves no migration artifact — the SQL diff in the PR is the substitute.

### 1.2 `role` vs. label `preset`
`User.role` is a richer human taxonomy (VC / PE / Legal / Founder-Operator / Personal / Other — final list is open Q1). It maps to a `PresetKey` (`labelPresets.ts:10`) via a **single module** `lib/rolePresets.ts` that exports the role list, `roleToPresetKey()`, AND the selector display metadata the quiz renders. It imports the `PresetKey` type from `labelPresets.ts` so the compiler catches drift. `role` is an independent profile signal; the label `preset` is separately editable and may intentionally diverge once a user overrides labels — `preset` wins for labeling, `role` is retained for future draft personalization.

### 1.3 Step re-sequence (reuse wizard plumbing)

| New step | Route | Purpose | Prefill / source |
|---|---|---|---|
| 1. Connect | `step-1-connect` (unchanged) | Confirm Gmail+Calendar credential | — |
| 2. Quiz | new `step-2-quiz` | Name (prefill), **Role (required — only hard gate)**, City (geo-guess, confirm) | name ← OAuth `profile`; city ← Vercel IP header (§1.6); role ← asked |
| 3. Personalize | `step-3` (evolve `step-3-tone`) | Tone (prefilled from sync), Labels (role-derived, override via shared `<LabelEditor>`). **Provision + run 25-thread sync here** with a "labeling your inbox…" progress state | tone ← `tone/sync`; labels ← `roleToPresetKey` |
| 4. Land in inbox | new `step-4-inbox` | Primary CTA enabled only after the 25-sync 200s; add-on link (non-blocking) | — |

Only **role** hard-gates. Name/tone/city are prefill-and-confirm and skippable (all editable later in Settings/Profile).

### 1.4 Back-scan — callable core + `waitUntil` continuation (the "labeled inbox")
Locked mechanism (the original "chained HTTP fetch" is dead: `back-scan/route.ts` auths via `auth()` session cookie, is not in `middleware.ts`'s add-on allowlist, and `waitUntil` doesn't grant a fresh function budget):

```
Personalize "Continue":
  POST /api/labels/preset      (persist chosen/derived preset)
  POST /api/labels/provision   (create Gmail labels + LabelMappings)  ← REQUIRED before any scan
  POST /api/labels/back-scan   (tranche 1: 25 threads, SYNC, awaited)
      route.ts wraps auth(), then calls the extracted core:
        scanCore({ userId, pageToken: null, limit: 25 }) → returns { pageToken }
      response 200 → enable "Open my inbox"
      waitUntil( scanCore({ userId, pageToken, limit: 25 }) )   ← tranche 2 (26–50), IN-PROCESS
```

- **Refactor** `back-scan/route.ts` into a callable `scanCore({ userId, pageToken, limit })`; the route handler is a thin `auth()` wrapper around it. The `waitUntil` continuation calls `scanCore` directly (same process — no internal HTTP, no cookie, no service token).
- **Thread `pageToken`** through `gmail.users.messages.list` (today it caps at `MAX_THREADS` with no pagination). Tranche 1 returns the `pageToken`; tranche 2 resumes from it.
- **Raise `maxDuration`** on this path to ~120s (Fluid Compute) so the `waitUntil` continuation survives — two ~45s tranches ≈ 90s, under the 2-minute target.
- **Skip `detectAndPersistSignal`** during the onboarding scan (pass a flag) to protect the budget; live classification detects signals afterward.
- Keep the existing `BUDGET_MS` partial-success guard per tranche.
- `MAX_THREADS`/`CONCURRENCY` become env-tunable; a perf spike confirms the numbers.

### 1.5 Redirect / completion atomicity
Client awaits `advance{complete:true}` and navigates to Gmail **only on 200**; non-200 → stay on closing screen with retry + error. Because the 25-sync already completed on Personalize, step-4 has no stall. Fresh navigation to Gmail shows the labels (an already-open Gmail tab would not live-refresh — this is why the sync must finish *before* arrival, and why we navigate rather than assume the user's existing tab updates).

### 1.6 City geo-guess — full-match-only
`lib/geoGuess.ts` (pure) reads `x-vercel-ip-city` + `x-vercel-ip-country-region` and resolves against `cities.ts`. It prefills the picker **only on a full city-record match** (with coords + timezone). No match → leave the field empty for the user to type (same validated `findCityByName` path). It **never** writes a coordless city — `homeCityLat/Lng/timezone` seed milestones + scheduling, so a null-coord write silently breaks both. Browser geolocation stays out (`next.config.ts:14-17` denies it).

### 1.7 Add-on install detection — GoogleBearer, not `/me`
Verified: `apps/` has only `gmail-addon` + `web` (no `chrome-extension`), and the add-on authenticates with `Authorization: GoogleBearer` to `thread-draft` / `tone` / `classify` / `rsvp` — it **never** calls `/api/user/me` (which only accepts a Dharma `Bearer` extension token). Stamp `addonInstalledAt` (one-time, `waitUntil`) inside the **shared `GoogleBearer` `resolveUserId` path** those routes use — the add-on's real first-contact signal. Nudges (dismissible banner + one email + driver.js tour) read `addonInstalledAt` and stop once set. `/api/user/me` stays a pure read.

### 1.8 Flow-version pinning + dead-route gating
Stamp `User.onboardingFlow` when a user first enters onboarding. **Both** `(app)/layout.tsx` and `onboarding/layout.tsx` select the `stepUrls` array by that stamp (not the ambient `ONBOARDING_V2` env flag) and route by `onboardingStep` within it. In-flight v1 users finish v1; only users who START after the flag get v2. `onboarding/layout.tsx` today only checks completion, so it must also gate: a v2-pinned user hitting a stale `/onboarding/step-2-city` URL is redirected to their correct v2 step. Remove the v1 step dirs once the flag is soaked.

### 1.9 Rate/usage contention
Kick `tone/sync` (15 sent + 1 Haiku, ~10-20s) and **let it finish before** starting the 50-thread label scan — don't run both model-bound flows concurrently. Exempt the onboarding back-scan from the per-user AI usage guard (`checkAiGuard`) or give it a separate budget, so a new user's own one-time scan can't 429 them mid-onboarding.

### 1.10 Shared `<LabelEditor>` (DRY)
Extract the editable-label rows + `ColorPickerDot` from `LabelsCard.tsx` into a shared `<LabelEditor>` both the quiz Personalize step and the config card render, and drop the client `COLOR_ROWS` mirror (`LabelsCard.tsx:35-39`) in favor of importing `GMAIL_COLOR_ROWS` from `lib/gmail.ts`. Do this as a **structural-only Stage 0** commit (make-the-change-easy, then make-the-easy-change), gated by **characterization tests pinning current `LabelsCard` behavior** first — it's a shipped, in-production settings surface.

---

## 2. OAuth / scopes — unchanged
Same scopes (`openid, email, profile, gmail.modify, gmail.compose, calendar.readonly, calendar.events`), same "no forced consent" (dropped in `331b0c0`). **No new scopes** — DOB/birthday stays dropped (protects CASA). `gmail.compose` is still requested; dropping it is a separate initiative. Confirm tone sent-mail reads are covered by the Limited-Use privacy copy (#16) before shipping.

---

## 3. Endpoint changes

### New
- `lib/rolePresets.ts` (pure) — role list + `roleToPresetKey` + selector metadata (§1.2).
- `lib/geoGuess.ts` (pure) — header → matched city-record | null (§1.6).

### Modified
- `back-scan/route.ts` — extract `scanCore({userId, pageToken, limit})`; add `pageToken`; `skipSignals` flag; raise `maxDuration`; env-tunable `MAX_THREADS`/`CONCURRENCY` (§1.4).
- `advance/route.ts` — persist `role` (derive+persist `LabelPreset`), stamp `onboardingFlow` at entry, keep `complete:true` completion stamp.
- The shared `GoogleBearer` `resolveUserId` path — one-time `addonInstalledAt` stamp (§1.7).
- `provision` + `preset` — unchanged signatures; called in order on Personalize before the scan (§1.4).

### Unchanged
- `/api/user/me` (stays a pure read), `tone/sync`, `auth.ts`.

---

## 4. Tests (vitest for logic, gstack /qa for flows)

- **Pure helpers (low-risk-eligible, mirror `labelPresets.test.ts`):** `rolePresets` (every role → valid `PresetKey`; unknown → default), `geoGuess` (valid header → known city; missing header → null, no throw; unmatched city → null).
- **Route logic (vitest, mock Gmail/session):** `advance` (role → preset persisted; `onboardingFlow` stamped once; `complete` stamps completion), `GoogleBearer` stamp (valid token + null → stamp once; already stamped → no write; invalid token → 401, no write), `scanCore` (pageToken offset labels 26-50; `skipSignals` skips signal writes; budget guard returns incomplete).
- **CRITICAL regression (mandatory, no deferral):** a v1 in-flight user (`onboardingStep=N`) resumes on the correct v1 step after `ONBOARDING_V2` flips; `stepUrls` index matches `onboardingFlow` in **both** layouts.
- **Characterization (Stage 0, before extraction):** pin current `LabelsCard` editing behavior so `<LabelEditor>` extraction can't regress the live settings surface.
- **Flows (gstack /qa against a preview deploy):** OAuth → quiz → labeled inbox; required-role gate; redirect-only-on-200; 50-in-2min; tone-sync <3-sent graceful skip.

Test plan artifact written to `~/.gstack/projects/Kuba-Ventures-Dharma/…-eng-review-test-plan-*.md` for `/qa` consumption.

---

## 5. Feature flag / rollout
`ONBOARDING_V2` flag decides whether *new* entrants get pinned `onboardingFlow='v2'`. Existing/in-flight users are unaffected (pinned at entry). Flip on after a supervised soak (mirrors the `FACTORY_AUTOMERGE` posture). Keep v1 routes until soaked, then remove.

---

## 6. Staged PR breakdown (one PR per stage; all escalate-to-human)

Ordered so DB + pure logic + structural refactor land before dependent surfaces.

- **Stage 0 — structural refactor:** extract shared `<LabelEditor>`, drop the palette mirror. Characterization tests first. No behavior change.
- **Stage 1 — schema + pure helpers:** add `role`, `addonInstalledAt`, `onboardingFlow`; `db push` (SQL diff in PR); `lib/rolePresets.ts` + `lib/geoGuess.ts` + unit tests.
- **Stage 2 — advance + geo + flow-pin:** persist role/derive preset, stamp `onboardingFlow`, gate both layouts by it; wire geoGuess into the quiz server component.
- **Stage 3 — quiz UI (`step-2-quiz`):** name/role/city; kick `tone/sync`.
- **Stage 4 — personalize UI (`step-3`):** tone + `<LabelEditor>`; provision + 25-sync with progress; sequence tone-before-scan.
- **Stage 5 — back-scan core:** `scanCore` refactor, `pageToken`, `skipSignals`, raised `maxDuration`, `waitUntil` tranche 2. Perf spike here.
- **Stage 6 — land-in-inbox (`step-4`):** await-200 → navigate; delete v1 step dirs; regression test.
- **Stage 7 — install stamp + nudges:** GoogleBearer stamp; banner + email + tour reading `addonInstalledAt`.
- **Stage 8 — flag flip** after soak.

---

## 7. Worktree parallelization

| Stage | Modules touched | Depends on |
|---|---|---|
| 0 LabelEditor | `components/`, `lib/gmail.ts` | — |
| 1 schema+helpers | `schema.prisma`, `lib/` | — |
| 2 advance+geo+flow | `app/api/onboarding/`, `app/(app)/`, `app/onboarding/` | 1 |
| 3 quiz UI | `app/onboarding/` | 1, 2 |
| 4 personalize UI | `app/onboarding/`, `components/` | 0, 3 |
| 5 back-scan core | `app/api/labels/` | 1 |
| 6 land-in-inbox | `app/onboarding/`, `app/(app)/` | 4, 5 |
| 7 install+nudges | `lib/` (GoogleBearer path), `components/` | 1 |

**Parallel lanes:** Lane A = Stage 0 (independent). Lane B = Stage 1 → 5 (back-scan, shares only `lib/`). Lane C = Stage 1 → 2 → 3 → 4 (onboarding UI, shared `app/onboarding/`, sequential). Launch A + (1) together; then B and C in parallel worktrees; Stage 6 waits on B+C; Stage 7 after 1. **Conflict flag:** Stages 2/3/4/6 all touch `app/onboarding/` — keep them in one lane (sequential), do not parallelize against each other.

---

## 8. Failure modes (new codepaths)

| Codepath | Realistic failure | Test? | Error handling? | User sees |
|---|---|---|---|---|
| `scanCore` tranche 2 (`waitUntil`) | Function killed at `maxDuration` before 50 done | qa 50-in-2min | partial-success guard | Top 25 labeled; rest via live classify (not silent — counts returned) |
| Redirect on completion | `advance` 500s, client navigates anyway | qa redirect-on-200 | await 200, retry | Error + retry on closing screen (not stranded) |
| geoGuess partial match | Coordless city written → milestones don't seed | unit geoGuess | full-match-only guard | Empty city field to type (no silent null) |
| GoogleBearer stamp | Stamp on every call (guard missing) | unit stamp-once | `if null` guard + `waitUntil` | Nudges stop correctly once installed |
| Flow cutover | v2 user resumes on v1 step | **CRITICAL regression** | flow-pin in both layouts | Correct step (no wrong-screen) |
| tone/sync <3 sent | 422 shown as "tone" | qa graceful-skip | catch → default tone | Default tone, editable later (no crash) |
| tone/sync + scan concurrency | Shared AI guard 429s mid-onboarding | (manual/qa) | sequence + guard exemption | Both complete (no 429) |

**No critical gaps** (each failure has a test AND error handling AND is user-visible or benign) — provided the flow-pin regression test and the geoGuess full-match guard ship as specified.

---

## 9. NOT in scope (deferred, with rationale)
- **Whole-inbox historical relabel** past the ~50-thread front page — optional open loop; live classification handles the rest.
- **DOB / birthday scope** — dropped; any birthday scope hurts CASA.
- **Silent/one-click add-on install for individuals** — Google-hosted consent, admin-only for domain-wide; impossible per-user.
- **Arbitrary hex label colors** — Gmail fixed palette only.
- **Dropping `gmail.compose`** — separate initiative; not entangled with onboarding.
- **Draft personalization from `role`** — `role` is captured now, consumed later; no v1 reader.
- **Playwright E2E harness** — using gstack /qa instead; revisit if CI-gated E2E becomes necessary.

## 10. What already exists (reused, not rebuilt)
- 5-step wizard plumbing (`StepShell`, per-step persistence, `onboardingStep`/`onboardingCompletedAt`) — reused, re-sequenced.
- Tone prefill (`tone/sync` → `toneProfile`) — reused as-is.
- Label preset data + resolver (`labelPresets.ts`) — reused; `rolePresets.ts` maps onto it.
- Editable-label editor + Gmail palette choke point (`LabelsCard`, `resolveGmailColor`, `GMAIL_COLOR_ROWS`) — extracted to `<LabelEditor>`, not duplicated.
- Back-scan classify/apply loop, `BUDGET_MS` guard, `ClassifiedThread` upsert — reused; refactored to `scanCore`.
- City data + validated lookup (`cities.ts`, `findCityByName`, `/api/geo/cities`) — reused; geoGuess feeds it.
- GoogleBearer `resolveUserId` path — reused as the install-detection hook.

## 11. Open questions for the owner
1. **Role taxonomy final list** (VC / PE / Legal / Founder-Operator / Personal / Other) + each → `PresetKey` mapping (esp. Founder-Operator, Other).
2. **Gmail deep-link format** — `authuser=<email>` vs `u/<index>`; confirm it resolves for Workspace accounts.
3. **Backfill `role` for existing users** from current `LabelPreset`? Only needed once draft-personalization reads `role`.
4. **Confirm tone sent-mail read is covered by Limited-Use copy (#16)** before shipping.

---

## Implementation Tasks
Synthesized from this review's findings. Each derives from a specific finding.

- [ ] **T1 (P1, human: ~3h / CC: ~25min)** — labels — extract shared `<LabelEditor>` + drop palette mirror, behind characterization tests
  - Surfaced by: Code Quality Issue 6 / outside-voice #8
  - Files: `apps/web/app/components/configuration/LabelsCard.tsx`, new `components/LabelEditor.tsx`, `apps/web/lib/gmail.ts`
  - Verify: characterization tests green before + after; vitest
- [ ] **T2 (P1, human: ~2h / CC: ~15min)** — schema — add `role`, `addonInstalledAt`, `onboardingFlow` (nullable); `db push` with SQL diff in PR
  - Surfaced by: Architecture Issues 3, 4 / §1.1
  - Files: `schema.prisma`
  - Verify: `prisma generate`; preview DB push
- [ ] **T3 (P1, human: ~2h / CC: ~15min)** — lib — `rolePresets.ts` (roles+mapping+metadata, imports `PresetKey`) + `geoGuess.ts` (full-match-only) + unit tests
  - Surfaced by: Code Quality Issue 5, Architecture Issue 9
  - Files: `apps/web/lib/rolePresets.ts`, `apps/web/lib/geoGuess.ts`, `*.test.ts`
  - Verify: `vitest run`
- [ ] **T4 (P1, human: ~4h / CC: ~30min)** — back-scan — refactor to `scanCore({userId,pageToken,limit})`, add pageToken + `skipSignals`, raise `maxDuration`, `waitUntil` tranche 2
  - Surfaced by: Architecture Issue 1 (revised) / Perf Issue 7 / outside-voice #3
  - Files: `apps/web/app/api/labels/back-scan/route.ts`
  - Verify: qa 50-in-2min on preview; vitest scanCore
- [ ] **T5 (P1, human: ~3h / CC: ~25min)** — onboarding — pin `onboardingFlow`; gate BOTH layouts by it; regression test
  - Surfaced by: Architecture Issue 3 / outside-voice #7
  - Files: `apps/web/app/(app)/layout.tsx`, `apps/web/app/onboarding/layout.tsx`, `apps/web/app/api/onboarding/advance/route.ts`
  - Verify: vitest stepUrls regression
- [ ] **T6 (P1, human: ~4h / CC: ~35min)** — onboarding — quiz + personalize UI; provision + 25-sync progress gate; sequence tone-before-scan
  - Surfaced by: Architecture Issues 2, 8 / Perf / outside-voice #2, #4, #5
  - Files: `apps/web/app/onboarding/step-2-quiz/`, `step-3/`, `step-4-inbox/`
  - Verify: qa flow on preview
- [ ] **T7 (P2, human: ~3h / CC: ~25min)** — add-on — stamp `addonInstalledAt` on first GoogleBearer call; banner + email + tour nudges
  - Surfaced by: Architecture Issue 4 (revised) / outside-voice #1
  - Files: GoogleBearer `resolveUserId` path, nudge components
  - Verify: unit stamp-once/no-write-when-set; qa nudge-stops
- [ ] **T8 (P2, human: ~15min / CC: ~5min)** — perf — exempt onboarding scan from per-user AI usage guard
  - Surfaced by: Perf / outside-voice #5
  - Files: `apps/web/lib/` (aiGuard call site in back-scan)
  - Verify: scan of 50 doesn't trip guard for the user

_Perf spike (Stage 5) confirms `MAX_THREADS`/`CONCURRENCY`; not a standalone task._

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run |
| Outside Voice | (Claude subagent) | Independent 2nd opinion | 1 | ISSUES_FOUND | 8 findings; 5 material (2 overturned locked decisions) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 9 issues, all resolved; 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | not run |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not run |

- **CODEX:** unavailable (not installed) — outside voice ran as a fresh-context Claude subagent.
- **CROSS-MODEL:** outside voice overturned two decisions the review had locked and both were verified against code — (1) `addonInstalledAt` on `/api/user/me` detects nothing (the Gmail add-on uses `GoogleBearer` and never calls `/me`); moved to the shared GoogleBearer resolver. (2) The chained-HTTP back-scan can't authenticate; refactored to an in-process `scanCore` + `waitUntil`. Plus 3 new confirmed gaps folded in (inbox-refresh race, geo null-coords, tone/scan rate contention).
- **UNRESOLVED:** 0 (all findings resolved into locked decisions; owner still owes the 4 product answers in §11, none of which block build sequencing).
- **VERDICT:** ENG CLEARED — architecture, tests, and perf reviewed; plan updated with all decisions. Ready to implement. Owner answers to §11 Q1 (role taxonomy) unblock Stage 1.
