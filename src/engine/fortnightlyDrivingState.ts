import type { DriverDay } from "./types";

export type FortnightlyDrivingStatus = "good" | "warning" | "limit" | "breach";

export interface FortnightlyDrivingState {
  previousWeekDrivingMinutes: number;

  currentWeekDrivingMinutes: number;

  drivingMinutesUsed: number;

  limitMinutes: number;

  remainingMinutes: number;

  percentageUsed: number;

  percentageRemaining: number;

  status: FortnightlyDrivingStatus;
}

/**
 * Maximum accumulated driving time in
 * any two consecutive fixed weeks.
 */
export const FORTNIGHTLY_DRIVING_LIMIT_MINUTES = 90 * 60;

/**
 * Early warning when 8 hours remain.
 */
export const FORTNIGHTLY_DRIVING_WARNING_REMAINING_MINUTES = 8 * 60;

function totalDrivingMinutes(days: DriverDay[]): number {
  return days.reduce(
    (total, day) => total + Math.max(0, day.drivingMinutes),
    0,
  );
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function calculateFortnightlyDrivingState(
  previousWeekDays: DriverDay[],
  currentWeekDays: DriverDay[],
): FortnightlyDrivingState {
  const previousWeekDrivingMinutes = totalDrivingMinutes(previousWeekDays);

  const currentWeekDrivingMinutes = totalDrivingMinutes(currentWeekDays);

  const drivingMinutesUsed =
    previousWeekDrivingMinutes + currentWeekDrivingMinutes;

  const remainingMinutes = Math.max(
    0,
    FORTNIGHTLY_DRIVING_LIMIT_MINUTES - drivingMinutesUsed,
  );

  const rawPercentageUsed =
    (drivingMinutesUsed / FORTNIGHTLY_DRIVING_LIMIT_MINUTES) * 100;

  const percentageUsed = clampPercentage(rawPercentageUsed);

  const percentageRemaining = clampPercentage(100 - rawPercentageUsed);

  let status: FortnightlyDrivingStatus = "good";

  if (drivingMinutesUsed > FORTNIGHTLY_DRIVING_LIMIT_MINUTES) {
    status = "breach";
  } else if (drivingMinutesUsed === FORTNIGHTLY_DRIVING_LIMIT_MINUTES) {
    status = "limit";
  } else if (
    remainingMinutes <= FORTNIGHTLY_DRIVING_WARNING_REMAINING_MINUTES
  ) {
    status = "warning";
  }

  return {
    previousWeekDrivingMinutes,

    currentWeekDrivingMinutes,

    drivingMinutesUsed,

    limitMinutes: FORTNIGHTLY_DRIVING_LIMIT_MINUTES,

    remainingMinutes,

    percentageUsed,

    percentageRemaining,

    status,
  };
}
