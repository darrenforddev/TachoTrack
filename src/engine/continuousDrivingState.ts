import type { DriverDay } from "./types";

import { DRIVING_LIMITS } from "./drivingRules";

export type ContinuousDrivingStatus = "good" | "warning" | "limit" | "breach";

export interface ContinuousDrivingState {
  /**
   * Continuous driving accumulated since the
   * last qualifying break reset.
   */
  drivingMinutesUsed: number;

  /**
   * Legal continuous-driving limit.
   *
   * Normally 270 minutes = 4h30.
   */
  limitMinutes: number;

  /**
   * Driving time remaining before the 4h30 limit.
   *
   * Never falls below zero.
   */
  remainingMinutes: number;

  /**
   * Amount by which the driver has exceeded
   * the legal limit.
   */
  excessMinutes: number;

  /**
   * Percentage of the continuous-driving
   * allowance already used.
   *
   * This can exceed 100 when in breach.
   */
  percentageUsed: number;

  /**
   * Percentage remaining for the future
   * inner-ring display.
   *
   * Always kept between 0 and 100.
   */
  percentageRemaining: number;

  /**
   * Whether the first qualifying part of
   * a 15 + 30 split break has been taken.
   */
  firstSplitBreakTaken: boolean;

  /**
   * Status suitable for dashboard display.
   */
  status: ContinuousDrivingStatus;
}

/**
 * --------------------------------------------------
 * STATUS
 * --------------------------------------------------
 *
 * These are display thresholds only.
 *
 * They do NOT change the legal 4h30 limit.
 *
 * For now:
 *
 * good:
 * more than 60 minutes remaining
 *
 * warning:
 * 1 - 60 minutes remaining
 *
 * limit:
 * exactly at 4h30
 *
 * breach:
 * over 4h30
 */
function getContinuousDrivingStatus(
  drivingMinutesUsed: number,
  remainingMinutes: number,
  excessMinutes: number,
): ContinuousDrivingStatus {
  if (excessMinutes > 0) {
    return "breach";
  }

  if (drivingMinutesUsed === DRIVING_LIMITS.continuousDrivingMinutes) {
    return "limit";
  }

  if (remainingMinutes <= 60) {
    return "warning";
  }

  return "good";
}

/**
 * --------------------------------------------------
 * CONTINUOUS DRIVING STATE
 * --------------------------------------------------
 *
 * Reads the chronological activity sequence
 * from DriverDay and determines how much
 * continuous driving currently remains.
 *
 * This intentionally follows the same break
 * reset behaviour as checkContinuousDriving():
 *
 * - 45m+ single break resets
 * - 15m first split part does NOT reset
 * - qualifying 30m second split part resets
 * - Other Work does not reset
 * - POA does not reset
 */
export function calculateContinuousDrivingState(
  day: DriverDay,
): ContinuousDrivingState {
  let drivingSinceReset = 0;

  let firstSplitBreakTaken = false;

  const sortedActivities = [...day.activities].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  for (const activity of sortedActivities) {
    /**
     * ----------------------------------------------
     * DRIVING
     * ----------------------------------------------
     */
    if (activity.type === "driving") {
      drivingSinceReset += activity.durationMinutes;

      continue;
    }

    /**
     * Other Work, POA and Rest do not form
     * part of the break-reset calculation here.
     */
    if (activity.type !== "break") {
      continue;
    }

    const breakMinutes = activity.durationMinutes;

    /**
     * ----------------------------------------------
     * FULL 45-MINUTE BREAK
     * ----------------------------------------------
     *
     * A single uninterrupted break of at least
     * 45 minutes completely resets continuous
     * driving.
     */
    if (breakMinutes >= DRIVING_LIMITS.requiredBreakMinutes) {
      drivingSinceReset = 0;

      firstSplitBreakTaken = false;

      continue;
    }

    /**
     * ----------------------------------------------
     * FIRST SPLIT BREAK
     * ----------------------------------------------
     *
     * At least 15 minutes.
     *
     * This does NOT reset driving yet.
     */
    if (!firstSplitBreakTaken && breakMinutes >= 15) {
      firstSplitBreakTaken = true;

      continue;
    }

    /**
     * ----------------------------------------------
     * SECOND SPLIT BREAK
     * ----------------------------------------------
     *
     * At least 30 minutes after the first
     * qualifying 15-minute break.
     *
     * This completes the split break and resets
     * the continuous-driving clock.
     */
    if (firstSplitBreakTaken && breakMinutes >= 30) {
      drivingSinceReset = 0;

      firstSplitBreakTaken = false;

      continue;
    }
  }

  const limitMinutes = DRIVING_LIMITS.continuousDrivingMinutes;

  const remainingMinutes = Math.max(0, limitMinutes - drivingSinceReset);

  const excessMinutes = Math.max(0, drivingSinceReset - limitMinutes);

  const percentageUsed =
    limitMinutes > 0 ? (drivingSinceReset / limitMinutes) * 100 : 0;

  const percentageRemaining = Math.max(0, Math.min(100, 100 - percentageUsed));

  return {
    drivingMinutesUsed: drivingSinceReset,

    limitMinutes,

    remainingMinutes,

    excessMinutes,

    percentageUsed,

    percentageRemaining,

    firstSplitBreakTaken,

    status: getContinuousDrivingStatus(
      drivingSinceReset,
      remainingMinutes,
      excessMinutes,
    ),
  };
}

/**
 * --------------------------------------------------
 * DISPLAY HELPER
 * --------------------------------------------------
 *
 * Converts minutes into:
 *
 * 75 -> "1h 15m"
 * 270 -> "4h 30m"
 * 15 -> "15m"
 */
export function formatDrivingMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));

  const hours = Math.floor(safeMinutes / 60);

  const remaining = safeMinutes % 60;

  if (hours === 0) {
    return `${remaining}m`;
  }

  return `${hours}h ${remaining.toString().padStart(2, "0")}m`;
}
