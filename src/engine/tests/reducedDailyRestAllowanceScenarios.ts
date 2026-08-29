import type { RestSession } from "../../data/restSession";

import { calculateReducedDailyRestAllowance } from "../reducedDailyRestAllowance";

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

function makeCompletedRest(
  id: string,
  type: RestSession["type"],
  startedAt: string,
  endedAt: string,
): RestSession {
  const durationMilliseconds =
    new Date(endedAt).getTime() - new Date(startedAt).getTime();

  return {
    id,
    type,
    startedAt,
    endedAt,
    durationMilliseconds,
    status: "completed",
  };
}

/**
 * A completed regular weekly rest of
 * exactly 45 hours.
 */
const weeklyBaseline = makeCompletedRest(
  "weekly-baseline",
  "weekly",
  "2026-08-17T00:00:00.000Z",
  "2026-08-18T21:00:00.000Z",
);

const reducedOne = makeCompletedRest(
  "reduced-one",
  "daily",
  "2026-08-19T10:00:00.000Z",
  "2026-08-19T19:00:00.000Z",
);

const reducedTwo = makeCompletedRest(
  "reduced-two",
  "daily",
  "2026-08-20T08:00:00.000Z",
  "2026-08-20T17:00:00.000Z",
);

const reducedThree = makeCompletedRest(
  "reduced-three",
  "daily",
  "2026-08-21T06:00:00.000Z",
  "2026-08-21T15:00:00.000Z",
);

const reducedFour = makeCompletedRest(
  "reduced-four",
  "daily",
  "2026-08-22T04:00:00.000Z",
  "2026-08-22T13:00:00.000Z",
);

const regularDailyRest = makeCompletedRest(
  "regular-daily",
  "daily",
  "2026-08-20T08:00:00.000Z",
  "2026-08-20T19:00:00.000Z",
);

const secondWeeklyRest = makeCompletedRest(
  "second-weekly-rest",
  "weekly",
  "2026-08-22T04:00:00.000Z",
  "2026-08-24T01:00:00.000Z",
);

const reducedAfterReset = makeCompletedRest(
  "reduced-after-reset",
  "daily",
  "2026-08-24T14:00:00.000Z",
  "2026-08-24T23:00:00.000Z",
);

const scenarios: ScenarioResult[] = [];

/**
 * --------------------------------------------------
 * SCENARIO 1
 *
 * Without a known weekly-rest baseline,
 * allowance must remain unverified.
 * --------------------------------------------------
 */
const noBaselineState = calculateReducedDailyRestAllowance([reducedOne]);

scenarios.push(
  result(
    "Allowance remains unverified without weekly-rest baseline",

    noBaselineState.status === "unverified" &&
      noBaselineState.reducedRestsUsed === null &&
      noBaselineState.reducedRestsRemaining === null &&
      !noBaselineState.canTakeAnotherReducedRest &&
      noBaselineState.unverifiedReducedRestSessionIds.includes("reduced-one"),

    noBaselineState.explanation,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 *
 * A known 45-hour weekly rest establishes
 * all three reduced daily rests as available.
 * --------------------------------------------------
 */
const newAllowanceState = calculateReducedDailyRestAllowance([weeklyBaseline]);

scenarios.push(
  result(
    "Weekly rest establishes full reduced-rest allowance",

    newAllowanceState.status === "verified" &&
      newAllowanceState.reducedRestsUsed === 0 &&
      newAllowanceState.reducedRestsRemaining === 3 &&
      newAllowanceState.canTakeAnotherReducedRest &&
      newAllowanceState.referenceWeeklyRestSessionId === "weekly-baseline",

    newAllowanceState.explanation,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 *
 * Two qualifying reduced daily rests leave
 * one reduction available.
 * --------------------------------------------------
 */
const twoUsedState = calculateReducedDailyRestAllowance([
  weeklyBaseline,
  reducedOne,
  reducedTwo,
]);

scenarios.push(
  result(
    "Two reduced daily rests leave one available",

    twoUsedState.status === "verified" &&
      twoUsedState.reducedRestsUsed === 2 &&
      twoUsedState.reducedRestsRemaining === 1 &&
      twoUsedState.canTakeAnotherReducedRest &&
      twoUsedState.acceptedReducedRestSessionIds.length === 2,

    twoUsedState.explanation,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 *
 * The third reduction is permitted, but
 * it exhausts the current allowance.
 * --------------------------------------------------
 */
const limitReachedState = calculateReducedDailyRestAllowance([
  weeklyBaseline,
  reducedOne,
  reducedTwo,
  reducedThree,
]);

scenarios.push(
  result(
    "Third reduced daily rest exhausts allowance",

    limitReachedState.reducedRestsUsed === 3 &&
      limitReachedState.reducedRestsRemaining === 0 &&
      !limitReachedState.canTakeAnotherReducedRest &&
      limitReachedState.level === "warning" &&
      limitReachedState.acceptedReducedRestSessionIds.length === 3 &&
      limitReachedState.rejectedReducedRestSessionIds.length === 0,

    limitReachedState.explanation,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 *
 * A fourth reduction before another weekly
 * rest is a breach and must be rejected.
 * --------------------------------------------------
 */
const breachedState = calculateReducedDailyRestAllowance([
  weeklyBaseline,
  reducedOne,
  reducedTwo,
  reducedThree,
  reducedFour,
]);

scenarios.push(
  result(
    "Fourth reduced daily rest creates breach",

    breachedState.reducedRestsUsed === 4 &&
      breachedState.reducedRestsRemaining === 0 &&
      !breachedState.canTakeAnotherReducedRest &&
      breachedState.level === "breach" &&
      breachedState.acceptedReducedRestSessionIds.length === 3 &&
      breachedState.rejectedReducedRestSessionIds.includes("reduced-four"),

    breachedState.explanation,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 *
 * An 11-hour regular daily rest does not
 * consume another reduced-rest allowance.
 * --------------------------------------------------
 */
const regularRestState = calculateReducedDailyRestAllowance([
  weeklyBaseline,
  reducedOne,
  regularDailyRest,
]);

scenarios.push(
  result(
    "Regular daily rest does not consume reduced allowance",

    regularRestState.reducedRestsUsed === 1 &&
      regularRestState.reducedRestsRemaining === 2 &&
      regularRestState.canTakeAnotherReducedRest,

    regularRestState.explanation,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 *
 * A later qualifying 45-hour weekly rest
 * resets the counter before the next reduction.
 * --------------------------------------------------
 */
const resetState = calculateReducedDailyRestAllowance([
  weeklyBaseline,
  reducedOne,
  reducedTwo,
  reducedThree,
  secondWeeklyRest,
  reducedAfterReset,
]);

scenarios.push(
  result(
    "Later weekly rest resets reduced-rest allowance",

    resetState.status === "verified" &&
      resetState.referenceWeeklyRestSessionId === "second-weekly-rest" &&
      resetState.reducedRestsUsed === 1 &&
      resetState.reducedRestsRemaining === 2 &&
      resetState.canTakeAnotherReducedRest &&
      resetState.acceptedReducedRestSessionIds.length === 1 &&
      resetState.acceptedReducedRestSessionIds[0] === "reduced-after-reset",

    resetState.explanation,
  ),
);

export const reducedDailyRestAllowanceScenarioResults = scenarios;

export const reducedDailyRestAllowanceScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};

export async function runReducedDailyRestAllowanceScenarios() {
  return {
    results: reducedDailyRestAllowanceScenarioResults,

    summary: reducedDailyRestAllowanceScenarioSummary,
  };
}
