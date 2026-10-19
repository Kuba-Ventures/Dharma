import type { Metadata } from "next";
import AdminBrand from "../_components/AdminBrand";
import AdminLoginForm from "../_components/AdminLoginForm";
import { safeAdminRedirectPath } from "@/lib/admin/adminSession";
import adminStyles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Sign in · Dharma admin",
  robots: { index: false, follow: false },
};

const signInErrorMessages: Record<string, string> = {
  invalid: "That email and password combination isn't allowed.",
  not_configured: "Admin sign-in isn't set up on this deployment yet.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const signInErrorMessage = error ? signInErrorMessages[error] : null;
  return (
    <div className={adminStyles.loginPage}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ color: "#f4f4f2", marginBottom: 14 }}>
          <AdminBrand />
        </div>
        {signInErrorMessage ? (
          <div className={adminStyles.loginError} style={{ marginBottom: 12 }}>
            {signInErrorMessage}
          </div>
        ) : null}
        <AdminLoginForm nextPath={safeAdminRedirectPath(next)} />
      </div>
    </div>
  );
}
