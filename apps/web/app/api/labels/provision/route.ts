import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { createGmailLabel, listGmailLabels } from "../../../../lib/gmail";
import { LABEL_PRESETS, isPresetKey } from "../../../../lib/labelPresets";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as { preset?: string };
  const presetKey = body.preset;
  if (!presetKey || !isPresetKey(presetKey)) {
    return NextResponse.json({ error: "Invalid preset" }, { status: 400 });
  }

  const cred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!cred) {
    return NextResponse.json({ error: "Google not connected" }, { status: 400 });
  }

  const presetLabels = LABEL_PRESETS[presetKey];

  // Pull existing Gmail labels so we can link rather than fail on 409 conflicts.
  const existing = await listGmailLabels(userId);
  const existingByName = new Map(existing.map((l) => [l.name, l.id]));

  let created = 0;
  let linked = 0;
  const provisioned: Array<{ name: string; gmailLabelId: string }> = [];

  for (const label of presetLabels) {
    let gmailLabelId = existingByName.get(label.name) ?? null;
    if (gmailLabelId) {
      linked++;
    } else {
      gmailLabelId = await createGmailLabel(userId, label.name, label.colorKey);
      if (gmailLabelId) created++;
    }

    if (gmailLabelId) {
      await prisma.labelMapping.upsert({
        where: { userId_labelName: { userId, labelName: label.name } },
        create: { userId, labelName: label.name, gmailLabelId },
        update: { gmailLabelId },
      });
      provisioned.push({ name: label.name, gmailLabelId });
    }
  }

  // Persist preset choice + enable classification.
  await prisma.labelPreset.upsert({
    where: { userId },
    create: { userId, preset: presetKey, enabled: true },
    update: { preset: presetKey, enabled: true },
  });

  return NextResponse.json({
    created,
    linked,
    total: provisioned.length,
    preset: presetKey,
    labels: provisioned,
  });
}
