import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import {
  resolvePresetSpec,
  isPresetKey,
  HIGH_PRIORITY_NAME,
} from "../../../../lib/labelPresets";

// GET /api/metrics/by-label?days=30
// → { rows: [{ labelName, color, tagged, share }], totalTagged, days }
//
// Per-label volume within the window. `share` is the label's portion of all
// labeled volume (rows sum to ~100%) — a distribution view of which categories
// dominate. (A draft-generation rate lived here previously but depended on
// per-thread draft tracking that didn't reliably link up, so it always read
// 0%; volume share is computed straight from the counts and is exact.)
//
// The label set is resolved from the user's active LabelPreset via
// resolvePresetSpec — the SAME source the classifier uses to write
// ClassifiedThread.labelName (the full prefixed name, e.g. "KV/Internal").
// The legacy Label table is not consulted: it can hold stale rows from a
// previous preset whose names no longer match what gets tagged, which is why
// reading it produced an active-label list that never matched any count.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const url = new URL(req.url);
  const days = Math.min(
    Math.max(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 1),
    365,
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Resolve the active label set the same way the classifier does. Each label
  // carries the full prefixed `name` (matches ClassifiedThread.labelName) and a
  // `shortName` for display. High-Priority is a secondary tag that's never the
  // primary matched label, so it would always read 0 — drop it from the chart.
  const presetRow = await prisma.labelPreset.findUnique({ where: { userId } });
  const spec =
    presetRow && isPresetKey(presetRow.preset)
      ? resolvePresetSpec({
          preset: presetRow.preset,
          customName: presetRow.customName,
          customLabels: presetRow.customLabels,
          includeUncategorized: presetRow.uncategorizedEnabled,
        })
      : null;
  const activeLabels = (spec?.labels ?? [])
    .filter((l) => l.shortName !== HIGH_PRIORITY_NAME)
    .map((l) => ({ name: l.name, shortName: l.shortName, color: l.displayHex }));

  // Group classified threads by labelName within the window.
  const threadsInWindow = await prisma.classifiedThread.findMany({
    where: { userId, classifiedAt: { gte: since } },
    select: { labelName: true },
  });

  const totalTagged = threadsInWindow.length;
  const taggedBy = new Map<string, number>();
  for (const t of threadsInWindow) {
    if (!t.labelName) continue;
    taggedBy.set(t.labelName, (taggedBy.get(t.labelName) ?? 0) + 1);
  }

  const counted = activeLabels.map((l) => ({
    labelName: l.shortName,
    color: l.color,
    tagged: taggedBy.get(l.name) ?? 0,
  }));
  // Share is each label's portion of total *labeled* volume, so the rows sum
  // to ~100% (threads tagged under old/retired labels aren't shown and fall
  // outside this denominator).
  const labeledTotal = counted.reduce((sum, r) => sum + r.tagged, 0);
  const rows = counted.map((r) => ({
    ...r,
    share: labeledTotal > 0 ? r.tagged / labeledTotal : 0,
  }));

  return NextResponse.json({ rows, totalTagged, labeledTotal, days });
}
