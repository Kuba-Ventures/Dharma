# Google OAuth Restricted-Scope Verification — Compliance & Financials Checklist

**App:** Dharma Automations (www.dharmaautomations.com)
**Goal:** Move the OAuth app from "Testing / unverified" to **verified & published** so any Google user can connect, without the unverified-app warning or the 100-user cap.
**Owner of this doc:** Finley (engineering)
**Last updated:** 2026-07-05

---

## Ownership map

Two accountable owners. Claude executes the work; the named owner reviews & is answerable.

| Area | Owner | Notes |
|------|-------|-------|
| Budget approval, CASA engagement signature, legal/privacy sign-off, price point | **Abhinav Godavarthi** | Business/legal/money |
| OAuth consent screen, brand verification, authorized domains / DNS | **Abhinav Godavarthi** (confirm who holds the GCP project + registrar) | Reassign to Finley if the agency manages Dharma's infra |
| Scope audit, security pre-work + remediation, demo video, reliability/monitoring, all code builds | **Finley** | Engineering; Claude produces artifacts for review |

> Inline `**Owner:** ___` fields below default to this map unless overridden.

---

## 0. TL;DR — what we're actually applying for

We use **restricted Gmail scopes**, so the simple "CASA Tier 1 self-assessment" path does **not** apply to us. We are on the **full restricted-scope verification** path, which includes an **independent CASA security assessment (Tier 2)**. Tier 2 cannot be self-scanned — it must be done by a Google-authorized assessor, and **must be repeated every 12 months**.

| Item | Our status |
|------|-----------|
| Restricted scopes requested | `gmail.modify`, `gmail.compose` (web) + `gmail.readonly`, `gmail.compose`, add-on scopes (Gmail add-on) |
| Sensitive scopes requested | `calendar.readonly`, `calendar.events` |
| Data leaves to a third-party server? | **Yes** — Vercel backend + Anthropic API. This is what triggers the mandatory security assessment. |
| Verification tier required | **Full restricted-scope verification + CASA Tier 2** |
| Recurring obligation | Re-assessment **every 12 months** |

---

## 1. Scope inventory (confirm before submitting)

Every restricted/sensitive scope below must be justified in the consent screen and demonstrated in the demo video. Trim anything we don't actually need — fewer scopes = cheaper, faster review.

> Audit run 2026-07-05 (Claude). "Still needed?" = verified against actual source usage.

| Scope | Type | Source file | Still needed? | Notes |
|-------|------|-------------|---------------|-------|
| `gmail.modify` | Restricted | `apps/web/lib/auth.ts` | ✅ YES | `gmail.ts`: labels.list/create/delete + messages.modify |
| `gmail.compose` | Restricted | `apps/web/lib/auth.ts` | ✅ YES | `gmail.ts:459` drafts.create |
| `calendar.readonly` | Sensitive | `apps/web/lib/auth.ts` | ✅ YES | events.list in dashboard/configuration/schedule |
| `calendar.events` | Sensitive | `apps/web/lib/auth.ts` | ✅ YES | events.insert/patch/delete in `api/preferences/scheduling` + `api/calendar/rsvp` |
| `gmail.readonly` | Restricted | `apps/gmail-addon/appsscript.json` | ✅ YES | Reads drafts via REST (Code.gs:470-493) + `GmailApp.search` (Code.gs:739) |
| `gmail.compose` | Restricted | `apps/gmail-addon/appsscript.json` | ⚠️ **DROP CANDIDATE** | Add-on writes drafts ONLY via `UpdateDraftBodyAction` (needs `gmail.addons.current.action.compose`, already granted). No drafts.create/.send/createDraft found. Removing this cuts one restricted scope from the add-on's CASA footprint. Requires re-consent + a test that compose-insert still works. |
| `gmail.addons.*` | Restricted | `apps/gmail-addon/appsscript.json` | ✅ YES | Add-on runtime (execute, current.action.compose, current.message.metadata) |
| `script.external_request` | Sensitive | `apps/gmail-addon/appsscript.json` | ✅ YES | UrlFetchApp → DHARMA_API |
| `spreadsheets` | Sensitive | `apps/web/lib/adminSheet.ts` | ✅ N/A to consent | **Confirmed:** service-account JWT (`adminSheet.ts:14`), NOT on the user OAuth consent screen. No user-facing justification needed. |

- [ ] **Confirm whether the web app and the Gmail add-on share one OAuth client / GCP project or are separate.** Each restricted-scope client must be covered. **Owner:** Abhinav (holds GCP project — confirm)
- [ ] **ACTION (Finley):** Remove `gmail.compose` from `apps/gmail-addon/appsscript.json`, re-deploy the add-on (create-version + deploy -i per the pinned-deployment rule), and verify polish/generate still inserts into compose. One fewer restricted scope = cheaper/faster CASA.

---

## 2. Pre-submission requirements (free, do these first)

These block the security assessment and are the most common rejection reasons. Knock them out before spending money on CASA.

### 2.1 Brand verification (~2–3 business days)
- [ ] App name, logo, support email set on OAuth consent screen — **Owner:** ___ — **Status:** ___
- [ ] Authorized domains include `dharmaautomations.com` — **Owner:** ___
- [ ] App name on consent screen exactly matches branding — **Owner:** ___

### 2.2 Public homepage
- [ ] Homepage publicly accessible (NOT behind login) — **Owner:** ___
- [ ] Clearly describes what the app does — **Owner:** ___
- [ ] Hosted on the same domain as the privacy policy — **Owner:** ___

### 2.3 Privacy policy (highest-leverage — most rejections happen here)
- [x] Hosted on **same domain** as homepage (`apps/web/app/privacy`) — already live at /privacy
- [x] Explicitly describes how we **access, use, store, and share** Google user data
- [x] Discloses that email content is sent to **Anthropic** for AI drafting + states it's not used to train Anthropic's models
- [x] Includes Google **Limited Use** commitment language — added "Limited Use of Google User Data" section (2026-06-24)
- [x] States we do **not** use Gmail data to train generalized AI models
- [x] Scope descriptions corrected to match actual scopes (gmail.modify, gmail.compose, calendar.readonly, calendar.events)
- [x] Describes **data deletion on request** mechanism (30-day deletion, Contact section)
- [ ] **Human review:** have legal/founder approve the new Limited Use wording before submitting — **Owner:** ___
- [ ] Deploy the updated /privacy page to production — **Owner:** ___

### 2.4 In-app disclosure & Limited Use
- [ ] App is an allowed Limited-Use app type — **Owner:** ___
- [ ] Actual data handling matches what the privacy policy claims — **Owner:** ___
- [ ] User-facing disclosure shown before/at OAuth grant — **Owner:** ___

### 2.5 Demo video (unlisted YouTube)
- [ ] In English — **Owner:** ___
- [ ] Shows OAuth consent screen with correct **app name** — **Owner:** ___
- [ ] Shows **OAuth client ID** visible in the browser URL bar during grant — **Owner:** ___
- [ ] Demonstrates the functionality enabled by **each** restricted/sensitive scope — **Owner:** ___
- [ ] Shows data flow across all OAuth clients (web + add-on) if applicable — **Owner:** ___

---

## 3. CASA Tier 2 security assessment (the long pole)

- [ ] **Choose an authorized assessor** via the App Defense Alliance portal (e.g. Tugboat Logic/OneTrust, NCC Group, Bishop Fox, Leviathan) — **Owner:** ___ — **Status:** ___
- [ ] Sign engagement / scope of work — **Owner:** ___
- [ ] Assessor runs **DAST scan** against production — **Owner:** ___
- [ ] Complete **Self-Assessment Questionnaire** (OWASP ASVS controls) — **Owner:** ___
- [ ] Remediate findings — **Owner:** ___
- [ ] Receive **Letter of Assessment / Letter of Validation (LOA/LOV)** — **Owner:** ___
- [ ] Submit LOA to Google to complete verification — **Owner:** ___
- [ ] **Calendar reminder set for re-assessment in 11 months** (due before the 12-month LOA expiry) — **Owner:** ___ — **Due:** ___

### Internal security pre-work (cheaper to fix before the assessor scans)
- [x] Secrets only in Vercel env vars, none in git / `NEXT_PUBLIC_*` — **verified 2026-07-05:** no keys/PEMs/tokens in tracked files, no `.env` tracked, no secret-shaped `NEXT_PUBLIC_*`.
- [ ] HTTPS / TLS enforced everywhere — **Owner:** Finley (Vercel enforces by default; confirm no plaintext callbacks)
- [~] Dependency vulnerabilities triaged (`npm audit`) — **2026-07-05:** 7 vulns (6 moderate, 1 high), ALL transitive `uuid` via `gaxios → googleapis-common → googleapis`. Clean fix needs `googleapis` major bump (breaking) + regression test. **Owner:** Finley — do before the assessor's DAST scan.
- [ ] Auth/session handling reviewed (`apps/web/lib/auth.ts`, `middleware.ts`) — **Owner:** ___
- [x] Data-deletion-on-request flow implemented & documented — **2026-07-05:** self-serve delete at Settings → Advanced (`/api/user/delete-account` → `lib/accountDeletion.ts`): stops Gmail watch, revokes Google grant, removes allowlist row, cascade-deletes all user data. Documented in `docs/data-deletion.md`. **Owner:** Finley
- [ ] Access logging / least-privilege on data stores — **Owner:** ___

---

## 4. Submission & approval

- [ ] All scopes, justifications, video, privacy URL submitted in Google Cloud Console verification flow — **Owner:** ___
- [ ] Respond to any Google reviewer follow-ups — **Owner:** ___
- [ ] Verification approved → **publish** OAuth app — **Owner:** ___
- [ ] Confirm unverified-app warning gone in production — **Owner:** ___

---

## 5. Financials

> Google charges nothing for verification itself. The cost is the **third-party CASA assessor** (annual) plus internal time.

| Line item | Est. cost | Frequency | Actual / quoted | Owner |
|-----------|-----------|-----------|-----------------|-------|
| CASA Tier 2 assessor | ~$500–$3,000+ USD | **Annual** | ___ | ___ |
| Security remediation eng time | varies | One-time + ongoing | ___ | ___ |
| Privacy policy / legal review | varies | One-time | ___ | ___ |
| Demo video production | low / internal | One-time | ___ | ___ |
| **Total year 1** | | | ___ | |
| **Recurring annual (re-assessment)** | ~$500–$3,000+ | Annual | ___ | |

- [ ] Get **2–3 assessor quotes** before committing — prices vary widely — **Owner:** ___
- [ ] Budget approved by ___ — **Date:** ___

---

## 6. Timeline (rough)

| Phase | Est. duration |
|-------|---------------|
| Brand verification | 2–3 business days |
| Privacy policy + homepage + video prep | ~1 week |
| Pick assessor + engage | ~1 week |
| CASA scan + remediation | 2–6 weeks (depends on findings) |
| Google final review after LOA | days–weeks |
| **End-to-end** | **~1–2 months** |

---

## 7. Key facts to remember

- Restricted scopes ⇒ **annual** assessment, not one-time.
- **Tier 2 self-scan is no longer allowed** — an authorized assessor is mandatory.
- Privacy policy / Limited Use mismatch is the #1 rejection cause — get it right before submitting.
- Fewer scopes = faster, cheaper review. Drop anything unused.

### Sources
- Google — Restricted scope verification: https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- Google Cloud — Security Assessment: https://support.google.com/cloud/answer/13465431
- CASA tiers & cost overview: https://deepstrike.io/blog/google-casa-security-assessment-2025
