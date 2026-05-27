import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

// POST { kind: "feedback" | "nps", message?, score?, page? }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    kind?: "feedback" | "nps";
    message?: string;
    score?: number;
    page?: string;
  };

  const kind = body.kind === "nps" ? "nps" : "feedback";

  if (kind === "feedback" && !body.message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }
  if (kind === "nps" && (typeof body.score !== "number" || body.score < 0 || body.score > 10)) {
    return NextResponse.json({ error: "Score must be 0–10" }, { status: 400 });
  }

  await prisma.feedback.create({
    data: {
      userId,
      kind,
      score: body.score ?? null,
      message: body.message?.trim() || null,
      page: body.page ?? null,
    },
  });

  // NPS responses gate the next prompt by 30 days.
  if (kind === "nps") {
    const nextPrompt = new Date();
    nextPrompt.setDate(nextPrompt.getDate() + 30);
    await prisma.user.update({
      where: { id: userId },
      data: { nextNpsPromptAt: nextPrompt },
    });
  }

  return NextResponse.json({ success: true });
}
