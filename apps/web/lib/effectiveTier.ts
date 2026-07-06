import { tierFor, isComp } from "./tiers";
import { sheetTierForEmail } from "./adminSheet";

// The tier to DISPLAY for a user: the higher of what they've earned (from
// cumulative seconds) and any admin comp set in the Users sheet's Tier column,
// read live with a ~60s cache. This mirrors the awards cron's comp-up rule, so
// a comp set in the sheet shows on the dashboard/profile within ~60s instead of
// waiting for the nightly run. A same/lower/blank sheet value has no effect.
export async function effectiveTier(
  cumulativeSecondsSaved: number,
  email: string | null | undefined,
): Promise<string> {
  const earned = tierFor(cumulativeSecondsSaved);
  const override = await sheetTierForEmail(email);
  return isComp(earned, override) ? override : earned;
}

// Whether the user has an admin comp: a sheet Tier set above what they've
// earned. Shares the ~60s-cached Users-tab read behind sheetTierForEmail, so
// it's not a Sheets API hit per call. Used by the AI guard to grant comped
// users paid limits (see lib/aiGuard.ts). Fails open to `false` (no comp) when
// the sheet is unreachable, matching effectiveTier's fail-open behavior.
export async function isComped(
  cumulativeSecondsSaved: number,
  email: string | null | undefined,
): Promise<boolean> {
  const earned = tierFor(cumulativeSecondsSaved);
  const override = await sheetTierForEmail(email);
  return isComp(earned, override);
}
