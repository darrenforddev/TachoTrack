import {
    calculateFortnightlyDrivingState,
    FORTNIGHTLY_DRIVING_LIMIT_MINUTES,
    FORTNIGHTLY_DRIVING_WARNING_REMAINING_MINUTES,
} from "../fortnightlyDrivingState";

import type { DriverDay } from "../types";

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

function makeDay(id: string, date: string, drivingMinutes: number): DriverDay {
  return {
    id,
    date,
    activities: [],
    drivingMinutes,
    otherWorkMinutes: 0,
    breakMinutes: 0,
    poaMinutes: 0,
    restMinutes: 0,
    dailyRestType: "unknown",
  };
}

const scenarios: ScenarioResult[] = [];

/**
 * 1 — no driving
 */
const state1 = calculateFortnightlyDrivingState([], []);

scenarios.push(
  result(
    "Zero driving starts with full 90h allowance",
    state1.drivingMinutesUsed === 0 &&
      state1.remainingMinutes === FORTNIGHTLY_DRIVING_LIMIT_MINUTES &&
      state1.status === "good",
    `Used: ${state1.drivingMinutesUsed}, remaining: ${state1.remainingMinutes}, status: ${state1.status}`,
  ),
);

/**
 * 2 — previous week only
 */
const state2 = calculateFortnightlyDrivingState(
  [makeDay("previous", "2026-08-17", 45 * 60)],
  [],
);

scenarios.push(
  result(
    "Previous week contributes to fortnight total",
    state2.previousWeekDrivingMinutes === 45 * 60 &&
      state2.currentWeekDrivingMinutes === 0 &&
      state2.drivingMinutesUsed === 45 * 60,
    `Previous: ${state2.previousWeekDrivingMinutes}, current: ${state2.currentWeekDrivingMinutes}, total: ${state2.drivingMinutesUsed}`,
  ),
);

/**
 * 3 — current week only
 */
const state3 = calculateFortnightlyDrivingState(
  [],
  [makeDay("current", "2026-08-24", 40 * 60)],
);

scenarios.push(
  result(
    "Current week contributes to fortnight total",
    state3.currentWeekDrivingMinutes === 40 * 60 &&
      state3.drivingMinutesUsed === 40 * 60,
    `Current: ${state3.currentWeekDrivingMinutes}, total: ${state3.drivingMinutesUsed}`,
  ),
);

/**
 * 4 — 81h59
 *
 * 8h01 remains, so warning has not started.
 */
const state4 = calculateFortnightlyDrivingState(
  [makeDay("previous", "2026-08-17", 45 * 60)],
  [makeDay("current", "2026-08-24", 36 * 60 + 59)],
);

scenarios.push(
  result(
    "81h59 remains outside eight-hour warning",
    state4.remainingMinutes ===
      FORTNIGHTLY_DRIVING_WARNING_REMAINING_MINUTES + 1 &&
      state4.status === "good",
    `Remaining: ${state4.remainingMinutes}, status: ${state4.status}`,
  ),
);

/**
 * 5 — exactly 82h
 *
 * 8h remain, so warning begins.
 */
const state5 = calculateFortnightlyDrivingState(
  [makeDay("previous", "2026-08-17", 45 * 60)],
  [makeDay("current", "2026-08-24", 37 * 60)],
);

scenarios.push(
  result(
    "Exactly 82h enters eight-hour warning",
    state5.remainingMinutes === FORTNIGHTLY_DRIVING_WARNING_REMAINING_MINUTES &&
      state5.status === "warning",
    `Remaining: ${state5.remainingMinutes}, status: ${state5.status}`,
  ),
);

/**
 * 6 — 89h59
 */
const state6 = calculateFortnightlyDrivingState(
  [makeDay("previous", "2026-08-17", 45 * 60)],
  [makeDay("current", "2026-08-24", 44 * 60 + 59)],
);

scenarios.push(
  result(
    "89h59 leaves one minute",
    state6.remainingMinutes === 1 && state6.status === "warning",
    `Remaining: ${state6.remainingMinutes}, status: ${state6.status}`,
  ),
);

/**
 * 7 — exactly 90h
 */
const state7 = calculateFortnightlyDrivingState(
  [makeDay("previous", "2026-08-17", 45 * 60)],
  [makeDay("current", "2026-08-24", 45 * 60)],
);

scenarios.push(
  result(
    "Exactly 90h reaches fortnightly limit",
    state7.drivingMinutesUsed === 90 * 60 &&
      state7.remainingMinutes === 0 &&
      state7.status === "limit",
    `Total: ${state7.drivingMinutesUsed}, status: ${state7.status}`,
  ),
);

/**
 * 8 — 90h01
 */
const state8 = calculateFortnightlyDrivingState(
  [makeDay("previous", "2026-08-17", 45 * 60)],
  [makeDay("current", "2026-08-24", 45 * 60 + 1)],
);

scenarios.push(
  result(
    "90h01 creates fortnightly breach",
    state8.drivingMinutesUsed === 90 * 60 + 1 &&
      state8.remainingMinutes === 0 &&
      state8.status === "breach",
    `Total: ${state8.drivingMinutesUsed}, status: ${state8.status}`,
  ),
);

/**
 * 9 — realistic split
 *
 * Previous week 46h
 * Current week 38h
 * Total 84h
 * Remaining 6h
 */
const state9 = calculateFortnightlyDrivingState(
  [makeDay("previous", "2026-08-17", 46 * 60)],
  [makeDay("current", "2026-08-24", 38 * 60)],
);

scenarios.push(
  result(
    "46h plus 38h gives 84h with 6h remaining",
    state9.previousWeekDrivingMinutes === 46 * 60 &&
      state9.currentWeekDrivingMinutes === 38 * 60 &&
      state9.drivingMinutesUsed === 84 * 60 &&
      state9.remainingMinutes === 6 * 60 &&
      state9.status === "warning",
    `Previous: ${state9.previousWeekDrivingMinutes}, current: ${state9.currentWeekDrivingMinutes}, remaining: ${state9.remainingMinutes}`,
  ),
);

/**
 * 10 — 45h + 0h = exactly 50%
 */
const state10 = calculateFortnightlyDrivingState(
  [makeDay("previous", "2026-08-17", 45 * 60)],
  [],
);

scenarios.push(
  result(
    "45h is exactly 50 percent of fortnight limit",
    Math.abs(state10.percentageUsed - 50) < 0.001 &&
      Math.abs(state10.percentageRemaining - 50) < 0.001,
    `Used %: ${state10.percentageUsed}, remaining %: ${state10.percentageRemaining}`,
  ),
);

/**
 * 11 — negative values cannot reduce total
 */
const state11 = calculateFortnightlyDrivingState(
  [makeDay("bad", "2026-08-17", -600)],
  [makeDay("good", "2026-08-24", 60)],
);

scenarios.push(
  result(
    "Negative driving cannot reduce fortnight total",
    state11.drivingMinutesUsed === 60 &&
      state11.remainingMinutes === FORTNIGHTLY_DRIVING_LIMIT_MINUTES - 60,
    `Total: ${state11.drivingMinutesUsed}, remaining: ${state11.remainingMinutes}`,
  ),
);

export const fortnightlyDrivingStateScenarioResults = scenarios;

export const fortnightlyDrivingStateScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
