import { tierFor, isComp } from "./tiers";
import { sheetTierForEmail } from "./adminSheet";

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
