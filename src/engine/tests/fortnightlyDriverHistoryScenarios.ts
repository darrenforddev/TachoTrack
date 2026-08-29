import {
    createCurrentFortnightlyDriverHistory,
    createPreviousWeeklyDriverHistory,
    isSameWeeklyPeriod,
    rollFortnightlyDriverHistoryForward,
} from "../../data/fortnightlyDriverHistory";

import type { WeeklyDriverHistory } from "../../data/weeklyDriverHistory";

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
 * SCENARIO 1
 *
 * Current fortnight boundaries on
 * Thursday 27 August 2026.
 * --------------------------------------------------
 */
const now = new Date("2026-08-27T12:00:00.000Z").getTime();

const fortnight = createCurrentFortnightlyDriverHistory(now);

scenarios.push(
  result(
    "Current fortnight creates correct current week",

    fortnight.currentWeek.weekStartDate === "2026-08-24" &&
      fortnight.currentWeek.weekEndDate === "2026-08-30",

    `Current: ${fortnight.currentWeek.weekStartDate} -> ${fortnight.currentWeek.weekEndDate}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 *
 * Previous week boundaries.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Current fortnight creates correct previous week",

    fortnight.previousWeek.weekStartDate === "2026-08-17" &&
      fortnight.previousWeek.weekEndDate === "2026-08-23",

    `Previous: ${fortnight.previousWeek.weekStartDate} -> ${fortnight.previousWeek.weekEndDate}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 *
 * createPreviousWeeklyDriverHistory().
 * --------------------------------------------------
 */
const previous = createPreviousWeeklyDriverHistory(fortnight.currentWeek);

scenarios.push(
  result(
    "Previous-week helper shifts exactly seven days",

    previous.weekStartDate === "2026-08-17" &&
      previous.weekEndDate === "2026-08-23",

    `Previous: ${previous.weekStartDate} -> ${previous.weekEndDate}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 *
 * Matching week periods.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Same weekly period is recognised",

    isSameWeeklyPeriod(fortnight.currentWeek, {
      weekStartDate: "2026-08-24",
      weekEndDate: "2026-08-30",
      days: [],
    }) === true,

    "Matching Monday-Sunday boundaries returned true",
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 *
 * Different week periods.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Different weekly periods are rejected",

    isSameWeeklyPeriod(fortnight.currentWeek, fortnight.previousWeek) === false,

    "Different boundaries returned false",
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 *
 * Same week reload:
 * preserve existing history.
 * --------------------------------------------------
 */
const storedSameWeek = {
  previousWeek: {
    ...fortnight.previousWeek,
    days: [
      {
        id: "old-week-day",
        date: "2026-08-18",
        activities: [],
        drivingMinutes: 500,
        otherWorkMinutes: 0,
        breakMinutes: 0,
        poaMinutes: 0,
        restMinutes: 0,
        dailyRestType: "unknown" as const,
      },
    ],
  },

  currentWeek: {
    ...fortnight.currentWeek,
    days: [
      {
        id: "current-week-day",
        date: "2026-08-25",
        activities: [],
        drivingMinutes: 480,
        otherWorkMinutes: 0,
        breakMinutes: 0,
        poaMinutes: 0,
        restMinutes: 0,
        dailyRestType: "unknown" as const,
      },
    ],
  },
};

const rolledSameWeek = rollFortnightlyDriverHistoryForward(storedSameWeek, now);

scenarios.push(
  result(
    "Same-week reload preserves both stored weeks",

    rolledSameWeek.previousWeek.days.length === 1 &&
      rolledSameWeek.currentWeek.days.length === 1,

    `Previous days: ${rolledSameWeek.previousWeek.days.length}, current days: ${rolledSameWeek.currentWeek.days.length}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 *
 * Sunday -> Monday rollover.
 *
 * Stored current week:
 * 24 Aug -> 30 Aug
 *
 * New current week:
 * 31 Aug -> 6 Sep
 *
 * Stored current week should become previousWeek.
 * --------------------------------------------------
 */
const monday = new Date("2026-08-31T08:00:00.000Z").getTime();

const rolledMonday = rollFortnightlyDriverHistoryForward(
  storedSameWeek,
  monday,
);

scenarios.push(
  result(
    "Monday rollover moves old current week into previous week",

    rolledMonday.previousWeek.weekStartDate === "2026-08-24" &&
      rolledMonday.previousWeek.weekEndDate === "2026-08-30" &&
      rolledMonday.previousWeek.days.length === 1,

    `Previous: ${rolledMonday.previousWeek.weekStartDate} -> ${rolledMonday.previousWeek.weekEndDate}, days: ${rolledMonday.previousWeek.days.length}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 *
 * Monday rollover starts clean new current week.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Monday rollover creates new empty current week",

    rolledMonday.currentWeek.weekStartDate === "2026-08-31" &&
      rolledMonday.currentWeek.weekEndDate === "2026-09-06" &&
      rolledMonday.currentWeek.days.length === 0,

    `Current: ${rolledMonday.currentWeek.weekStartDate} -> ${rolledMonday.currentWeek.weekEndDate}, days: ${rolledMonday.currentWeek.days.length}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 *
 * Data older than one week is discarded.
 * --------------------------------------------------
 */
const stale: {
  previousWeek: WeeklyDriverHistory;
  currentWeek: WeeklyDriverHistory;
} = {
  previousWeek: {
    weekStartDate: "2026-08-03",
    weekEndDate: "2026-08-09",
    days: [],
  },

  currentWeek: {
    weekStartDate: "2026-08-10",
    weekEndDate: "2026-08-16",
    days: [
      {
        id: "stale",
        date: "2026-08-12",
        activities: [],
        drivingMinutes: 600,
        otherWorkMinutes: 0,
        breakMinutes: 0,
        poaMinutes: 0,
        restMinutes: 0,
        dailyRestType: "unknown",
      },
    ],
  },
};

const rolledStale = rollFortnightlyDriverHistoryForward(stale, now);

scenarios.push(
  result(
    "Stale fortnight history resets safely",

    rolledStale.previousWeek.days.length === 0 &&
      rolledStale.currentWeek.days.length === 0 &&
      rolledStale.currentWeek.weekStartDate === "2026-08-24",

    `Previous days: ${rolledStale.previousWeek.days.length}, current days: ${rolledStale.currentWeek.days.length}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 *
 * Previous/current weeks remain consecutive.
 * --------------------------------------------------
 */
const previousEnd = new Date(
  `${fortnight.previousWeek.weekEndDate}T12:00:00.000Z`,
);

const currentStart = new Date(
  `${fortnight.currentWeek.weekStartDate}T12:00:00.000Z`,
);

const differenceDays =
  (currentStart.getTime() - previousEnd.getTime()) / (24 * 60 * 60 * 1000);

scenarios.push(
  result(
    "Previous and current weeks are consecutive",

    differenceDays === 1,

    `Gap: ${differenceDays} day`,
  ),
);

export const fortnightlyDriverHistoryScenarioResults = scenarios;

export const fortnightlyDriverHistoryScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
