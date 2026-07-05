# Data deletion on request

Dharma gives users a self-serve way to permanently delete their account and all
associated data, satisfying the Google Limited Use "delete on request" and the
privacy policy's ≤30-day deletion commitment. Deletion is **immediate and hard**
(no soft-delete / retention window), which comfortably beats the 30-day promise.

## How a user deletes their account

1. **Settings → Advanced → Delete account** (`/settings/advanced`).
2. Click **Delete my account**, type `DELETE` to confirm, then **Permanently delete**.
3. On success the user is signed out and returned to the homepage.

## What happens (server-side)

`POST /api/user/delete-account` (requires an authenticated session and
`{ confirm: "DELETE" }`) calls `deleteUserAccount()` in
`apps/web/lib/accountDeletion.ts`, which runs, in order:

1. **Stop the Gmail watch** — `stopGmailWatch()` calls `gmail.users.stop`, so
   Google stops sending inbox push notifications. (best-effort)
2. **Revoke the Google OAuth grant** — `revokeGoogleAccess()` revokes the
   refresh token, so Dharma loses all Gmail/Calendar access. (best-effort)
3. **Remove from the sign-in allowlist** — `removeFromUsers()` deletes the
   user's row from the admin sheet's Users tab, removing their PII from the
   sheet and preventing re-authentication. (best-effort)
4. **Delete the `User` row** — cascades (`onDelete: Cascade` in `schema.prisma`)
   to every child table: Google/Microsoft/Apple credentials, labels + rules,
   label presets/mappings, classified threads, usage events, meeting hours,
   milestones, badges, signals, feedback, sessions, and accounts.

Steps 1–3 are best-effort and logged; only step 4 (the actual data removal) is
allowed to fail the request. If step 4 fails the user is told to contact
support so it can be completed manually.

## Manual / support-assisted deletion

If a user emails support instead of using the in-app flow, an operator can run
`deleteUserAccount(userId)` (or delete the User row directly — the cascade does
the rest) after verifying identity. The support address is published on the
privacy policy and support pages.

## Notes for the CASA assessor

- No user email content is persisted beyond transient processing; the DB stores
  labels/classifications/usage metadata, all removed by the cascade.
- Google tokens live only in `GoogleCredential`, revoked in step 2 and removed
  by the cascade in step 4.
