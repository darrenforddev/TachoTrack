import type { DriverDay } from "./types";

import { DRIVING_LIMITS } from "./drivingRules";

export type ExtendedDrivingAllowanceStatus =
  | "available"
  | "one-used"
  | "exhausted"
  | "breach";

export interface ExtendedDrivingAllowanceState {
  /**
   * Maximum number of 10h daily-driving
   * extensions allowed in a week.
   */
  maxExtensionsPerWeek: number;

  /**
   * Number of days this week where driving
   * exceeded 9h but did not exceed 10h.
   */
  extensionsUsed: number;

  /**
   * Number of valid 10h extensions still
   * available this week.
   */
  extensionsRemaining: number;

  /**
   * True when another extension can still
   * legally be used.
   */
  extensionAvailable: boolean;

  /**
   * True when the weekly extension allowance
   * has already been fully used.
   */
  allowanceExhausted: boolean;

  /**
   * Number of extension days beyond
   * the legal weekly maximum.
   */
  excessExtensionDays: number;

  status: ExtendedDrivingAllowanceStatus;
}

/**
 * --------------------------------------------------
 * EXTENDED DRIVING DAY
 * --------------------------------------------------
 *
 * A valid extended daily-driving day is:
 *
 * > 9h
 * <= 10h
 */
function isExtendedDrivingDay(day: DriverDay): boolean {
  return (
    day.drivingMinutes > DRIVING_LIMITS.standardDailyDrivingMinutes &&
    day.drivingMinutes <= DRIVING_LIMITS.extendedDailyDrivingMinutes
  );
}

/**
 * --------------------------------------------------
 * WEEKLY EXTENSION ALLOWANCE
 * --------------------------------------------------
 *
 * Regulation state used by the dashboard.
 *
 * This does not replace checkExtendedDrivingUsage().
 * It simply exposes the same weekly allowance
 * in a UI-friendly format.
 */
export function calculateExtendedDrivingAllowanceState(
  days: DriverDay[],
): ExtendedDrivingAllowanceState {
  const maxExtensionsPerWeek = DRIVING_LIMITS.maxExtendedDrivingDaysPerWeek;

  const extensionsUsed = days.filter(isExtendedDrivingDay).length;

  const extensionsRemaining = Math.max(
    0,
    maxExtensionsPerWeek - extensionsUsed,
  );

  const excessExtensionDays = Math.max(
    0,
    extensionsUsed - maxExtensionsPerWeek,
  );

  const extensionAvailable = extensionsRemaining > 0;

  const allowanceExhausted = extensionsRemaining === 0;

  let status: ExtendedDrivingAllowanceStatus;

  if (excessExtensionDays > 0) {
    status = "breach";
  } else if (extensionsUsed === 0) {
    status = "available";
  } else if (extensionsUsed === 1) {
    status = "one-used";
  } else {
    status = "exhausted";
  }

  return {
    maxExtensionsPerWeek,

    extensionsUsed,

    extensionsRemaining,

    extensionAvailable,

    allowanceExhausted,

    excessExtensionDays,

    status,
  };
}
