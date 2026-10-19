import Link from "next/link";
import { adminReportingRanges, adminTimeZone, type AdminReportingRangeKey } from "@/lib/admin/adminRange";
import adminStyles from "../admin.module.css";

const syncTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: adminTimeZone,
  hour: "numeric",
  minute: "2-digit",
});

export default function AdminPageHeader({
  title,
  subtitle,
  pagePath,
  selectedRangeKey,
}: {
  title: string;
  subtitle: string;
  pagePath: string;
  selectedRangeKey?: AdminReportingRangeKey;
}) {
  return (
    <div className={adminStyles.pageHeader}>
      <div>
        <h1 className={adminStyles.pageTitle}>{title}</h1>
        <div className={adminStyles.pageSubtitle}>{subtitle}</div>
      </div>
      <div className={adminStyles.headerControls}>
        <div className={adminStyles.syncBadge}>
          <span className={adminStyles.syncDot} />
          Live as of {syncTimeFormatter.format(new Date())}
        </div>
        {selectedRangeKey ? (
          <nav className={adminStyles.rangeSelector} aria-label="Date range">
            {adminReportingRanges.map((reportingRange) => (
              <Link
                key={reportingRange.key}
                href={`${pagePath}?range=${reportingRange.key}`}
                className={
                  reportingRange.key === selectedRangeKey
                    ? `${adminStyles.rangeOption} ${adminStyles.rangeOptionActive}`
                    : adminStyles.rangeOption
                }
                aria-current={reportingRange.key === selectedRangeKey ? "page" : undefined}
              >
                {reportingRange.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
