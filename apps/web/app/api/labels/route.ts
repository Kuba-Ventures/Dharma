import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { createGmailLabel } from "../../../lib/gmail";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const labels = await prisma.label.findMany({
    where: { userId: session.user.id },
    include: { rules: { orderBy: { createdAt: "asc" } } },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(labels);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const { name, description = "", color = "#c8f5a0", colorKey = "gray" } =
    await req.json() as { name: string; description?: string; color?: string; colorKey?: string };

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const count = await prisma.label.count({ where: { userId } });
  const label = await prisma.label.create({
    data: { userId, name: name.trim(), description, color, order: count },
    include: { rules: true },
  });

  // Create in Gmail if connected
  const googleCred = await prisma.googleCredential.findUnique({ where: { userId } });
  if (googleCred) {
    const { id: gmailLabelId } = await createGmailLabel(userId, `#${label.name}`, colorKey);
    if (gmailLabelId) {
      await prisma.label.update({ where: { id: label.id }, data: { gmailLabelId } });
      return NextResponse.json({ ...label, gmailLabelId });
    }
  }

  return NextResponse.json(label);
}
