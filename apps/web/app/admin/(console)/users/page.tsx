import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminStatTile from "../../_components/AdminStatTile";
import { requireAdminSession } from "@/lib/admin/adminRequestSession";
import { loadAdminUsers } from "@/lib/admin/adminMetrics";
import { formatAdminDate, formatCount, formatRelativeTime, formatUsd } from "@/lib/admin/adminFormatting";
import adminStyles from "../../admin.module.css";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sevenDayMilliseconds = 7 * 24 * 60 * 60 * 1000;

export default async function AdminUsersPage() {
  await requireAdminSession();
  const users = await loadAdminUsers();
  const realUsers = users.filter((user) => !user.isInternal);
  const nowMilliseconds = Date.now();
  const activeLastSevenDays = realUsers.filter(
    (user) => user.lastActiveAt && nowMilliseconds - user.lastActiveAt.getTime() < sevenDayMilliseconds,
  ).length;

  return (
    <>
      <AdminPageHeader
        title="Users"
        subtitle="Every account, newest first. Team accounts are tagged and left out of the totals."
        pagePath="/admin/users"
      />
      <div className={adminStyles.tileGrid}>
        <AdminStatTile label="Users" value={formatCount(realUsers.length)} note={`${users.length - realUsers.length} team accounts`} />
        <AdminStatTile label="Onboarded" value={formatCount(realUsers.filter((user) => user.onboarded).length)} />
        <AdminStatTile label="Add-on installed" value={formatCount(realUsers.filter((user) => user.addonInstalled).length)} />
        <AdminStatTile label="Active last 7d" value={formatCount(activeLastSevenDays)} />
      </div>
      <div className={adminStyles.panel}>
        <div className={adminStyles.tableScroller}>
          <table className={adminStyles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Tier</th>
                <th>Signed up</th>
                <th>Onboarded</th>
                <th>Add-on</th>
                <th>Last active</th>
                <th className={adminStyles.numericCell}>AI calls 30d</th>
                <th className={adminStyles.numericCell}>AI cost 30d</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.email}>
                  <td>
                    {user.email}
                    {user.isInternal ? <span className={adminStyles.statusPill}>team</span> : null}
                  </td>
                  <td>{user.role ?? "-"}</td>
                  <td>{user.tier}</td>
                  <td>{formatAdminDate(user.signedUpAt)}</td>
                  <td>{user.onboarded ? "Yes" : "No"}</td>
                  <td>{user.addonInstalled ? "Yes" : "No"}</td>
                  <td>{formatRelativeTime(user.lastActiveAt, nowMilliseconds)}</td>
                  <td className={adminStyles.numericCell}>{formatCount(user.eventsLast30Days)}</td>
                  <td className={adminStyles.numericCell}>{formatUsd(user.costLast30DaysUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
