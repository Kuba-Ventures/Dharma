import type { Metadata } from "next";
import AdminBrand from "../_components/AdminBrand";
import AdminSidebarNavigation from "../_components/AdminSidebarNavigation";
import { requireAdminSession } from "@/lib/admin/adminRequestSession";
import adminStyles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Dharma admin",
  robots: { index: false, follow: false },
};

export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const adminSession = await requireAdminSession();
  return (
    <div className={adminStyles.consoleShell}>
      <aside className={adminStyles.sidebar}>
        <AdminBrand />
        <AdminSidebarNavigation />
        <div className={adminStyles.sidebarFooter}>
          <div>{adminSession.emailAddress}</div>
          <div className={adminStyles.sidebarFooterRow}>
            <a className={adminStyles.ghostButton} href="/">
              Site
            </a>
            <form action="/api/admin/logout" method="post">
              <button type="submit" className={adminStyles.ghostButton}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className={adminStyles.content}>{children}</main>
    </div>
  );
}
