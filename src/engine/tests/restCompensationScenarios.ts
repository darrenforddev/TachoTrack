import type { WeeklyRestCompensationObligation } from "../weeklyRestCompensation";

import {
    applyWeeklyRestCompensation,
    createWeeklyRestCompensationObligation,
    evaluateWeeklyRestCompensation,
} from "../weeklyRestCompensation";

type ScenarioResult = {
  name: string;
  passed: boolean;
  details: string;
};

function passFail(
  condition: boolean,
  name: string,
  details: string,
): ScenarioResult {
  return {
    name,
    passed: condition,
    details,
  };
}

const results: ScenarioResult[] = [];

/**
 * --------------------------------------------------
 * SCENARIO 1
 * Full 45h weekly rest.
 *
 * No compensation should be created.
 * --------------------------------------------------
 */
const regular45 = createWeeklyRestCompensationObligation(
  35,
  "2026-08-30",
  45 * 60,
);

results.push(
  passFail(
    regular45.level === "good" && regular45.obligation === undefined,
    "45h weekly rest creates no obligation",
    `Level: ${regular45.level}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 * Exactly 24h reduced weekly rest.
 *
 * Shortfall from 45h = 21h.
 * --------------------------------------------------
 */
const reduced24 = createWeeklyRestCompensationObligation(
  35,
  "2026-08-30",
  24 * 60,
);

results.push(
  passFail(
    reduced24.level === "warning" &&
      reduced24.obligation?.requiredCompensationMinutes === 21 * 60 &&
      reduced24.obligation?.remainingMinutes === 21 * 60,
    "24h reduced weekly rest creates 21h compensation",
    `Required: ${
      reduced24.obligation?.requiredCompensationMinutes ?? 0
    } minutes`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 * 30h weekly rest.
 *
 * Shortfall = 15h.
 * --------------------------------------------------
 */
const reduced30 = createWeeklyRestCompensationObligation(
  36,
  "2026-09-06",
  30 * 60,
);

results.push(
  passFail(
    reduced30.obligation?.requiredCompensationMinutes === 15 * 60,
    "30h weekly rest creates 15h compensation",
    `Required: ${
      reduced30.obligation?.requiredCompensationMinutes ?? 0
    } minutes`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 * Below 24h weekly rest.
 *
 * This is a breach rather than
 * a valid reduced weekly rest.
 * --------------------------------------------------
 */
const below24 = createWeeklyRestCompensationObligation(
  37,
  "2026-09-13",
  23 * 60 + 59,
);

results.push(
  passFail(
    below24.level === "breach" && below24.obligation === undefined,
    "Below 24h weekly rest is a breach",
    `Level: ${below24.level}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 * Partial compensation.
 *
 * Start with 21h outstanding.
 * Apply 10h.
 * 11h should remain.
 * --------------------------------------------------
 */
const originalObligation =
  reduced24.obligation as WeeklyRestCompensationObligation;

const partiallyCompensated = applyWeeklyRestCompensation(
  originalObligation,
  10 * 60,
);

results.push(
  passFail(
    partiallyCompensated.status === "partially-compensated" &&
      partiallyCompensated.compensatedMinutes === 10 * 60 &&
      partiallyCompensated.remainingMinutes === 11 * 60,
    "Partial compensation leaves correct balance",
    `Remaining: ${partiallyCompensated.remainingMinutes} minutes`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 * Complete compensation.
 *
 * Apply remaining 11h.
 * --------------------------------------------------
 */
const fullyCompensated = applyWeeklyRestCompensation(
  partiallyCompensated,
  11 * 60,
);

results.push(
  passFail(
    fullyCompensated.status === "completed" &&
      fullyCompensated.remainingMinutes === 0,
    "Full compensation completes obligation",
    `Status: ${fullyCompensated.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 * Overpayment should not create
 * a negative remaining balance.
 * --------------------------------------------------
 */
const overCompensated = applyWeeklyRestCompensation(
  originalObligation,
  30 * 60,
);

results.push(
  passFail(
    overCompensated.remainingMinutes === 0 &&
      overCompensated.compensatedMinutes === 21 * 60 &&
      overCompensated.status === "completed",
    "Compensation cannot exceed obligation",
    `Compensated: ${overCompensated.compensatedMinutes} minutes`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 * Outstanding before deadline.
 * --------------------------------------------------
 */
const beforeDeadline = evaluateWeeklyRestCompensation(
  originalObligation,
  "2026-09-10",
);

results.push(
  passFail(
    beforeDeadline.level === "warning" &&
      beforeDeadline.obligation?.status === "outstanding",
    "Outstanding compensation remains warning before deadline",
    `Status: ${beforeDeadline.obligation?.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 * Fully compensated obligation
 * stays good even after deadline.
 * --------------------------------------------------
 */
const completedAfterDeadline = evaluateWeeklyRestCompensation(
  fullyCompensated,
  "2026-10-01",
);

results.push(
  passFail(
    completedAfterDeadline.level === "good" &&
      completedAfterDeadline.obligation?.status === "completed",
    "Completed compensation remains compliant after deadline",
    `Level: ${completedAfterDeadline.level}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 * Outstanding obligation after due date.
 *
 * Should become overdue/breach.
 * --------------------------------------------------
 */
const overdue = evaluateWeeklyRestCompensation(
  originalObligation,
  "2026-10-01",
);

results.push(
  passFail(
    overdue.level === "breach" && overdue.obligation?.status === "overdue",
    "Outstanding compensation becomes overdue",
    `Status: ${overdue.obligation?.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 11
 * Partial compensation can also
 * become overdue.
 * --------------------------------------------------
 */
const partialOverdue = evaluateWeeklyRestCompensation(
  partiallyCompensated,
  "2026-10-01",
);

results.push(
  passFail(
    partialOverdue.level === "breach" &&
      partialOverdue.obligation?.status === "overdue" &&
      partialOverdue.obligation?.remainingMinutes === 11 * 60,
    "Partially compensated balance becomes overdue",
    `Remaining: ${partialOverdue.obligation?.remainingMinutes ?? 0} minutes`,
  ),
);

export const restCompensationScenarioResults = results;

export const restCompensationScenarioSummary = {
  total: results.length,

  passed: results.filter((scenario) => scenario.passed).length,

  failed: results.filter((scenario) => !scenario.passed).length,

  allPassed: results.every((scenario) => scenario.passed),
};
