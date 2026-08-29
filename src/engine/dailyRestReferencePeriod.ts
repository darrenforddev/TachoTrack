import type { RestSession } from "../data/restSession";

export type DailyRestReferencePeriodStatus = "verified" | "unverified";

export type DailyRestReferenceSource =
  | "regular-daily-rest"
  | "verified-reduced-daily-rest"
  | "regular-weekly-rest"
  | "unknown";

export interface VerifiedReducedDailyRestEvidence {
  sessionId: string;
  verified: boolean;
}

export interface DailyRestReferencePeriod {
  status: DailyRestReferencePeriodStatus;

  referenceStart: string | null;
  referenceDeadline: string | null;

  source: DailyRestReferenceSource;
  sourceSessionId: string | null;

  minutesUntilDeadline: number | null;
  deadlinePassed: boolean;

  message: string;
}

const MINUTES_PER_HOUR = 60;

export const DAILY_REST_REFERENCE_LIMITS = {
  referencePeriodMinutes: 24 * MINUTES_PER_HOUR,

  /**
   * Safe first-version evidence thresholds.
   *
   * A completed daily RestSession below 9 hours
   * is not accepted as a reference boundary.
   *
   * Weekly rest is deliberately restricted to
   * the currently implemented 45-hour regular
   * weekly-rest milestone.
   *
   * Reduced weekly rest is NOT inferred here yet.
   */
  reducedDailyRestMinutes: 9 * MINUTES_PER_HOUR,
  regularDailyRestMinutes: 11 * MINUTES_PER_HOUR,
  regularWeeklyRestMinutes: 45 * MINUTES_PER_HOUR,
} as const;

function toTimestamp(timestamp: string): number {
  return new Date(timestamp).getTime();
}

function addMinutes(timestamp: string, minutes: number): string {
  return new Date(toTimestamp(timestamp) + minutes * 60 * 1000).toISOString();
}

function getCompletedDurationMinutes(session: RestSession): number | null {
  if (session.status !== "completed" || session.endedAt === null) {
    return null;
  }

  if (session.durationMilliseconds !== null) {
    return Math.floor(session.durationMilliseconds / (60 * 1000));
  }

  const startedAt = toTimestamp(session.startedAt);

  const endedAt = toTimestamp(session.endedAt);

  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(endedAt) ||
    endedAt <= startedAt
  ) {
    return null;
  }

  return Math.floor((endedAt - startedAt) / (60 * 1000));
}

function isQualifyingReferenceSession(
  session: RestSession,
  verifiedReducedRestEvidence: VerifiedReducedDailyRestEvidence[] = [],
): boolean {
  const durationMinutes = getCompletedDurationMinutes(session);

  if (durationMinutes === null) {
    return false;
  }

  if (session.type === "weekly") {
    return (
      durationMinutes >= DAILY_REST_REFERENCE_LIMITS.regularWeeklyRestMinutes
    );
  }

  /**
   * A completed daily rest of 11 hours or more
   * can establish a regular daily-rest boundary.
   *
   * A 9-hour reduced daily rest is deliberately
   * NOT accepted here yet.
   *
   * Duration alone cannot prove that the driver
   * was legally entitled to use another reduced
   * daily rest. That requires reduced-rest history
   * and the weekly-rest reset context.
   *
   * Until that entitlement is verified, TachoTrack
   * must leave the reference period unverified.
   */
  if (durationMinutes >= DAILY_REST_REFERENCE_LIMITS.regularDailyRestMinutes) {
    return true;
  }

  const hasVerifiedReducedRestEvidence = verifiedReducedRestEvidence.some(
    (evidence) => evidence.sessionId === session.id && evidence.verified,
  );

  return (
    durationMinutes >= DAILY_REST_REFERENCE_LIMITS.reducedDailyRestMinutes &&
    hasVerifiedReducedRestEvidence
  );
}

function getReferenceSource(
  session: RestSession,
  verifiedReducedRestEvidence: VerifiedReducedDailyRestEvidence[] = [],
): DailyRestReferenceSource {
  const durationMinutes = getCompletedDurationMinutes(session);

  if (durationMinutes === null) {
    return "unknown";
  }

  if (
    session.type === "weekly" &&
    durationMinutes >= DAILY_REST_REFERENCE_LIMITS.regularWeeklyRestMinutes
  ) {
    return "regular-weekly-rest";
  }

  if (
    session.type === "daily" &&
    durationMinutes >= DAILY_REST_REFERENCE_LIMITS.regularDailyRestMinutes
  ) {
    return "regular-daily-rest";
  }

  const hasVerifiedReducedRestEvidence = verifiedReducedRestEvidence.some(
    (evidence) => evidence.sessionId === session.id && evidence.verified,
  );

  if (
    session.type === "daily" &&
    durationMinutes >= DAILY_REST_REFERENCE_LIMITS.reducedDailyRestMinutes &&
    hasVerifiedReducedRestEvidence
  ) {
    return "verified-reduced-daily-rest";
  }

  return "unknown";
}

/**
 * Finds the most recent completed RestSession
 * that can safely act as the beginning of the
 * current 24-hour daily-rest reference period.
 *
 * IMPORTANT:
 *
 * The reference begins at the END of the previous
 * qualifying daily or weekly rest.
 *
 * We deliberately do not use:
 *
 * - start of the shift
 * - first driving event
 * - last driving event
 * - last other-work event
 *
 * as a substitute for that legal boundary.
 */
export function findPreviousQualifyingRestSession(
  sessions: RestSession[],
  beforeTimestamp: string,
  verifiedReducedRestEvidence: VerifiedReducedDailyRestEvidence[] = [],
): RestSession | null {
  const beforeTime = toTimestamp(beforeTimestamp);

  if (!Number.isFinite(beforeTime)) {
    return null;
  }

  return (
    sessions
      .filter((session) =>
        isQualifyingReferenceSession(session, verifiedReducedRestEvidence),
      )
      .filter(
        (session) =>
          session.endedAt !== null &&
          toTimestamp(session.endedAt) <= beforeTime,
      )
      .slice()
      .sort((a, b) => {
        const aEnded = a.endedAt === null ? 0 : toTimestamp(a.endedAt);

        const bEnded = b.endedAt === null ? 0 : toTimestamp(b.endedAt);

        return bEnded - aEnded;
      })[0] ?? null
  );
}

/**
 * Builds the current 24-hour reference period
 * from recorded qualifying-rest evidence.
 *
 * If TachoTrack cannot establish the preceding
 * qualifying rest from its own data, the result
 * is UNVERIFIED.
 *
 * That is intentional.
 *
 * An unknown legal boundary must never be silently
 * replaced with an inferred work timestamp.
 */
export function calculateDailyRestReferencePeriod(
  sessions: RestSession[],
  currentRestStartedAt: string,
  now: number = Date.now(),
  verifiedReducedRestEvidence: VerifiedReducedDailyRestEvidence[] = [],
): DailyRestReferencePeriod {
  const previousRest = findPreviousQualifyingRestSession(
    sessions,
    currentRestStartedAt,
    verifiedReducedRestEvidence,
  );

  if (previousRest === null || previousRest.endedAt === null) {
    return {
      status: "unverified",

      referenceStart: null,
      referenceDeadline: null,

      source: "unknown",
      sourceSessionId: null,

      minutesUntilDeadline: null,
      deadlinePassed: false,

      message:
        "TachoTrack does not yet have enough recorded rest history to verify the start of this 24-hour daily-rest reference period.",
    };
  }

  const referenceStart = previousRest.endedAt;

  const referenceDeadline = addMinutes(
    referenceStart,
    DAILY_REST_REFERENCE_LIMITS.referencePeriodMinutes,
  );

  const deadlineTimestamp = toTimestamp(referenceDeadline);

  const remainingMilliseconds = deadlineTimestamp - now;

  const deadlinePassed = remainingMilliseconds < 0;

  const minutesUntilDeadline = deadlinePassed
    ? 0
    : Math.max(0, Math.ceil(remainingMilliseconds / (60 * 1000)));

  return {
    status: "verified",

    referenceStart,
    referenceDeadline,

    source: getReferenceSource(previousRest, verifiedReducedRestEvidence),

    sourceSessionId: previousRest.id,

    minutesUntilDeadline,
    deadlinePassed,

    message: deadlinePassed
      ? "The verified 24-hour daily-rest reference deadline has passed."
      : "The 24-hour daily-rest reference period is anchored to the end of the previous recorded qualifying rest.",
  };
}
