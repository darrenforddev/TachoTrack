import { calculateDailyDrivingState } from "../dailyDrivingState";

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

function makeDay(drivingMinutes: number): DriverDay {
  return {
    id: "daily-driving-test",
    date: "2026-08-27",

    activities: [
      {
        id: "driving",
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
 * 8h driving.
 * --------------------------------------------------
 */
const state1 = calculateDailyDrivingState(makeDay(8 * 60));

scenarios.push(
  result(
    "8h daily driving remains good",

    state1.drivingMinutesUsed === 480 &&
      state1.remainingToStandardMinutes === 60 &&
      state1.remainingToExtendedMinutes === 120 &&
      state1.status === "warning",

    `Used: ${state1.drivingMinutesUsed}, to 9h: ${state1.remainingToStandardMinutes}, to 10h: ${state1.remainingToExtendedMinutes}, status: ${state1.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 * Exactly 9h.
 * --------------------------------------------------
 */
const state2 = calculateDailyDrivingState(makeDay(9 * 60));

scenarios.push(
  result(
    "Exactly 9h reaches standard daily limit",

    state2.remainingToStandardMinutes === 0 &&
      state2.extensionUsedMinutes === 0 &&
      state2.status === "standard-limit",

    `Status: ${state2.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 * 9h01.
 * --------------------------------------------------
 */
const state3 = calculateDailyDrivingState(makeDay(9 * 60 + 1));

scenarios.push(
  result(
    "9h01 enters extended driving",

    state3.extensionInUse === true &&
      state3.extensionUsedMinutes === 1 &&
      state3.remainingToExtendedMinutes === 59 &&
      state3.status === "extended-warning",

    `Extension: ${state3.extensionUsedMinutes}, remaining to 10h: ${state3.remainingToExtendedMinutes}, status: ${state3.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 * 9h30.
 * --------------------------------------------------
 */
const state4 = calculateDailyDrivingState(makeDay(9 * 60 + 30));

scenarios.push(
  result(
    "9h30 remains within extended maximum",

    state4.extensionInUse === true &&
      state4.extensionUsedMinutes === 30 &&
      state4.remainingToExtendedMinutes === 30 &&
      state4.excessMinutes === 0,

    `Extension: ${state4.extensionUsedMinutes}, remaining: ${state4.remainingToExtendedMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 * Exactly 10h.
 * --------------------------------------------------
 */
const state5 = calculateDailyDrivingState(makeDay(10 * 60));

scenarios.push(
  result(
    "Exactly 10h reaches extended daily maximum",

    state5.remainingToExtendedMinutes === 0 &&
      state5.excessMinutes === 0 &&
      state5.status === "extended-limit",

    `Status: ${state5.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 * 10h01.
 * --------------------------------------------------
 */
const state6 = calculateDailyDrivingState(makeDay(10 * 60 + 1));

scenarios.push(
  result(
    "10h01 creates daily-driving breach",

    state6.excessMinutes === 1 && state6.status === "breach",

    `Excess: ${state6.excessMinutes}, status: ${state6.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 * Percent of standard limit.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "4h30 is 50 percent of standard 9h limit",

    Math.abs(
      calculateDailyDrivingState(makeDay(270)).percentageOfStandardUsed - 50,
    ) < 0.001,

    `Percentage: ${
      calculateDailyDrivingState(makeDay(270)).percentageOfStandardUsed
    }`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 * Percent of extended maximum.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "5h is 50 percent of extended 10h maximum",

    Math.abs(
      calculateDailyDrivingState(makeDay(300)).percentageOfExtendedUsed - 50,
    ) < 0.001,

    `Percentage: ${
      calculateDailyDrivingState(makeDay(300)).percentageOfExtendedUsed
    }`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 * Remaining percentage.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "5h leaves 50 percent of 10h maximum",

    Math.abs(
      calculateDailyDrivingState(makeDay(300)).percentageRemainingToExtended -
        50,
    ) < 0.001,

    `Remaining %: ${
      calculateDailyDrivingState(makeDay(300)).percentageRemainingToExtended
    }`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 * Zero driving.
 * --------------------------------------------------
 */
const state10 = calculateDailyDrivingState(makeDay(0));

scenarios.push(
  result(
    "Zero driving starts with full allowance",

    state10.drivingMinutesUsed === 0 &&
      state10.remainingToStandardMinutes === 540 &&
      state10.remainingToExtendedMinutes === 600 &&
      state10.extensionInUse === false &&
      state10.status === "good",

    `To 9h: ${state10.remainingToStandardMinutes}, to 10h: ${state10.remainingToExtendedMinutes}`,
  ),
);

export const dailyDrivingStateScenarioResults = scenarios;

export const dailyDrivingStateScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
