import type { DriverActivityType } from "../data/activityState";

import type { LegalRestRestartState } from "./legalRestRestartState";

export type LegalRestResumptionGuardLevel = "allowed" | "blocked";

export interface LegalRestResumptionGuardResult {
  level: LegalRestResumptionGuardLevel;

  activity: DriverActivityType;

  mayChangeActivity: boolean;

  endsProtectedRest: boolean;

  title: string;

  message: string;

  remainingRestMinutes: number;

  earliestLegalRestartTime: string;
}

function activityEndsProtectedRest(activity: DriverActivityType): boolean {
  return (
    activity === "driving" || activity === "other-work" || activity === "poa"
  );
}

export function evaluateLegalRestResumption(
  activity: DriverActivityType,
  restartState: LegalRestRestartState,
): LegalRestResumptionGuardResult {
  const endsProtectedRest = activityEndsProtectedRest(activity);

  /**
   * Break does not end the protected rest session.
   */
  if (!endsProtectedRest) {
    return {
      level: "allowed",

      activity,

      mayChangeActivity: true,

      endsProtectedRest: false,

      title: "Rest continues",

      message: "Break does not interrupt the current protected rest session.",

      remainingRestMinutes: restartState.remainingRestMinutes,

      earliestLegalRestartTime: restartState.earliestLegalRestartTime,
    };
  }

  /**
   * --------------------------------------------------
   * UNVERIFIED REFERENCE PERIOD
   * --------------------------------------------------
   *
   * This is deliberately different from a known
   * deadline failure.
   *
   * TachoTrack simply does not have sufficient
   * recorded qualifying-rest history to confirm
   * the legal 24-hour reference boundary.
   */
  if (restartState.referenceStatus === "unverified") {
    return {
      level: "blocked",

      activity,

      mayChangeActivity: false,

      endsProtectedRest: true,

      title: "Reference period unverified",

      message:
        restartState.remainingRestMinutes > 0
          ? "Protected rest is still in progress and TachoTrack cannot yet verify the applicable 24-hour daily-rest reference period from recorded qualifying-rest history."
          : "The required rest-duration milestone has been reached, but TachoTrack cannot verify the applicable 24-hour daily-rest reference period from recorded qualifying-rest history. A compliant restart cannot therefore be confirmed.",

      remainingRestMinutes: restartState.remainingRestMinutes,

      earliestLegalRestartTime: restartState.earliestLegalRestartTime,
    };
  }

  /**
   * --------------------------------------------------
   * VERIFIED REFERENCE — DEADLINE FAILURE
   * --------------------------------------------------
   */
  if (!restartState.restartWithinReferencePeriod) {
    return {
      level: "blocked",

      activity,

      mayChangeActivity: false,

      endsProtectedRest: true,

      title: "24-hour deadline exceeded",

      message:
        "The required rest milestone falls outside the verified 24-hour daily-rest reference period. TachoTrack cannot treat this as a compliant restart.",

      remainingRestMinutes: restartState.remainingRestMinutes,

      earliestLegalRestartTime: restartState.earliestLegalRestartTime,
    };
  }

  /**
   * --------------------------------------------------
   * REQUIRED REST STILL RUNNING
   * --------------------------------------------------
   */
  if (!restartState.mayResumeWork) {
    return {
      level: "blocked",

      activity,

      mayChangeActivity: false,

      endsProtectedRest: true,

      title: "Protected rest still in progress",

      message:
        restartState.route === "split-regular-daily-rest"
          ? "A qualifying split-rest route is active, but the current 9-hour second part has not yet been completed."
          : restartState.route === "regular-daily-rest"
            ? "Regular daily rest is required. Continue resting until the 11-hour milestone before resuming work."
            : "Reduced daily rest is available, but the 9-hour milestone has not yet been reached.",

      remainingRestMinutes: restartState.remainingRestMinutes,

      earliestLegalRestartTime: restartState.earliestLegalRestartTime,
    };
  }

  /**
   * --------------------------------------------------
   * VERIFIED REST REQUIREMENT ACHIEVED
   * --------------------------------------------------
   */
  return {
    level: "allowed",

    activity,

    mayChangeActivity: true,

    endsProtectedRest: true,

    title: "Rest requirement achieved",

    message:
      restartState.route === "split-regular-daily-rest"
        ? "Split regular daily rest has been achieved within the verified reference period. Work may resume without using a reduced daily-rest allowance."
        : restartState.route === "regular-daily-rest"
          ? "Regular daily rest has been achieved within the verified reference period. Work may resume."
          : "Reduced daily rest has been achieved within the verified reference period. Work may resume and one reduced daily-rest allowance will be used.",

    remainingRestMinutes: 0,

    earliestLegalRestartTime: restartState.earliestLegalRestartTime,
  };
}
