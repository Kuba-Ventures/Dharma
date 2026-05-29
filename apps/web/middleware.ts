import NextAuth from "next-auth";
import { authConfig } from "./lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/support" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/gmail/") ||
    pathname.startsWith("/api/emails/thread-draft") ||
    pathname.startsWith("/api/user/me") ||
    pathname.startsWith("/api/user/preferences") ||
    pathname.startsWith("/api/waitlist/") ||
    pathname.startsWith("/api/geo/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/share/") ||
    pathname.startsWith("/share/");

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico|.*\\.webp).*)"],
};
