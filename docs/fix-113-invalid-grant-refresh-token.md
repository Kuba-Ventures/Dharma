# Fix #113 — Recurring `invalid_grant` (~hourly) breaking drafting + auto-labeling

- **Issue:** [#113](https://github.com/Kuba-Ventures/Dharma/issues/113)
- **PR:** [#115](https://github.com/Kuba-Ventures/Dharma/pull/115) (merged to `main`, commit `8ee0009`)
- **Severity:** High — broke AI drafting and auto-labeling for the paying client until manual re-login.
- **Area:** Auth layer (Google OAuth token refresh). Escalation surface per `CLAUDE.md` — never auto-merged.

## Symptom

`POST /api/emails/thread-draft` returned **502 `invalid_grant`** on `gmail.threads.get` roughly **one hour after each manual Dharma re-login**. Auto-labeling stopped in the same window (it runs on the same Google grant).

```
[thread-draft] gmail.threads.get failed: invalid_grant threadId: <…>
```

The tell: it worked for ~1 hour after every login, then died until the next manual login.

## Root cause

`makeAuthForUser` (`apps/web/lib/gmail.ts`) is the shared OAuth client behind every Gmail call and most Calendar calls (thread-draft, auto-labeling, classify, drafts, RSVP, metrics, …). Its `googleapis` `"tokens"` refresh handler persisted the refreshed **access token** and **expiry** but **silently dropped a rotated `refresh_token`**:

```js
// before
auth.on("tokens", async (tokens) => {
  await prisma.googleCredential.update({
    where: { userId },
    data: {
      accessToken: tokens.access_token ?? cred.accessToken,
      expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3_600_000),
      // ← refresh_token was never saved
    },
  });
});
```

Google **rotates the refresh token on every refresh while the OAuth client is in "Testing" publishing status**, invalidating the previous refresh token. So the stored token went stale after the very first refresh.

### Why exactly ~1 hour

1. **Login** → fresh access token (valid ~1h) + refresh token `RT1` stored.
2. **For that hour** → no refresh needed, everything works.
3. **At ~1h** → `googleapis` refreshes with `RT1`. Google returns a new access token **and a rotated `RT2`**. We saved the access token but **not `RT2`**; `RT1` is now dead.
4. **Next refresh** → uses the stale `RT1` → **`invalid_grant`**. Drafting + labeling break until a manual re-login, which only buys one more access-token lifetime.

The issue's "consent screen in Testing mode" hypothesis was directionally right but the wrong timescale — not the 7-day *grant* expiry, but per-refresh *token rotation* under Testing mode.

## The fix

`apps/web/lib/gmail.ts` — persist `tokens.refresh_token` whenever Google returns one, and never let a persistence failure escape the event emitter:

```js
// after
auth.on("tokens", async (tokens) => {
  try {
    await prisma.googleCredential.update({
      where: { userId },
      data: {
        accessToken: tokens.access_token ?? cred.accessToken,
        // A plain access-token refresh omits refresh_token, so only overwrite
        // when Google actually sends a new (rotated) one.
        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3_600_000),
      },
    });
  } catch (err) {
    console.error("[gmail] Failed to persist refreshed Google token:", err);
  }
});
```

- The guard `...(tokens.refresh_token && { refreshToken })` preserves the stored token on a plain access-token refresh and only overwrites when Google actually rotates.
- The `try/catch` prevents a DB hiccup from surfacing as an unhandled rejection out of the emitter (the in-memory client still holds the fresh tokens).

## Tests

`apps/web/lib/gmail.tokenRefresh.test.ts` — drives the `"tokens"` handler and asserts three paths:

1. A rotated `refresh_token` is persisted.
2. A refresh that omits `refresh_token` leaves the stored token untouched.
3. A persistence failure is swallowed (logged) rather than thrown from the emitter.

Full suite green (232 tests / 34 files); typecheck clean on changed files.

## Deploy & verification

- Deployed via Vercel production auto-deploy from `main`. Confirm commit `8ee0009` shows **Ready / Production** in Vercel → Deployments.

### One-time prerequisite

Every already-connected user's stored refresh token is **already the dead one** — the fix stops future drift but cannot resurrect a token Google already invalidated. **Each affected user must sign out and back in once** to seed a fresh refresh token the fixed code will then keep rotating.

### Decisive test (fast, ~2 min, needs DB access)

The old bug always worked for the first ~hour, so a valid test must cross a token refresh. Force it instead of waiting:

1. Sign out / sign back in on production (seeds a good token).
2. Set the test user's `GoogleCredential.expiresAt` to the past → generate a draft. Forces refresh #1: Google rotates, the fix persists the new token → succeeds.
3. Set `expiresAt` to the past **again** → generate another draft. Refresh #2 now uses the **persisted rotated** token.
   - Before the fix: `invalid_grant` (still using the stale original).
   - After the fix: succeeds. ✅

### Natural test (no DB, ~1.5–2 h)

1. Sign out / sign back in.
2. Wait ~90 min without re-logging in.
3. Generate an AI draft and confirm auto-labeling tagged new inbox mail (poll cron runs every 30 min).
4. Success = drafting + labeling work with no `502 invalid_grant`.

Log signature that should no longer recur after a refresh cycle:

```
[thread-draft] gmail.threads.get failed: invalid_grant
```

## Related / out of scope

- The same refresh-token-drop pattern exists in `createCalendarEvent`'s `onTokenRefresh` callback (`apps/web/lib/calendar.ts`) — its signature can't carry a refresh token — but that function currently has **no callers**, so it was intentionally left out of this fix. Close it off if that path is ever wired up.
