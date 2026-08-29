import {
    createCurrentWeeklyDriverHistory,
    getDriverDayFromWeek,
    getWeeklyBreakMinutes,
    getWeeklyDrivingMinutes,
    getWeeklyPoaMinutes,
    getWeeklyWorkingMinutes,
    mergeDriverDaysIntoWeek,
    upsertDriverDayIntoWeek,
} from "../../data/weeklyDriverHistory";

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

function makeDay(
  date: string,
  drivingMinutes: number,
  otherWorkMinutes: number = 0,
  breakMinutes: number = 0,
  poaMinutes: number = 0,
): DriverDay {
  return {
    id: `day-${date}`,
    date,

    activities: [],

    drivingMinutes,
    otherWorkMinutes,
    breakMinutes,
    poaMinutes,
    restMinutes: 0,

    dailyRestType: "unknown",
  };
}

const now = new Date("2026-08-27T12:00:00.000Z").getTime();

const emptyWeek = createCurrentWeeklyDriverHistory(now);

scenarios.push(
  result(
    "Current week starts on Monday",

    emptyWeek.weekStartDate === "2026-08-24",

    `Start: ${emptyWeek.weekStartDate}`,
  ),
);

scenarios.push(
  result(
    "Current week ends on Sunday",

    emptyWeek.weekEndDate === "2026-08-30",

    `End: ${emptyWeek.weekEndDate}`,
  ),
);

const weekWithMonday = upsertDriverDayIntoWeek(
  emptyWeek,
  makeDay("2026-08-24", 8 * 60),
);

scenarios.push(
  result(
    "Driver day can be added to current week",

    weekWithMonday.days.length === 1 &&
      weekWithMonday.days[0]?.date === "2026-08-24",

    `Days: ${weekWithMonday.days.length}`,
  ),
);

const replacedMonday = upsertDriverDayIntoWeek(
  weekWithMonday,
  makeDay("2026-08-24", 9 * 60),
);

scenarios.push(
  result(
    "Updating same date replaces existing day",

    replacedMonday.days.length === 1 &&
      replacedMonday.days[0]?.drivingMinutes === 540,

    `Days: ${replacedMonday.days.length}, driving: ${replacedMonday.days[0]?.drivingMinutes}`,
  ),
);

const outsideWeek = upsertDriverDayIntoWeek(
  replacedMonday,
  makeDay("2026-08-31", 500),
);

scenarios.push(
  result(
    "Day outside current week is ignored",

    outsideWeek.days.length === 1 &&
      getDriverDayFromWeek(outsideWeek, "2026-08-31") === null,

    `Days: ${outsideWeek.days.length}`,
  ),
);

const mergedWeek = mergeDriverDaysIntoWeek(emptyWeek, [
  makeDay("2026-08-27", 300),

  makeDay("2026-08-25", 480),

  makeDay("2026-08-26", 420),
]);

scenarios.push(
  result(
    "Merged week remains chronological",

    mergedWeek.days[0]?.date === "2026-08-25" &&
      mergedWeek.days[1]?.date === "2026-08-26" &&
      mergedWeek.days[2]?.date === "2026-08-27",

    `Order: ${mergedWeek.days.map((day) => day.date).join(" -> ")}`,
  ),
);

scenarios.push(
  result(
    "Weekly driving total is correct",

    getWeeklyDrivingMinutes(mergedWeek) === 1200,

    `Driving: ${getWeeklyDrivingMinutes(mergedWeek)}`,
  ),
);

const workingWeek = mergeDriverDaysIntoWeek(emptyWeek, [
  makeDay("2026-08-24", 300, 120, 45, 60),

  makeDay("2026-08-25", 240, 180, 60, 30),
]);

scenarios.push(
  result(
    "Weekly working total excludes break and POA",

    getWeeklyWorkingMinutes(workingWeek) === 840,

    `Working: ${getWeeklyWorkingMinutes(workingWeek)}`,
  ),
);

scenarios.push(
  result(
    "Weekly break total is correct",

    getWeeklyBreakMinutes(workingWeek) === 105,

    `Break: ${getWeeklyBreakMinutes(workingWeek)}`,
  ),
);

scenarios.push(
  result(
    "Weekly POA total is correct",

    getWeeklyPoaMinutes(workingWeek) === 90,

    `POA: ${getWeeklyPoaMinutes(workingWeek)}`,
  ),
);

export const weeklyDriverHistoryScenarioResults = scenarios;

export const weeklyDriverHistoryScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
