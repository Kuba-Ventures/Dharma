import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminStatTile from "../../_components/AdminStatTile";
import { requireAdminSession } from "@/lib/admin/adminRequestSession";
import { parseAdminReportingRange, periodsForRange } from "@/lib/admin/adminRange";
import { loadAdminFeedback } from "@/lib/admin/adminMetrics";
import { formatAdminDate, formatCount, netPromoterScore } from "@/lib/admin/adminFormatting";
import adminStyles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdminSession();
  const selectedRangeKey = parseAdminReportingRange((await searchParams).range);
  const feedbackRows = await loadAdminFeedback(periodsForRange(selectedRangeKey).current);
  const npsScores = feedbackRows
    .filter((row) => row.kind === "nps" && row.score != null)
    .map((row) => row.score as number);
  const nps = netPromoterScore(npsScores);

  return (
    <>
      <AdminPageHeader
        title="Feedback"
        subtitle="NPS responses and in-app feedback. Team accounts excluded (TEAM_EMAILS, ADMIN_EXCLUDED_EMAILS)."
        pagePath="/admin/feedback"
        selectedRangeKey={selectedRangeKey}
      />
      <div className={adminStyles.tileGrid}>
        <AdminStatTile label="NPS" value={nps == null ? "-" : String(nps)} note={`${formatCount(npsScores.length)} responses`} />
        <AdminStatTile label="Promoters" value={formatCount(npsScores.filter((score) => score >= 9).length)} note="scored 9 to 10" />
        <AdminStatTile label="Detractors" value={formatCount(npsScores.filter((score) => score <= 6).length)} note="scored 0 to 6" />
        <AdminStatTile
          label="Written feedback"
          value={formatCount(feedbackRows.filter((row) => row.message).length)}
          note="messages in range"
        />
      </div>
      <div className={adminStyles.panel}>
        {feedbackRows.length === 0 ? (
          <div className={adminStyles.emptyState}>No feedback in this range.</div>
        ) : (
          <div className={adminStyles.tableScroller}>
            <table className={adminStyles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Kind</th>
                  <th className={adminStyles.numericCell}>Score</th>
                  <th>Message</th>
                  <th>Page</th>
                </tr>
              </thead>
              <tbody>
                {feedbackRows.map((row, rowIndex) => (
                  <tr key={`${row.email}-${row.createdAt.toISOString()}-${rowIndex}`}>
                    <td>{formatAdminDate(row.createdAt)}</td>
                    <td>{row.email}</td>
                    <td>{row.kind}</td>
                    <td className={adminStyles.numericCell}>{row.score ?? "-"}</td>
                    <td className={adminStyles.truncatedCell} title={row.message ?? ""}>
                      {row.message ?? "-"}
                    </td>
                    <td>{row.page ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
