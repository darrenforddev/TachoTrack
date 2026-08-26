import {
    calculateDrivingSafetyTimes,
    calculateRestSafetyTimes,
    DEFAULT_SAFETY_MARGIN_SETTINGS,
    evaluateDrivingSafetyStatus,
    evaluateRestSafetyStatus,
    type SafetyMarginSettings,
} from "../safetyMargin";

type ScenarioResult = {
  name: string;
  passed: boolean;
  details: string;
};

function result(
  name: string,
  passed: boolean,
  details: string,
): ScenarioResult {
  return {
    name,
    passed,
    details,
  };
}

const scenarios: ScenarioResult[] = [];

/**
 * --------------------------------------------------
 * SCENARIO 1
 *
 * Prove our defaults.
 *
 * Safety margin:    5 minutes
 * Planning warning: 20 minutes
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Default safety settings are 5m + 20m",
    DEFAULT_SAFETY_MARGIN_SETTINGS.legalSafetyMarginMinutes === 5 &&
      DEFAULT_SAFETY_MARGIN_SETTINGS.planningWarningMinutes === 20,
    `Safety: ${
      DEFAULT_SAFETY_MARGIN_SETTINGS.legalSafetyMarginMinutes
    }m, planning: ${DEFAULT_SAFETY_MARGIN_SETTINGS.planningWarningMinutes}m`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 *
 * Legal driving limit = 14:30
 *
 * Safety target = 14:25
 * Planning warning = 14:05
 * --------------------------------------------------
 */
const defaultDriving = calculateDrivingSafetyTimes("2026-09-01T14:30:00.000Z");

scenarios.push(
  result(
    "Default driving target is 5m early",
    defaultDriving.recommendedStopTime === "2026-09-01T14:25:00.000Z",
    `Target: ${defaultDriving.recommendedStopTime}`,
  ),
);

scenarios.push(
  result(
    "Default planning warning is 20m before target",
    defaultDriving.planningWarningTime === "2026-09-01T14:05:00.000Z",
    `Planning: ${defaultDriving.planningWarningTime}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 *
 * At 14:24:
 *
 * legal limit not reached
 * recommended target not reached
 * --------------------------------------------------
 */
const beforeTarget = evaluateDrivingSafetyStatus(
  "2026-09-01T14:24:00.000Z",
  defaultDriving,
);

scenarios.push(
  result(
    "One minute before safety target remains before target",
    beforeTarget.legalTimeReached === false &&
      beforeTarget.recommendedTimeReached === false &&
      beforeTarget.remainingToRecommendedMinutes === 1 &&
      beforeTarget.remainingToLegalMinutes === 6,
    `Target remaining: ${beforeTarget.remainingToRecommendedMinutes}m`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 *
 * Exactly 14:25.
 *
 * TachoTrack safety target reached,
 * but statutory limit has NOT been reached.
 * --------------------------------------------------
 */
const atTarget = evaluateDrivingSafetyStatus(
  "2026-09-01T14:25:00.000Z",
  defaultDriving,
);

scenarios.push(
  result(
    "Safety target does not alter legal limit",
    atTarget.recommendedTimeReached === true &&
      atTarget.legalTimeReached === false &&
      atTarget.remainingToLegalMinutes === 5,
    `Legal remaining: ${atTarget.remainingToLegalMinutes}m`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 *
 * Exactly at legal limit.
 * --------------------------------------------------
 */
const atLegalLimit = evaluateDrivingSafetyStatus(
  "2026-09-01T14:30:00.000Z",
  defaultDriving,
);

scenarios.push(
  result(
    "Legal driving limit remains unchanged",
    atLegalLimit.legalTimeReached === true &&
      atLegalLimit.remainingToLegalMinutes === 0,
    `Legal reached: ${atLegalLimit.legalTimeReached}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 *
 * Rest legally completes at 06:00.
 *
 * Recommended TachoTrack resume = 06:05.
 * --------------------------------------------------
 */
const defaultRest = calculateRestSafetyTimes("2026-09-02T06:00:00.000Z");

scenarios.push(
  result(
    "Rest safety margin moves recommended resume 5m later",
    defaultRest.recommendedResumeTime === "2026-09-02T06:05:00.000Z",
    `Recommended: ${defaultRest.recommendedResumeTime}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 *
 * At legal rest completion:
 *
 * legal requirement is satisfied
 * optional safety margin is not.
 * --------------------------------------------------
 */
const legalRestComplete = evaluateRestSafetyStatus(
  "2026-09-02T06:00:00.000Z",
  defaultRest,
);

scenarios.push(
  result(
    "Legal rest completion remains separate from safety margin",
    legalRestComplete.legalTimeReached === true &&
      legalRestComplete.recommendedTimeReached === false &&
      legalRestComplete.remainingToRecommendedMinutes === 5,
    `Safety remaining: ${legalRestComplete.remainingToRecommendedMinutes}m`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 *
 * Exactly at recommended resume.
 * --------------------------------------------------
 */
const recommendedRestComplete = evaluateRestSafetyStatus(
  "2026-09-02T06:05:00.000Z",
  defaultRest,
);

scenarios.push(
  result(
    "Recommended rest resume reached after safety margin",
    recommendedRestComplete.legalTimeReached === true &&
      recommendedRestComplete.recommendedTimeReached === true &&
      recommendedRestComplete.remainingToRecommendedMinutes === 0,
    `Recommended reached: ${recommendedRestComplete.recommendedTimeReached}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 *
 * Driver chooses:
 *
 * 10-minute safety margin
 * 30-minute planning warning
 * --------------------------------------------------
 */
const conservativeSettings: SafetyMarginSettings = {
  legalSafetyMarginMinutes: 10,
  planningWarningMinutes: 30,
};

const conservativeDriving = calculateDrivingSafetyTimes(
  "2026-09-03T14:30:00.000Z",
  conservativeSettings,
);

scenarios.push(
  result(
    "Custom 10m safety margin works",
    conservativeDriving.recommendedStopTime === "2026-09-03T14:20:00.000Z",
    `Target: ${conservativeDriving.recommendedStopTime}`,
  ),
);

scenarios.push(
  result(
    "Custom 30m planning warning works",
    conservativeDriving.planningWarningTime === "2026-09-03T13:50:00.000Z",
    `Planning: ${conservativeDriving.planningWarningTime}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 12
 *
 * Custom 20-minute planning warning,
 * matching the practical preference we
 * designed TachoTrack around.
 * --------------------------------------------------
 */
const twentyMinutePlanning: SafetyMarginSettings = {
  legalSafetyMarginMinutes: 5,
  planningWarningMinutes: 20,
};

const twentyMinuteResult = calculateDrivingSafetyTimes(
  "2026-09-04T10:30:00.000Z",
  twentyMinutePlanning,
);

scenarios.push(
  result(
    "20m parking-planning warning calculates correctly",
    twentyMinuteResult.recommendedStopTime === "2026-09-04T10:25:00.000Z" &&
      twentyMinuteResult.planningWarningTime === "2026-09-04T10:05:00.000Z",
    `Plan at ${twentyMinuteResult.planningWarningTime}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 13
 *
 * Zero safety margin.
 *
 * Recommended time should exactly equal
 * the legal timestamp.
 * --------------------------------------------------
 */
const zeroSettings: SafetyMarginSettings = {
  legalSafetyMarginMinutes: 0,
  planningWarningMinutes: 0,
};

const zeroDriving = calculateDrivingSafetyTimes(
  "2026-09-05T14:30:00.000Z",
  zeroSettings,
);

scenarios.push(
  result(
    "Zero margin leaves legal time unchanged",
    zeroDriving.recommendedStopTime === zeroDriving.legalLimitTime &&
      zeroDriving.planningWarningTime === zeroDriving.legalLimitTime,
    `Legal: ${zeroDriving.legalLimitTime}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 14
 *
 * Custom 7-minute margin.
 * --------------------------------------------------
 */
const sevenMinuteSettings: SafetyMarginSettings = {
  legalSafetyMarginMinutes: 7,
  planningWarningMinutes: 20,
};

const sevenMinuteRest = calculateRestSafetyTimes(
  "2026-09-06T06:00:00.000Z",
  sevenMinuteSettings,
);

scenarios.push(
  result(
    "Custom 7m rest safety margin works",
    sevenMinuteRest.recommendedResumeTime === "2026-09-06T06:07:00.000Z",
    `Recommended: ${sevenMinuteRest.recommendedResumeTime}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 15
 *
 * Crossing midnight.
 *
 * Legal limit = 00:10
 * Target = 00:05
 * Planning warning = previous day 23:45
 * --------------------------------------------------
 */
const midnightDriving = calculateDrivingSafetyTimes("2026-09-08T00:10:00.000Z");

scenarios.push(
  result(
    "Planning warning handles midnight boundary",
    midnightDriving.recommendedStopTime === "2026-09-08T00:05:00.000Z" &&
      midnightDriving.planningWarningTime === "2026-09-07T23:45:00.000Z",
    `Planning: ${midnightDriving.planningWarningTime}`,
  ),
);

/**
 * --------------------------------------------------
 * FINAL REPORT
 * --------------------------------------------------
 */

export const safetyMarginScenarioResults = scenarios;

export const safetyMarginScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
