import NextAuth from "next-auth";
import { authConfig } from "./lib/auth.config";
import { NextResponse, type NextRequest } from "next/server";
import { adminSessionCookieName, readAdminSessionToken } from "./lib/admin/adminSession";

const { auth } = NextAuth(authConfig);

// The admin console has its own sign-in (email allowlist + master password,
// see lib/admin/adminSession.ts) and never uses the product's NextAuth session.
async function handleAdminRequest(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/admin/login" || pathname === "/api/admin/login" || pathname === "/api/admin/logout") {
    return NextResponse.next();
  }
  const adminSession = await readAdminSessionToken(req.cookies.get(adminSessionCookieName)?.value);
  if (adminSession) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  if (pathname.startsWith("/api/admin/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/")) {
    return handleAdminRequest(req);
  }

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
    // Public health check for external uptime monitors — must not redirect.
    pathname === "/api/health" ||
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
