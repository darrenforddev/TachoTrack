import {
    buildWeeklyRestHistory,
    classifyWeeklyRest,
    createCompensationObligation,
    createWeeklyRestRecord,
} from "../weeklyRestHistory";

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
 * Exactly 45h weekly rest.
 * --------------------------------------------------
 */
const regular45 = createWeeklyRestRecord(
  "weekly-45",
  "2026-09-04T18:00:00.000Z",
  "2026-09-06T15:00:00.000Z",
);

scenarios.push(
  result(
    "Exactly 45h weekly rest is regular",
    regular45 !== null &&
      regular45.type === "regular" &&
      regular45.restMinutes === 2700 &&
      regular45.compensationCreatedMinutes === 0,
    `Type: ${regular45?.type}, minutes: ${regular45?.restMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 * Exactly 24h weekly rest.
 * --------------------------------------------------
 */
const reduced24 = createWeeklyRestRecord(
  "weekly-24",
  "2026-09-11T18:00:00.000Z",
  "2026-09-12T18:00:00.000Z",
);

scenarios.push(
  result(
    "Exactly 24h weekly rest is reduced",
    reduced24 !== null &&
      reduced24.type === "reduced" &&
      reduced24.restMinutes === 1440 &&
      reduced24.compensationCreatedMinutes === 1260,
    `Type: ${reduced24?.type}, compensation: ${reduced24?.compensationCreatedMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 * 30h weekly rest.
 *
 * Shortfall from 45h = 15h.
 * --------------------------------------------------
 */
const reduced30 = createWeeklyRestRecord(
  "weekly-30",
  "2026-09-18T18:00:00.000Z",
  "2026-09-20T00:00:00.000Z",
);

scenarios.push(
  result(
    "30h weekly rest creates 15h compensation",
    reduced30 !== null &&
      reduced30.type === "reduced" &&
      reduced30.compensationCreatedMinutes === 15 * 60,
    `Compensation: ${reduced30?.compensationCreatedMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 * 44h59m remains reduced.
 * --------------------------------------------------
 */
const fortyFourFiftyNine = createWeeklyRestRecord(
  "weekly-44-59",
  "2026-09-25T18:00:00.000Z",
  "2026-09-27T14:59:00.000Z",
);

scenarios.push(
  result(
    "44h59m weekly rest remains reduced",
    fortyFourFiftyNine !== null &&
      fortyFourFiftyNine.type === "reduced" &&
      fortyFourFiftyNine.compensationCreatedMinutes === 1,
    `Type: ${fortyFourFiftyNine?.type}, compensation: ${fortyFourFiftyNine?.compensationCreatedMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 * 23h59m is not a qualifying weekly rest.
 * --------------------------------------------------
 */
const below24 = createWeeklyRestRecord(
  "weekly-under-24",
  "2026-10-02T18:00:00.000Z",
  "2026-10-03T17:59:00.000Z",
);

scenarios.push(
  result(
    "23h59m is not accepted as qualifying weekly rest",
    below24 === null,
    `Record created: ${below24 !== null}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 * Direct classification at 45h.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "classifyWeeklyRest returns regular at 45h",
    classifyWeeklyRest(45 * 60) === "regular",
    `Classification: ${classifyWeeklyRest(45 * 60)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 * Direct classification at 24h.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "classifyWeeklyRest returns reduced at 24h",
    classifyWeeklyRest(24 * 60) === "reduced",
    `Classification: ${classifyWeeklyRest(24 * 60)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 * Direct classification below 24h.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "classifyWeeklyRest rejects 23h59m",
    classifyWeeklyRest(23 * 60 + 59) === null,
    `Classification: ${classifyWeeklyRest(23 * 60 + 59)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 * Regular rest creates no compensation obligation.
 * --------------------------------------------------
 */
const regularObligation = regular45
  ? createCompensationObligation(regular45)
  : null;

scenarios.push(
  result(
    "Regular weekly rest creates no obligation",
    regularObligation === null,
    `Obligation created: ${regularObligation !== null}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 * Reduced 24h rest creates 21h obligation.
 * --------------------------------------------------
 */
const reducedObligation = reduced24
  ? createCompensationObligation(reduced24)
  : null;

scenarios.push(
  result(
    "Reduced 24h rest creates 21h obligation",
    reducedObligation !== null &&
      reducedObligation.requiredCompensationMinutes === 21 * 60 &&
      reducedObligation.remainingMinutes === 21 * 60 &&
      reducedObligation.status === "outstanding",
    `Required: ${reducedObligation?.requiredCompensationMinutes}, remaining: ${reducedObligation?.remainingMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 11
 * History with one regular and one reduced rest.
 * --------------------------------------------------
 */
const mixedHistory = buildWeeklyRestHistory(
  [regular45, reduced24].filter(
    (item): item is NonNullable<typeof item> => item !== null,
  ),
);

scenarios.push(
  result(
    "History detects one outstanding obligation",
    mixedHistory.obligations.length === 1 &&
      mixedHistory.hasOutstandingCompensation === true &&
      mixedHistory.totalOutstandingCompensationMinutes === 21 * 60,
    `Obligations: ${mixedHistory.obligations.length}, outstanding: ${mixedHistory.totalOutstandingCompensationMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 12
 * Two reduced rests create two independent obligations.
 * --------------------------------------------------
 */
const twoReducedHistory = buildWeeklyRestHistory(
  [reduced24, reduced30].filter(
    (item): item is NonNullable<typeof item> => item !== null,
  ),
);

scenarios.push(
  result(
    "Two reduced weekly rests create two obligations",
    twoReducedHistory.obligations.length === 2 &&
      twoReducedHistory.totalOutstandingCompensationMinutes === 36 * 60,
    `Obligations: ${twoReducedHistory.obligations.length}, total: ${twoReducedHistory.totalOutstandingCompensationMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 13
 * History containing regular rests only.
 * --------------------------------------------------
 */
const regularOnlyHistory = buildWeeklyRestHistory(regular45 ? [regular45] : []);

scenarios.push(
  result(
    "Regular-only history has no compensation outstanding",
    regularOnlyHistory.obligations.length === 0 &&
      regularOnlyHistory.hasOutstandingCompensation === false &&
      regularOnlyHistory.totalOutstandingCompensationMinutes === 0,
    `Outstanding: ${regularOnlyHistory.totalOutstandingCompensationMinutes}`,
  ),
);

export const weeklyRestHistoryScenarioResults = scenarios;

export const weeklyRestHistoryScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
