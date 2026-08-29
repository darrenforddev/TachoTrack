import type { DriverWeek } from "../engine/types";

import type { WeeklyDriverHistory } from "./weeklyDriverHistory";

/**
 * --------------------------------------------------
 * ISO WEEK NUMBER
 * --------------------------------------------------
 *
 * Calculates the ISO week number from a
 * YYYY-MM-DD date.
 */
function getIsoWeekNumber(dateString: string): number {
  const date = new Date(`${dateString}T00:00:00.000Z`);

  const day = date.getUTCDay() || 7;

  date.setUTCDate(date.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));

  return Math.ceil(
    ((date.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000) + 1) / 7,
  );
}

/**
 * --------------------------------------------------
 * WEEKLY HISTORY -> DRIVER WEEK
 * --------------------------------------------------
 *
 * Converts the dashboard/storage representation
 * into the canonical DriverWeek model expected
 * by the compliance engine.
 */
export function convertWeeklyDriverHistoryToDriverWeek(
  history: WeeklyDriverHistory,
): DriverWeek {
  return {
    id: `driver-week-${history.weekStartDate}`,

    weekNumber: getIsoWeekNumber(history.weekStartDate),

    startDate: history.weekStartDate,

    endDate: history.weekEndDate,

    days: history.days,
  };
}
