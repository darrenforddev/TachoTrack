import type { RestSession } from "../data/restSession";

import { DAILY_REST_LIMITS } from "./dailyRestRules";

import { calculateLiveSplitDailyRestState } from "./liveSplitDailyRestState";

export type LegalRestRestartRoute =
  | "reduced-daily-rest"
  | "regular-daily-rest"
  | "split-regular-daily-rest";

export type LegalRestReferenceStatus = "verified" | "unverified";

export type LegalRestAllowanceStatus = "verified" | "unverified";

/**
 * Shared input shape accepted from either:
 *
 * - the original reduced-rest history engine
 * - the verified reduced-rest allowance engine
 *
 * The optional status keeps the existing isolated
 * restart tests compatible. A missing status means
 * the supplied test/history state is treated as
 * verified.
 */
export interface LegalRestReducedAllowanceInput {
  status?: LegalRestAllowanceStatus;

  canTakeAnotherReducedRest: boolean;

  reducedRestsUsed: number | null;

  reducedRestsRemaining: number | null;
}

export interface LegalRestRestartState {
  route: LegalRestRestartRoute;

  restStartedAt: string;

  earliestLegalRestartTime: string;

  requiredCurrentRestMinutes: number;

  elapsedCurrentRestMinutes: number;

  remainingRestMinutes: number;

  mayResumeWork: boolean;

  allowanceStatus: LegalRestAllowanceStatus;

  reducedRestAvailable: boolean;

  reducedRestsUsed: number | null;

  reducedRestsRemaining: number | null;

  reducedRestWillBeUsed: boolean;

  splitFirstPartAvailable: boolean;

  splitFirstPartMinutes: number;

  referenceStatus: LegalRestReferenceStatus;

  referenceStart: string | null;

  referenceDeadline: string | null;

  restartWithinReferencePeriod: boolean;

  message: string;
}

function addMinutes(timestamp: string, minutes: number): string {
  return new Date(
    new Date(timestamp).getTime() + minutes * 60 * 1000,
  ).toISOString();
}

function getElapsedMinutes(session: RestSession, now: number): number {
  const startedAt = new Date(session.startedAt).getTime();

  const endedAt =
    session.endedAt !== null ? new Date(session.endedAt).getTime() : now;

  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(endedAt) ||
    endedAt <= startedAt
  ) {
    return 0;
  }

  return Math.floor((endedAt - startedAt) / (60 * 1000));
}

function isAtOrBefore(timestamp: string, deadline: string): boolean {
  return new Date(timestamp).getTime() <= new Date(deadline).getTime();
}

/**
 * Calculates the earliest possible restart route
 * for an active DAILY rest session.
 *
 * Three separate facts must be verified:
 *
 * 1. The required rest duration has been reached.
 * 2. The 24-hour reference period is known.
 * 3. Reduced-rest entitlement is verified when
 *    the proposed route relies on a reduction.
 *
 * Route priority:
 *
 * 1. Valid 3h + 9h split regular daily rest.
 * 2. Verified reduced daily rest available.
 * 3. Otherwise, 11h regular daily rest.
 */
export function calculateLegalRestRestartState(
  currentRestSession: RestSession,
  allRestSessions: RestSession[],
  reducedRestAllowance: LegalRestReducedAllowanceInput,
  referenceStart: string | null,
  now: number = Date.now(),
): LegalRestRestartState {
  const elapsedCurrentRestMinutes = getElapsedMinutes(currentRestSession, now);

  const referenceStatus: LegalRestReferenceStatus =
    referenceStart === null ? "unverified" : "verified";

  /**
   * Existing isolated test states do not include
   * status. They are treated as verified.
   *
   * Live TachoTrack state will provide the explicit
   * verified/unverified status from the new
   * allowance engine.
   */
  const allowanceStatus: LegalRestAllowanceStatus =
    reducedRestAllowance.status ?? "verified";

  /**
   * Split detection may provide useful planning
   * information while the reference is unverified.
   *
   * But an unverified reference must never produce
   * permission to resume work.
   */
  const splitState = calculateLiveSplitDailyRestState(
    allRestSessions,
    referenceStart,
    now,
  );

  const qualifyingFirstPart = splitState.qualifyingFirstPart;

  const currentRestStartedAt = new Date(currentRestSession.startedAt).getTime();

  const firstPartEndedAt =
    qualifyingFirstPart !== null
      ? new Date(qualifyingFirstPart.endedAt).getTime()
      : null;

  const splitFirstPartAvailable =
    qualifyingFirstPart !== null &&
    qualifyingFirstPart.id !== currentRestSession.id &&
    firstPartEndedAt !== null &&
    firstPartEndedAt <= currentRestStartedAt;

  const splitFirstPartMinutes =
    splitFirstPartAvailable && qualifyingFirstPart !== null
      ? qualifyingFirstPart.durationMinutes
      : 0;

  /**
   * A reduced route is available only when:
   *
   * - history establishes entitlement, and
   * - fewer than three reductions have been used.
   */
  const reducedRestAvailable =
    allowanceStatus === "verified" &&
    reducedRestAllowance.canTakeAnotherReducedRest;

  const route: LegalRestRestartRoute = splitFirstPartAvailable
    ? "split-regular-daily-rest"
    : reducedRestAvailable
      ? "reduced-daily-rest"
      : "regular-daily-rest";

  const requiredCurrentRestMinutes =
    route === "regular-daily-rest"
      ? DAILY_REST_LIMITS.regularDailyRestMinutes
      : DAILY_REST_LIMITS.reducedDailyRestMinutes;

  const earliestLegalRestartTime = addMinutes(
    currentRestSession.startedAt,
    requiredCurrentRestMinutes,
  );

  const remainingRestMinutes = Math.max(
    0,
    requiredCurrentRestMinutes - elapsedCurrentRestMinutes,
  );

  const referenceDeadline =
    referenceStatus === "verified" ? splitState.referenceDeadline : null;

  const restartWithinReferencePeriod =
    referenceStatus === "verified" &&
    referenceDeadline !== null &&
    isAtOrBefore(earliestLegalRestartTime, referenceDeadline);

  const mayResumeWork =
    remainingRestMinutes === 0 &&
    referenceStatus === "verified" &&
    restartWithinReferencePeriod;

  const reducedRestWillBeUsed = route === "reduced-daily-rest";

  let message: string;

  if (referenceStatus === "unverified") {
    if (remainingRestMinutes > 0) {
      message =
        `Continue resting for the current ` +
        `${route === "regular-daily-rest" ? "11-hour" : "9-hour"} ` +
        `route. TachoTrack cannot yet verify a compliant ` +
        `restart because the preceding 24-hour daily-rest ` +
        `reference boundary is not established from recorded ` +
        `qualifying-rest history.`;
    } else {
      message =
        "The rest-duration milestone has been reached, but " +
        "TachoTrack cannot verify a compliant restart because " +
        "the preceding 24-hour daily-rest reference boundary " +
        "is not established from recorded qualifying-rest history.";
    }
  } else if (!restartWithinReferencePeriod) {
    message =
      "The calculated rest milestone falls after the verified " +
      "24-hour daily-rest deadline. TachoTrack must not present " +
      "this as a compliant restart.";
  } else if (route === "split-regular-daily-rest") {
    if (mayResumeWork) {
      message =
        "Split regular daily rest achieved within the verified " +
        "reference period. Work may resume and the reduced " +
        "daily-rest allowance is preserved.";
    } else {
      message =
        "A qualifying first split-rest period has already been " +
        "recorded. Continue the current daily rest until 9 hours " +
        "to complete a split regular daily rest.";
    }
  } else if (allowanceStatus === "unverified") {
    if (mayResumeWork) {
      message =
        "Regular 11-hour daily rest achieved within the verified " +
        "reference period. Work may resume. The reduced daily-rest " +
        "allowance remains unverified and has not been used.";
    } else {
      message =
        "Reduced daily-rest entitlement cannot be verified from " +
        "the available weekly-rest history. Continue resting until " +
        "the 11-hour regular daily-rest milestone.";
    }
  } else if (route === "reduced-daily-rest") {
    if (mayResumeWork) {
      message =
        "Reduced daily rest achieved within the verified reference " +
        "period. Work may resume. This rest will use one reduced " +
        "daily-rest allowance.";
    } else {
      message =
        "A reduced daily rest is available. Continue resting until " +
        "the 9-hour milestone, or continue to 11 hours to achieve " +
        "a regular daily rest and preserve the allowance.";
    }
  } else {
    if (mayResumeWork) {
      message =
        "Regular daily rest achieved within the verified reference " +
        "period. Work may resume.";
    } else {
      message =
        "The reduced daily-rest allowance is unavailable and no " +
        "qualifying split first part has been detected. Continue " +
        "resting until the 11-hour regular daily-rest milestone.";
    }
  }

  return {
    route,

    restStartedAt: currentRestSession.startedAt,

    earliestLegalRestartTime,

    requiredCurrentRestMinutes,

    elapsedCurrentRestMinutes,

    remainingRestMinutes,

    mayResumeWork,

    allowanceStatus,

    reducedRestAvailable,

    reducedRestsUsed: reducedRestAllowance.reducedRestsUsed,

    reducedRestsRemaining: reducedRestAllowance.reducedRestsRemaining,

    reducedRestWillBeUsed,

    splitFirstPartAvailable,

    splitFirstPartMinutes,

    referenceStatus,

    referenceStart,

    referenceDeadline,

    restartWithinReferencePeriod,

    message,
  };
}
