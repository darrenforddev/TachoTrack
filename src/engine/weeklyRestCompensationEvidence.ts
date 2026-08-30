import type { RestSession } from "../data/restSession";

import type { CompensationRestCandidate } from "./weeklyRestCompensationAllocation";

const MINUTES_PER_HOUR = 60;

export const WEEKLY_REST_COMPENSATION_EVIDENCE_LIMITS = {
  regularDailyRestMinutes: 11 * MINUTES_PER_HOUR,

  reducedDailyRestMinutes: 9 * MINUTES_PER_HOUR,

  regularWeeklyRestMinutes: 45 * MINUTES_PER_HOUR,

  reducedWeeklyRestMinutes: 24 * MINUTES_PER_HOUR,
} as const;

export type VerifiedAttachedRestType =
  | "regular-daily-rest"
  | "regular-weekly-rest";

export type CompensationEvidenceRejectionReason =
  | "session-not-completed"
  | "session-interrupted"
  | "missing-end-timestamp"
  | "missing-duration"
  | "invalid-timestamps"
  | "duration-mismatch"
  | "daily-rest-below-nine-hours"
  | "reduced-daily-rest-unverified"
  | "weekly-rest-below-24-hours"
  | "reduced-weekly-rest-unverified"
  | "no-compensation-surplus";

export interface VerifiedCompensationRestCandidate extends CompensationRestCandidate {
  sessionId: string;

  startedAt: string;

  endedAt: string;

  attachedRestType: VerifiedAttachedRestType;

  verificationStatus: "verified";
}

export interface WeeklyRestCompensationEvidence {
  sessionId: string;

  status: "verified" | "rejected";

  candidate: VerifiedCompensationRestCandidate | null;

  rejectionReason: CompensationEvidenceRejectionReason | null;
}

function rejectEvidence(
  session: RestSession,
  rejectionReason: CompensationEvidenceRejectionReason,
): WeeklyRestCompensationEvidence {
  return {
    sessionId: session.id,

    status: "rejected",

    candidate: null,

    rejectionReason,
  };
}

function formatLocalDate(timestamp: string): string {
  const date = new Date(timestamp);

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function evaluateWeeklyRestCompensationEvidence(
  session: RestSession,
): WeeklyRestCompensationEvidence {
  if (session.status === "interrupted") {
    return rejectEvidence(session, "session-interrupted");
  }

  if (session.status !== "completed") {
    return rejectEvidence(session, "session-not-completed");
  }

  if (session.endedAt === null) {
    return rejectEvidence(session, "missing-end-timestamp");
  }

  if (session.durationMilliseconds === null) {
    return rejectEvidence(session, "missing-duration");
  }

  const startTimestamp = new Date(session.startedAt).getTime();

  const endTimestamp = new Date(session.endedAt).getTime();

  if (
    !Number.isFinite(startTimestamp) ||
    !Number.isFinite(endTimestamp) ||
    endTimestamp <= startTimestamp
  ) {
    return rejectEvidence(session, "invalid-timestamps");
  }

  const derivedDurationMilliseconds = endTimestamp - startTimestamp;

  if (session.durationMilliseconds !== derivedDurationMilliseconds) {
    return rejectEvidence(session, "duration-mismatch");
  }

  const totalRestMinutes = Math.floor(
    derivedDurationMilliseconds / (60 * 1000),
  );

  let baseRequiredRestMinutes: number;

  let attachedRestType: VerifiedAttachedRestType;

  if (session.type === "daily") {
    if (
      totalRestMinutes <
      WEEKLY_REST_COMPENSATION_EVIDENCE_LIMITS.reducedDailyRestMinutes
    ) {
      return rejectEvidence(session, "daily-rest-below-nine-hours");
    }

    if (
      totalRestMinutes <
      WEEKLY_REST_COMPENSATION_EVIDENCE_LIMITS.regularDailyRestMinutes
    ) {
      return rejectEvidence(session, "reduced-daily-rest-unverified");
    }

    baseRequiredRestMinutes =
      WEEKLY_REST_COMPENSATION_EVIDENCE_LIMITS.regularDailyRestMinutes;

    attachedRestType = "regular-daily-rest";
  } else {
    if (
      totalRestMinutes <
      WEEKLY_REST_COMPENSATION_EVIDENCE_LIMITS.reducedWeeklyRestMinutes
    ) {
      return rejectEvidence(session, "weekly-rest-below-24-hours");
    }

    if (
      totalRestMinutes <
      WEEKLY_REST_COMPENSATION_EVIDENCE_LIMITS.regularWeeklyRestMinutes
    ) {
      return rejectEvidence(session, "reduced-weekly-rest-unverified");
    }

    baseRequiredRestMinutes =
      WEEKLY_REST_COMPENSATION_EVIDENCE_LIMITS.regularWeeklyRestMinutes;

    attachedRestType = "regular-weekly-rest";
  }

  if (totalRestMinutes <= baseRequiredRestMinutes) {
    return rejectEvidence(session, "no-compensation-surplus");
  }

  const candidate: VerifiedCompensationRestCandidate = {
    id: `verified-compensation-${session.id}`,

    sessionId: session.id,

    date: formatLocalDate(session.endedAt),

    startedAt: session.startedAt,

    endedAt: session.endedAt,

    totalRestMinutes,

    baseRequiredRestMinutes,

    attachedRestType,

    verificationStatus: "verified",
  };

  return {
    sessionId: session.id,

    status: "verified",

    candidate,

    rejectionReason: null,
  };
}

export function buildWeeklyRestCompensationEvidence(
  sessions: RestSession[],
): WeeklyRestCompensationEvidence[] {
  return sessions.map(evaluateWeeklyRestCompensationEvidence);
}
