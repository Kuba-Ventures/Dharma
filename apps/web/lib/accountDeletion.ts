import { prisma } from "./prisma";
import { stopGmailWatch, revokeGoogleAccess } from "./gmail";
import { removeFromUsers } from "./adminSheet";

// Result of a deletion run. Every external step is best-effort: a failure to
// stop the watch or revoke the token must NOT prevent the DB row (the source
// of all user PII) from being deleted. We record what succeeded so the API
// can log it and support can follow up on any residue.
export type DeletionReport = {
  userId: string;
  email: string | null;
  watchStopped: boolean;
  googleRevoked: boolean;
  allowlistRemoved: boolean;
  dbDeleted: boolean;
};

// Fully deletes a user and all associated data on request.
//
// Order matters: the Google credential (tokens) must be used to stop the
// Gmail watch and revoke access BEFORE the User row is deleted, because that
// delete cascades GoogleCredential away (schema.prisma onDelete: Cascade).
// Deleting the User row cascades to every child table (credentials, labels,
// classified threads, usage events, signals, feedback, sessions, accounts,
// badges, meeting hours) — see the relations on `model User`.
//
// Immediate hard delete satisfies the privacy policy's "within 30 days"
// commitment with room to spare.
export async function deleteUserAccount(userId: string): Promise<DeletionReport> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const email = user?.email ?? null;

  const report: DeletionReport = {
    userId,
    email,
    watchStopped: false,
    googleRevoked: false,
    allowlistRemoved: false,
    dbDeleted: false,
  };

  // 1. Stop Gmail push notifications (best-effort). No-op if no Google cred.
  try {
    await stopGmailWatch(userId);
    report.watchStopped = true;
  } catch (err) {
    console.warn(`[deletion] stopGmailWatch failed for ${userId}:`, err);
  }

  // 2. Revoke the Google OAuth grant so we lose all access (best-effort).
  try {
    await revokeGoogleAccess(userId);
    report.googleRevoked = true;
  } catch (err) {
    console.warn(`[deletion] revokeGoogleAccess failed for ${userId}:`, err);
  }

  // 3. Remove from the sign-in allowlist so PII leaves the sheet and the
  //    account can't re-authenticate (best-effort).
  if (email) {
    try {
      await removeFromUsers(email);
      report.allowlistRemoved = true;
    } catch (err) {
      console.warn(`[deletion] removeFromUsers failed for ${email}:`, err);
    }
  }

  // 4. Delete the User row — cascades to all child data. This is the step
  //    that actually removes the data; if it throws, the caller must surface
  //    the failure so the user knows deletion did NOT complete.
  await prisma.user.delete({ where: { id: userId } });
  report.dbDeleted = true;

  console.log(`[deletion] account deleted for ${userId} (${email}):`, report);
  return report;
}
