import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import {
  resolvePresetSpec,
  isPresetKey,
  HIGH_PRIORITY_NAME,
} from "../../../../lib/labelPresets";

// GET /api/metrics/by-label?days=30
// → { rows: [{ labelName, color, tagged, drafted, draftRate }], totalTagged, days }
//
// Per-label volume + draft-generation rate within the window. Reply rate
// proper (recipient actually replied) is still a v2 follow-up — that requires
// per-thread Gmail polling — but draftRate (drafts ÷ tagged) is a useful
// signal of which categories Dharma is engaging with.
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
    select: { labelName: true, draftCreated: true },
  });

  const totalTagged = threadsInWindow.length;
  const taggedBy = new Map<string, { tagged: number; drafted: number }>();
  let unlabeledTagged = 0;
  let unlabeledDrafted = 0;
  for (const t of threadsInWindow) {
    if (!t.labelName) {
      unlabeledTagged += 1;
      if (t.draftCreated) unlabeledDrafted += 1;
      continue;
    }
    const entry = taggedBy.get(t.labelName) ?? { tagged: 0, drafted: 0 };
    entry.tagged += 1;
    if (t.draftCreated) entry.drafted += 1;
    taggedBy.set(t.labelName, entry);
  }

  const rows = activeLabels.map((l) => {
    const stats = taggedBy.get(l.name) ?? { tagged: 0, drafted: 0 };
    return {
      labelName: l.shortName,
      color: l.color,
      tagged: stats.tagged,
      drafted: stats.drafted,
      draftRate: stats.tagged > 0 ? stats.drafted / stats.tagged : 0,
    };
  });

  return NextResponse.json({
    rows,
    totalTagged,
    unlabeled: { tagged: unlabeledTagged, drafted: unlabeledDrafted },
    days,
  });
}
