# Google verification demo video — shot-by-shot script

**Purpose:** the unlisted YouTube video Google requires for restricted-scope
verification (CASA checklist §2.5). It must prove, on camera, that every
requested scope maps to a real user-facing feature.

**Owner:** Finley (record) · **Reviewer:** Abhinav
**Length target:** 3–5 minutes · **Language:** English narration (required)

## Hard requirements (Google will reject the video if any are missing)

- [ ] English narration or captions throughout.
- [ ] The OAuth **consent screen** is shown, with the app name **exactly**
      matching the verified brand ("Dharma" / "Dharma Automations" — match
      whatever is set on the consent screen).
- [ ] The **OAuth client ID** is **visible in the browser URL bar** during the
      grant (don't cut away from the `accounts.google.com/o/oauth2/...` URL —
      the `client_id=` param must be legible; pause/zoom on it).
- [ ] **Every** restricted/sensitive scope is demonstrated doing real work.
- [ ] Both OAuth clients are covered if separate: the **web app** and the
      **Gmail add-on**. (Confirm with Abhinav whether they share one GCP
      project — if separate, each needs its consent screen + client ID shown.)
- [ ] Use a **real test Google account**, not a dev bypass.

## Scope → feature crosswalk (say each scope name out loud on screen)

| Scope | Type | Prove by showing… |
|-------|------|-------------------|
| `gmail.modify` | Restricted | Dharma applying a label to an inbox thread + marking read |
| `gmail.compose` | Restricted | Generating an AI draft reply that lands in Gmail Drafts |
| `calendar.readonly` | Sensitive | Dharma reading the calendar to suggest/return real times |
| `calendar.events` | Sensitive | Confirming a scheduling action that creates/updates an event |
| add-on: `gmail.readonly` | Restricted | Sidebar reading the open thread to draft a reply |
| add-on: `gmail.addons.*`, `script.external_request` | Restricted/Sensitive | The sidebar UI itself + its call to the Dharma backend |

> Note: `gmail.compose` on the **add-on** is flagged for removal (unused — the
> add-on inserts via `UpdateDraftBodyAction`). If it's already removed before
> recording, do **not** show or mention it for the add-on. Confirm the live
> add-on's scope set matches the consent screen before recording.

---

## Scene-by-scene

### 0. Intro (15s)
- On camera: the public homepage at `www.dharmaautomations.com`.
- Narrate: "This is Dharma, an AI email assistant for Gmail that labels your
  inbox, drafts replies in your voice, and helps you schedule meetings. I'll
  show how each Google permission we request is used."

### 1. Sign-in + consent (45s) — **the critical shot**
- Click **Sign in with Google**.
- On the `accounts.google.com` consent screen: **pause**. Narrate the app name
  shown. **Zoom the URL bar** so `client_id=` is readable; hold ~3s.
- Read the requested scopes aloud as they appear on the consent screen.
- Grant access; land on the dashboard.

### 2. `gmail.modify` — labeling + inbox writes (45s)
- Open the dashboard / Configuration → Labels.
- Trigger **Sync Inbox** (or show a recently auto-labeled thread).
- Cut to Gmail: show the **label now applied** to the thread, and a message
  marked read. Narrate: "gmail.modify lets Dharma apply labels and update
  message state — it never deletes mail."

### 3. `gmail.compose` — AI drafting (45s)
- On a thread, click **Generate draft** (web) — show the draft text produced.
- Cut to Gmail **Drafts**: show the reply saved as a draft. Narrate:
  "gmail.compose lets Dharma create draft replies. Drafts are never sent
  automatically — the user reviews and sends."

### 4. `calendar.readonly` — reading availability (30s)
- Open Configuration → Scheduling (or the schedule view).
- Show Dharma pulling **real upcoming events / free-busy** and proposing times.
  Narrate: "calendar.readonly lets Dharma read your calendar to find open
  slots."

### 5. `calendar.events` — creating/updating an event (45s)
- Confirm a scheduling action (the block-off-time / accept flow that calls
  `events.insert`/`patch`).
- Cut to Google Calendar: show the **new/updated event** on the calendar.
  Narrate: "calendar.events lets Dharma create or update events only when you
  confirm the action."

### 6. Gmail add-on (60s) — if a separate OAuth client
- Open Gmail → the **Dharma add-on sidebar** on an open message.
- If the add-on has its own consent screen, show that grant too (URL bar +
  client ID again).
- In the sidebar: generate a reply for the open thread (shows
  `gmail.readonly` reading the thread + `script.external_request` calling the
  Dharma backend + the draft inserted into the compose box).
- Narrate the add-on scopes as they're exercised.

### 7. Limited Use + data control (30s)
- Show the `/privacy` page's **Limited Use** section briefly.
- Show **Settings → Advanced → Delete account** (the self-serve deletion).
  Narrate: "Users can delete all their data at any time, and email content sent
  to our AI provider is never used to train models." (Do not actually delete
  the demo account until the end.)

### 8. Close (15s)
- Recap: "Every scope we request maps directly to a feature you just saw."

---

## Pre-record checklist
- [ ] Test account seeded with a few inbox threads + a couple of calendar events.
- [ ] Consent screen app name/logo/support email finalized (brand verification).
- [ ] Live add-on scope set confirmed (esp. the `gmail.compose` removal).
- [ ] Screen recording at ≥1080p; URL bar legible; no personal data of real users.
- [ ] Upload as **unlisted** YouTube; paste the link into the Google Cloud
      Console verification request and into the CASA checklist.
