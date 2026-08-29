import {
    calculateContinuousDrivingState,
    formatDrivingMinutes,
} from "../continuousDrivingState";

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

/**
 * --------------------------------------------------
 * HELPER
 * --------------------------------------------------
 */
function makeDay(activities: DriverDay["activities"]): DriverDay {
  const drivingMinutes = activities
    .filter((activity) => activity.type === "driving")
    .reduce((total, activity) => total + activity.durationMinutes, 0);

  const breakMinutes = activities
    .filter((activity) => activity.type === "break")
    .reduce((total, activity) => total + activity.durationMinutes, 0);

  const otherWorkMinutes = activities
    .filter((activity) => activity.type === "otherWork")
    .reduce((total, activity) => total + activity.durationMinutes, 0);

  const poaMinutes = activities
    .filter((activity) => activity.type === "poa")
    .reduce((total, activity) => total + activity.durationMinutes, 0);

  return {
    id: "test-day",
    date: "2026-08-27",

    activities,

    drivingMinutes,
    breakMinutes,
    otherWorkMinutes,
    poaMinutes,

    restMinutes: 0,

    dailyRestType: "unknown",
  };
}

/**
 * --------------------------------------------------
 * SCENARIO 1
 *
 * 1h15 driving.
 *
 * Used      = 75
 * Remaining = 195
 * --------------------------------------------------
 */
const state1 = calculateContinuousDrivingState(
  makeDay([
    {
      id: "drive-75",
      type: "driving",
      start: "2026-08-27T08:00:00.000Z",
      end: "2026-08-27T09:15:00.000Z",
      durationMinutes: 75,
    },
  ]),
);

scenarios.push(
  result(
    "1h15 driving gives 3h15 remaining",

    state1.drivingMinutesUsed === 75 &&
      state1.remainingMinutes === 195 &&
      state1.status === "good",

    `Used: ${state1.drivingMinutesUsed}, remaining: ${state1.remainingMinutes}, status: ${state1.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 *
 * Exactly 4h30.
 * --------------------------------------------------
 */
const state2 = calculateContinuousDrivingState(
  makeDay([
    {
      id: "drive-270",
      type: "driving",
      start: "2026-08-27T06:00:00.000Z",
      end: "2026-08-27T10:30:00.000Z",
      durationMinutes: 270,
    },
  ]),
);

scenarios.push(
  result(
    "Exactly 4h30 reaches the limit",

    state2.drivingMinutesUsed === 270 &&
      state2.remainingMinutes === 0 &&
      state2.excessMinutes === 0 &&
      state2.status === "limit",

    `Used: ${state2.drivingMinutesUsed}, remaining: ${state2.remainingMinutes}, excess: ${state2.excessMinutes}, status: ${state2.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 *
 * 4h31.
 * --------------------------------------------------
 */
const state3 = calculateContinuousDrivingState(
  makeDay([
    {
      id: "drive-271",
      type: "driving",
      start: "2026-08-27T06:00:00.000Z",
      end: "2026-08-27T10:31:00.000Z",
      durationMinutes: 271,
    },
  ]),
);

scenarios.push(
  result(
    "4h31 produces one minute excess",

    state3.drivingMinutesUsed === 271 &&
      state3.remainingMinutes === 0 &&
      state3.excessMinutes === 1 &&
      state3.status === "breach",

    `Used: ${state3.drivingMinutesUsed}, excess: ${state3.excessMinutes}, status: ${state3.status}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 *
 * 45-minute break resets.
 * --------------------------------------------------
 */
const state4 = calculateContinuousDrivingState(
  makeDay([
    {
      id: "drive-before",
      type: "driving",
      start: "2026-08-27T06:00:00.000Z",
      end: "2026-08-27T08:00:00.000Z",
      durationMinutes: 120,
    },

    {
      id: "break-45",
      type: "break",
      start: "2026-08-27T08:00:00.000Z",
      end: "2026-08-27T08:45:00.000Z",
      durationMinutes: 45,
    },

    {
      id: "drive-after",
      type: "driving",
      start: "2026-08-27T08:45:00.000Z",
      end: "2026-08-27T09:45:00.000Z",
      durationMinutes: 60,
    },
  ]),
);

scenarios.push(
  result(
    "45-minute break resets used driving",

    state4.drivingMinutesUsed === 60 && state4.remainingMinutes === 210,

    `Used after reset: ${state4.drivingMinutesUsed}, remaining: ${state4.remainingMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 *
 * 15-minute break alone does not reset.
 * --------------------------------------------------
 */
const state5 = calculateContinuousDrivingState(
  makeDay([
    {
      id: "drive-a",
      type: "driving",
      start: "2026-08-27T06:00:00.000Z",
      end: "2026-08-27T09:00:00.000Z",
      durationMinutes: 180,
    },

    {
      id: "break-15",
      type: "break",
      start: "2026-08-27T09:00:00.000Z",
      end: "2026-08-27T09:15:00.000Z",
      durationMinutes: 15,
    },

    {
      id: "drive-b",
      type: "driving",
      start: "2026-08-27T09:15:00.000Z",
      end: "2026-08-27T10:15:00.000Z",
      durationMinutes: 60,
    },
  ]),
);

scenarios.push(
  result(
    "15-minute split break does not reset",

    state5.drivingMinutesUsed === 240 && state5.firstSplitBreakTaken === true,

    `Used: ${state5.drivingMinutesUsed}, first split: ${state5.firstSplitBreakTaken}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 *
 * 15 + 30 split resets.
 * --------------------------------------------------
 */
const state6 = calculateContinuousDrivingState(
  makeDay([
    {
      id: "drive-a",
      type: "driving",
      start: "2026-08-27T06:00:00.000Z",
      end: "2026-08-27T08:00:00.000Z",
      durationMinutes: 120,
    },

    {
      id: "break-15",
      type: "break",
      start: "2026-08-27T08:00:00.000Z",
      end: "2026-08-27T08:15:00.000Z",
      durationMinutes: 15,
    },

    {
      id: "drive-b",
      type: "driving",
      start: "2026-08-27T08:15:00.000Z",
      end: "2026-08-27T10:15:00.000Z",
      durationMinutes: 120,
    },

    {
      id: "break-30",
      type: "break",
      start: "2026-08-27T10:15:00.000Z",
      end: "2026-08-27T10:45:00.000Z",
      durationMinutes: 30,
    },

    {
      id: "drive-c",
      type: "driving",
      start: "2026-08-27T10:45:00.000Z",
      end: "2026-08-27T11:45:00.000Z",
      durationMinutes: 60,
    },
  ]),
);

scenarios.push(
  result(
    "15 + 30 split break resets continuous driving",

    state6.drivingMinutesUsed === 60 && state6.firstSplitBreakTaken === false,

    `Used after split reset: ${state6.drivingMinutesUsed}, first split: ${state6.firstSplitBreakTaken}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 *
 * Other Work does not reset.
 * --------------------------------------------------
 */
const state7 = calculateContinuousDrivingState(
  makeDay([
    {
      id: "drive-a",
      type: "driving",
      start: "2026-08-27T06:00:00.000Z",
      end: "2026-08-27T09:00:00.000Z",
      durationMinutes: 180,
    },

    {
      id: "work",
      type: "otherWork",
      start: "2026-08-27T09:00:00.000Z",
      end: "2026-08-27T09:30:00.000Z",
      durationMinutes: 30,
    },

    {
      id: "drive-b",
      type: "driving",
      start: "2026-08-27T09:30:00.000Z",
      end: "2026-08-27T10:30:00.000Z",
      durationMinutes: 60,
    },
  ]),
);

scenarios.push(
  result(
    "Other Work does not reset used driving",

    state7.drivingMinutesUsed === 240,

    `Used: ${state7.drivingMinutesUsed}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 *
 * POA does not reset.
 * --------------------------------------------------
 */
const state8 = calculateContinuousDrivingState(
  makeDay([
    {
      id: "drive-a",
      type: "driving",
      start: "2026-08-27T06:00:00.000Z",
      end: "2026-08-27T09:00:00.000Z",
      durationMinutes: 180,
    },

    {
      id: "poa",
      type: "poa",
      start: "2026-08-27T09:00:00.000Z",
      end: "2026-08-27T09:30:00.000Z",
      durationMinutes: 30,
    },

    {
      id: "drive-b",
      type: "driving",
      start: "2026-08-27T09:30:00.000Z",
      end: "2026-08-27T10:30:00.000Z",
      durationMinutes: 60,
    },
  ]),
);

scenarios.push(
  result(
    "POA does not reset used driving",

    state8.drivingMinutesUsed === 240,

    `Used: ${state8.drivingMinutesUsed}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 *
 * Percentage values.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Percentage used and remaining are correct",

    Math.abs(state1.percentageUsed - 27.7777777778) < 0.001 &&
      Math.abs(state1.percentageRemaining - 72.2222222222) < 0.001,

    `Used %: ${state1.percentageUsed}, remaining %: ${state1.percentageRemaining}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 *
 * Display helper.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Driving-minute formatter returns expected value",

    formatDrivingMinutes(195) === "3h 15m",

    `Formatted: ${formatDrivingMinutes(195)}`,
  ),
);

export const continuousDrivingStateScenarioResults = scenarios;

export const continuousDrivingStateScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
