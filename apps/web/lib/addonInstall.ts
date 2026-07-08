import { prisma } from "./prisma";

// The Gmail add-on authenticates with `Authorization: GoogleBearer <token>` and
// only ever hits the add-on API routes (thread-draft, classify, tone[/sync],
// rsvp, user/preferences) — it never calls /api/user/me. So the first
// GoogleBearer-authenticated request IS the "add-on is installed and in use"
// signal. Call markAddonInstalled(userId) from those routes' GoogleBearer path
// to stamp User.addonInstalledAt once; the install nudges read it and stop.
//
// Idempotent by construction: updateMany with an addonInstalledAt: null guard
// writes exactly once and no-ops on every subsequent call, so it's safe to fire
// (and forget) on every add-on request without an extra read.
export async function markAddonInstalled(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, addonInstalledAt: null },
    data: { addonInstalledAt: new Date() },
  });
}
