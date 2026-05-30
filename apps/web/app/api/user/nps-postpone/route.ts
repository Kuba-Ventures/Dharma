import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

// POST → set nextNpsPromptAt 7 days out so the user isn't re-asked tomorrow
// after dismissing. Distinct from a real NPS submission, which sets it 30
// days out via /api/feedback.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const next = new Date();
  next.setDate(next.getDate() + 7);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { nextNpsPromptAt: next },
  });

  return NextResponse.json({ ok: true });
}
