import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminSessionCookieName, readAdminSessionToken, type AdminSession } from "./adminSession";

export async function currentAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  return readAdminSessionToken(cookieStore.get(adminSessionCookieName)?.value);
}

// Second gate behind middleware: every console page calls this, so a
// middleware matcher mistake can never expose the data on its own.
export async function requireAdminSession(): Promise<AdminSession> {
  const adminSession = await currentAdminSession();
  if (!adminSession) redirect("/admin/login");
  return adminSession;
}
