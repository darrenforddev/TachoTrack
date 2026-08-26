import type { ActivityType } from "../types";

import {
    calculateRestMustContinueUntil,
    evaluateRequestedActivityDuringRest,
    evaluateRestResumption,
    type RestResumptionRequirement,
} from "../restResumptionGuard";

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
 * Test requirement:
 *
 * Rest starts:
 * Saturday 19 Sep 2026 at 18:00 UTC
 *
 * Base weekly rest:
 * 45h
 *
 * Compensation attached:
 * 6h
 *
 * Total protected rest:
 * 51h
 *
 * Expected completion:
 * Monday 21 Sep 2026 at 21:00 UTC
 */
const requirement: RestResumptionRequirement = {
  restStart: "2026-09-19T18:00:00.000Z",

  baseRestMinutes: 45 * 60,

  compensationMinutes: 6 * 60,
};

const expectedCompletion = "2026-09-21T21:00:00.000Z";

/**
 * --------------------------------------------------
 * SCENARIO 1
 * Exact rest completion timestamp.
 * --------------------------------------------------
 */
const completionTime = calculateRestMustContinueUntil(requirement);

scenarios.push(
  result(
    "Calculates 51h protected rest completion",
    completionTime === expectedCompletion,
    `Expected ${expectedCompletion}, got ${completionTime}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 * One hour before completion.
 *
 * Must still be protected.
 * --------------------------------------------------
 */
const oneHourRemaining = evaluateRestResumption(
  requirement,
  "2026-09-21T20:00:00.000Z",
);

scenarios.push(
  result(
    "60 minutes remaining blocks work",
    oneHourRemaining.canResumeWork === false &&
      oneHourRemaining.restComplete === false &&
      oneHourRemaining.remainingMinutes === 60,
    `Remaining: ${oneHourRemaining.remainingMinutes}, canResumeWork: ${oneHourRemaining.canResumeWork}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 * 59 minutes remaining.
 *
 * This should enter the final-warning band.
 * --------------------------------------------------
 */
const fiftyNineRemaining = evaluateRestResumption(
  requirement,
  "2026-09-21T20:01:00.000Z",
);

scenarios.push(
  result(
    "59 minutes remaining enters final warning",
    fiftyNineRemaining.canResumeWork === false &&
      fiftyNineRemaining.remainingMinutes === 59 &&
      fiftyNineRemaining.level === "breach-risk",
    `Level: ${fiftyNineRemaining.level}, remaining: ${fiftyNineRemaining.remainingMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 * One minute remaining.
 * --------------------------------------------------
 */
const oneMinuteRemaining = evaluateRestResumption(
  requirement,
  "2026-09-21T20:59:00.000Z",
);

scenarios.push(
  result(
    "1 minute remaining still blocks work",
    oneMinuteRemaining.canResumeWork === false &&
      oneMinuteRemaining.restComplete === false &&
      oneMinuteRemaining.remainingMinutes === 1,
    `Remaining: ${oneMinuteRemaining.remainingMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 * Exact completion time.
 *
 * Work may resume.
 * --------------------------------------------------
 */
const exactCompletion = evaluateRestResumption(requirement, expectedCompletion);

scenarios.push(
  result(
    "Exact completion time allows work",
    exactCompletion.canResumeWork === true &&
      exactCompletion.restComplete === true &&
      exactCompletion.remainingMinutes === 0 &&
      exactCompletion.level === "good",
    `canResumeWork: ${exactCompletion.canResumeWork}, level: ${exactCompletion.level}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 * One minute after completion.
 * --------------------------------------------------
 */
const oneMinuteAfter = evaluateRestResumption(
  requirement,
  "2026-09-21T21:01:00.000Z",
);

scenarios.push(
  result(
    "1 minute after completion allows work",
    oneMinuteAfter.canResumeWork === true &&
      oneMinuteAfter.restComplete === true,
    `canResumeWork: ${oneMinuteAfter.canResumeWork}`,
  ),
);

/**
 * Helper for activity-request tests.
 */
function testActivityBeforeCompletion(activity: ActivityType) {
  return evaluateRequestedActivityDuringRest(
    requirement,
    "2026-09-21T20:45:00.000Z",
    activity,
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 7
 * Driving before completion.
 * --------------------------------------------------
 */
const drivingDecision = testActivityBeforeCompletion("driving");

scenarios.push(
  result(
    "Driving before rest completion is blocked",
    drivingDecision.allowed === false &&
      drivingDecision.requiresFinalWarning === true &&
      drivingDecision.status.remainingMinutes === 15,
    `Allowed: ${drivingDecision.allowed}, remaining: ${drivingDecision.status.remainingMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 * Other work before completion.
 * --------------------------------------------------
 */
const otherWorkDecision = testActivityBeforeCompletion("otherWork");

scenarios.push(
  result(
    "Other work before rest completion is blocked",
    otherWorkDecision.allowed === false &&
      otherWorkDecision.requiresFinalWarning === true,
    `Allowed: ${otherWorkDecision.allowed}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 * Break before completion.
 *
 * Continuing a break should not trigger
 * the work-start warning.
 * --------------------------------------------------
 */
const breakDecision = testActivityBeforeCompletion("break");

scenarios.push(
  result(
    "Break may continue during protected rest",
    breakDecision.allowed === true &&
      breakDecision.requiresFinalWarning === false,
    `Allowed: ${breakDecision.allowed}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 * Rest before completion.
 * --------------------------------------------------
 */
const restDecision = testActivityBeforeCompletion("rest");

scenarios.push(
  result(
    "Rest may continue during protected rest",
    restDecision.allowed === true &&
      restDecision.requiresFinalWarning === false,
    `Allowed: ${restDecision.allowed}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 11
 * POA before completion.
 *
 * Our current conservative engine
 * blocks this until we refine POA context.
 * --------------------------------------------------
 */
const poaDecision = testActivityBeforeCompletion("poa");

scenarios.push(
  result(
    "POA currently blocked during protected rest",
    poaDecision.allowed === false && poaDecision.requiresFinalWarning === true,
    `Allowed: ${poaDecision.allowed}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 12
 * Driving after completion.
 * --------------------------------------------------
 */
const drivingAfter = evaluateRequestedActivityDuringRest(
  requirement,
  "2026-09-21T21:01:00.000Z",
  "driving",
);

scenarios.push(
  result(
    "Driving allowed after protected rest completes",
    drivingAfter.allowed === true &&
      drivingAfter.requiresFinalWarning === false,
    `Allowed: ${drivingAfter.allowed}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 13
 * Other work after completion.
 * --------------------------------------------------
 */
const otherWorkAfter = evaluateRequestedActivityDuringRest(
  requirement,
  "2026-09-21T21:01:00.000Z",
  "otherWork",
);

scenarios.push(
  result(
    "Other work allowed after protected rest completes",
    otherWorkAfter.allowed === true &&
      otherWorkAfter.requiresFinalWarning === false,
    `Allowed: ${otherWorkAfter.allowed}`,
  ),
);

/**
 * --------------------------------------------------
 * FINAL REPORT
 * --------------------------------------------------
 */

export const restResumptionScenarioResults = scenarios;

export const restResumptionScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
