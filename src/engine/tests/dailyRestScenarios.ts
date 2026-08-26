import {
    calculateDailyRestDeadline,
    classifyDailyRest,
    evaluateDailyRestPeriod,
    type DailyRestPeriod,
} from "../dailyRestRules";

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
 * Helper to evaluate a rest period.
 */
function evaluate(referenceStart: string, restStart: string, restEnd: string) {
  const period: DailyRestPeriod = {
    referenceStart,
    restStart,
    restEnd,
  };

  return evaluateDailyRestPeriod(period);
}

/**
 * --------------------------------------------------
 * SCENARIO 1
 *
 * Exactly 11 hours daily rest.
 *
 * Should be regular.
 * --------------------------------------------------
 */
const exactly11 = evaluate(
  "2026-09-01T06:00:00.000Z",
  "2026-09-01T19:00:00.000Z",
  "2026-09-02T06:00:00.000Z",
);

scenarios.push(
  result(
    "Exactly 11h daily rest is regular",
    exactly11.classification === "regular" &&
      exactly11.level === "good" &&
      exactly11.restMinutes === 660,
    `Classification: ${exactly11.classification}, level: ${exactly11.level}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 *
 * 10h59m.
 *
 * Should be reduced, not regular.
 * --------------------------------------------------
 */
const tenFiftyNine = evaluate(
  "2026-09-03T06:00:00.000Z",
  "2026-09-03T19:01:00.000Z",
  "2026-09-04T06:00:00.000Z",
);

scenarios.push(
  result(
    "10h59m daily rest is reduced",
    tenFiftyNine.classification === "reduced" &&
      tenFiftyNine.level === "warning" &&
      tenFiftyNine.restMinutes === 659,
    `Classification: ${tenFiftyNine.classification}, minutes: ${tenFiftyNine.restMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 *
 * Exactly 9 hours.
 *
 * Reduced daily rest.
 * --------------------------------------------------
 */
const exactly9 = evaluate(
  "2026-09-05T06:00:00.000Z",
  "2026-09-05T21:00:00.000Z",
  "2026-09-06T06:00:00.000Z",
);

scenarios.push(
  result(
    "Exactly 9h daily rest is reduced",
    exactly9.classification === "reduced" &&
      exactly9.level === "warning" &&
      exactly9.restMinutes === 540,
    `Classification: ${exactly9.classification}, level: ${exactly9.level}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 *
 * 8h59m.
 *
 * One minute below reduced minimum.
 * --------------------------------------------------
 */
const eightFiftyNine = evaluate(
  "2026-09-07T06:00:00.000Z",
  "2026-09-07T21:01:00.000Z",
  "2026-09-08T06:00:00.000Z",
);

scenarios.push(
  result(
    "8h59m daily rest is a breach",
    eightFiftyNine.classification === "insufficient" &&
      eightFiftyNine.level === "breach" &&
      eightFiftyNine.restMinutes === 539,
    `Classification: ${eightFiftyNine.classification}, level: ${eightFiftyNine.level}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 *
 * Exactly 24 hours after reference start.
 *
 * Should still count as completed within
 * the relevant 24-hour period.
 * --------------------------------------------------
 */
const exactDeadline = evaluate(
  "2026-09-09T06:00:00.000Z",
  "2026-09-09T19:00:00.000Z",
  "2026-09-10T06:00:00.000Z",
);

scenarios.push(
  result(
    "Rest completed exactly at 24h deadline is valid",
    exactDeadline.completedWithin24Hours === true &&
      exactDeadline.level === "good",
    `Deadline: ${exactDeadline.twentyFourHourDeadline}, completed: ${exactDeadline.completedWithin24Hours}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 *
 * One minute after 24-hour deadline.
 *
 * Should breach timing rule.
 * --------------------------------------------------
 */
const oneMinuteLate = evaluate(
  "2026-09-11T06:00:00.000Z",
  "2026-09-11T19:01:00.000Z",
  "2026-09-12T06:01:00.000Z",
);

scenarios.push(
  result(
    "Rest ending 1m after 24h deadline breaches",
    oneMinuteLate.completedWithin24Hours === false &&
      oneMinuteLate.level === "breach",
    `Completed: ${oneMinuteLate.completedWithin24Hours}, level: ${oneMinuteLate.level}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 *
 * Rest duration is regular,
 * but finishes late.
 *
 * Must still breach.
 * --------------------------------------------------
 */
const regularButLate = evaluate(
  "2026-09-13T06:00:00.000Z",
  "2026-09-13T19:01:00.000Z",
  "2026-09-14T06:01:00.000Z",
);

scenarios.push(
  result(
    "11h rest completed late still breaches",
    regularButLate.classification === "regular" &&
      regularButLate.level === "breach" &&
      regularButLate.completedWithin24Hours === false,
    `Classification: ${regularButLate.classification}, level: ${regularButLate.level}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 *
 * Reduced 9h rest completed inside 24h.
 * --------------------------------------------------
 */
const validReducedInside24 = evaluate(
  "2026-09-15T06:00:00.000Z",
  "2026-09-15T20:30:00.000Z",
  "2026-09-16T05:30:00.000Z",
);

scenarios.push(
  result(
    "Reduced 9h rest completed inside 24h is warning only",
    validReducedInside24.classification === "reduced" &&
      validReducedInside24.level === "warning" &&
      validReducedInside24.completedWithin24Hours === true,
    `Level: ${validReducedInside24.level}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 *
 * Direct classification:
 * exactly 660m.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "classifyDailyRest returns regular at 660m",
    classifyDailyRest(660) === "regular",
    `Classification: ${classifyDailyRest(660)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 *
 * Direct classification:
 * 659m.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "classifyDailyRest returns reduced at 659m",
    classifyDailyRest(659) === "reduced",
    `Classification: ${classifyDailyRest(659)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 11
 *
 * Direct classification:
 * 540m.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "classifyDailyRest returns reduced at 540m",
    classifyDailyRest(540) === "reduced",
    `Classification: ${classifyDailyRest(540)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 12
 *
 * Direct classification:
 * 539m.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "classifyDailyRest returns insufficient at 539m",
    classifyDailyRest(539) === "insufficient",
    `Classification: ${classifyDailyRest(539)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 13
 *
 * Deadline calculation crosses midnight.
 * --------------------------------------------------
 */
const midnightDeadline = calculateDailyRestDeadline("2026-09-17T23:30:00.000Z");

scenarios.push(
  result(
    "24h deadline crosses midnight correctly",
    midnightDeadline === "2026-09-18T23:30:00.000Z",
    `Deadline: ${midnightDeadline}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 14
 *
 * End-of-month boundary.
 * --------------------------------------------------
 */
const monthBoundaryDeadline = calculateDailyRestDeadline(
  "2026-09-30T08:00:00.000Z",
);

scenarios.push(
  result(
    "24h deadline crosses month boundary correctly",
    monthBoundaryDeadline === "2026-10-01T08:00:00.000Z",
    `Deadline: ${monthBoundaryDeadline}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 15
 *
 * End-of-year boundary.
 * --------------------------------------------------
 */
const yearBoundaryDeadline = calculateDailyRestDeadline(
  "2026-12-31T08:00:00.000Z",
);

scenarios.push(
  result(
    "24h deadline crosses year boundary correctly",
    yearBoundaryDeadline === "2027-01-01T08:00:00.000Z",
    `Deadline: ${yearBoundaryDeadline}`,
  ),
);

/**
 * --------------------------------------------------
 * FINAL REPORT
 * --------------------------------------------------
 */

export const dailyRestScenarioResults = scenarios;

export const dailyRestScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
