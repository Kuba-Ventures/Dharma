import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { createGmailLabel, listGmailLabels, updateGmailLabel } from "../../../../lib/gmail";
import { isPresetKey, resolvePresetSpec, UNCATEGORIZED_NAME, type CustomPresetLabel } from "../../../../lib/labelPresets";

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

  // Respect the user's catch-all choice — if they deleted Uncategorized, don't
  // recreate it on the next sync. Defaults to on for first-time provisioning.
  const existingPreset = await prisma.labelPreset.findUnique({ where: { userId } });
  const includeUncategorized = existingPreset?.uncategorizedEnabled ?? true;

  // For Custom presets, the request body carries the spec (we also persist it
  // so subsequent polls can classify). For built-ins, the spec is hardcoded.
  const spec = resolvePresetSpec({
    preset: presetKey,
    customName: body.customName,
    customLabels: body.customLabels,
    includeUncategorized,
  });
  // Require at least one real (non-catch-all) label — otherwise a Custom preset
  // with only Uncategorized would slip through.
  if (!spec || spec.labels.filter((l) => l.shortName !== UNCATEGORIZED_NAME).length === 0) {
    return NextResponse.json(
      { error: "Custom preset needs at least one label" },
      { status: 400 }
    );
  }

  const existing = await listGmailLabels(userId);
  const existingByName = new Map(existing.map((l) => [l.name, l.id]));

  let created = 0;
  let linked = 0;
  let updated = 0;
  const provisioned: Array<{ name: string; gmailLabelId: string }> = [];
  const failures: Array<{ name: string; error: string }> = [];

  for (const label of spec.labels) {
    let gmailLabelId: string | null = existingByName.get(label.name) ?? null;
    if (gmailLabelId) {
      const ok = await updateGmailLabel(userId, gmailLabelId, { colorKey: label.colorKey });
      if (ok) updated++;
      linked++;
    } else {
      const createRes = await createGmailLabel(userId, label.name, label.colorKey);
      gmailLabelId = createRes.id;
      if (gmailLabelId) {
        created++;
      } else {
        failures.push({ name: label.name, error: createRes.error ?? "unknown" });
      }
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

  // Drop LabelMappings from prior presets that no longer apply. Gmail labels
  // themselves are left alone (users may want to keep historical folders) —
  // this just stops them from inflating the "provisioned in Gmail" count and
  // from being applied during back-scan.
  const currentNames = spec.labels.map((l) => l.name);
  await prisma.labelMapping.deleteMany({
    where: { userId, labelName: { notIn: currentNames } },
  });

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
    failures,
  });
}
