import type { DriverDay } from "./types";

export type WeeklyDrivingStatus = "good" | "warning" | "limit" | "breach";

export interface WeeklyDrivingState {
  drivingMinutesUsed: number;

  limitMinutes: number;

  remainingMinutes: number;

  percentageUsed: number;

  percentageRemaining: number;

  status: WeeklyDrivingStatus;
}

/**
 * EU/UK weekly driving limit:
 *
 * Maximum driving time in a fixed week
 * (Monday 00:00 to Sunday 24:00):
 *
 * 56 hours.
 */
export const WEEKLY_DRIVING_LIMIT_MINUTES = 56 * 60;

/**
 * Early-warning threshold.
 *
 * For now we use 8 hours remaining.
 *
 * This matches the warning strategy we planned
 * for the weekly-driving limit and gives the
 * driver plenty of time to plan the remainder
 * of the working week.
 */
export const WEEKLY_DRIVING_WARNING_REMAINING_MINUTES = 8 * 60;

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function calculateWeeklyDrivingState(
  days: DriverDay[],
): WeeklyDrivingState {
  const drivingMinutesUsed = days.reduce(
    (total, day) => total + Math.max(0, day.drivingMinutes),
    0,
  );

  const remainingMinutes = Math.max(
    0,
    WEEKLY_DRIVING_LIMIT_MINUTES - drivingMinutesUsed,
  );

  const rawPercentageUsed =
    WEEKLY_DRIVING_LIMIT_MINUTES > 0
      ? (drivingMinutesUsed / WEEKLY_DRIVING_LIMIT_MINUTES) * 100
      : 0;

  const percentageUsed = clampPercentage(rawPercentageUsed);

  const percentageRemaining = clampPercentage(100 - rawPercentageUsed);

  let status: WeeklyDrivingStatus = "good";

  if (drivingMinutesUsed > WEEKLY_DRIVING_LIMIT_MINUTES) {
    status = "breach";
  } else if (drivingMinutesUsed === WEEKLY_DRIVING_LIMIT_MINUTES) {
    status = "limit";
  } else if (remainingMinutes <= WEEKLY_DRIVING_WARNING_REMAINING_MINUTES) {
    status = "warning";
  }

  return {
    drivingMinutesUsed,

    limitMinutes: WEEKLY_DRIVING_LIMIT_MINUTES,

    remainingMinutes,

    percentageUsed,

    percentageRemaining,

    status,
  };
}
