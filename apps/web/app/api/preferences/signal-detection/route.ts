import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

// PATCH /api/preferences/signal-detection { enabled: boolean }
// → { signalDetectionEnabled: boolean }
//
// User-level toggle for the Haiku-backed signal producer. When false,
// detectAndPersistSignal() short-circuits before any LLM call so no
// UsageEvent is written and no Signal row is created.
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  if (typeof body.enabled !== "boolean")
    return NextResponse.json(
      { error: "Missing { enabled: boolean }" },
      { status: 400 },
    );

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { signalDetectionEnabled: body.enabled },
    select: { signalDetectionEnabled: true },
  });

  return NextResponse.json(updated);
}
