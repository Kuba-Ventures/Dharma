import NextAuth from "next-auth";
import { authConfig } from "./lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Add-on endpoints below carry their own `Authorization: GoogleBearer <token>`
  // and verify the user inside the route handler. They must bypass middleware,
  // which only understands NextAuth session cookies.
  const isAddonEndpoint =
    pathname.startsWith("/api/emails/thread-draft") ||
    pathname.startsWith("/api/preferences/tone") ||
    pathname === "/api/calendar/rsvp" ||
    /^\/api\/emails\/[^/]+\/classify$/.test(pathname);

  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/support" ||
    // Crawler files must be reachable unauthenticated; otherwise the redirect
    // below bounces Googlebot to /login and the sitemap/robots never resolve.
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/gmail/") ||
    isAddonEndpoint ||
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
