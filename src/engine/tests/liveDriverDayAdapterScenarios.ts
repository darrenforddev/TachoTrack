import { buildLiveDriverDay } from "../../data/liveDriverDayAdapter";

import type { ActivityHistoryEvent } from "../../data/activityHistory";

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
 * FIXED TEST TIME
 * --------------------------------------------------
 *
 * Current time:
 * 26 Aug 2026 10:30 UTC
 */
const now = new Date("2026-08-26T10:30:00.000Z").getTime();

/**
 * --------------------------------------------------
 * TEST HISTORY
 * --------------------------------------------------
 *
 * 08:00 - 08:15 Other Work = 15m
 * 08:15 - 09:00 Driving    = 45m
 * 09:00 - 09:30 Break      = 30m
 * 09:30 - 10:30 Driving    = 60m ACTIVE
 *
 * Totals expected:
 *
 * Driving    = 105m
 * Break      = 30m
 * Other Work = 15m
 * POA        = 0m
 */
const events: ActivityHistoryEvent[] = [
  {
    id: "other-work-1",

    activity: "other-work",

    startedAt: "2026-08-26T08:00:00.000Z",

    endedAt: "2026-08-26T08:15:00.000Z",

    durationMilliseconds: 15 * 60 * 1000,

    source: "manual",
  },

  {
    id: "driving-1",

    activity: "driving",

    startedAt: "2026-08-26T08:15:00.000Z",

    endedAt: "2026-08-26T09:00:00.000Z",

    durationMilliseconds: 45 * 60 * 1000,

    source: "manual",
  },

  {
    id: "break-1",

    activity: "break",

    startedAt: "2026-08-26T09:00:00.000Z",

    endedAt: "2026-08-26T09:30:00.000Z",

    durationMilliseconds: 30 * 60 * 1000,

    source: "manual",
  },

  {
    id: "driving-active",

    activity: "driving",

    startedAt: "2026-08-26T09:30:00.000Z",

    endedAt: null,

    durationMilliseconds: null,

    source: "manual",
  },
];

const day = buildLiveDriverDay(events, now);

/**
 * --------------------------------------------------
 * SCENARIO 1
 *
 * Live day date should come from "now".
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Live driver day uses current date",

    day.date === "2026-08-26",

    `Date: ${day.date}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 *
 * All four events should be included,
 * including the active event.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Active activity is included in live day",

    day.activities.length === 4,

    `Activities: ${day.activities.length}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 *
 * other-work must map to otherWork.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Other Work maps to compliance activity type",

    day.activities[0]?.type === "otherWork",

    `Type: ${day.activities[0]?.type}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 *
 * Completed driving = 45m
 * Active driving    = 60m
 *
 * Total = 105m
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Live driving total includes active driving",

    day.drivingMinutes === 105,

    `Driving: ${day.drivingMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 *
 * Break total = 30m.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Break total is correct",

    day.breakMinutes === 30,

    `Break: ${day.breakMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 *
 * Other Work total = 15m.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Other Work total is correct",

    day.otherWorkMinutes === 15,

    `Other Work: ${day.otherWorkMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 *
 * No POA events.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Missing POA gives zero total",

    day.poaMinutes === 0,

    `POA: ${day.poaMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 *
 * Active driving event should end at "now"
 * in the live snapshot.
 * --------------------------------------------------
 */
const activeDriving = day.activities.find(
  (activity) =>
    activity.id.startsWith("driving-active-") && activity.type === "driving",
);

scenarios.push(
  result(
    "Active driving event closes temporarily at now",

    activeDriving?.end === "2026-08-26T10:30:00.000Z",

    `End: ${activeDriving?.end}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 *
 * Active driving duration should be 60m.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Active driving duration is calculated correctly",

    activeDriving?.durationMinutes === 60,

    `Duration: ${activeDriving?.durationMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 *
 * Activities must remain chronological.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Live activities are chronological",

    day.activities[0]?.start === "2026-08-26T08:00:00.000Z" &&
      day.activities[1]?.start === "2026-08-26T08:15:00.000Z" &&
      day.activities[2]?.start === "2026-08-26T09:00:00.000Z" &&
      day.activities[3]?.start === "2026-08-26T09:30:00.000Z",

    `Order: ${day.activities.map((activity) => activity.id).join(" -> ")}`,
  ),
);

export const liveDriverDayAdapterScenarioResults = scenarios;

export const liveDriverDayAdapterScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
