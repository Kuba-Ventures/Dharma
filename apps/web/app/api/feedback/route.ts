import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { appendRow } from "../../../lib/adminSheet";

// POST { kind: "feedback" | "nps" | "bug", message?, score?, page?, severity? }
//
// Dual-writes to the Feedback table (canonical) and the admin sheet's
// Debugging tab (for triage). Sheet write is best-effort — failures log
// but don't fail the response.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    kind?: "feedback" | "nps" | "bug";
    message?: string;
    score?: number;
    page?: string;
    severity?: string;
  };

  const kind: "feedback" | "nps" | "bug" =
    body.kind === "nps" ? "nps" : body.kind === "bug" ? "bug" : "feedback";

  if ((kind === "feedback" || kind === "bug") && !body.message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }
  if (kind === "nps" && (typeof body.score !== "number" || body.score < 0 || body.score > 10)) {
    return NextResponse.json({ error: "Score must be 0–10" }, { status: 400 });
  }

  // Feedback table stores all three kinds; the schema's `kind` column is
  // free-text so adding "bug" doesn't need a migration.
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

  // Best-effort sheet append for triage.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const submittedByEmail = user?.email ?? "";
  const messageOrScore =
    kind === "nps" ? `score=${body.score}` : (body.message?.trim() ?? "");
  void appendRow("Debugging", [
    submittedByEmail,
    body.page ?? "",
    kind,
    messageOrScore,
    body.severity ?? "",
    new Date().toISOString(),
  ]);

  return NextResponse.json({ success: true });
}
