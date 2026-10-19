import { NextResponse } from "next/server";
import {
  adminSessionCookieName,
  adminSessionLifetimeSeconds,
  createAdminSessionToken,
  isAdminPasswordConfigured,
  isAllowedAdminEmailAddress,
  isCorrectAdminPassword,
  safeAdminRedirectPath,
} from "@/lib/admin/adminSession";

export const runtime = "nodejs";

// Slows brute force without a rate-limit store; Vercel Firewall can add a hard limit.
const failedSignInDelayMilliseconds = 750;

function redirectToLogin(request: Request, errorCode: string, nextPath: string): NextResponse {
  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("error", errorCode);
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl, { status: 303 });
}

export async function POST(request: Request) {
  const submittedForm = await request.formData().catch(() => null);
  const emailAddress = String(submittedForm?.get("email") ?? "").trim();
  const password = String(submittedForm?.get("password") ?? "");
  const nextPath = safeAdminRedirectPath(String(submittedForm?.get("next") ?? ""));

  if (!isAdminPasswordConfigured()) {
    return redirectToLogin(request, "not_configured", nextPath);
  }
  const passwordIsCorrect = await isCorrectAdminPassword(password);
  if (!isAllowedAdminEmailAddress(emailAddress) || !passwordIsCorrect) {
    await new Promise((resolve) => setTimeout(resolve, failedSignInDelayMilliseconds));
    console.warn(`[admin] failed sign-in for ${emailAddress || "(blank)"}`);
    return redirectToLogin(request, "invalid", nextPath);
  }

  console.log(`[admin] signed in ${emailAddress.toLowerCase()}`);
  const response = NextResponse.redirect(new URL(nextPath, request.url), { status: 303 });
  response.cookies.set(adminSessionCookieName, await createAdminSessionToken(emailAddress), {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: adminSessionLifetimeSeconds,
  });
  return response;
}
