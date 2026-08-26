import {
    evaluateProposedReducedDailyRest,
    evaluateReducedDailyRestHistory,
    type DailyRestHistoryEntry,
} from "../reducedDailyRestHistory";

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

function entry(
  id: string,
  date: string,
  type: DailyRestHistoryEntry["type"],
): DailyRestHistoryEntry {
  return {
    id,
    date,
    type,
  };
}

/**
 * --------------------------------------------------
 * SCENARIO 1
 * No reduced rests used.
 * --------------------------------------------------
 */
const noneUsed = evaluateReducedDailyRestHistory([
  entry("weekly-1", "2026-09-06", "weekly-rest"),

  entry("regular-1", "2026-09-07", "regular-daily-rest"),
]);

scenarios.push(
  result(
    "No reduced rests leaves all 3 available",
    noneUsed.reducedRestsUsed === 0 &&
      noneUsed.reducedRestsRemaining === 3 &&
      noneUsed.canTakeAnotherReducedRest === true &&
      noneUsed.level === "good",
    `Used: ${noneUsed.reducedRestsUsed}, remaining: ${noneUsed.reducedRestsRemaining}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 * One reduced rest.
 * --------------------------------------------------
 */
const oneUsed = evaluateReducedDailyRestHistory([
  entry("weekly-1", "2026-09-06", "weekly-rest"),

  entry("reduced-1", "2026-09-07", "reduced-daily-rest"),
]);

scenarios.push(
  result(
    "One reduced rest leaves two remaining",
    oneUsed.reducedRestsUsed === 1 &&
      oneUsed.reducedRestsRemaining === 2 &&
      oneUsed.canTakeAnotherReducedRest === true &&
      oneUsed.level === "good",
    `Used: ${oneUsed.reducedRestsUsed}, remaining: ${oneUsed.reducedRestsRemaining}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 * Two reduced rests.
 * --------------------------------------------------
 */
const twoUsed = evaluateReducedDailyRestHistory([
  entry("weekly-1", "2026-09-06", "weekly-rest"),

  entry("reduced-1", "2026-09-07", "reduced-daily-rest"),

  entry("regular-1", "2026-09-08", "regular-daily-rest"),

  entry("reduced-2", "2026-09-09", "reduced-daily-rest"),
]);

scenarios.push(
  result(
    "Two reduced rests leaves one remaining",
    twoUsed.reducedRestsUsed === 2 &&
      twoUsed.reducedRestsRemaining === 1 &&
      twoUsed.canTakeAnotherReducedRest === true,
    `Used: ${twoUsed.reducedRestsUsed}, remaining: ${twoUsed.reducedRestsRemaining}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 * Three reduced rests.
 *
 * Legal count reached.
 * TachoTrack warning only.
 * --------------------------------------------------
 */
const threeUsed = evaluateReducedDailyRestHistory([
  entry("weekly-1", "2026-09-06", "weekly-rest"),

  entry("reduced-1", "2026-09-07", "reduced-daily-rest"),

  entry("reduced-2", "2026-09-08", "reduced-daily-rest"),

  entry("reduced-3", "2026-09-09", "reduced-daily-rest"),
]);

scenarios.push(
  result(
    "Three reduced rests reaches allowance",
    threeUsed.reducedRestsUsed === 3 &&
      threeUsed.reducedRestsRemaining === 0 &&
      threeUsed.canTakeAnotherReducedRest === false &&
      threeUsed.level === "warning",
    `Level: ${threeUsed.level}, remaining: ${threeUsed.reducedRestsRemaining}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 * Fourth reduced rest.
 *
 * Must breach.
 * --------------------------------------------------
 */
const fourUsed = evaluateReducedDailyRestHistory([
  entry("weekly-1", "2026-09-06", "weekly-rest"),

  entry("reduced-1", "2026-09-07", "reduced-daily-rest"),

  entry("reduced-2", "2026-09-08", "reduced-daily-rest"),

  entry("reduced-3", "2026-09-09", "reduced-daily-rest"),

  entry("reduced-4", "2026-09-10", "reduced-daily-rest"),
]);

scenarios.push(
  result(
    "Fourth reduced rest breaches allowance",
    fourUsed.reducedRestsUsed === 4 &&
      fourUsed.reducedRestsRemaining === 0 &&
      fourUsed.canTakeAnotherReducedRest === false &&
      fourUsed.level === "breach",
    `Level: ${fourUsed.level}, used: ${fourUsed.reducedRestsUsed}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 * Regular daily rest does not reset counter.
 * --------------------------------------------------
 */
const regularDoesNotReset = evaluateReducedDailyRestHistory([
  entry("weekly-1", "2026-09-06", "weekly-rest"),

  entry("reduced-1", "2026-09-07", "reduced-daily-rest"),

  entry("regular-1", "2026-09-08", "regular-daily-rest"),

  entry("regular-2", "2026-09-09", "regular-daily-rest"),

  entry("reduced-2", "2026-09-10", "reduced-daily-rest"),
]);

scenarios.push(
  result(
    "Regular daily rest does not reset reduced-rest count",
    regularDoesNotReset.reducedRestsUsed === 2,
    `Used: ${regularDoesNotReset.reducedRestsUsed}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 * Split regular daily rest does not consume
 * one of the reductions.
 * --------------------------------------------------
 */
const splitDoesNotConsume = evaluateReducedDailyRestHistory([
  entry("weekly-1", "2026-09-06", "weekly-rest"),

  entry("reduced-1", "2026-09-07", "reduced-daily-rest"),

  entry("split-1", "2026-09-08", "split-regular-daily-rest"),

  entry("reduced-2", "2026-09-09", "reduced-daily-rest"),
]);

scenarios.push(
  result(
    "Split regular daily rest does not consume reduction",
    splitDoesNotConsume.reducedRestsUsed === 2 &&
      splitDoesNotConsume.reducedRestsRemaining === 1,
    `Used: ${splitDoesNotConsume.reducedRestsUsed}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 * Weekly rest resets counter.
 * --------------------------------------------------
 */
const weeklyReset = evaluateReducedDailyRestHistory([
  entry("weekly-old", "2026-09-06", "weekly-rest"),

  entry("reduced-old-1", "2026-09-07", "reduced-daily-rest"),

  entry("reduced-old-2", "2026-09-08", "reduced-daily-rest"),

  entry("reduced-old-3", "2026-09-09", "reduced-daily-rest"),

  entry("weekly-new", "2026-09-13", "weekly-rest"),

  entry("reduced-new-1", "2026-09-14", "reduced-daily-rest"),
]);

scenarios.push(
  result(
    "New weekly rest resets reduced-rest history",
    weeklyReset.reducedRestsUsed === 1 &&
      weeklyReset.reducedRestsRemaining === 2 &&
      weeklyReset.level === "good",
    `Used after reset: ${weeklyReset.reducedRestsUsed}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 * Proposed third reduction.
 *
 * Should warn but remain legal.
 * --------------------------------------------------
 */
const proposedThird = evaluateProposedReducedDailyRest(
  [
    entry("weekly-1", "2026-09-06", "weekly-rest"),

    entry("reduced-1", "2026-09-07", "reduced-daily-rest"),

    entry("reduced-2", "2026-09-08", "reduced-daily-rest"),
  ],
  "2026-09-09",
);

scenarios.push(
  result(
    "Proposed third reduced rest warns but is available",
    proposedThird.reducedRestsUsed === 3 &&
      proposedThird.level === "warning" &&
      proposedThird.canTakeAnotherReducedRest === false,
    `Level after proposed rest: ${proposedThird.level}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 * Proposed fourth reduction.
 *
 * Must show breach.
 * --------------------------------------------------
 */
const proposedFourth = evaluateProposedReducedDailyRest(
  [
    entry("weekly-1", "2026-09-06", "weekly-rest"),

    entry("reduced-1", "2026-09-07", "reduced-daily-rest"),

    entry("reduced-2", "2026-09-08", "reduced-daily-rest"),

    entry("reduced-3", "2026-09-09", "reduced-daily-rest"),
  ],
  "2026-09-10",
);

scenarios.push(
  result(
    "Proposed fourth reduced rest predicts breach",
    proposedFourth.reducedRestsUsed === 4 &&
      proposedFourth.level === "breach" &&
      proposedFourth.canTakeAnotherReducedRest === false,
    `Level: ${proposedFourth.level}`,
  ),
);

export const reducedDailyRestHistoryScenarioResults = scenarios;

export const reducedDailyRestHistoryScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
