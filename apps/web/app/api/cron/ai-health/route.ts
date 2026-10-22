import { NextResponse } from "next/server";
import { runAiHealthCheck } from "../../../../lib/aiHealth/aiHealthJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/ai-health, every 10 minutes from vercel.json. Same
// `Authorization: Bearer <CRON_SECRET>` gate as the other cron routes.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const checkOutcomes = await runAiHealthCheck();
    console.log(
      `[ai-health] ${checkOutcomes
        .map((outcome) => `${outcome.service}=${outcome.status}${outcome.alertSent ? ` (${outcome.alertSent} alert sent)` : ""}`)
        .join(", ")}`,
    );
    return NextResponse.json({ ranAt: new Date().toISOString(), checks: checkOutcomes });
  } catch (error) {
    console.error("[ai-health] cron run failed:", error);
    return NextResponse.json({ error: "AI health check failed" }, { status: 500 });
  }
}
