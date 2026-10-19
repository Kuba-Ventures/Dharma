import AdminDailyBarChart from "../../_components/AdminDailyBarChart";
import AdminFunnel from "../../_components/AdminFunnel";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminStatTile from "../../_components/AdminStatTile";
import { requireAdminSession } from "@/lib/admin/adminRequestSession";
import { parseAdminReportingRange, percentChange, periodsForRange } from "@/lib/admin/adminRange";
import { loadAdminGrowth } from "@/lib/admin/adminMetrics";
import { formatCount, formatHours, priorComparisonNote } from "@/lib/admin/adminFormatting";
import adminStyles from "../../admin.module.css";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const eventTypeLabels: Record<string, string> = {
  classify: "Emails labeled",
  draft: "Drafts written",
  tone_sync: "Tone syncs",
  schedule: "Meetings scheduled",
  signal: "Signals detected",
};

export default async function AdminGrowthPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdminSession();
  const selectedRangeKey = parseAdminReportingRange((await searchParams).range);
  const periods = periodsForRange(selectedRangeKey);
  const growth = await loadAdminGrowth(periods);

  return (
    <>
      <AdminPageHeader
        title="Growth"
        subtitle="Signups, activation and usage. Team accounts excluded (TEAM_EMAILS, ADMIN_EXCLUDED_EMAILS)."
        pagePath="/admin/growth"
        selectedRangeKey={selectedRangeKey}
      />
      <div className={adminStyles.tileGrid}>
        <AdminStatTile
          label="New signups"
          value={formatCount(growth.signups)}
          note={priorComparisonNote(growth.signups, growth.priorSignups, formatCount)}
        />
        <AdminStatTile
          label="Active users"
          value={formatCount(growth.activeUsers)}
          note={priorComparisonNote(growth.activeUsers, growth.priorActiveUsers, formatCount)}
        />
        <AdminStatTile
          label="Waitlist joins"
          value={formatCount(growth.waitlistInRange)}
          note={growth.waitlistInRange == null ? "admin sheet not connected" : "from the admin sheet"}
        />
        <AdminStatTile label="Hours saved, all time" value={formatHours(growth.hoursSavedSeconds)} note="across all users" />
      </div>
      <div className={adminStyles.panelRow}>
        <div className={adminStyles.panel}>
          <div className={adminStyles.panelTitle}>Signups and daily active users</div>
          <AdminDailyBarChart
            dayKeys={periods.current.dayKeys}
            primarySeries={{
              label: "Daily active users",
              color: "#7f77dd",
              dailyValues: growth.dailyActiveUsers,
              formatValue: (value) => formatCount(Math.round(value)),
            }}
            secondarySeries={{
              label: "Signups",
              color: "#1D9E75",
              dailyValues: growth.dailySignups,
              formatValue: (value) => formatCount(Math.round(value)),
            }}
            sharedScale
          />
        </div>
        <div className={adminStyles.panel}>
          <div className={adminStyles.panelTitle}>Activation funnel, all time</div>
          <AdminFunnel steps={growth.funnel} />
        </div>
      </div>
      <div className={adminStyles.panel}>
        <div className={adminStyles.panelTitle}>Product usage</div>
        <div className={adminStyles.tableScroller}>
          <table className={adminStyles.table}>
            <thead>
              <tr>
                <th>Action</th>
                <th className={adminStyles.numericCell}>This range</th>
                <th className={adminStyles.numericCell}>Prior</th>
                <th className={adminStyles.numericCell}>Change</th>
              </tr>
            </thead>
            <tbody>
              {growth.eventCounts.map((eventCount) => {
                const change = percentChange(eventCount.current, eventCount.prior);
                return (
                  <tr key={eventCount.eventType}>
                    <td>{eventTypeLabels[eventCount.eventType] ?? eventCount.eventType}</td>
                    <td className={adminStyles.numericCell}>{formatCount(eventCount.current)}</td>
                    <td className={adminStyles.numericCell}>{formatCount(eventCount.prior)}</td>
                    <td
                      className={`${adminStyles.numericCell} ${
                        change == null ? adminStyles.changeNeutral : change >= 0 ? adminStyles.changeGood : adminStyles.changeBad
                      }`}
                    >
                      {change == null ? "-" : `${change > 0 ? "+" : ""}${change}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
