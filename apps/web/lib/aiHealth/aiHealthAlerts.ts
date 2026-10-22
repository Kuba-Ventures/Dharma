import { adminTimeZone } from "../admin/adminRange";
import type {
  AiServiceCheckResult,
  AiServiceFailureKind,
  AiServiceName,
  AiServiceStatus,
} from "./aiHealthChecks";

export type AiServiceAlertKind = "down" | "recovered";

export type StoredAiServiceCheck = {
  service: AiServiceName;
  status: AiServiceStatus;
  failureKind: AiServiceFailureKind | null;
  failureDetail: string | null;
  checkedAt: string;
  alertSent: AiServiceAlertKind | null;
};

const failureKindsThatNeverFixThemselves: AiServiceFailureKind[] = [
  "out_of_credits",
  "out_of_quota",
  "key_rejected",
  "key_not_allowed",
];

export const aiServiceDisplayNames: Record<AiServiceName, string> = {
  claude: "Claude",
};

export const whatBreaksForUsers: Record<AiServiceName, string> = {
  claude:
    "Dharma cannot draft replies, label incoming email, detect scheduling requests or suggest meeting times, so every AI feature in Gmail and the dashboard fails",
};

const whatToDo: Record<AiServiceFailureKind, (service: AiServiceName) => string> = {
  out_of_credits: (service) =>
    service === "claude"
      ? "An admin on the Anthropic org that owns Dharma's ANTHROPIC_API_KEY needs to add credits in Console > Billing and turn on auto-reload. Finley can confirm which org that is."
      : `Add credit to the ${aiServiceDisplayNames[service]} account.`,
  out_of_quota: (service) =>
    `The ${aiServiceDisplayNames[service]} plan has used all of its allowance for this period. Upgrade the plan or wait for it to reset.`,
  key_rejected: (service) =>
    `The ${aiServiceDisplayNames[service]} API key was rejected. It was probably revoked or rotated, so Finley needs to check the key in the dharma project's Vercel environment variables.`,
  key_not_allowed: (service) =>
    `The ${aiServiceDisplayNames[service]} API key is valid but not allowed to do this. Check its permissions and workspace.`,
  rate_limited: (service) =>
    `${aiServiceDisplayNames[service]} is rate limiting the key. Check the rate limits for the workspace the key belongs to.`,
  provider_outage: (service) =>
    `${aiServiceDisplayNames[service]} is having problems on their side. Check their status page. Nothing to change unless it lasts.`,
  unreachable: (service) =>
    `${aiServiceDisplayNames[service]} could not be reached from Vercel at all. Usually a network blip; check their status page if it lasts.`,
  unexpected_response: (service) =>
    `${aiServiceDisplayNames[service]} answered with something unexpected. The detail below says what.`,
  not_configured: (service) =>
    `The ${aiServiceDisplayNames[service]} key is missing from the dharma project's Vercel environment variables.`,
  cannot_check: (service) => `The ${aiServiceDisplayNames[service]} key cannot be checked with the permissions it has.`,
};

export const aiServiceFailureSummaries: Record<AiServiceFailureKind, string> = {
  out_of_credits: "the credit balance is too low",
  out_of_quota: "the plan is out of quota",
  key_rejected: "the API key was rejected",
  key_not_allowed: "the API key is not allowed",
  rate_limited: "requests are being rate limited",
  provider_outage: "the service is having an outage",
  unreachable: "the service cannot be reached",
  unexpected_response: "it returned an unexpected error",
  not_configured: "the key is not configured",
  cannot_check: "the key cannot be checked",
};

export function escapeHtml(unsafeText: string): string {
  return unsafeText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function checksInTheCurrentIncident(earlierChecksNewestFirst: StoredAiServiceCheck[]): StoredAiServiceCheck[] {
  const indexOfMostRecentWorkingCheck = earlierChecksNewestFirst.findIndex((check) => check.status === "working");
  return indexOfMostRecentWorkingCheck === -1
    ? earlierChecksNewestFirst
    : earlierChecksNewestFirst.slice(0, indexOfMostRecentWorkingCheck);
}

export function decideAiServiceAlert(
  newCheck: Pick<AiServiceCheckResult, "status" | "failureKind">,
  earlierChecksNewestFirst: StoredAiServiceCheck[],
): AiServiceAlertKind | null {
  const currentIncidentChecks = checksInTheCurrentIncident(earlierChecksNewestFirst);
  const downAlertAlreadySentForThisIncident = currentIncidentChecks.some((check) => check.alertSent === "down");

  if (newCheck.status === "working") {
    return downAlertAlreadySentForThisIncident ? "recovered" : null;
  }
  if (newCheck.status !== "down" || downAlertAlreadySentForThisIncident) {
    return null;
  }

  const failureNeverFixesItself =
    newCheck.failureKind !== null && failureKindsThatNeverFixThemselves.includes(newCheck.failureKind);
  const previousCheckWasAlsoDown = earlierChecksNewestFirst[0]?.status === "down";
  return failureNeverFixesItself || previousCheckWasAlsoDown ? "down" : null;
}

export function downSinceForIncident(earlierChecksNewestFirst: StoredAiServiceCheck[], fallbackInstantIso: string): string {
  const currentIncidentDownChecks = checksInTheCurrentIncident(earlierChecksNewestFirst).filter(
    (check) => check.status === "down",
  );
  return currentIncidentDownChecks.at(-1)?.checkedAt ?? fallbackInstantIso;
}

export function formatPacificTime(instantIso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: adminTimeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instantIso));
}

export function describeDowntime(downSinceIso: string, recoveredAtIso: string): string {
  const totalMinutes = Math.max(1, Math.round((Date.parse(recoveredAtIso) - Date.parse(downSinceIso)) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  if (minutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export type AiServiceAlertEmailInput = {
  alertKind: AiServiceAlertKind;
  service: AiServiceName;
  failureKind: AiServiceFailureKind | null;
  failureDetail: string | null;
  downSinceIso: string;
  nowIso: string;
  healthPageUrl: string;
};

export type AiServiceAlertEmail = { subject: string; text: string; html: string };

export function buildAiServiceAlertEmail(alertInput: AiServiceAlertEmailInput): AiServiceAlertEmail {
  const serviceName = aiServiceDisplayNames[alertInput.service];
  const paragraphs = alertEmailParagraphs(alertInput, serviceName);
  const subject =
    alertInput.alertKind === "down"
      ? `Dharma is down: ${serviceName} says ${aiServiceFailureSummaries[alertInput.failureKind ?? "unexpected_response"]}`
      : `Dharma is back: ${serviceName} is working again`;
  const text = [...paragraphs, `Health page: ${alertInput.healthPageUrl}`].join("\n\n");
  const accentColor = alertInput.alertKind === "down" ? "#dc2626" : "#16a34a";
  const html =
    `<div style="font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">` +
    `<div style="border-left:4px solid ${accentColor};padding-left:14px">` +
    `<h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(subject)}</h1>` +
    paragraphs
      .map((paragraph) => `<p style="font-size:14px;line-height:1.5;margin:0 0 12px">${escapeHtml(paragraph)}</p>`)
      .join("") +
    `</div>` +
    `<p style="margin:20px 0 0"><a href="${escapeHtml(alertInput.healthPageUrl)}" style="background:#111827;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600">Open the Health page</a></p>` +
    `</div>`;
  return { subject, text, html };
}

function alertEmailParagraphs(alertInput: AiServiceAlertEmailInput, serviceName: string): string[] {
  if (alertInput.alertKind === "recovered") {
    return [
      `${serviceName} started working again at ${formatPacificTime(alertInput.nowIso)} PT.`,
      `It was down for ${describeDowntime(alertInput.downSinceIso, alertInput.nowIso)}, since ${formatPacificTime(alertInput.downSinceIso)} PT.`,
    ];
  }
  const failureKind = alertInput.failureKind ?? "unexpected_response";
  const paragraphs = [
    `Since ${formatPacificTime(alertInput.downSinceIso)} PT, ${whatBreaksForUsers[alertInput.service]}.`,
    whatToDo[failureKind](alertInput.service),
  ];
  if (alertInput.failureDetail) {
    paragraphs.push(`What ${serviceName} said: ${alertInput.failureDetail}`);
  }
  paragraphs.push("You will get one more email when it recovers.");
  return paragraphs;
}

export const defaultAiHealthAlertRecipient = "finley@qsbsrollover.com";

export function parseAiHealthAlertRecipients(rawRecipientList: string | undefined): string[] {
  const recipientList = rawRecipientList?.trim() ? rawRecipientList : defaultAiHealthAlertRecipient;
  return recipientList
    .split(/[,;\s]+/)
    .map((recipient) => recipient.trim().toLowerCase())
    .filter((recipient) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient));
}
