import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// Public health check for external uptime monitors (Better Uptime, Cronitor,
// Pingdom, etc.). Verifies the app can reach its database — the dependency that
// takes the whole product down if it's gone. Returns 200 {ok:true} or 503
// {ok:false}. Deliberately minimal: no auth, no internal details leaked beyond
// pass/fail per check.
//
// Not cached — an uptime monitor needs the live state on every poll.
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {};
  let ok = true;

  // Database reachability. A cheap round-trip; if this throws, the app is down.
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "fail";
    ok = false;
  }

  // Admin-sheet config presence (env only — no Sheets API call on the hot path).
  // Informational: the app still serves if the sheet is misconfigured, so this
  // does not flip the overall status.
  checks.adminSheetConfigured = process.env.ADMIN_SHEET_ID ? "ok" : "fail";

  return NextResponse.json(
    { ok, checks, ts: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
