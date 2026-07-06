# Self-serve signup

The switch that turns Dharma from an invite-only allowlist into a public,
anyone-can-sign-up product. Gated by a single env flag, default **OFF**.

## How it works

The sign-in gate in `apps/web/lib/auth.ts` (`signIn` callback) checks
`isSubscriber(email)` against the admin sheet's **Users** tab:

- **`SELF_SERVE_SIGNUP` unset / not `"true"`** (default): a user not on the
  Users allowlist is rejected — the current invite-only behavior.
- **`SELF_SERVE_SIGNUP="true"`**: a user not on the allowlist is
  **auto-provisioned** via `provisionUser(email)` — appended to the Users tab
  (`tier=Apprentice`, `started_at=now`, note `self-serve signup`), their
  Waitlist row is marked converted, and sign-in proceeds. The Prisma adapter
  creates the DB user as usual.

`provisionUser` is best-effort and busts the 60s subscriber cache so a retry
within the window doesn't create a duplicate row.

## ⚠️ Do not enable before verification

Turning this on does **not** by itself make the app public — Google OAuth is
still in "Testing" mode with a **100-user cap** and an unverified-app warning
until restricted-scope verification + CASA clear (tasks #1/#2). Flipping the
flag before then just lets sign-ups pile into that 100-user cap.

**Correct launch order:** verification clears → publish the OAuth app → confirm
cost guardrails (`AI_*` env) are live → set `SELF_SERVE_SIGNUP=true`.

## Rollback

Unset `SELF_SERVE_SIGNUP` (or set to anything but `"true"`). Already-provisioned
users remain on the allowlist; new non-allowlisted sign-ins are rejected again.
