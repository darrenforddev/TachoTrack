import {
    clearFortnightlyDriverHistory,
    hasStoredFortnightlyDriverHistory,
    loadFortnightlyDriverHistory,
    saveFortnightlyDriverHistory,
} from "../../data/weeklyDriverHistoryStorage";

import { createCurrentFortnightlyDriverHistory } from "../../data/fortnightlyDriverHistory";

import { mergeDriverDaysIntoWeek } from "../../data/weeklyDriverHistory";

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

export async function runFortnightlyDriverHistoryStorageScenarios() {
  const scenarios: ScenarioResult[] = [];

  const now = new Date("2026-08-27T12:00:00.000Z").getTime();

  const emptyFortnight = createCurrentFortnightlyDriverHistory(now);

  const populatedFortnight = {
    previousWeek: mergeDriverDaysIntoWeek(emptyFortnight.previousWeek, [
      makeDay("previous-1", "2026-08-18", 9 * 60),

      makeDay("previous-2", "2026-08-19", 8 * 60),
    ]),

    currentWeek: mergeDriverDaysIntoWeek(emptyFortnight.currentWeek, [
      makeDay("current-1", "2026-08-25", 7 * 60),

      makeDay("current-2", "2026-08-26", 6 * 60),
    ]),
  };

  /**
   * --------------------------------------------------
   * SCENARIO 1
   * Clear storage.
   * --------------------------------------------------
   */
  await clearFortnightlyDriverHistory();

  const existsAfterClear = await hasStoredFortnightlyDriverHistory();

  scenarios.push(
    result(
      "Cleared fortnightly storage reports no saved history",

      existsAfterClear === false,

      `Exists: ${existsAfterClear}`,
    ),
  );

  /**
   * --------------------------------------------------
   * SCENARIO 2
   * Empty load returns null.
   * --------------------------------------------------
   */
  const emptyLoad = await loadFortnightlyDriverHistory();

  scenarios.push(
    result(
      "Loading empty fortnightly storage returns null",

      emptyLoad === null,

      `Loaded: ${emptyLoad === null ? "null" : "history"}`,
    ),
  );

  /**
   * --------------------------------------------------
   * SCENARIO 3
   * Save fortnight.
   * --------------------------------------------------
   */
  await saveFortnightlyDriverHistory(populatedFortnight);

  const existsAfterSave = await hasStoredFortnightlyDriverHistory();

  scenarios.push(
    result(
      "Saving fortnightly history creates stored record",

      existsAfterSave === true,

      `Exists: ${existsAfterSave}`,
    ),
  );

  /**
   * --------------------------------------------------
   * SCENARIO 4
   * Load fortnight.
   * --------------------------------------------------
   */
  const loaded = await loadFortnightlyDriverHistory();

  scenarios.push(
    result(
      "Saved fortnightly history can be loaded",

      loaded !== null,

      `Loaded: ${loaded === null ? "null" : "history"}`,
    ),
  );

  /**
   * --------------------------------------------------
   * SCENARIO 5
   * Previous week boundaries survive.
   * --------------------------------------------------
   */
  scenarios.push(
    result(
      "Previous week boundaries survive storage",

      loaded?.previousWeek.weekStartDate === "2026-08-17" &&
        loaded?.previousWeek.weekEndDate === "2026-08-23",

      `Previous: ${loaded?.previousWeek.weekStartDate} -> ${loaded?.previousWeek.weekEndDate}`,
    ),
  );

  /**
   * --------------------------------------------------
   * SCENARIO 6
   * Current week boundaries survive.
   * --------------------------------------------------
   */
  scenarios.push(
    result(
      "Current week boundaries survive storage",

      loaded?.currentWeek.weekStartDate === "2026-08-24" &&
        loaded?.currentWeek.weekEndDate === "2026-08-30",

      `Current: ${loaded?.currentWeek.weekStartDate} -> ${loaded?.currentWeek.weekEndDate}`,
    ),
  );

  /**
   * --------------------------------------------------
   * SCENARIO 7
   * Previous week days survive.
   * --------------------------------------------------
   */
  scenarios.push(
    result(
      "Previous week driver days survive storage",

      loaded?.previousWeek.days.length === 2,

      `Previous days: ${loaded?.previousWeek.days.length}`,
    ),
  );

  /**
   * --------------------------------------------------
   * SCENARIO 8
   * Current week days survive.
   * --------------------------------------------------
   */
  scenarios.push(
    result(
      "Current week driver days survive storage",

      loaded?.currentWeek.days.length === 2,

      `Current days: ${loaded?.currentWeek.days.length}`,
    ),
  );

  /**
   * --------------------------------------------------
   * SCENARIO 9
   * Exact driving values survive.
   * --------------------------------------------------
   */
  const previousDriving =
    loaded?.previousWeek.days.reduce(
      (total, day) => total + day.drivingMinutes,
      0,
    ) ?? 0;

  const currentDriving =
    loaded?.currentWeek.days.reduce(
      (total, day) => total + day.drivingMinutes,
      0,
    ) ?? 0;

  scenarios.push(
    result(
      "Driving minutes survive exactly across both weeks",

      previousDriving === 17 * 60 && currentDriving === 13 * 60,

      `Previous: ${previousDriving}, current: ${currentDriving}`,
    ),
  );

  /**
   * --------------------------------------------------
   * SCENARIO 10
   * Final clear.
   * --------------------------------------------------
   */
  await clearFortnightlyDriverHistory();

  const finalExists = await hasStoredFortnightlyDriverHistory();

  scenarios.push(
    result(
      "Final clear removes fortnightly history",

      finalExists === false,

      `Exists: ${finalExists}`,
    ),
  );

  return {
    results: scenarios,

    summary: {
      total: scenarios.length,

      passed: scenarios.filter((scenario) => scenario.passed).length,

      failed: scenarios.filter((scenario) => !scenario.passed).length,

      allPassed: scenarios.every((scenario) => scenario.passed),
    },
  };
}
