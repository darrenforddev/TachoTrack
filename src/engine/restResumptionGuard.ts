import type { ActivityType } from "./types";

export type RestResumptionGuardLevel = "good" | "warning" | "breach-risk";

export interface RestResumptionRequirement {
  /**
   * ISO date/time string marking
   * when the protected rest period began.
   */
  restStart: string;

  /**
   * Base qualifying rest duration.
   *
   * Example:
   * 45h weekly rest = 2700 minutes.
   */
  baseRestMinutes: number;

  /**
   * Weekly-rest compensation attached
   * to this rest period.
   *
   * Example:
   * 6h compensation = 360 minutes.
   */
  compensationMinutes: number;
}

export interface RestResumptionStatus {
  canResumeWork: boolean;
  restComplete: boolean;

  restMustContinueUntil: string;

  totalRequiredRestMinutes: number;
  elapsedRestMinutes: number;
  remainingMinutes: number;

  level: RestResumptionGuardLevel;

  message: string;
}

export interface ActivityResumptionDecision {
  allowed: boolean;

  requestedActivity: ActivityType;

  requiresFinalWarning: boolean;

  status: RestResumptionStatus;

  message: string;
}

function toTimestamp(dateTime: string): number {
  return new Date(dateTime).getTime();
}

function addMinutes(dateTime: string, minutes: number): string {
  const start = toTimestamp(dateTime);

  const result = new Date(start + minutes * 60 * 1000);

  return result.toISOString();
}

function minutesBetween(start: string, end: string): number {
  const difference = toTimestamp(end) - toTimestamp(start);

  return Math.max(0, Math.floor(difference / (60 * 1000)));
}

export function calculateRestMustContinueUntil(
  requirement: RestResumptionRequirement,
): string {
  const totalRequiredRestMinutes =
    requirement.baseRestMinutes + requirement.compensationMinutes;

  return addMinutes(requirement.restStart, totalRequiredRestMinutes);
}

export function evaluateRestResumption(
  requirement: RestResumptionRequirement,
  currentDateTime: string,
): RestResumptionStatus {
  const totalRequiredRestMinutes =
    requirement.baseRestMinutes + requirement.compensationMinutes;

  const restMustContinueUntil = calculateRestMustContinueUntil(requirement);

  const elapsedRestMinutes = minutesBetween(
    requirement.restStart,
    currentDateTime,
  );

  const remainingMinutes = Math.max(
    0,
    totalRequiredRestMinutes - elapsedRestMinutes,
  );

  const restComplete =
    toTimestamp(currentDateTime) >= toTimestamp(restMustContinueUntil);

  if (restComplete) {
    return {
      canResumeWork: true,
      restComplete: true,

      restMustContinueUntil,

      totalRequiredRestMinutes,
      elapsedRestMinutes: Math.min(
        elapsedRestMinutes,
        totalRequiredRestMinutes,
      ),

      remainingMinutes: 0,

      level: "good",

      message: "Required rest is complete. Driving or other work may resume.",
    };
  }

  /**
   * Final-hour warning band.
   */
  if (remainingMinutes <= 60) {
    return {
      canResumeWork: false,
      restComplete: false,

      restMustContinueUntil,

      totalRequiredRestMinutes,
      elapsedRestMinutes,
      remainingMinutes,

      level: "breach-risk",

      message:
        `Required rest is still in progress. ` +
        `${remainingMinutes} minutes remain before driving or other work may resume.`,
    };
  }

  return {
    canResumeWork: false,
    restComplete: false,

    restMustContinueUntil,

    totalRequiredRestMinutes,
    elapsedRestMinutes,
    remainingMinutes,

    level: "warning",

    message:
      `Required rest is still in progress. ` +
      `Do not begin driving or other work before ${restMustContinueUntil}.`,
  };
}

export function evaluateRequestedActivityDuringRest(
  requirement: RestResumptionRequirement,
  currentDateTime: string,
  requestedActivity: ActivityType,
): ActivityResumptionDecision {
  const status = evaluateRestResumption(requirement, currentDateTime);

  /**
   * Once rest is complete,
   * all activities are allowed.
   */
  if (status.restComplete) {
    return {
      allowed: true,
      requestedActivity,
      requiresFinalWarning: false,
      status,
      message: "Required rest is complete.",
    };
  }

  /**
   * Continuing break/rest does not
   * terminate the protected rest.
   */
  if (requestedActivity === "rest" || requestedActivity === "break") {
    return {
      allowed: true,
      requestedActivity,
      requiresFinalWarning: false,
      status,
      message: "Rest may continue.",
    };
  }

  /**
   * Driving and other work would
   * terminate the required rest early.
   */
  if (requestedActivity === "driving" || requestedActivity === "otherWork") {
    return {
      allowed: false,
      requestedActivity,
      requiresFinalWarning: true,
      status,

      message:
        `Do not begin ${requestedActivity === "driving" ? "driving" : "other work"} yet. ` +
        `${status.remainingMinutes} minutes of required rest remain.`,
    };
  }

  /**
   * POA is left conservative for now.
   *
   * We'll refine this once the wider
   * activity-context engine is in place.
   */
  if (requestedActivity === "poa") {
    return {
      allowed: false,
      requestedActivity,
      requiresFinalWarning: true,
      status,

      message:
        "POA should not be started while protected compensatory rest is still in progress.",
    };
  }

  return {
    allowed: false,
    requestedActivity,
    requiresFinalWarning: true,
    status,

    message: "Required rest is still in progress.",
  };
}

/**
 * Utility for UI presentation.
 */
export function formatRemainingRest(remainingMinutes: number): string {
  const hours = Math.floor(remainingMinutes / 60);

  const minutes = remainingMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ` + `${minutes.toString().padStart(2, "0")}m`;
}
