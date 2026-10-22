import type { StoredAiServiceCheck } from "./aiHealthAlerts";
import type { AiServiceFailureKind, AiServiceName, AiServiceStatus } from "./aiHealthChecks";

export type AiServiceTimelineSlot = "working" | "down" | "no_data";

export type AiServiceIncident = {
  startedAtIso: string;
  endedAtIso: string | null;
  failureKind: AiServiceFailureKind | null;
  failureDetail: string | null;
};

export type AiServiceHealthSummary = {
  service: AiServiceName;
  currentStatus: AiServiceStatus | "never_checked";
  lastCheckedAtIso: string | null;
  lastLatencyMilliseconds: number | null;
  currentFailureKind: AiServiceFailureKind | null;
  currentFailureDetail: string | null;
  uptimePercent: number | null;
  timelineSlots: AiServiceTimelineSlot[];
  incidentsNewestFirst: AiServiceIncident[];
};

export const healthWindowDays = 7;
export const timelineSlotCount = 56;

export type StoredAiServiceCheckWithLatency = StoredAiServiceCheck & { latencyMilliseconds: number | null };

export function timelineSlotsForChecks(
  checksNewestFirst: StoredAiServiceCheck[],
  windowStartMilliseconds: number,
  windowEndMilliseconds: number,
  slotCount = timelineSlotCount,
): AiServiceTimelineSlot[] {
  const slotLengthMilliseconds = (windowEndMilliseconds - windowStartMilliseconds) / slotCount;
  const timelineSlots: AiServiceTimelineSlot[] = Array.from({ length: slotCount }, () => "no_data");
  for (const check of checksNewestFirst) {
    const checkedAtMilliseconds = Date.parse(check.checkedAt);
    if (checkedAtMilliseconds < windowStartMilliseconds || checkedAtMilliseconds > windowEndMilliseconds) continue;
    const slotIndex = Math.min(
      slotCount - 1,
      Math.floor((checkedAtMilliseconds - windowStartMilliseconds) / slotLengthMilliseconds),
    );
    if (check.status === "down") {
      timelineSlots[slotIndex] = "down";
    } else if (check.status === "working" && timelineSlots[slotIndex] === "no_data") {
      timelineSlots[slotIndex] = "working";
    }
  }
  return timelineSlots;
}

export function incidentsFromChecks(checksNewestFirst: StoredAiServiceCheck[]): AiServiceIncident[] {
  const incidentsOldestFirst: AiServiceIncident[] = [];
  let openIncident: AiServiceIncident | null = null;
  for (const check of [...checksNewestFirst].reverse()) {
    if (check.status === "down" && openIncident === null) {
      openIncident = {
        startedAtIso: check.checkedAt,
        endedAtIso: null,
        failureKind: check.failureKind,
        failureDetail: check.failureDetail,
      };
      incidentsOldestFirst.push(openIncident);
    } else if (check.status === "working" && openIncident !== null) {
      openIncident.endedAtIso = check.checkedAt;
      openIncident = null;
    }
  }
  return incidentsOldestFirst.reverse();
}

export function uptimePercentForChecks(checksNewestFirst: StoredAiServiceCheck[]): number | null {
  const conclusiveChecks = checksNewestFirst.filter((check) => check.status === "working" || check.status === "down");
  if (conclusiveChecks.length === 0) return null;
  const workingCheckCount = conclusiveChecks.filter((check) => check.status === "working").length;
  return Math.round((workingCheckCount / conclusiveChecks.length) * 1000) / 10;
}

export function summarizeAiServiceHealth(
  service: AiServiceName,
  checksNewestFirst: StoredAiServiceCheckWithLatency[],
  nowMilliseconds: number,
): AiServiceHealthSummary {
  const latestCheck = checksNewestFirst[0] ?? null;
  const windowStartMilliseconds = nowMilliseconds - healthWindowDays * 24 * 60 * 60 * 1000;
  return {
    service,
    currentStatus: latestCheck?.status ?? "never_checked",
    lastCheckedAtIso: latestCheck?.checkedAt ?? null,
    lastLatencyMilliseconds: latestCheck?.latencyMilliseconds ?? null,
    currentFailureKind: latestCheck?.failureKind ?? null,
    currentFailureDetail: latestCheck?.failureDetail ?? null,
    uptimePercent: uptimePercentForChecks(checksNewestFirst),
    timelineSlots: timelineSlotsForChecks(checksNewestFirst, windowStartMilliseconds, nowMilliseconds),
    incidentsNewestFirst: incidentsFromChecks(checksNewestFirst),
  };
}
