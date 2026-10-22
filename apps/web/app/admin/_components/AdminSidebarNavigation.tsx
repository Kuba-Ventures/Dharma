"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import adminStyles from "../admin.module.css";

// Add a page here and under app/admin/(console)/ to extend the console.
const adminNavigationSections = [
  {
    sectionLabel: "INSIGHTS",
    items: [
      { href: "/admin/finance", label: "Finance" },
      { href: "/admin/growth", label: "Growth" },
    ],
  },
  {
    sectionLabel: "PRODUCT",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/feedback", label: "Feedback" },
    ],
  },
  {
    sectionLabel: "SYSTEM",
    items: [{ href: "/admin/health", label: "Health" }],
  },
];

const healthPageHref = "/admin/health";

export default function AdminSidebarNavigation({ servicesCurrentlyDownCount }: { servicesCurrentlyDownCount: number }) {
  const currentPathname = usePathname() ?? "";
  return (
    <nav>
      {adminNavigationSections.map((navigationSection) => (
        <div key={navigationSection.sectionLabel}>
          <div className={adminStyles.navigationSectionLabel}>{navigationSection.sectionLabel}</div>
          {navigationSection.items.map((navigationItem) => {
            const isCurrentPage = currentPathname.startsWith(navigationItem.href);
            return (
              <Link
                key={navigationItem.href}
                href={navigationItem.href}
                className={
                  isCurrentPage
                    ? `${adminStyles.navigationLink} ${adminStyles.navigationLinkActive}`
                    : adminStyles.navigationLink
                }
                aria-current={isCurrentPage ? "page" : undefined}
              >
                {navigationItem.label}
                {navigationItem.href === healthPageHref && servicesCurrentlyDownCount > 0 ? (
                  <span className={adminStyles.navigationBadge} aria-label={`${servicesCurrentlyDownCount} down`}>
                    {servicesCurrentlyDownCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
