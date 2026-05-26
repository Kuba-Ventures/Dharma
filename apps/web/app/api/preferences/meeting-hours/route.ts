import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

// GET → { hours: [{ dayOfWeek, hourStart, hourEnd }] }
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hours = await prisma.meetingHour.findMany({
    where: { userId: session.user.id },
    orderBy: [{ dayOfWeek: "asc" }, { hourStart: "asc" }],
    select: { dayOfWeek: true, hourStart: true, hourEnd: true },
  });

  return NextResponse.json({ hours });
}

// PUT { hours: [...] } — bulk-replace meeting hours for this user.
// We delete + recreate inside a transaction so the user always sees a clean
// state, never half-applied. The wire format is one row per contiguous block
// per day; the UI keeps it simple in v1 and only emits one block per day.
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { hours } = (await req.json()) as {
    hours: Array<{ dayOfWeek: number; hourStart: number; hourEnd: number }>;
  };

  if (!Array.isArray(hours)) {
    return NextResponse.json({ error: "hours must be an array" }, { status: 400 });
  }

  for (const h of hours) {
    if (
      !Number.isInteger(h.dayOfWeek) ||
      h.dayOfWeek < 0 ||
      h.dayOfWeek > 6 ||
      !Number.isInteger(h.hourStart) ||
      h.hourStart < 0 ||
      h.hourStart > 23 ||
      !Number.isInteger(h.hourEnd) ||
      h.hourEnd < 1 ||
      h.hourEnd > 24 ||
      h.hourEnd <= h.hourStart
    ) {
      return NextResponse.json(
        { error: "Invalid hour block" },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction([
    prisma.meetingHour.deleteMany({ where: { userId } }),
    ...(hours.length > 0
      ? [
          prisma.meetingHour.createMany({
            data: hours.map((h) => ({
              userId,
              dayOfWeek: h.dayOfWeek,
              hourStart: h.hourStart,
              hourEnd: h.hourEnd,
            })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ success: true });
}
