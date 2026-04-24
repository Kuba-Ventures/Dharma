import { NextResponse } from "next/server";
import { verifyExtensionToken } from "../../../../lib/extension-token";
import { prisma } from "../../../../lib/prisma";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  let userId: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    userId = verifyExtensionToken(authHeader.slice(7)) ?? undefined;
  } else if (authHeader?.startsWith("GoogleBearer ")) {
    const googleToken = authHeader.slice("GoogleBearer ".length);
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${googleToken}` },
    });
    if (userinfoRes.ok) {
      const { email } = await userinfoRes.json() as { email: string };
      const cred = await prisma.googleCredential.findUnique({ where: { email } });
      if (cred) userId = cred.userId;
    }
  }

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { schedulingEnabled: true },
  });

  return NextResponse.json({ schedulingEnabled: user?.schedulingEnabled ?? false }, { headers: CORS });
}
