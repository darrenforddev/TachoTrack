export type LiveWtdPredictionLevel =
  | "clear"
  | "advisory"
  | "warning"
  | "action"
  | "breach";

export interface LiveWtdPrediction {
  level: LiveWtdPredictionLevel;

  consecutiveWorkingMinutes: number;
  minutesUntilSixHourLimit: number;

  message: string;
}

const SIX_HOUR_LIMIT_MINUTES = 6 * 60;

const ADVISORY_THRESHOLD_MINUTES = 60;
const WARNING_THRESHOLD_MINUTES = 30;

export function evaluateLiveWtdPrediction(
  consecutiveWorkingMinutes: number,
): LiveWtdPrediction {
  const safeWorkingMinutes = Math.max(0, consecutiveWorkingMinutes);

  const minutesUntilSixHourLimit = Math.max(
    0,
    SIX_HOUR_LIMIT_MINUTES - safeWorkingMinutes,
  );

  /*
   * More than six hours without a qualifying
   * break is an actual breach state.
   */
  if (safeWorkingMinutes > SIX_HOUR_LIMIT_MINUTES) {
    return {
      level: "breach",
      consecutiveWorkingMinutes: safeWorkingMinutes,
      minutesUntilSixHourLimit: 0,
      message:
        "WTD six-hour working limit has been exceeded without a qualifying break.",
    };
  }

  /*
   * Exactly six hours:
   * the driver must not continue working without
   * taking the required qualifying break.
   */
  if (safeWorkingMinutes === SIX_HOUR_LIMIT_MINUTES) {
    return {
      level: "action",
      consecutiveWorkingMinutes: safeWorkingMinutes,
      minutesUntilSixHourLimit: 0,
      message: "WTD break required before any further working time.",
    };
  }

  /*
   * 5h30 -> 5h59
   */
  if (minutesUntilSixHourLimit <= WARNING_THRESHOLD_MINUTES) {
    return {
      level: "warning",
      consecutiveWorkingMinutes: safeWorkingMinutes,
      minutesUntilSixHourLimit,
      message: `${minutesUntilSixHourLimit} minutes until WTD break action point.`,
    };
  }

  /*
   * 5h00 -> 5h29
   *
   * Early information rather than an alarm.
   */
  if (minutesUntilSixHourLimit <= ADVISORY_THRESHOLD_MINUTES) {
    return {
      level: "advisory",
      consecutiveWorkingMinutes: safeWorkingMinutes,
      minutesUntilSixHourLimit,
      message: `${minutesUntilSixHourLimit} minutes until WTD break action point.`,
    };
  }

  return {
    level: "clear",
    consecutiveWorkingMinutes: safeWorkingMinutes,
    minutesUntilSixHourLimit,
    message: "No immediate WTD break action required.",
  };
}
