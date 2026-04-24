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
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }
  const userId = verifyExtensionToken(authHeader.slice(7));
  if (!userId) return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: CORS });

  const cred = await prisma.googleCredential.findUnique({ where: { userId } });
  return NextResponse.json({ email: cred?.email ?? null }, { headers: CORS });
}
