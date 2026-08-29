import { calculateExtendedDrivingAllowanceState } from "../extendedDrivingAllowanceState";

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

const scenarios: ScenarioResult[] = [];

function makeDay(id: string, drivingMinutes: number): DriverDay {
  return {
    id,
    date: "2026-08-27",

    activities: [
      {
        id: `${id}-driving`,
        type: "driving",
        start: "2026-08-27T06:00:00.000Z",
        end: "2026-08-27T06:00:00.000Z",
        durationMinutes: drivingMinutes,
      },
    ],

    drivingMinutes,
    otherWorkMinutes: 0,
    breakMinutes: 0,
    poaMinutes: 0,
    restMinutes: 0,

    dailyRestType: "unknown",
  };
}

/**
 * --------------------------------------------------
 * SCENARIO 1
 *
 * No extensions used.
 * --------------------------------------------------
 */
const state1 = calculateExtendedDrivingAllowanceState([]);

scenarios.push(
  result(
    "Zero extensions leaves two available",

    state1.extensionsUsed === 0 &&
      state1.extensionsRemaining === 2 &&
      state1.extensionAvailable === true &&
      state1.allowanceExhausted === false &&
      state1.status === "available",

    `Used: ${state1.extensionsUsed}, remaining: ${state1.extensionsRemaining}, status: ${state1.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 *
 * One valid extended day.
 * --------------------------------------------------
 */
const state2 = calculateExtendedDrivingAllowanceState([
  makeDay("day-1", 9 * 60 + 30),
]);

scenarios.push(
  result(
    "One extension leaves one remaining",

    state2.extensionsUsed === 1 &&
      state2.extensionsRemaining === 1 &&
      state2.extensionAvailable === true &&
      state2.status === "one-used",

    `Used: ${state2.extensionsUsed}, remaining: ${state2.extensionsRemaining}, status: ${state2.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 *
 * Two valid extended days.
 * --------------------------------------------------
 */
const state3 = calculateExtendedDrivingAllowanceState([
  makeDay("day-1", 9 * 60 + 15),

  makeDay("day-2", 9 * 60 + 45),
]);

scenarios.push(
  result(
    "Two extensions exhaust weekly allowance",

    state3.extensionsUsed === 2 &&
      state3.extensionsRemaining === 0 &&
      state3.extensionAvailable === false &&
      state3.allowanceExhausted === true &&
      state3.status === "exhausted",

    `Used: ${state3.extensionsUsed}, remaining: ${state3.extensionsRemaining}, status: ${state3.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 *
 * Three valid extended days.
 * --------------------------------------------------
 */
const state4 = calculateExtendedDrivingAllowanceState([
  makeDay("day-1", 9 * 60 + 10),

  makeDay("day-2", 9 * 60 + 20),

  makeDay("day-3", 9 * 60 + 30),
]);

scenarios.push(
  result(
    "Three extensions create weekly breach",

    state4.extensionsUsed === 3 &&
      state4.extensionsRemaining === 0 &&
      state4.excessExtensionDays === 1 &&
      state4.status === "breach",

    `Used: ${state4.extensionsUsed}, excess days: ${state4.excessExtensionDays}, status: ${state4.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 *
 * Exactly 9h does NOT count as an extension.
 * --------------------------------------------------
 */
const state5 = calculateExtendedDrivingAllowanceState([
  makeDay("day-1", 9 * 60),
]);

scenarios.push(
  result(
    "Exactly 9h does not use an extension",

    state5.extensionsUsed === 0 && state5.extensionsRemaining === 2,

    `Used: ${state5.extensionsUsed}, remaining: ${state5.extensionsRemaining}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 *
 * 9h01 DOES count.
 * --------------------------------------------------
 */
const state6 = calculateExtendedDrivingAllowanceState([
  makeDay("day-1", 9 * 60 + 1),
]);

scenarios.push(
  result(
    "9h01 uses one extension",

    state6.extensionsUsed === 1 && state6.extensionsRemaining === 1,

    `Used: ${state6.extensionsUsed}, remaining: ${state6.extensionsRemaining}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 *
 * Exactly 10h counts as a valid extended day.
 * --------------------------------------------------
 */
const state7 = calculateExtendedDrivingAllowanceState([
  makeDay("day-1", 10 * 60),
]);

scenarios.push(
  result(
    "Exactly 10h counts as a valid extension",

    state7.extensionsUsed === 1 && state7.extensionsRemaining === 1,

    `Used: ${state7.extensionsUsed}, remaining: ${state7.extensionsRemaining}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 *
 * Over 10h is already a daily-driving breach,
 * so it must NOT be counted as a valid extension.
 * --------------------------------------------------
 */
const state8 = calculateExtendedDrivingAllowanceState([
  makeDay("day-1", 10 * 60 + 1),
]);

scenarios.push(
  result(
    "Over 10h is not counted as a valid extension",

    state8.extensionsUsed === 0 && state8.extensionsRemaining === 2,

    `Used: ${state8.extensionsUsed}, remaining: ${state8.extensionsRemaining}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 *
 * Ordinary sub-9h days do not affect allowance.
 * --------------------------------------------------
 */
const state9 = calculateExtendedDrivingAllowanceState([
  makeDay("day-1", 8 * 60),

  makeDay("day-2", 7 * 60 + 30),
]);

scenarios.push(
  result(
    "Normal driving days do not use extensions",

    state9.extensionsUsed === 0 &&
      state9.extensionsRemaining === 2 &&
      state9.status === "available",

    `Used: ${state9.extensionsUsed}, remaining: ${state9.extensionsRemaining}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 *
 * Mixed week:
 *
 * 8h
 * 9h30
 * 9h
 * 10h
 *
 * Should use exactly two extensions.
 * --------------------------------------------------
 */
const state10 = calculateExtendedDrivingAllowanceState([
  makeDay("day-1", 8 * 60),

  makeDay("day-2", 9 * 60 + 30),

  makeDay("day-3", 9 * 60),

  makeDay("day-4", 10 * 60),
]);

scenarios.push(
  result(
    "Mixed week counts only valid extended days",

    state10.extensionsUsed === 2 &&
      state10.extensionsRemaining === 0 &&
      state10.allowanceExhausted === true &&
      state10.status === "exhausted",

    `Used: ${state10.extensionsUsed}, remaining: ${state10.extensionsRemaining}, status: ${state10.status}`,
  ),
);

export const extendedDrivingAllowanceStateScenarioResults = scenarios;

export const extendedDrivingAllowanceStateScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
