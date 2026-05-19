import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { isPresetKey } from "../../../../lib/labelPresets";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    preset?: string;
    enabled?: boolean;
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
    },
    update: {
      ...(body.preset !== undefined && { preset: body.preset }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
    },
  });

  return NextResponse.json({ preset: next.preset, enabled: next.enabled });
}
