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
Decided: **free + paid tiers.** Still needed:
- [ ] **Feature split:** what does the **free** tier include vs **paid**?
      (e.g. free = labeling + N drafts/day; paid = unlimited drafts + scheduling +
      priority?) This directly sizes the cost guardrails and the Stripe build.
- [ ] **Price point(s):** monthly/annual amount for the paid tier(s).
- [ ] **Free trial?** length, and does it require a card?

## 4. Ownership / accounts — unblocks the consent-screen work
- [ ] **Who holds the Google Cloud project + the `dharmaautomations.com` domain
      registrar** — Abhinav (client) or Finley (agency)? This decides who owns
      the consent-screen / brand-verification / authorized-domains lines.

## 5. Brand verification — needed before the demo video
- [ ] Confirm the **final consent-screen app name, logo, and support email** (the
      demo video and Google review require these to be locked).
- [ ] Authorized domains include `dharmaautomations.com`.

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
