import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tone: true, toneProfile: true, toneExample: true },
  });

  return NextResponse.json({
    tone: user?.tone ?? "Concise",
    toneProfile: user?.toneProfile ?? null,
    toneExample: user?.toneExample ?? null,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { tone?: string; toneProfile?: string; toneExample?: string };
  if (!body.tone && body.toneProfile === undefined && body.toneExample === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const data: { tone?: string; toneProfile?: string; toneExample?: string } = {};
  if (body.tone) data.tone = body.tone;
  if (body.toneProfile !== undefined) data.toneProfile = body.toneProfile;
  if (body.toneExample !== undefined) data.toneExample = body.toneExample;

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { tone: true, toneProfile: true, toneExample: true },
  });

  return NextResponse.json(updated);
}
