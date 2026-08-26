import {
    calculateSplitDailyRestDeadline,
    evaluateSplitDailyRest,
    type SplitDailyRestPeriod,
} from "../splitDailyRestRules";

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

function evaluate(
  referenceStart: string,
  firstRestStart: string,
  firstRestEnd: string,
  secondRestStart: string,
  secondRestEnd: string,
) {
  const period: SplitDailyRestPeriod = {
    referenceStart,
    firstRestStart,
    firstRestEnd,
    secondRestStart,
    secondRestEnd,
  };

  return evaluateSplitDailyRest(period);
}

const scenarios: ScenarioResult[] = [];

/**
 * 1. Exactly 3h + 9h
 */
const exactThreeNine = evaluate(
  "2026-09-01T06:00:00.000Z",
  "2026-09-01T10:00:00.000Z",
  "2026-09-01T13:00:00.000Z",
  "2026-09-01T21:00:00.000Z",
  "2026-09-02T06:00:00.000Z",
);

scenarios.push(
  result(
    "Exactly 3h + 9h split daily rest is valid",
    exactThreeNine.validSplitDailyRest === true &&
      exactThreeNine.level === "good",
    `Level: ${exactThreeNine.level}`,
  ),
);

/**
 * 2. 4h + 9h
 */
const fourNine = evaluate(
  "2026-09-03T06:00:00.000Z",
  "2026-09-03T09:00:00.000Z",
  "2026-09-03T13:00:00.000Z",
  "2026-09-03T21:00:00.000Z",
  "2026-09-04T06:00:00.000Z",
);

scenarios.push(
  result(
    "4h + 9h split daily rest is valid",
    fourNine.validSplitDailyRest === true,
    `Level: ${fourNine.level}`,
  ),
);

/**
 * 3. 3h + 10h
 */
const threeTen = evaluate(
  "2026-09-05T06:00:00.000Z",
  "2026-09-05T10:00:00.000Z",
  "2026-09-05T13:00:00.000Z",
  "2026-09-05T20:00:00.000Z",
  "2026-09-06T06:00:00.000Z",
);

scenarios.push(
  result(
    "3h + 10h split daily rest is valid",
    threeTen.validSplitDailyRest === true,
    `Level: ${threeTen.level}`,
  ),
);

/**
 * 4. 2h59 + 9h
 */
const shortFirst = evaluate(
  "2026-09-07T06:00:00.000Z",
  "2026-09-07T10:00:00.000Z",
  "2026-09-07T12:59:00.000Z",
  "2026-09-07T21:00:00.000Z",
  "2026-09-08T06:00:00.000Z",
);

scenarios.push(
  result(
    "2h59 first part is a breach",
    shortFirst.validSplitDailyRest === false &&
      shortFirst.firstPartQualifies === false &&
      shortFirst.level === "breach",
    `First part: ${shortFirst.firstRestMinutes}m`,
  ),
);

/**
 * 5. 3h + 8h59
 */
const shortSecond = evaluate(
  "2026-09-09T06:00:00.000Z",
  "2026-09-09T10:00:00.000Z",
  "2026-09-09T13:00:00.000Z",
  "2026-09-09T21:01:00.000Z",
  "2026-09-10T06:00:00.000Z",
);

scenarios.push(
  result(
    "8h59 second part is a breach",
    shortSecond.validSplitDailyRest === false &&
      shortSecond.secondPartQualifies === false &&
      shortSecond.level === "breach",
    `Second part: ${shortSecond.secondRestMinutes}m`,
  ),
);

/**
 * 6. Reversed order
 */
const reversed = evaluate(
  "2026-09-11T06:00:00.000Z",
  "2026-09-11T20:00:00.000Z",
  "2026-09-12T05:00:00.000Z",
  "2026-09-11T10:00:00.000Z",
  "2026-09-11T13:00:00.000Z",
);

scenarios.push(
  result(
    "Reversed rest order is a breach",
    reversed.correctOrder === false &&
      reversed.validSplitDailyRest === false &&
      reversed.level === "breach",
    `Correct order: ${reversed.correctOrder}`,
  ),
);

/**
 * 7. Exact 24h deadline
 */
const exactDeadline = evaluate(
  "2026-09-13T06:00:00.000Z",
  "2026-09-13T09:00:00.000Z",
  "2026-09-13T12:00:00.000Z",
  "2026-09-13T21:00:00.000Z",
  "2026-09-14T06:00:00.000Z",
);

scenarios.push(
  result(
    "Split rest completed exactly at 24h deadline is valid",
    exactDeadline.completedWithin24Hours === true &&
      exactDeadline.validSplitDailyRest === true,
    `Deadline: ${exactDeadline.twentyFourHourDeadline}`,
  ),
);

/**
 * 8. One minute late
 */
const oneMinuteLate = evaluate(
  "2026-09-15T06:00:00.000Z",
  "2026-09-15T09:00:00.000Z",
  "2026-09-15T12:00:00.000Z",
  "2026-09-15T21:01:00.000Z",
  "2026-09-16T06:01:00.000Z",
);

scenarios.push(
  result(
    "Split rest completed 1m late is a breach",
    oneMinuteLate.completedWithin24Hours === false &&
      oneMinuteLate.level === "breach",
    `Completed within 24h: ${oneMinuteLate.completedWithin24Hours}`,
  ),
);

/**
 * 9. Month boundary
 */
const monthDeadline = calculateSplitDailyRestDeadline(
  "2026-09-30T08:00:00.000Z",
);

scenarios.push(
  result(
    "Split rest deadline crosses month boundary",
    monthDeadline === "2026-10-01T08:00:00.000Z",
    `Deadline: ${monthDeadline}`,
  ),
);

/**
 * 10. Year boundary
 */
const yearDeadline = calculateSplitDailyRestDeadline(
  "2026-12-31T08:00:00.000Z",
);

scenarios.push(
  result(
    "Split rest deadline crosses year boundary",
    yearDeadline === "2027-01-01T08:00:00.000Z",
    `Deadline: ${yearDeadline}`,
  ),
);

export const splitDailyRestScenarioResults = scenarios;

export const splitDailyRestScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
