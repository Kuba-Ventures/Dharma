import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Both dashboard (NextAuth session) and Apps Script sidebar (GoogleBearer)
// need to read and update tone fields.
async function resolveUserId(req: NextRequest): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("GoogleBearer ")) {
    const googleToken = authHeader.slice("GoogleBearer ".length);
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${googleToken}` },
    });
    if (userinfoRes.ok) {
      const { email } = (await userinfoRes.json()) as { email: string };
      const cred = await prisma.googleCredential.findUnique({ where: { email } });
      if (cred) return cred.userId;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tone: true,
      toneProfile: true,
      toneExample: true,
      inferredIntro: true,
      inferredSignOff: true,
    },
  });

  return NextResponse.json(
    {
      tone: user?.tone ?? "Concise",
      toneProfile: user?.toneProfile ?? null,
      toneExample: user?.toneExample ?? null,
      inferredIntro: user?.inferredIntro ?? null,
      inferredSignOff: user?.inferredSignOff ?? null,
    },
    { headers: CORS }
  );
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const body = (await req.json()) as {
    tone?: string;
    toneProfile?: string;
    toneSummary?: string;
    toneExample?: string;
    inferredIntro?: string | null;
    inferredSignOff?: string | null;
  };

  if (
    body.tone === undefined &&
    body.toneProfile === undefined &&
    body.toneSummary === undefined &&
    body.toneExample === undefined &&
    body.inferredIntro === undefined &&
    body.inferredSignOff === undefined
  ) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400, headers: CORS });
  }

  const data: {
    tone?: string;
    toneProfile?: string;
    toneSummary?: string;
    toneExample?: string;
    inferredIntro?: string | null;
    inferredSignOff?: string | null;
  } = {};
  if (body.tone !== undefined) data.tone = body.tone;
  if (body.toneProfile !== undefined) data.toneProfile = body.toneProfile;
  if (body.toneSummary !== undefined) data.toneSummary = body.toneSummary;
  if (body.toneExample !== undefined) data.toneExample = body.toneExample;
  if (body.inferredIntro !== undefined) data.inferredIntro = body.inferredIntro || null;
  if (body.inferredSignOff !== undefined) data.inferredSignOff = body.inferredSignOff || null;

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      tone: true,
      toneProfile: true,
      toneSummary: true,
      toneExample: true,
      inferredIntro: true,
      inferredSignOff: true,
    },
  });

  return NextResponse.json(updated, { headers: CORS });
}
