import { buildLiveDriverDay } from "../../data/liveDriverDayAdapter";

import type { ActivityHistoryEvent } from "../../data/activityHistory";

import { checkContinuousDriving } from "../drivingRules";

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
function evaluate(events: ActivityHistoryEvent[], nowIso: string) {
  const day = buildLiveDriverDay(events, new Date(nowIso).getTime());

  return {
    day,
    compliance: checkContinuousDriving(day),
  };
}

/**
 * --------------------------------------------------
 * SCENARIO 1
 *
 * 4h20 driving remains compliant.
 * --------------------------------------------------
 */
const scenario1 = evaluate(
  [
    {
      id: "s1-driving",

      activity: "driving",

      startedAt: "2026-08-27T06:00:00.000Z",

      endedAt: null,

      durationMilliseconds: null,

      source: "manual",
    },
  ],

  "2026-08-27T10:20:00.000Z",
);

scenarios.push(
  result(
    "4h20 continuous driving remains compliant",

    scenario1.compliance.level === "good" &&
      scenario1.compliance.issues.length === 0,

    `Level: ${scenario1.compliance.level}, issues: ${scenario1.compliance.issues.length}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 *
 * Exactly 4h30 is at the limit,
 * but not yet a breach.
 * --------------------------------------------------
 */
const scenario2 = evaluate(
  [
    {
      id: "s2-driving",

      activity: "driving",

      startedAt: "2026-08-27T06:00:00.000Z",

      endedAt: null,

      durationMilliseconds: null,

      source: "manual",
    },
  ],

  "2026-08-27T10:30:00.000Z",
);

scenarios.push(
  result(
    "Exactly 4h30 continuous driving is not a breach",

    scenario2.compliance.level === "good" &&
      scenario2.compliance.issues.length === 0,

    `Driving: ${scenario2.day.drivingMinutes} minutes, level: ${scenario2.compliance.level}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 *
 * 4h31 driving must breach.
 * --------------------------------------------------
 */
const scenario3 = evaluate(
  [
    {
      id: "s3-driving",

      activity: "driving",

      startedAt: "2026-08-27T06:00:00.000Z",

      endedAt: null,

      durationMilliseconds: null,

      source: "manual",
    },
  ],

  "2026-08-27T10:31:00.000Z",
);

scenarios.push(
  result(
    "4h31 continuous driving creates a breach",

    scenario3.compliance.level === "breach" &&
      scenario3.compliance.issues.length === 1 &&
      scenario3.compliance.issues[0]?.rule === "continuous-driving" &&
      scenario3.compliance.issues[0]?.varianceMinutes === 1,

    `Level: ${scenario3.compliance.level}, excess: ${scenario3.compliance.issues[0]?.varianceMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 *
 * A full 45-minute break resets the clock.
 *
 * Drive 2h
 * Break 45m
 * Drive 3h
 *
 * Total driving = 5h
 * Continuous driving after reset = 3h
 * --------------------------------------------------
 */
const scenario4 = evaluate(
  [
    {
      id: "s4-driving-1",

      activity: "driving",

      startedAt: "2026-08-27T06:00:00.000Z",

      endedAt: "2026-08-27T08:00:00.000Z",

      durationMilliseconds: 2 * 60 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s4-break",

      activity: "break",

      startedAt: "2026-08-27T08:00:00.000Z",

      endedAt: "2026-08-27T08:45:00.000Z",

      durationMilliseconds: 45 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s4-driving-2",

      activity: "driving",

      startedAt: "2026-08-27T08:45:00.000Z",

      endedAt: null,

      durationMilliseconds: null,

      source: "manual",
    },
  ],

  "2026-08-27T11:45:00.000Z",
);

scenarios.push(
  result(
    "45-minute break resets continuous driving",

    scenario4.compliance.level === "good" &&
      scenario4.compliance.issues.length === 0 &&
      scenario4.day.drivingMinutes === 5 * 60,

    `Total driving: ${scenario4.day.drivingMinutes}, level: ${scenario4.compliance.level}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 *
 * A 15-minute break alone does NOT reset.
 *
 * Drive 3h
 * Break 15m
 * Drive 1h31
 *
 * Continuous total = 4h31
 * --------------------------------------------------
 */
const scenario5 = evaluate(
  [
    {
      id: "s5-driving-1",

      activity: "driving",

      startedAt: "2026-08-27T06:00:00.000Z",

      endedAt: "2026-08-27T09:00:00.000Z",

      durationMilliseconds: 3 * 60 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s5-break-15",

      activity: "break",

      startedAt: "2026-08-27T09:00:00.000Z",

      endedAt: "2026-08-27T09:15:00.000Z",

      durationMilliseconds: 15 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s5-driving-2",

      activity: "driving",

      startedAt: "2026-08-27T09:15:00.000Z",

      endedAt: null,

      durationMilliseconds: null,

      source: "manual",
    },
  ],

  "2026-08-27T10:46:00.000Z",
);

scenarios.push(
  result(
    "15-minute break alone does not reset driving",

    scenario5.compliance.level === "breach" &&
      scenario5.compliance.issues[0]?.varianceMinutes === 1,

    `Level: ${scenario5.compliance.level}, excess: ${scenario5.compliance.issues[0]?.varianceMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 *
 * Valid 15 + 30 split break resets.
 *
 * Drive 2h
 * Break 15m
 * Drive 2h
 * Break 30m
 * Drive 3h
 *
 * No breach after the second break.
 * --------------------------------------------------
 */
const scenario6 = evaluate(
  [
    {
      id: "s6-driving-1",

      activity: "driving",

      startedAt: "2026-08-27T06:00:00.000Z",

      endedAt: "2026-08-27T08:00:00.000Z",

      durationMilliseconds: 2 * 60 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s6-break-15",

      activity: "break",

      startedAt: "2026-08-27T08:00:00.000Z",

      endedAt: "2026-08-27T08:15:00.000Z",

      durationMilliseconds: 15 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s6-driving-2",

      activity: "driving",

      startedAt: "2026-08-27T08:15:00.000Z",

      endedAt: "2026-08-27T10:15:00.000Z",

      durationMilliseconds: 2 * 60 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s6-break-30",

      activity: "break",

      startedAt: "2026-08-27T10:15:00.000Z",

      endedAt: "2026-08-27T10:45:00.000Z",

      durationMilliseconds: 30 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s6-driving-3",

      activity: "driving",

      startedAt: "2026-08-27T10:45:00.000Z",

      endedAt: null,

      durationMilliseconds: null,

      source: "manual",
    },
  ],

  "2026-08-27T13:45:00.000Z",
);

scenarios.push(
  result(
    "15 + 30 split break resets continuous driving",

    scenario6.compliance.level === "good" &&
      scenario6.compliance.issues.length === 0,

    `Level: ${scenario6.compliance.level}, issues: ${scenario6.compliance.issues.length}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 *
 * Other Work does not reset continuous driving.
 *
 * Drive 3h
 * Other Work 30m
 * Drive 1h31
 * --------------------------------------------------
 */
const scenario7 = evaluate(
  [
    {
      id: "s7-driving-1",

      activity: "driving",

      startedAt: "2026-08-27T06:00:00.000Z",

      endedAt: "2026-08-27T09:00:00.000Z",

      durationMilliseconds: 3 * 60 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s7-other-work",

      activity: "other-work",

      startedAt: "2026-08-27T09:00:00.000Z",

      endedAt: "2026-08-27T09:30:00.000Z",

      durationMilliseconds: 30 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s7-driving-2",

      activity: "driving",

      startedAt: "2026-08-27T09:30:00.000Z",

      endedAt: null,

      durationMilliseconds: null,

      source: "manual",
    },
  ],

  "2026-08-27T11:01:00.000Z",
);

scenarios.push(
  result(
    "Other Work does not reset continuous driving",

    scenario7.compliance.level === "breach" &&
      scenario7.compliance.issues[0]?.varianceMinutes === 1,

    `Level: ${scenario7.compliance.level}, excess: ${scenario7.compliance.issues[0]?.varianceMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 *
 * POA does not reset continuous driving.
 * --------------------------------------------------
 */
const scenario8 = evaluate(
  [
    {
      id: "s8-driving-1",

      activity: "driving",

      startedAt: "2026-08-27T06:00:00.000Z",

      endedAt: "2026-08-27T09:00:00.000Z",

      durationMilliseconds: 3 * 60 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s8-poa",

      activity: "poa",

      startedAt: "2026-08-27T09:00:00.000Z",

      endedAt: "2026-08-27T09:30:00.000Z",

      durationMilliseconds: 30 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s8-driving-2",

      activity: "driving",

      startedAt: "2026-08-27T09:30:00.000Z",

      endedAt: null,

      durationMilliseconds: null,

      source: "manual",
    },
  ],

  "2026-08-27T11:01:00.000Z",
);

scenarios.push(
  result(
    "POA does not reset continuous driving",

    scenario8.compliance.level === "breach" &&
      scenario8.compliance.issues[0]?.varianceMinutes === 1,

    `Level: ${scenario8.compliance.level}, excess: ${scenario8.compliance.issues[0]?.varianceMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 *
 * A 44-minute break is not enough to reset.
 * --------------------------------------------------
 */
const scenario9 = evaluate(
  [
    {
      id: "s9-driving-1",

      activity: "driving",

      startedAt: "2026-08-27T06:00:00.000Z",

      endedAt: "2026-08-27T09:00:00.000Z",

      durationMilliseconds: 3 * 60 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s9-break-44",

      activity: "break",

      startedAt: "2026-08-27T09:00:00.000Z",

      endedAt: "2026-08-27T09:44:00.000Z",

      durationMilliseconds: 44 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s9-driving-2",

      activity: "driving",

      startedAt: "2026-08-27T09:44:00.000Z",

      endedAt: null,

      durationMilliseconds: null,

      source: "manual",
    },
  ],

  "2026-08-27T11:15:00.000Z",
);

scenarios.push(
  result(
    "44-minute break does not reset continuous driving",

    scenario9.compliance.level === "breach" &&
      scenario9.compliance.issues[0]?.varianceMinutes === 1,

    `Level: ${scenario9.compliance.level}, excess: ${scenario9.compliance.issues[0]?.varianceMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 *
 * Exact 45-minute break DOES reset.
 * --------------------------------------------------
 */
const scenario10 = evaluate(
  [
    {
      id: "s10-driving-1",

      activity: "driving",

      startedAt: "2026-08-27T06:00:00.000Z",

      endedAt: "2026-08-27T09:00:00.000Z",

      durationMilliseconds: 3 * 60 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s10-break-45",

      activity: "break",

      startedAt: "2026-08-27T09:00:00.000Z",

      endedAt: "2026-08-27T09:45:00.000Z",

      durationMilliseconds: 45 * 60 * 1000,

      source: "manual",
    },

    {
      id: "s10-driving-2",

      activity: "driving",

      startedAt: "2026-08-27T09:45:00.000Z",

      endedAt: null,

      durationMilliseconds: null,

      source: "manual",
    },
  ],

  "2026-08-27T13:45:00.000Z",
);

scenarios.push(
  result(
    "Exactly 45-minute break resets continuous driving",

    scenario10.compliance.level === "good" &&
      scenario10.compliance.issues.length === 0,

    `Level: ${scenario10.compliance.level}, issues: ${scenario10.compliance.issues.length}`,
  ),
);

export const liveContinuousDrivingScenarioResults = scenarios;

export const liveContinuousDrivingScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
