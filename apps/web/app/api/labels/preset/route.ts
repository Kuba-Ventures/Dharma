import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { isPresetKey, type CustomPresetLabel } from "../../../../lib/labelPresets";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    preset?: string;
    enabled?: boolean;
    customName?: string | null;
    customLabels?: CustomPresetLabel[] | null;
  };

  if (body.preset !== undefined && !isPresetKey(body.preset)) {
    return NextResponse.json({ error: "Invalid preset" }, { status: 400 });
  }

  const existing = await prisma.labelPreset.findUnique({ where: { userId } });
  if (!existing && body.preset === undefined) {
    return NextResponse.json({ error: "No preset configured" }, { status: 400 });
  }

  const next = await prisma.labelPreset.upsert({
    where: { userId },
    create: {
      userId,
      preset: body.preset ?? "General",
      enabled: body.enabled ?? false,
      customName: body.customName ?? null,
      customLabels: (body.customLabels ?? null) as unknown as object,
    },
    update: {
      ...(body.preset !== undefined && { preset: body.preset }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      ...(body.customName !== undefined && { customName: body.customName }),
      ...(body.customLabels !== undefined && { customLabels: body.customLabels as unknown as object }),
    },
  });

  return NextResponse.json({
    preset: next.preset,
    enabled: next.enabled,
    customName: next.customName,
    customLabels: next.customLabels,
  });
}
