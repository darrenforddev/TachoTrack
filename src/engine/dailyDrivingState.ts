import type { DriverDay } from "./types";

import { DRIVING_LIMITS } from "./drivingRules";

export type DailyDrivingStatus =
  | "good"
  | "warning"
  | "standard-limit"
  | "extended"
  | "extended-warning"
  | "extended-limit"
  | "breach";

export interface DailyDrivingState {
  /**
   * Total driving recorded in the current DriverDay.
   */
  drivingMinutesUsed: number;

  /**
   * Standard daily driving limit:
   * 9 hours = 540 minutes.
   */
  standardLimitMinutes: number;

  /**
   * Maximum extended daily driving limit:
   * 10 hours = 600 minutes.
   */
  extendedLimitMinutes: number;

  /**
   * Remaining time before 9h standard limit.
   *
   * Never below zero.
   */
  remainingToStandardMinutes: number;

  /**
   * Remaining time before 10h maximum.
   *
   * Never below zero.
   */
  remainingToExtendedMinutes: number;

  /**
   * Amount driven beyond the normal 9h limit.
   */
  extensionUsedMinutes: number;

  /**
   * Amount driven beyond the 10h absolute maximum.
   */
  excessMinutes: number;

  /**
   * True once the driver has exceeded 9h.
   */
  extensionInUse: boolean;

  /**
   * Percentage of the 9h standard allowance used.
   *
   * May exceed 100%.
   */
  percentageOfStandardUsed: number;

  /**
   * Percentage of the 10h maximum used.
   *
   * May exceed 100%.
   */
  percentageOfExtendedUsed: number;

  /**
   * Percentage remaining to 10h.
   *
   * Always between 0 and 100.
   */
  percentageRemainingToExtended: number;

  status: DailyDrivingStatus;
}

/**
 * --------------------------------------------------
 * STATUS
 * --------------------------------------------------
 *
 * Display thresholds only.
 *
 * Legal limits remain:
 *
 * standard = 9h
 * extended = 10h
 *
 * For now:
 *
 * good
 *   more than 60m to standard 9h limit
 *
 * warning
 *   60m or less to 9h
 *
 * standard-limit
 *   exactly 9h
 *
 * extended
 *   over 9h with more than 60m to 10h
 *
 * extended-warning
 *   60m or less remaining to 10h
 *
 * extended-limit
 *   exactly 10h
 *
 * breach
 *   over 10h
 */
function getDailyDrivingStatus(
  drivingMinutesUsed: number,
  standardLimitMinutes: number,
  extendedLimitMinutes: number,
): DailyDrivingStatus {
  if (drivingMinutesUsed > extendedLimitMinutes) {
    return "breach";
  }

  if (drivingMinutesUsed === extendedLimitMinutes) {
    return "extended-limit";
  }

  if (drivingMinutesUsed > standardLimitMinutes) {
    const remainingToExtended = extendedLimitMinutes - drivingMinutesUsed;

    if (remainingToExtended <= 60) {
      return "extended-warning";
    }

    return "extended";
  }

  if (drivingMinutesUsed === standardLimitMinutes) {
    return "standard-limit";
  }

  const remainingToStandard = standardLimitMinutes - drivingMinutesUsed;

  if (remainingToStandard <= 60) {
    return "warning";
  }

  return "good";
}

/**
 * --------------------------------------------------
 * DAILY DRIVING STATE
 * --------------------------------------------------
 *
 * This is deliberately much simpler than the
 * continuous-driving calculation.
 *
 * Daily driving is the total driving time in
 * the DriverDay. A normal 45-minute break does
 * NOT reset it.
 */
export function calculateDailyDrivingState(day: DriverDay): DailyDrivingState {
  const drivingMinutesUsed = day.drivingMinutes;

  const standardLimitMinutes = DRIVING_LIMITS.standardDailyDrivingMinutes;

  const extendedLimitMinutes = DRIVING_LIMITS.extendedDailyDrivingMinutes;

  const remainingToStandardMinutes = Math.max(
    0,
    standardLimitMinutes - drivingMinutesUsed,
  );

  const remainingToExtendedMinutes = Math.max(
    0,
    extendedLimitMinutes - drivingMinutesUsed,
  );

  const extensionUsedMinutes = Math.max(
    0,
    drivingMinutesUsed - standardLimitMinutes,
  );

  const excessMinutes = Math.max(0, drivingMinutesUsed - extendedLimitMinutes);

  const extensionInUse = drivingMinutesUsed > standardLimitMinutes;

  const percentageOfStandardUsed =
    standardLimitMinutes > 0
      ? (drivingMinutesUsed / standardLimitMinutes) * 100
      : 0;

  const percentageOfExtendedUsed =
    extendedLimitMinutes > 0
      ? (drivingMinutesUsed / extendedLimitMinutes) * 100
      : 0;

  const percentageRemainingToExtended = Math.max(
    0,
    Math.min(100, 100 - percentageOfExtendedUsed),
  );

  return {
    drivingMinutesUsed,

    standardLimitMinutes,

    extendedLimitMinutes,

    remainingToStandardMinutes,

    remainingToExtendedMinutes,

    extensionUsedMinutes,

    excessMinutes,

    extensionInUse,

    percentageOfStandardUsed,

    percentageOfExtendedUsed,

    percentageRemainingToExtended,

    status: getDailyDrivingStatus(
      drivingMinutesUsed,
      standardLimitMinutes,
      extendedLimitMinutes,
    ),
  };
}
