import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { enabled?: boolean; schedulingPreferences?: string };

  const data: { schedulingEnabled?: boolean; schedulingPreferences?: string } = {};
  if (typeof body.enabled === "boolean") data.schedulingEnabled = body.enabled;
  if (typeof body.schedulingPreferences === "string") data.schedulingPreferences = body.schedulingPreferences;

  await prisma.user.update({ where: { id: session.user.id }, data });

  return NextResponse.json({ success: true });
}
