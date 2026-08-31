import type { ActivityHistoryEvent } from "../data/activityHistory";

import type {
    ComplianceNetworkEvidenceEvent,
    ComplianceNetworkLineId,
} from "./complianceNetworkMap";

export interface BuildActivityComplianceNetworkEvidenceOptions {
  events: ActivityHistoryEvent[];
  now?: string | number | Date;
}

function requireTimestamp(value: string, fieldName: string): number {
  const milliseconds = new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  return milliseconds;
}

function parseNow(value: string | number | Date): number {
  const milliseconds =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error("Invalid activity-network current time.");
  }

  return milliseconds;
}

function activityLabel(activity: ActivityHistoryEvent["activity"]): string {
  switch (activity) {
    case "driving":
      return "Driving";

    case "break":
      return "Break";

    case "other-work":
      return "Other Work";

    case "poa":
      return "POA";
  }
}

function activityLineIds(
  activity: ActivityHistoryEvent["activity"],
): ComplianceNetworkLineId[] {
  switch (activity) {
    case "driving":
      return [
        "activity",
        "continuous-driving",
        "daily-driving",
        "weekly-driving",
        "fortnightly-driving",
      ];

    case "break":
      return ["activity", "continuous-driving", "wtd"];

    case "other-work":
      return ["activity", "wtd"];

    case "poa":
      return ["activity", "continuous-driving", "wtd"];
  }
}

function formatDuration(durationMilliseconds: number): string {
  const totalMinutes = Math.max(
    0,
    Math.floor(durationMilliseconds / (60 * 1000)),
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function startEvidence(
  event: ActivityHistoryEvent,
  startedAt: string,
): ComplianceNetworkEvidenceEvent {
  const label = activityLabel(event.activity);

  return {
    id: `activity-network-${event.id}-start`,
    occurredAt: startedAt,
    title: `${label} started`,
    summary: `${label} began at ${startedAt}.`,
    severity: "info",
    lineIds: activityLineIds(event.activity),
    sourceIds: [event.id],
  };
}

function endEvidence(
  event: ActivityHistoryEvent,
  endedAt: string,
  durationMilliseconds: number,
  activeSnapshot: boolean,
): ComplianceNetworkEvidenceEvent {
  const label = activityLabel(event.activity);
  const duration = formatDuration(durationMilliseconds);

  return {
    id: `activity-network-${event.id}-${activeSnapshot ? "live" : "end"}`,
    occurredAt: endedAt,
    title: activeSnapshot ? `${label} active` : `${label} ended`,
    summary: activeSnapshot
      ? `${label} is active with ${duration} elapsed.`
      : `${label} ended after ${duration}.`,
    severity: "info",
    lineIds: activityLineIds(event.activity),
    sourceIds: [event.id],
  };
}

export function buildActivityComplianceNetworkEvidence(
  options: BuildActivityComplianceNetworkEvidenceOptions,
): ComplianceNetworkEvidenceEvent[] {
  const nowMilliseconds = parseNow(options.now ?? Date.now());
  const eventIds = new Set<string>();
  const evidence: ComplianceNetworkEvidenceEvent[] = [];

  for (const event of options.events) {
    if (event.id.trim().length === 0) {
      throw new Error(
        "Activity-network evidence requires non-empty event ids.",
      );
    }

    if (eventIds.has(event.id)) {
      throw new Error(`Duplicate activity-history event id: ${event.id}`);
    }

    eventIds.add(event.id);

    const startMilliseconds = requireTimestamp(
      event.startedAt,
      `activity start for ${event.id}`,
    );
    const startedAt = new Date(startMilliseconds).toISOString();
    const activeSnapshot = event.endedAt === null;
    const endMilliseconds =
      event.endedAt === null
        ? nowMilliseconds
        : requireTimestamp(event.endedAt, `activity end for ${event.id}`);

    if (endMilliseconds < startMilliseconds) {
      throw new Error(`Activity ${event.id} ends before it starts.`);
    }

    const endedAt = new Date(endMilliseconds).toISOString();
    const calculatedDurationMilliseconds = endMilliseconds - startMilliseconds;
    const durationMilliseconds =
      !activeSnapshot &&
      event.durationMilliseconds !== null &&
      Number.isFinite(event.durationMilliseconds) &&
      event.durationMilliseconds >= 0
        ? event.durationMilliseconds
        : calculatedDurationMilliseconds;

    evidence.push(startEvidence(event, startedAt));
    evidence.push(
      endEvidence(event, endedAt, durationMilliseconds, activeSnapshot),
    );
  }

  return evidence.sort((left, right) => {
    const timeDifference =
      new Date(left.occurredAt).getTime() -
      new Date(right.occurredAt).getTime();

    return timeDifference !== 0
      ? timeDifference
      : left.id.localeCompare(right.id);
  });
}
