import { tierFor, tierRank } from "./tiers";
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
  return tierRank(override) > tierRank(earned) ? override : earned;
}
