// src/data/weeklyDriverHistory.ts

import type { DriverDay } from "../engine/types";

export interface WeeklyDriverHistory {
  weekStartDate: string;
  weekEndDate: string;
  days: DriverDay[];
}

/**
 * --------------------------------------------------
 * DATE HELPERS
 * --------------------------------------------------
 */

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfIsoWeek(date: Date): Date {
  const result = new Date(date);

  const day = result.getUTCDay();

  const distanceFromMonday = day === 0 ? -6 : 1 - day;

  result.setUTCDate(result.getUTCDate() + distanceFromMonday);

  result.setUTCHours(0, 0, 0, 0);

  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);

  result.setUTCDate(result.getUTCDate() + days);

  return result;
}

/**
 * --------------------------------------------------
 * CREATE EMPTY CURRENT WEEK
 * --------------------------------------------------
 */
export function createCurrentWeeklyDriverHistory(
  now: number = Date.now(),
): WeeklyDriverHistory {
  const currentDate = new Date(now);

  const weekStart = startOfIsoWeek(currentDate);

  const weekEnd = addDays(weekStart, 6);

  return {
    weekStartDate: toDateOnly(weekStart),

    weekEndDate: toDateOnly(weekEnd),

    days: [],
  };
}

/**
 * --------------------------------------------------
 * CHECK DAY BELONGS TO WEEK
 * --------------------------------------------------
 */
export function isDriverDayInWeek(
  day: DriverDay,
  history: WeeklyDriverHistory,
): boolean {
  return day.date >= history.weekStartDate && day.date <= history.weekEndDate;
}

/**
 * --------------------------------------------------
 * UPSERT DRIVER DAY
 * --------------------------------------------------
 *
 * Replaces a day if the date already exists.
 * Otherwise adds it.
 *
 * This is how today's live DriverDay can be merged
 * into the current week without duplicating it.
 */
export function upsertDriverDayIntoWeek(
  history: WeeklyDriverHistory,
  day: DriverDay,
): WeeklyDriverHistory {
  if (!isDriverDayInWeek(day, history)) {
    return history;
  }

  const existingDayIndex = history.days.findIndex(
    (existingDay) => existingDay.date === day.date,
  );

  let nextDays: DriverDay[];

  if (existingDayIndex >= 0) {
    nextDays = history.days.map((existingDay) =>
      existingDay.date === day.date ? day : existingDay,
    );
  } else {
    nextDays = [...history.days, day];
  }

  nextDays.sort((a, b) => a.date.localeCompare(b.date));

  return {
    ...history,
    days: nextDays,
  };
}

/**
 * --------------------------------------------------
 * MERGE MULTIPLE DAYS
 * --------------------------------------------------
 */
export function mergeDriverDaysIntoWeek(
  history: WeeklyDriverHistory,
  days: DriverDay[],
): WeeklyDriverHistory {
  return days.reduce(
    (currentHistory, day) => upsertDriverDayIntoWeek(currentHistory, day),
    history,
  );
}

/**
 * --------------------------------------------------
 * GET DAY
 * --------------------------------------------------
 */
export function getDriverDayFromWeek(
  history: WeeklyDriverHistory,
  date: string,
): DriverDay | null {
  return history.days.find((day) => day.date === date) ?? null;
}

/**
 * --------------------------------------------------
 * CURRENT WEEK TOTAL DRIVING
 * --------------------------------------------------
 */
export function getWeeklyDrivingMinutes(history: WeeklyDriverHistory): number {
  return history.days.reduce((total, day) => total + day.drivingMinutes, 0);
}

/**
 * --------------------------------------------------
 * CURRENT WEEK TOTAL WORKING
 * --------------------------------------------------
 *
 * For now:
 *
 * working time =
 * driving + other work
 *
 * POA and breaks are excluded.
 */
export function getWeeklyWorkingMinutes(history: WeeklyDriverHistory): number {
  return history.days.reduce(
    (total, day) => total + day.drivingMinutes + day.otherWorkMinutes,
    0,
  );
}

/**
 * --------------------------------------------------
 * CURRENT WEEK TOTAL BREAK
 * --------------------------------------------------
 */
export function getWeeklyBreakMinutes(history: WeeklyDriverHistory): number {
  return history.days.reduce((total, day) => total + day.breakMinutes, 0);
}

/**
 * --------------------------------------------------
 * CURRENT WEEK TOTAL POA
 * --------------------------------------------------
 */
export function getWeeklyPoaMinutes(history: WeeklyDriverHistory): number {
  return history.days.reduce((total, day) => total + day.poaMinutes, 0);
}
