import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { createGmailLabel, deleteGmailLabel, listGmailLabels } from "../../../../lib/gmail";
import { isPresetKey, uncategorizedLabelName } from "../../../../lib/labelPresets";

// Toggle the "Uncategorized" catch-all label for the user's active preset.
//   enabled:false → delete the Gmail label + mapping; no-match mail goes
//                   unlabeled again.
//   enabled:true  → recreate the Gmail label + mapping; no-match mail is tagged
//                   Uncategorized again.
// The persisted LabelPreset.uncategorizedEnabled flag is what the classifiers
// read to decide whether to apply the fallback.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (boolean) required" }, { status: 400 });
  }

  const presetRow = await prisma.labelPreset.findUnique({ where: { userId } });
  if (!presetRow || !isPresetKey(presetRow.preset)) {
    return NextResponse.json({ error: "No preset configured" }, { status: 400 });
  }

  const labelName = uncategorizedLabelName({
    preset: presetRow.preset,
    customName: presetRow.customName,
  });

  if (body.enabled) {
    // Re-add: create the Gmail label (idempotent against existing) + mapping.
    const existing = await listGmailLabels(userId);
    let gmailLabelId = existing.find((l) => l.name === labelName)?.id ?? null;
    if (!gmailLabelId) {
      const res = await createGmailLabel(userId, labelName, "gray");
      gmailLabelId = res.id;
      if (!gmailLabelId) {
        return NextResponse.json(
          { error: res.error ?? "Failed to create label in Gmail" },
          { status: 502 }
        );
      }
    }
    await prisma.labelMapping.upsert({
      where: { userId_labelName: { userId, labelName } },
      create: { userId, labelName, gmailLabelId },
      update: { gmailLabelId },
    });
    await prisma.labelPreset.update({ where: { userId }, data: { uncategorizedEnabled: true } });
    return NextResponse.json({ enabled: true, labelName });
  }

  // Delete: remove the Gmail label + mapping, then flip the flag off.
  const mapping = await prisma.labelMapping.findUnique({
    where: { userId_labelName: { userId, labelName } },
  });
  if (mapping) {
    await deleteGmailLabel(userId, mapping.gmailLabelId);
    await prisma.labelMapping.delete({ where: { userId_labelName: { userId, labelName } } });
  }
  await prisma.labelPreset.update({ where: { userId }, data: { uncategorizedEnabled: false } });
  return NextResponse.json({ enabled: false, labelName });
}
