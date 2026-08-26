import { coordinateWeeklyRestObligation } from "../weeklyRestObligationCoordinator";

import { createWeeklyRestRecord } from "../weeklyRestHistory";

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
 * WEEK 35
 *
 * 24h reduced weekly rest.
 *
 * This creates:
 *
 * 45h required
 * 24h taken
 * 21h compensation owed
 *
 * Source week:
 * Mon 24 Aug - Sun 30 Aug 2026
 *
 * Deadline:
 * Sun 20 Sep 2026
 * --------------------------------------------------
 */

const reduced24 = createWeeklyRestRecord(
  "week-35-rest",
  "2026-08-29T18:00:00.000Z",
  "2026-08-30T18:00:00.000Z",
);

if (!reduced24) {
  throw new Error("Expected reduced24 weekly rest record to be created.");
}

/**
 * --------------------------------------------------
 * SCENARIO 1
 *
 * Fresh reduced weekly rest creates
 * 21h outstanding compensation.
 * --------------------------------------------------
 */

const freshObligation = coordinateWeeklyRestObligation({
  weeklyRest: reduced24,

  sourceWeekNumber: 35,

  sourceWeekReferenceDate: "2026-08-30",

  currentDate: "2026-08-31",
});

scenarios.push(
  result(
    "24h reduced weekly rest creates 21h outstanding obligation",

    freshObligation.hasObligation === true &&
      freshObligation.obligation?.requiredMinutes === 21 * 60 &&
      freshObligation.obligation?.remainingMinutes === 21 * 60 &&
      freshObligation.obligation?.status === "outstanding",

    `Required: ${
      freshObligation.obligation?.requiredMinutes ?? 0
    }, remaining: ${freshObligation.obligation?.remainingMinutes ?? 0}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 *
 * Deadline should come from our
 * already-tested deadline engine.
 * --------------------------------------------------
 */

scenarios.push(
  result(
    "Coordinator attaches correct compensation deadline",

    freshObligation.obligation?.deadline === "2026-09-20",

    `Deadline: ${freshObligation.obligation?.deadline}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 *
 * Outstanding obligation remains visible
 * to calendar/planning layer.
 * --------------------------------------------------
 */

scenarios.push(
  result(
    "Outstanding obligation remains calendar-visible",

    freshObligation.obligation?.calendarVisible === true &&
      freshObligation.obligation?.hasOutstandingCompensation === true,

    `Visible: ${freshObligation.obligation?.calendarVisible}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 *
 * Apply 10h compensation.
 *
 * Original debt: 21h
 * Paid:          10h
 * Remaining:     11h
 * --------------------------------------------------
 */

const partial = coordinateWeeklyRestObligation({
  weeklyRest: reduced24,

  sourceWeekNumber: 35,

  sourceWeekReferenceDate: "2026-08-30",

  currentDate: "2026-09-10",

  satisfiedMinutes: 10 * 60,
});

scenarios.push(
  result(
    "Partial compensation leaves correct balance",

    partial.obligation?.status === "partially-compensated" &&
      partial.obligation?.satisfiedMinutes === 10 * 60 &&
      partial.obligation?.remainingMinutes === 11 * 60,

    `Satisfied: ${partial.obligation?.satisfiedMinutes ?? 0}, remaining: ${
      partial.obligation?.remainingMinutes ?? 0
    }`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 *
 * Partial obligation stays visible.
 * --------------------------------------------------
 */

scenarios.push(
  result(
    "Partial obligation stays calendar-visible",

    partial.obligation?.calendarVisible === true &&
      partial.obligation?.hasOutstandingCompensation === true,

    `Visible: ${partial.obligation?.calendarVisible}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 *
 * Full 21h compensation.
 * --------------------------------------------------
 */

const completed = coordinateWeeklyRestObligation({
  weeklyRest: reduced24,

  sourceWeekNumber: 35,

  sourceWeekReferenceDate: "2026-08-30",

  currentDate: "2026-09-15",

  satisfiedMinutes: 21 * 60,
});

scenarios.push(
  result(
    "Full compensation satisfies obligation",

    completed.obligation?.status === "completed" &&
      completed.obligation?.remainingMinutes === 0 &&
      completed.obligation?.satisfiedMinutes === 21 * 60,

    `Status: ${completed.obligation?.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 *
 * Completed obligation disappears from
 * active calendar warnings.
 * --------------------------------------------------
 */

scenarios.push(
  result(
    "Satisfied obligation no longer needs active calendar warning",

    completed.obligation?.calendarVisible === false &&
      completed.obligation?.hasOutstandingCompensation === false,

    `Visible: ${completed.obligation?.calendarVisible}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 *
 * Outstanding after deadline becomes overdue.
 * --------------------------------------------------
 */

const overdue = coordinateWeeklyRestObligation({
  weeklyRest: reduced24,

  sourceWeekNumber: 35,

  sourceWeekReferenceDate: "2026-08-30",

  currentDate: "2026-09-21",
});

scenarios.push(
  result(
    "Outstanding compensation becomes overdue after deadline",

    overdue.obligation?.status === "overdue" &&
      overdue.obligation?.overdue === true &&
      overdue.obligation?.remainingMinutes === 21 * 60,

    `Status: ${overdue.obligation?.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 *
 * Overdue obligation remains visible.
 * --------------------------------------------------
 */

scenarios.push(
  result(
    "Overdue obligation remains calendar-visible",

    overdue.obligation?.calendarVisible === true &&
      overdue.obligation?.hasOutstandingCompensation === true,

    `Visible: ${overdue.obligation?.calendarVisible}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 *
 * Partially compensated debt can become overdue.
 *
 * 10h paid.
 * 11h remain.
 * --------------------------------------------------
 */

const partialOverdue = coordinateWeeklyRestObligation({
  weeklyRest: reduced24,

  sourceWeekNumber: 35,

  sourceWeekReferenceDate: "2026-08-30",

  currentDate: "2026-09-21",

  satisfiedMinutes: 10 * 60,
});

scenarios.push(
  result(
    "Partially compensated obligation can become overdue",

    partialOverdue.obligation?.status === "overdue" &&
      partialOverdue.obligation?.remainingMinutes === 11 * 60 &&
      partialOverdue.obligation?.overdue === true,

    `Remaining: ${partialOverdue.obligation?.remainingMinutes ?? 0}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 11
 *
 * Regular 45h weekly rest creates
 * no compensation obligation.
 * --------------------------------------------------
 */

const regular45 = createWeeklyRestRecord(
  "regular-weekly-rest",
  "2026-09-04T18:00:00.000Z",
  "2026-09-06T15:00:00.000Z",
);

if (!regular45) {
  throw new Error("Expected regular weekly rest record.");
}

const regularResult = coordinateWeeklyRestObligation({
  weeklyRest: regular45,

  sourceWeekNumber: 36,

  sourceWeekReferenceDate: "2026-09-06",

  currentDate: "2026-09-07",
});

scenarios.push(
  result(
    "Regular weekly rest creates no obligation",

    regularResult.hasObligation === false && regularResult.obligation === null,

    `Has obligation: ${regularResult.hasObligation}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 12
 *
 * 30h reduced weekly rest.
 *
 * Missing:
 * 45 - 30 = 15h
 * --------------------------------------------------
 */

const reduced30 = createWeeklyRestRecord(
  "week-37-rest",
  "2026-09-11T18:00:00.000Z",
  "2026-09-13T00:00:00.000Z",
);

if (!reduced30) {
  throw new Error("Expected 30h reduced weekly rest.");
}

const reduced30Result = coordinateWeeklyRestObligation({
  weeklyRest: reduced30,

  sourceWeekNumber: 37,

  sourceWeekReferenceDate: "2026-09-13",

  currentDate: "2026-09-14",
});

scenarios.push(
  result(
    "30h weekly rest creates 15h coordinated obligation",

    reduced30Result.obligation?.requiredMinutes === 15 * 60 &&
      reduced30Result.obligation?.remainingMinutes === 15 * 60,

    `Required: ${reduced30Result.obligation?.requiredMinutes ?? 0}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 13
 *
 * Overpayment is capped.
 *
 * 21h owed.
 * Attempt to satisfy 30h.
 *
 * Must record no more than 21h.
 * --------------------------------------------------
 */

const overpayment = coordinateWeeklyRestObligation({
  weeklyRest: reduced24,

  sourceWeekNumber: 35,

  sourceWeekReferenceDate: "2026-08-30",

  currentDate: "2026-09-15",

  satisfiedMinutes: 30 * 60,
});

scenarios.push(
  result(
    "Coordinator caps compensation at amount owed",

    overpayment.obligation?.satisfiedMinutes === 21 * 60 &&
      overpayment.obligation?.remainingMinutes === 0 &&
      overpayment.obligation?.status === "completed",

    `Satisfied: ${overpayment.obligation?.satisfiedMinutes ?? 0}`,
  ),
);

export const weeklyRestCoordinatorScenarioResults = scenarios;

export const weeklyRestCoordinatorScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
