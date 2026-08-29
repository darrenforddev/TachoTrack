export type LiveWtdPrecisionLevel =
  | "clear"
  | "advisory"
  | "warning"
  | "action"
  | "breach";

export interface LiveWtdPrecisionState {
  level: LiveWtdPrecisionLevel;

  consecutiveWorkingMilliseconds: number;
  consecutiveWorkingSeconds: number;

  millisecondsUntilSixHourLimit: number;
  secondsUntilSixHourLimit: number;

  message: string;
}

const SIX_HOURS_MILLISECONDS = 6 * 60 * 60 * 1000;

const ADVISORY_THRESHOLD_MILLISECONDS = 5 * 60 * 60 * 1000;

const WARNING_THRESHOLD_MILLISECONDS = (5 * 60 + 30) * 60 * 1000;

export function evaluateLiveWtdPrecision(
  consecutiveWorkingMilliseconds: number,
): LiveWtdPrecisionState {
  const safeMilliseconds = Math.max(0, consecutiveWorkingMilliseconds);

  const consecutiveWorkingSeconds = Math.floor(safeMilliseconds / 1000);

  const millisecondsUntilSixHourLimit = Math.max(
    0,
    SIX_HOURS_MILLISECONDS - safeMilliseconds,
  );

  const secondsUntilSixHourLimit = Math.ceil(
    millisecondsUntilSixHourLimit / 1000,
  );

  /*
   * Any proven working time beyond exactly
   * six hours is a breach.
   *
   * This deliberately uses milliseconds rather
   * than rounded whole minutes.
   */

  if (safeMilliseconds > SIX_HOURS_MILLISECONDS) {
    return {
      level: "breach",
      consecutiveWorkingMilliseconds: safeMilliseconds,
      consecutiveWorkingSeconds,
      millisecondsUntilSixHourLimit: 0,
      secondsUntilSixHourLimit: 0,
      message:
        "WTD six-hour working limit has been exceeded without a qualifying break.",
    };
  }

  /*
   * Exactly 6:00:00.
   */

  if (safeMilliseconds === SIX_HOURS_MILLISECONDS) {
    return {
      level: "action",
      consecutiveWorkingMilliseconds: safeMilliseconds,
      consecutiveWorkingSeconds,
      millisecondsUntilSixHourLimit: 0,
      secondsUntilSixHourLimit: 0,
      message: "WTD break required before any further working time.",
    };
  }

  if (safeMilliseconds >= WARNING_THRESHOLD_MILLISECONDS) {
    return {
      level: "warning",
      consecutiveWorkingMilliseconds: safeMilliseconds,
      consecutiveWorkingSeconds,
      millisecondsUntilSixHourLimit,
      secondsUntilSixHourLimit,
      message: `${secondsUntilSixHourLimit} seconds until WTD break action point.`,
    };
  }

  if (safeMilliseconds >= ADVISORY_THRESHOLD_MILLISECONDS) {
    return {
      level: "advisory",
      consecutiveWorkingMilliseconds: safeMilliseconds,
      consecutiveWorkingSeconds,
      millisecondsUntilSixHourLimit,
      secondsUntilSixHourLimit,
      message: `${secondsUntilSixHourLimit} seconds until WTD break action point.`,
    };
  }

  return {
    level: "clear",
    consecutiveWorkingMilliseconds: safeMilliseconds,
    consecutiveWorkingSeconds,
    millisecondsUntilSixHourLimit,
    secondsUntilSixHourLimit,
    message: "No immediate WTD break action required.",
  };
}
