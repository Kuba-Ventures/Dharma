import { prisma } from "../prisma";
import { sendOpsAlert } from "../opsAlert";
import {
  buildAiServiceAlertEmail,
  decideAiServiceAlert,
  downSinceForIncident,
  parseAiHealthAlertRecipients,
  type AiServiceAlertKind,
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

async function sendAiServiceAlert(
  alertKind: AiServiceAlertKind,
  checkResult: AiServiceCheckResult,
  downSinceIso: string,
  nowIso: string,
): Promise<boolean> {
  const alertEmail = buildAiServiceAlertEmail({
    alertKind,
    service: checkResult.service,
    failureKind: checkResult.failureKind,
    failureDetail: checkResult.failureDetail,
    downSinceIso,
    nowIso,
    healthPageUrl,
  });
  const emailWasSent = await sendAlertEmailThroughResend(
    alertEmail,
    `ai-health-${checkResult.service}-${alertKind}-${downSinceIso}`,
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

async function recordCheckAndAlertIfNeeded(checkResult: AiServiceCheckResult, now: Date): Promise<AiServiceCheckOutcome> {
  const nowIso = now.toISOString();
  const earlierChecksNewestFirst = await readEarlierChecksNewestFirst(checkResult.service);
  const alertKindToSend = decideAiServiceAlert(checkResult, earlierChecksNewestFirst);
  const downSinceIso = downSinceForIncident(earlierChecksNewestFirst, nowIso);

  const alertWasSent =
    alertKindToSend !== null && (await sendAiServiceAlert(alertKindToSend, checkResult, downSinceIso, nowIso));
  const alertSent = alertWasSent ? alertKindToSend : null;

  await prisma.aiServiceCheck.create({
    data: {
      service: checkResult.service,
      checkedAt: now,
      status: checkResult.status,
      failureKind: checkResult.failureKind,
      failureDetail: checkResult.failureDetail,
      latencyMs: checkResult.latencyMilliseconds,
      alertSent,
    },
  });

  return {
    service: checkResult.service,
    status: checkResult.status,
    failureKind: checkResult.failureKind,
    alertSent,
  };
}

export async function runAiHealthCheck(now = new Date()): Promise<AiServiceCheckOutcome[]> {
  const checkResults = await checkAllAiServices();
  return Promise.all(checkResults.map((checkResult) => recordCheckAndAlertIfNeeded(checkResult, now)));
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
