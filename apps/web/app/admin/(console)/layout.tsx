import type { Metadata } from "next";
import AdminBrand from "../_components/AdminBrand";
import AdminSidebarNavigation from "../_components/AdminSidebarNavigation";
import { requireAdminSession } from "@/lib/admin/adminRequestSession";
import { aiServiceDisplayNames, aiServiceFailureSummaries, formatPacificTime } from "@/lib/aiHealth/aiHealthAlerts";
import { readServicesCurrentlyDown } from "@/lib/aiHealth/aiHealthJob";
import adminStyles from "../admin.module.css";

export const metadata: Metadata = {
  title: "Dharma admin",
  robots: { index: false, follow: false },
};

export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const adminSession = await requireAdminSession();
  const servicesCurrentlyDown = await Promise.race([
    readServicesCurrentlyDown(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out after 3s")), 3_000)),
  ]).catch((error) => {
    console.error("[admin] reading which AI services are down failed:", error);
    return [];
  });
  return (
    <div className={adminStyles.consoleShell}>
      <aside className={adminStyles.sidebar}>
        <AdminBrand />
        <AdminSidebarNavigation servicesCurrentlyDownCount={servicesCurrentlyDown.length} />
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
      <main className={adminStyles.content}>
        {servicesCurrentlyDown.map((downCheck) => (
          <a key={downCheck.service} href="/admin/health" className={adminStyles.healthDownStrip}>
            <span className={`${adminStyles.statusDot} ${adminStyles.statusDotBad}`} />
            <span>
              <strong>{aiServiceDisplayNames[downCheck.service]} is down.</strong>{" "}
              {downCheck.failureKind ? `It says ${aiServiceFailureSummaries[downCheck.failureKind]}.` : ""} Last
              checked {formatPacificTime(downCheck.checkedAt)} PT.
            </span>
            <span className={adminStyles.healthDownStripLink}>Health</span>
          </a>
        ))}
        {children}
      </main>
    </div>
  );
}
