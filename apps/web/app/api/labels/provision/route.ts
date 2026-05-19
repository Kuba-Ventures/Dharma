import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { createGmailLabel, listGmailLabels, updateGmailLabel } from "../../../../lib/gmail";
import { isPresetKey, resolvePresetSpec, type CustomPresetLabel } from "../../../../lib/labelPresets";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    preset?: string;
    customName?: string | null;
    customLabels?: CustomPresetLabel[] | null;
  };
  const presetKey = body.preset;
  if (!presetKey || !isPresetKey(presetKey)) {
    return NextResponse.json({ error: "Invalid preset" }, { status: 400 });
  }

  const cred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!cred) {
    return NextResponse.json({ error: "Google not connected" }, { status: 400 });
  }

  // For Custom presets, the request body carries the spec (we also persist it
  // so subsequent polls can classify). For built-ins, the spec is hardcoded.
  const spec = resolvePresetSpec({
    preset: presetKey,
    customName: body.customName,
    customLabels: body.customLabels,
  });
  if (!spec || spec.labels.length === 0) {
    return NextResponse.json(
      { error: "Custom preset needs a name and at least one label" },
      { status: 400 }
    );
  }

  const existing = await listGmailLabels(userId);
  const existingByName = new Map(existing.map((l) => [l.name, l.id]));

  let created = 0;
  let linked = 0;
  let updated = 0;
  const provisioned: Array<{ name: string; gmailLabelId: string }> = [];

  for (const label of spec.labels) {
    let gmailLabelId = existingByName.get(label.name) ?? null;
    if (gmailLabelId) {
      // Sync color back to Gmail in case the user picked a new one in the UI.
      const ok = await updateGmailLabel(userId, gmailLabelId, { colorKey: label.colorKey });
      if (ok) updated++;
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

  // Persist preset choice (and custom spec if applicable). Enable classification.
  await prisma.labelPreset.upsert({
    where: { userId },
    create: {
      userId,
      preset: presetKey,
      enabled: true,
      customName: presetKey === "Custom" ? (body.customName ?? null) : null,
      customLabels: (presetKey === "Custom"
        ? (body.customLabels ?? null)
        : null) as unknown as object,
    },
    update: {
      preset: presetKey,
      enabled: true,
      ...(presetKey === "Custom" && {
        customName: body.customName ?? null,
        customLabels: (body.customLabels ?? null) as unknown as object,
      }),
    },
  });

  return NextResponse.json({
    created,
    linked,
    updated,
    total: provisioned.length,
    preset: presetKey,
    displayName: spec.displayName,
    labels: provisioned,
  });
}
