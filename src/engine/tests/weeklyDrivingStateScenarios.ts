import {
    calculateWeeklyDrivingState,
    WEEKLY_DRIVING_LIMIT_MINUTES,
    WEEKLY_DRIVING_WARNING_REMAINING_MINUTES,
} from "../weeklyDrivingState";

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

function makeDay(id: string, drivingMinutes: number): DriverDay {
  return {
    id,
    date: "2026-08-27",
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
 * 1 — zero driving
 */
const state1 = calculateWeeklyDrivingState([]);

scenarios.push(
  result(
    "Zero weekly driving starts with full allowance",
    state1.drivingMinutesUsed === 0 &&
      state1.remainingMinutes === WEEKLY_DRIVING_LIMIT_MINUTES &&
      state1.percentageUsed === 0 &&
      state1.percentageRemaining === 100 &&
      state1.status === "good",
    `Used: ${state1.drivingMinutesUsed}, remaining: ${state1.remainingMinutes}, status: ${state1.status}`,
  ),
);

/**
 * 2 — 47h59
 */
const state2 = calculateWeeklyDrivingState([makeDay("day-1", 47 * 60 + 59)]);

scenarios.push(
  result(
    "47h59 remains outside warning threshold",
    state2.remainingMinutes === WEEKLY_DRIVING_WARNING_REMAINING_MINUTES + 1 &&
      state2.status === "good",
    `Remaining: ${state2.remainingMinutes}, status: ${state2.status}`,
  ),
);

/**
 * 3 — exactly 48h
 *
 * 8h remain, therefore warning starts.
 */
const state3 = calculateWeeklyDrivingState([makeDay("day-1", 48 * 60)]);

scenarios.push(
  result(
    "Exactly 48h enters eight-hour warning",
    state3.remainingMinutes === WEEKLY_DRIVING_WARNING_REMAINING_MINUTES &&
      state3.status === "warning",
    `Remaining: ${state3.remainingMinutes}, status: ${state3.status}`,
  ),
);

/**
 * 4 — 55h
 */
const state4 = calculateWeeklyDrivingState([makeDay("day-1", 55 * 60)]);

scenarios.push(
  result(
    "55h is warning with one hour remaining",
    state4.remainingMinutes === 60 && state4.status === "warning",
    `Remaining: ${state4.remainingMinutes}, status: ${state4.status}`,
  ),
);

/**
 * 5 — 55h59
 */
const state5 = calculateWeeklyDrivingState([makeDay("day-1", 55 * 60 + 59)]);

scenarios.push(
  result(
    "55h59 leaves one minute remaining",
    state5.remainingMinutes === 1 && state5.status === "warning",
    `Remaining: ${state5.remainingMinutes}, status: ${state5.status}`,
  ),
);

/**
 * 6 — exactly 56h
 */
const state6 = calculateWeeklyDrivingState([makeDay("day-1", 56 * 60)]);

scenarios.push(
  result(
    "Exactly 56h reaches weekly driving limit",
    state6.remainingMinutes === 0 && state6.status === "limit",
    `Remaining: ${state6.remainingMinutes}, status: ${state6.status}`,
  ),
);

/**
 * 7 — 56h01
 */
const state7 = calculateWeeklyDrivingState([makeDay("day-1", 56 * 60 + 1)]);

scenarios.push(
  result(
    "56h01 creates weekly driving breach",
    state7.remainingMinutes === 0 && state7.status === "breach",
    `Used: ${state7.drivingMinutesUsed}, status: ${state7.status}`,
  ),
);

/**
 * 8 — multi-day total
 *
 * 9h + 9h + 9h + 9h + 9h = 45h.
 */
const state8 = calculateWeeklyDrivingState([
  makeDay("mon", 9 * 60),
  makeDay("tue", 9 * 60),
  makeDay("wed", 9 * 60),
  makeDay("thu", 9 * 60),
  makeDay("fri", 9 * 60),
]);

scenarios.push(
  result(
    "Weekly state sums multiple driver days",
    state8.drivingMinutesUsed === 45 * 60 &&
      state8.remainingMinutes === 11 * 60 &&
      state8.status === "good",
    `Used: ${state8.drivingMinutesUsed}, remaining: ${state8.remainingMinutes}`,
  ),
);

/**
 * 9 — percentage calculation
 *
 * 28h is exactly 50% of 56h.
 */
const state9 = calculateWeeklyDrivingState([makeDay("day-1", 28 * 60)]);

scenarios.push(
  result(
    "28h is exactly 50 percent of weekly limit",
    Math.abs(state9.percentageUsed - 50) < 0.001 &&
      Math.abs(state9.percentageRemaining - 50) < 0.001,
    `Used %: ${state9.percentageUsed}, remaining %: ${state9.percentageRemaining}`,
  ),
);

/**
 * 10 — negative values are ignored safely.
 */
const state10 = calculateWeeklyDrivingState([
  makeDay("bad-day", -120),
  makeDay("good-day", 60),
]);

scenarios.push(
  result(
    "Negative driving values cannot reduce weekly total",
    state10.drivingMinutesUsed === 60 &&
      state10.remainingMinutes === WEEKLY_DRIVING_LIMIT_MINUTES - 60,
    `Used: ${state10.drivingMinutesUsed}, remaining: ${state10.remainingMinutes}`,
  ),
);

export const weeklyDrivingStateScenarioResults = scenarios;

export const weeklyDrivingStateScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
