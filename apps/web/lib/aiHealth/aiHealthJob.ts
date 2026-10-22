import { prisma } from "../prisma";
import { sendOpsAlert } from "../opsAlert";
import {
  aDownEmailWentOutForThisServiceSince,
  buildAiHealthAlertEmail,
  downSinceForIncident,
  isOutageWorthReporting,
  isRecoveryAwaitingReport,
  parseAiHealthAlertRecipients,
  reportedIncidentTimes,
  startOfPacificDay,
  type AiHealthAlertEmailInput,
  type AiServiceAlertKind,
  type ServiceOutageForEmail,
  type ServiceRecoveryForEmail,
  type StoredAiServiceCheck,
} from "./aiHealthAlerts";
import {
  allAiServiceNames,
  checkAllAiServices,
  type AiServiceCheckResult,
  type AiServiceFailureKind,
  type AiServiceName,
  type AiServiceStatus,
} from "./aiHealthChecks";
import type { StoredAiServiceCheckWithLatency } from "./aiHealthSummary";

export const healthPageUrl = "https://www.dharmaautomations.com/admin/health";
const earlierChecksToReadPerService = 300;

type AiServiceCheckRow = {
  service: string;
  status: string;
  failureKind: string | null;
  failureDetail: string | null;
  checkedAt: Date;
  alertSent: string | null;
  latencyMs: number | null;
};

function storedCheckFromRow(checkRow: AiServiceCheckRow): StoredAiServiceCheckWithLatency {
  return {
    service: checkRow.service as AiServiceName,
    status: checkRow.status as AiServiceStatus,
    failureKind: checkRow.failureKind as AiServiceFailureKind | null,
    failureDetail: checkRow.failureDetail,
    checkedAt: checkRow.checkedAt.toISOString(),
    alertSent: checkRow.alertSent as AiServiceAlertKind | null,
    latencyMilliseconds: checkRow.latencyMs,
  };
}

async function readEarlierChecksNewestFirst(service: AiServiceName): Promise<StoredAiServiceCheck[]> {
  const checkRows = await prisma.aiServiceCheck.findMany({
    where: { service },
    orderBy: { checkedAt: "desc" },
    take: earlierChecksToReadPerService,
  });
  return checkRows.map(storedCheckFromRow);
}

async function sendAlertEmailThroughResend(
  alertEmail: { subject: string; html: string; text: string },
  idempotencyKey: string,
  recipients: string[],
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.AI_HEALTH_ALERT_FROM;
  if (!resendApiKey || !fromAddress || recipients.length === 0) {
    console.warn("[ai-health] RESEND_API_KEY or AI_HEALTH_ALERT_FROM not set, cannot email the alert");
    return false;
  }
  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: recipients,
        subject: alertEmail.subject,
        html: alertEmail.html,
        text: alertEmail.text,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!resendResponse.ok) {
      console.error(`[ai-health] Resend ${resendResponse.status}: ${await resendResponse.text()}`);
      return false;
    }
    console.log(`[ai-health] emailed ${idempotencyKey} to ${recipients.join(", ")}`);
    return true;
  } catch (error) {
    console.error("[ai-health] alert email failed:", error);
    return false;
  }
}

async function sendAiHealthAlert(emailInput: AiHealthAlertEmailInput, now: Date): Promise<boolean> {
  const alertEmail = buildAiHealthAlertEmail(emailInput);
  const emailWasSent = await sendAlertEmailThroughResend(
    alertEmail,
    `ai-health-${now.toISOString()}`,
    parseAiHealthAlertRecipients(process.env.AI_HEALTH_ALERT_TO),
  );
  await sendOpsAlert(`${alertEmail.subject}. ${healthPageUrl}`);
  const opsWebhookIsConfigured = Boolean(process.env.OPS_ALERT_WEBHOOK_URL);
  return emailWasSent || opsWebhookIsConfigured;
}

export type AiServiceCheckOutcome = {
  service: AiServiceName;
  status: AiServiceStatus;
  failureKind: AiServiceFailureKind | null;
  alertSent: AiServiceAlertKind | null;
};

export type AiHealthRunOutcome = {
  checks: AiServiceCheckOutcome[];
  alert: "sent" | "not_needed" | "send_failed";
};

export async function runAiHealthCheck(now = new Date()): Promise<AiHealthRunOutcome> {
  const nowIso = now.toISOString();
  const checkResults = await checkAllAiServices();
  const earlierChecksByService = await Promise.all(
    checkResults.map((checkResult) => readEarlierChecksNewestFirst(checkResult.service)),
  );

  const startOfTodayIso = startOfPacificDay(now).toISOString();
  const outages: ServiceOutageForEmail[] = [];
  const recoveries: ServiceRecoveryForEmail[] = [];
  const alertKindByService = new Map<AiServiceName, AiServiceAlertKind>();
  checkResults.forEach((checkResult, checkIndex) => {
    const earlierChecksNewestFirst = earlierChecksByService[checkIndex];
    const outageIsNewAndNotAlreadyEmailedToday =
      isOutageWorthReporting(checkResult, earlierChecksNewestFirst) &&
      !aDownEmailWentOutForThisServiceSince(earlierChecksNewestFirst, startOfTodayIso);
    if (outageIsNewAndNotAlreadyEmailedToday) {
      outages.push({
        service: checkResult.service,
        failureKind: checkResult.failureKind,
        failureDetail: checkResult.failureDetail,
        downSinceIso: downSinceForIncident(earlierChecksNewestFirst, nowIso),
      });
      alertKindByService.set(checkResult.service, "down");
    } else if (isRecoveryAwaitingReport(checkResult, earlierChecksNewestFirst)) {
      recoveries.push({ service: checkResult.service, ...reportedIncidentTimes(earlierChecksNewestFirst, nowIso) });
      alertKindByService.set(checkResult.service, "recovered");
    }
  });

  let alertOutcome: AiHealthRunOutcome["alert"] = "not_needed";
  if (outages.length > 0 || recoveries.length > 0) {
    const alertWasSent = await sendAiHealthAlert({ outages, recoveries, healthPageUrl }, now);
    alertOutcome = alertWasSent ? "sent" : "send_failed";
  }

  const checkRowsToInsert = checkResults.map((checkResult) => ({
    service: checkResult.service,
    checkedAt: now,
    status: checkResult.status,
    failureKind: checkResult.failureKind,
    failureDetail: checkResult.failureDetail,
    latencyMs: checkResult.latencyMilliseconds,
    alertSent: alertOutcome === "sent" ? alertKindByService.get(checkResult.service) ?? null : null,
  }));
  await prisma.aiServiceCheck.createMany({ data: checkRowsToInsert });

  return {
    checks: checkRowsToInsert.map((checkRow) => ({
      service: checkRow.service,
      status: checkRow.status,
      failureKind: checkRow.failureKind,
      alertSent: checkRow.alertSent,
    })),
    alert: alertOutcome,
  };
}

export async function readRecentChecksForAllServices(
  since: Date,
): Promise<Record<AiServiceName, StoredAiServiceCheckWithLatency[]>> {
  const checkRows = await prisma.aiServiceCheck.findMany({
    where: { checkedAt: { gte: since } },
    orderBy: { checkedAt: "desc" },
    take: 5000,
  });
  const checksByService = Object.fromEntries(
    allAiServiceNames.map((service) => [service, [] as StoredAiServiceCheckWithLatency[]]),
  ) as Record<AiServiceName, StoredAiServiceCheckWithLatency[]>;
  for (const checkRow of checkRows) {
    checksByService[checkRow.service as AiServiceName]?.push(storedCheckFromRow(checkRow));
  }
  return checksByService;
}

export async function readServicesCurrentlyDown(): Promise<StoredAiServiceCheck[]> {
  const latestChecks = await Promise.all(
    allAiServiceNames.map((service) =>
      prisma.aiServiceCheck.findFirst({ where: { service }, orderBy: { checkedAt: "desc" } }),
    ),
  );
  return latestChecks
    .filter((latestCheck): latestCheck is NonNullable<typeof latestCheck> => latestCheck !== null)
    .map(storedCheckFromRow)
    .filter((latestCheck) => latestCheck.status === "down");
}
