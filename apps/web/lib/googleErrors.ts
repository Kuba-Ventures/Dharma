// Shared detection for a failed OAuth token refresh ("invalid_grant"): the
// stored Google grant is expired or revoked — the user revoked access, or the
// OAuth client rotated (e.g. when the project moved teams). googleapis surfaces
// this when it tries to refresh a stale access token, and every calendar/Gmail
// call made with that grant then throws.
//
// Callers translate this into an actionable "reconnect" prompt (sign out and
// back in) instead of a raw `invalid_grant (400)` or a misleading
// "sync is catching up" state that will never resolve on its own.
export function isInvalidGrant(err: unknown): boolean {
  const e = err as {
    message?: string;
    response?: { data?: { error?: { message?: string } | string } };
  };
  const apiErr = e?.response?.data?.error;
  const code = typeof apiErr === "string" ? apiErr : undefined;
  return code === "invalid_grant" || e?.message === "invalid_grant";
}
