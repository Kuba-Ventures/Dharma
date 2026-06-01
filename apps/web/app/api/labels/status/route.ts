import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [preset, mappingCount] = await Promise.all([
    prisma.labelPreset.findUnique({ where: { userId } }),
    prisma.labelMapping.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    preset: preset?.preset ?? null,
    enabled: preset?.enabled ?? false,
    count: mappingCount,
    customName: preset?.customName ?? null,
    customLabels: preset?.customLabels ?? null,
    uncategorizedEnabled: preset?.uncategorizedEnabled ?? true,
  });
}
