import AdminDailyBarChart from "../../_components/AdminDailyBarChart";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminStatTile from "../../_components/AdminStatTile";
import { requireAdminSession } from "@/lib/admin/adminRequestSession";
import { parseAdminReportingRange, periodsForRange } from "@/lib/admin/adminRange";
import { loadAdminFinance } from "@/lib/admin/adminMetrics";
import { adminVendors, fixedMonthlyCostUsd, loadAiGatewayCredits, loadStripeRevenue } from "@/lib/admin/adminVendors";
import { divideOrNull, formatCount, formatUsd, priorComparisonNote } from "@/lib/admin/adminFormatting";
import adminStyles from "../../admin.module.css";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const eventTypeLabels: Record<string, string> = {
  classify: "Labeling",
  draft: "Drafts",
  tone_sync: "Tone sync",
  schedule: "Scheduling",
  signal: "Signal detection",
};

export default async function AdminFinancePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdminSession();
  const selectedRangeKey = parseAdminReportingRange((await searchParams).range);
  const periods = periodsForRange(selectedRangeKey);
  const [finance, stripeRevenue, gatewayCredits] = await Promise.all([
    loadAdminFinance(periods),
    loadStripeRevenue(),
    loadAiGatewayCredits(),
  ]);
  const dayCount = periods.current.dayKeys.length;
  const mrrUsd = stripeRevenue.state === "connected" ? stripeRevenue.reading.mrrUsd : null;
  const fixedCostUsd = fixedMonthlyCostUsd();
  const aiSpendPerMonthUsd = (finance.aiSpendUsd / dayCount) * 30;
  const monthlyBurnUsd = aiSpendPerMonthUsd + (fixedCostUsd ?? 0);
  const notices = [
    stripeRevenue.state === "unavailable" ? `Stripe unavailable: ${stripeRevenue.reason}` : null,
    gatewayCredits.state === "unavailable" ? `AI Gateway unavailable: ${gatewayCredits.reason}` : null,
  ].filter(Boolean);

  return (
    <>
      <AdminPageHeader
        title="Finance"
        subtitle="Revenue, AI spend and fixed costs. Team accounts excluded (TEAM_EMAILS, ADMIN_EXCLUDED_EMAILS)."
        pagePath="/admin/finance"
        selectedRangeKey={selectedRangeKey}
      />
      {notices.length > 0 ? <div className={adminStyles.notice}>{notices.join(" · ")}</div> : null}
      <div className={adminStyles.tileGrid}>
        <AdminStatTile
          label="MRR"
          value={mrrUsd == null ? "-" : formatUsd(mrrUsd)}
          note={
            stripeRevenue.state === "connected"
              ? `${formatCount(stripeRevenue.reading.activeSubscriptions)} active subscriptions`
              : "Stripe not connected"
          }
        />
        <AdminStatTile
          label="AI spend"
          value={formatUsd(finance.aiSpendUsd)}
          note={priorComparisonNote(finance.aiSpendUsd, finance.priorAiSpendUsd, formatUsd)}
        />
        <AdminStatTile
          label="AI cost per active user"
          value={formatUsd(divideOrNull(finance.aiSpendUsd, finance.activeUsers))}
          note={`${formatCount(finance.activeUsers)} active users in range`}
        />
        <AdminStatTile
          label="Monthly burn"
          value={formatUsd(monthlyBurnUsd)}
          note={
            fixedCostUsd == null
              ? "AI run-rate only; add fixed costs in adminVendors.ts"
              : `AI run-rate + ${formatUsd(fixedCostUsd)} fixed`
          }
        />
      </div>
      <div className={adminStyles.tileGrid}>
        <AdminStatTile
          label="Gross margin"
          value={mrrUsd ? `${Math.round(((mrrUsd - aiSpendPerMonthUsd) / mrrUsd) * 100)}%` : "-"}
          note="MRR minus AI run-rate"
        />
        <AdminStatTile
          label="Avg daily AI spend"
          value={formatUsd(finance.aiSpendUsd / dayCount)}
          note={`over ${dayCount} days`}
        />
        <AdminStatTile
          label="AI Gateway balance"
          value={gatewayCredits.state === "connected" ? formatUsd(gatewayCredits.reading.balanceUsd) : "-"}
          note={
            gatewayCredits.state === "connected"
              ? `${formatUsd(gatewayCredits.reading.totalUsedUsd)} used all time`
              : "AI Gateway not connected"
          }
        />
        <AdminStatTile
          label="Break-even price"
          value={formatUsd(divideOrNull(monthlyBurnUsd, finance.activeUsers))}
          note="per active user per month"
        />
      </div>
      <div className={adminStyles.panelRow}>
        <div className={adminStyles.panel}>
          <div className={adminStyles.panelTitle}>AI spend by day</div>
          <AdminDailyBarChart
            dayKeys={periods.current.dayKeys}
            primarySeries={{
              label: "AI spend",
              color: "#7f77dd",
              dailyValues: finance.dailyAiSpendUsd,
              formatValue: formatUsd,
            }}
          />
        </div>
        <div className={adminStyles.panel}>
          <div className={adminStyles.panelTitle}>By feature and model</div>
          {finance.spendLines.length === 0 ? (
            <div className={adminStyles.emptyState}>No AI usage in this range.</div>
          ) : (
            finance.spendLines.map((line) => (
              <div key={`${line.eventType}-${line.model}`} className={adminStyles.lineItem}>
                <span>
                  {eventTypeLabels[line.eventType] ?? line.eventType}{" "}
                  <span className={adminStyles.tileNote}>
                    {line.model} · {formatCount(line.events)}
                  </span>
                </span>
                <span>{formatUsd(line.costUsd)}</span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className={adminStyles.panelRow}>
        <div className={adminStyles.panel}>
          <div className={adminStyles.panelTitle}>Heaviest users by AI cost</div>
          <div className={adminStyles.tableScroller}>
            <table className={adminStyles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Tier</th>
                  <th className={adminStyles.numericCell}>AI calls</th>
                  <th className={adminStyles.numericCell}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {finance.topUsers.map((user) => (
                  <tr key={user.email}>
                    <td>{user.email}</td>
                    <td>{user.tier}</td>
                    <td className={adminStyles.numericCell}>{formatCount(user.events)}</td>
                    <td className={adminStyles.numericCell}>{formatUsd(user.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={adminStyles.panel}>
          <div className={adminStyles.panelTitle}>Vendors</div>
          {adminVendors.map((vendor) => (
            <div key={vendor.name} className={adminStyles.lineItem}>
              <span>
                <a className={adminStyles.externalLink} href={vendor.billingUrl} target="_blank" rel="noreferrer">
                  {vendor.name}
                </a>{" "}
                <span className={adminStyles.tileNote}>{vendor.purpose}</span>
              </span>
              <span>{vendor.monthlyUsd == null ? "usage" : `${formatUsd(vendor.monthlyUsd)}/mo`}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
