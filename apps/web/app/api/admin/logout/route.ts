import { NextResponse } from "next/server";
import { adminSessionCookieName } from "@/lib/admin/adminSession";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url), { status: 303 });
  response.cookies.set(adminSessionCookieName, "", { path: "/", maxAge: 0 });
  return response;
}
