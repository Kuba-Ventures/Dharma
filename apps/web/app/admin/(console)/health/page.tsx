import AdminPageHeader from "../../_components/AdminPageHeader";
import { requireAdminSession } from "@/lib/admin/adminRequestSession";
import { formatRelativeTime } from "@/lib/admin/adminFormatting";
import {
  aiServiceDisplayNames,
  aiServiceFailureSummaries,
  describeDowntime,
  formatPacificTime,
  whatBreaksForUsers,
} from "@/lib/aiHealth/aiHealthAlerts";
import { allAiServiceNames } from "@/lib/aiHealth/aiHealthChecks";
import { readRecentChecksForAllServices } from "@/lib/aiHealth/aiHealthJob";
import {
  healthWindowDays,
  summarizeAiServiceHealth,
  type AiServiceHealthSummary,
  type AiServiceIncident,
} from "@/lib/aiHealth/aiHealthSummary";
import adminStyles from "../../admin.module.css";

export const dynamic = "force-dynamic";

function statusDotClassName(healthSummary: AiServiceHealthSummary): string {
  if (healthSummary.currentStatus === "working") return `${adminStyles.statusDot} ${adminStyles.statusDotGood}`;
  if (healthSummary.currentStatus === "down") return `${adminStyles.statusDot} ${adminStyles.statusDotBad}`;
  return adminStyles.statusDot;
}

function statusDescription(healthSummary: AiServiceHealthSummary, nowMilliseconds: number): string {
  if (healthSummary.currentStatus === "never_checked" || healthSummary.lastCheckedAtIso === null) {
    return "Not checked yet. The first check runs within 10 minutes of deploy.";
  }
  const checkedAgo = `checked ${formatRelativeTime(new Date(healthSummary.lastCheckedAtIso), nowMilliseconds).toLowerCase()}`;
  if (healthSummary.currentStatus === "working") {
    const replyTime =
      healthSummary.lastLatencyMilliseconds != null
        ? `, answered in ${(healthSummary.lastLatencyMilliseconds / 1000).toFixed(1)}s`
        : "";
    return `Working, ${checkedAgo}${replyTime}`;
  }
  const failureSummary = healthSummary.currentFailureKind
    ? aiServiceFailureSummaries[healthSummary.currentFailureKind]
    : "the check could not tell";
  return healthSummary.currentStatus === "down"
    ? `Down: ${failureSummary}, ${checkedAgo}`
    : `Unknown: ${failureSummary}, ${checkedAgo}`;
}

function timelineSlotClassName(timelineSlot: AiServiceHealthSummary["timelineSlots"][number]): string {
  if (timelineSlot === "down") return `${adminStyles.healthTimelineSlot} ${adminStyles.healthTimelineSlotDown}`;
  if (timelineSlot === "working") return `${adminStyles.healthTimelineSlot} ${adminStyles.healthTimelineSlotWorking}`;
  return adminStyles.healthTimelineSlot;
}

function incidentDescription(incident: AiServiceIncident, nowIso: string): string {
  const failureSummary = incident.failureKind ? aiServiceFailureSummaries[incident.failureKind] : "it failed";
  if (incident.endedAtIso === null) {
    return `${failureSummary}. Ongoing for ${describeDowntime(incident.startedAtIso, nowIso)}.`;
  }
  return `${failureSummary}. Down for ${describeDowntime(incident.startedAtIso, incident.endedAtIso)}.`;
}

export default async function AdminHealthPage() {
  await requireAdminSession();
  const now = new Date();
  const nowIso = now.toISOString();
  const windowStart = new Date(now.getTime() - healthWindowDays * 24 * 60 * 60 * 1000);

  const recentChecksByService = await readRecentChecksForAllServices(windowStart).catch((error) => {
    console.error("[admin] reading AI health checks failed:", error);
    return null;
  });

  const healthSummaries = allAiServiceNames.map((service) =>
    summarizeAiServiceHealth(service, recentChecksByService?.[service] ?? [], now.getTime()),
  );
  const incidentsNewestFirst = healthSummaries
    .flatMap((healthSummary) =>
      healthSummary.incidentsNewestFirst.map((incident) => ({ service: healthSummary.service, incident })),
    )
    .sort((first, second) => Date.parse(second.incident.startedAtIso) - Date.parse(first.incident.startedAtIso))
    .slice(0, 20);

  return (
    <>
      <AdminPageHeader
        title="Health"
        subtitle="Checks every AI service Dharma depends on every 10 minutes, with its real production key."
        pagePath="/admin/health"
      />
      {recentChecksByService === null ? (
        <div className={adminStyles.notice}>
          Couldn&apos;t read the check history from the database. If this is a new deploy, the ai_service_checks
          table may not exist yet.
        </div>
      ) : null}

      {healthSummaries.map((healthSummary) => (
        <div key={healthSummary.service} className={adminStyles.panel}>
          <div className={adminStyles.healthServiceHeader}>
            <span className={statusDotClassName(healthSummary)} />
            <span className={adminStyles.healthServiceName}>{aiServiceDisplayNames[healthSummary.service]}</span>
            <span className={adminStyles.healthServiceStatus}>{statusDescription(healthSummary, now.getTime())}</span>
            <span className={adminStyles.healthUptime}>
              {healthSummary.uptimePercent == null
                ? "No data yet"
                : `${healthSummary.uptimePercent}% up, ${healthWindowDays} days`}
            </span>
          </div>
          {healthSummary.currentStatus === "down" ? (
            <div className={adminStyles.healthDownDetail}>
              While this is down, {whatBreaksForUsers[healthSummary.service]}.
              {healthSummary.currentFailureDetail
                ? ` ${aiServiceDisplayNames[healthSummary.service]} said: ${healthSummary.currentFailureDetail}`
                : ""}
            </div>
          ) : null}
          <div
            className={adminStyles.healthTimeline}
            aria-label={`${aiServiceDisplayNames[healthSummary.service]} checks over the last ${healthWindowDays} days`}
          >
            {healthSummary.timelineSlots.map((timelineSlot, slotIndex) => (
              <span key={slotIndex} className={timelineSlotClassName(timelineSlot)} />
            ))}
          </div>
          <div className={adminStyles.healthTimelineLabels}>
            <span>{formatPacificTime(windowStart.toISOString())}</span>
            <span>now</span>
          </div>
          {healthSummary.service === "claude" ? (
            <div className={adminStyles.healthSpend}>
              <div className={adminStyles.tileNote}>
                Prepaid Anthropic credit left can&apos;t be read by any API. The check above is what catches running
                out.
              </div>
            </div>
          ) : null}
        </div>
      ))}

      <div className={adminStyles.panel}>
        <div className={adminStyles.panelTitle}>Incidents, last {healthWindowDays} days</div>
        {incidentsNewestFirst.length === 0 ? (
          <div className={adminStyles.emptyState}>No incidents.</div>
        ) : (
          incidentsNewestFirst.map(({ service, incident }) => (
            <div key={`${service}-${incident.startedAtIso}`} className={adminStyles.lineItem}>
              <span>
                {aiServiceDisplayNames[service]}: {incidentDescription(incident, nowIso)}
              </span>
              <span className={incident.endedAtIso === null ? adminStyles.changeBad : adminStyles.changeNeutral}>
                {formatPacificTime(incident.startedAtIso)} PT
              </span>
            </div>
          ))
        )}
        <div className={adminStyles.panelFootnote}>
          An email goes out the moment a service goes down and again when it recovers. Running out of credit or a
          rejected key alerts on the first failed check; outages wait for a second check so a blip doesn&apos;t page
          anyone.
        </div>
      </div>
    </>
  );
}
