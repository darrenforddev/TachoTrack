import {
    createCurrentWeeklyDriverHistory,
    type WeeklyDriverHistory,
} from "./weeklyDriverHistory";

export interface FortnightlyDriverHistory {
  previousWeek: WeeklyDriverHistory;
  currentWeek: WeeklyDriverHistory;
}

/**
 * Move a YYYY-MM-DD date by a fixed number of days.
 *
 * Noon UTC is deliberately used to avoid date movement
 * around midnight while doing calendar arithmetic.
 */
function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);

  value.setUTCDate(value.getUTCDate() + days);

  return value.toISOString().slice(0, 10);
}

/**
 * Creates an empty WeeklyDriverHistory for the
 * seven-day week immediately before currentWeek.
 */
export function createPreviousWeeklyDriverHistory(
  currentWeek: WeeklyDriverHistory,
): WeeklyDriverHistory {
  return {
    weekStartDate: shiftDate(currentWeek.weekStartDate, -7),

    weekEndDate: shiftDate(currentWeek.weekEndDate, -7),

    days: [],
  };
}

/**
 * Creates the two fixed weeks required by the
 * EU/UK 90-hour fortnightly driving calculation.
 *
 * previousWeek = previous Monday-Sunday
 * currentWeek  = current Monday-Sunday
 */
export function createCurrentFortnightlyDriverHistory(
  now: number = Date.now(),
): FortnightlyDriverHistory {
  const currentWeek = createCurrentWeeklyDriverHistory(now);

  const previousWeek = createPreviousWeeklyDriverHistory(currentWeek);

  return {
    previousWeek,
    currentWeek,
  };
}

/**
 * Returns true when the supplied week has exactly
 * the same fixed Monday-Sunday boundaries.
 */
export function isSameWeeklyPeriod(
  first: WeeklyDriverHistory,
  second: WeeklyDriverHistory,
): boolean {
  return (
    first.weekStartDate === second.weekStartDate &&
    first.weekEndDate === second.weekEndDate
  );
}

/**
 * Normalises stored two-week history against the
 * driver's current fixed week.
 *
 * Cases:
 *
 * 1. Stored current week is still current:
 *    preserve both weeks.
 *
 * 2. Stored current week has become the immediately
 *    previous week:
 *    roll it into previousWeek and start a new
 *    current week.
 *
 * 3. Stored data is older or does not line up:
 *    create a clean two-week structure.
 */
export function rollFortnightlyDriverHistoryForward(
  stored: FortnightlyDriverHistory,
  now: number = Date.now(),
): FortnightlyDriverHistory {
  const fresh = createCurrentFortnightlyDriverHistory(now);

  if (isSameWeeklyPeriod(stored.currentWeek, fresh.currentWeek)) {
    return stored;
  }

  if (isSameWeeklyPeriod(stored.currentWeek, fresh.previousWeek)) {
    return {
      previousWeek: stored.currentWeek,

      currentWeek: fresh.currentWeek,
    };
  }

  return fresh;
}
