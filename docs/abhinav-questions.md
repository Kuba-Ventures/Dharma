# Decisions & confirmations needed from Abhinav

Everything blocking the public launch that isn't code. Grouped by urgency. The
top three (CASA budget, assessor, pricing) are on the critical path — the
Google verification clock can't start without the first two.

## 1. CASA budget approval — **critical path, do first**
Google restricted-scope verification requires an independent **CASA Tier 2**
security assessment by a Google-authorized assessor. Recurs **every 12 months**.
- [ ] **Approve the budget:** ~**$500–$3,000+/yr** for the assessor (varies a lot
      by vendor), plus internal remediation time. Google charges nothing itself.
- [ ] Confirm **who pays** (client vs agency) and the PO/invoice process.
- [ ] OK to get **2–3 competitive quotes** before committing?

## 2. Pick a CASA assessor — **critical path**
- [ ] Choose from the App Defense Alliance authorized list (e.g. Tugboat
      Logic/OneTrust, NCC Group, Bishop Fox, Leviathan). Finley will source
      2–3 quotes; **Abhinav signs the engagement / SOW.**
- [ ] Any procurement/security-review constraints on which vendor we can use?

## 3. Pricing / monetization — unblocks Stripe (#7)
Decided: **free + paid tiers.** To turn this from an open question into a
yes/no, here's a **proposed split** to react to (not final — edit freely):

### Proposed free vs paid split

| Capability | Free | Paid |
|---|---|---|
| Inbox auto-labeling | ✅ included | ✅ included |
| AI draft replies | **10 / day** | Unlimited\* |
| Draft tones | Concise only | **All** (My Tone, Formal/Legal, Casual, Scheduling) |
| Tone learning ("My Tone" from sent mail) | 1 initial sync | Re-sync anytime |
| Scheduling (suggest times + create calendar events) | ❌ | ✅ |
| High-signal email detection | ❌ | ✅ |
| Metrics / badges / time-saved | ✅ | ✅ |

\* "Unlimited" stays within the abuse guardrails already shipped
(`AI_PAID_*` env). Free maps to the existing `AI_FREE_*` caps (≈60 AI
actions/day, $0.75/day) — so **auto-labeling for free users is already
cost-bounded**; no separate labeling cap needed.

**Rationale:** labeling is the hook (keep it free to drive adoption); drafting,
all-tones, scheduling, and signals are the daily-value features people will pay
for. This split maps cleanly onto the `planForUser()` seam already in the code —
Stripe just flips a user free↔paid.

### Decisions needed
- [ ] **Approve or edit the split above** (esp. whether scheduling/signals are
      paid-only, and the free draft/day number).
- [ ] **Price point(s):** monthly + annual for the paid tier (a common starting
      point is ~$12–20/mo or ~$99–199/yr — your call; the number doesn't block
      the build, only the checkout config).
- [ ] **Free trial?** length, and does it require a card?

## 4. Ownership / accounts — unblocks the consent-screen work
- [ ] **Who holds the Google Cloud project + the `dharmaautomations.com` domain
      registrar** — Abhinav (client) or Finley (agency)? This decides who owns
      the consent-screen / brand-verification / authorized-domains lines.

## 5. Brand verification + demo video — needed for Google review
- [ ] Confirm the **final consent-screen app name, logo, and support email** (the
      demo video and Google review require these to be locked).
- [ ] Authorized domains include `dharmaautomations.com`.

### Demo video (the script is written and ready to record)
Google requires an unlisted demo video showing every requested scope in action.
The **full shot-by-shot script is in `docs/demo-video-script.md`** — please skim
it and confirm the plan. It runs ~3–5 min and will show:

1. Sign-in + the OAuth **consent screen** (with the client ID visible in the URL
   bar — a hard Google requirement).
2. `gmail.modify` — applying a label to an inbox thread.
3. `gmail.compose` — generating an AI draft reply into Gmail Drafts.
4. `calendar.readonly` — reading availability to suggest times.
5. `calendar.events` — confirming a scheduling action that creates an event.
6. The Gmail add-on sidebar (reads the thread, drafts a reply).
7. The Limited Use policy + self-serve account deletion.

- [ ] **Review the demo plan** in `demo-video-script.md` (approve or flag anything).
- **Blocked on:** the brand assets above being final, and the add-on
  `gmail.compose` removal (item #8) — both must be settled before recording so
  the video matches the live consent screen. Finley records once unblocked.

## 6. Legal sign-off on the privacy policy — unblocks PR #16
- [ ] **Approve the "Limited Use of Google User Data" wording** in PR #16 so it
      can be un-drafted, merged, and deployed. (Privacy/Limited-Use mismatch is
      the #1 verification rejection cause — it must be right before we submit.)

## 7. Support channel — required for CASA + data-deletion requests
- [ ] Confirm the **public support email**, that it's **monitored**, and by whom.
      It must be reachable by strangers and handle deletion requests. (Self-serve
      deletion now exists in-app, but a support path is still required.)

## 8. Gmail add-on scope removal — OK to proceed?
- [ ] The add-on requests `gmail.compose` (a **restricted** scope) but doesn't
      use it — removing it means **one fewer restricted scope** to justify in
      CASA. It requires re-deploying the add-on and users re-consenting.
      **OK to remove?** (Finley executes.)

---

### Fastest unblock
If Abhinav can green-light **#1 (budget)** and **#6 (privacy sign-off)** today,
we can start the assessor process (the long pole) and ship the privacy policy in
parallel. #3 (pricing) can follow — it doesn't block verification, only billing.
