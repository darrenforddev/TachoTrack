import type { ActivityHistoryEvent } from "../data/activityHistory";

export type LiveWtdActivityLevel = "good" | "warning" | "breach";

export interface LiveWtdActivityState {
  level: LiveWtdActivityLevel;

  /*
   * Existing minute-based fields are kept
   * for compatibility with current engine code.
   */
  consecutiveWorkingMinutes: number;
  minutesUntilSixHourLimit: number;

  /*
   * Precise fields used for second/millisecond
   * boundary decisions.
   */
  consecutiveWorkingMilliseconds: number;
  consecutiveWorkingSeconds: number;

  millisecondsUntilSixHourLimit: number;
  secondsUntilSixHourLimit: number;

  message: string;
}

const MINUTE_MILLISECONDS = 60 * 1000;

const SIX_HOURS_MILLISECONDS = 6 * 60 * 60 * 1000;

const WARNING_MILLISECONDS = (5 * 60 + 30) * MINUTE_MILLISECONDS;

const MINIMUM_QUALIFYING_BREAK_MILLISECONDS = 15 * MINUTE_MILLISECONDS;

function getEventDurationMilliseconds(
  event: ActivityHistoryEvent,
  nowMilliseconds: number,
): number {
  const startMilliseconds = new Date(event.startedAt).getTime();

  const endMilliseconds =
    event.endedAt !== null
      ? new Date(event.endedAt).getTime()
      : nowMilliseconds;

  if (
    !Number.isFinite(startMilliseconds) ||
    !Number.isFinite(endMilliseconds) ||
    endMilliseconds <= startMilliseconds
  ) {
    return 0;
  }

  return endMilliseconds - startMilliseconds;
}

export function evaluateLiveWtdActivityState(
  events: ActivityHistoryEvent[],
  nowMilliseconds: number = Date.now(),
): LiveWtdActivityState {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );

  let consecutiveWorkingMilliseconds = 0;

  for (const event of sortedEvents) {
    const durationMilliseconds = getEventDurationMilliseconds(
      event,
      nowMilliseconds,
    );

    /*
     * Driving and other work both count
     * as working time.
     */
    if (event.activity === "driving" || event.activity === "other-work") {
      consecutiveWorkingMilliseconds += durationMilliseconds;

      continue;
    }

    /*
     * A qualifying WTD break resets the
     * consecutive-working clock.
     *
     * The 15-minute requirement is checked
     * using exact milliseconds.
     */
    if (event.activity === "break") {
      if (durationMilliseconds >= MINIMUM_QUALIFYING_BREAK_MILLISECONDS) {
        consecutiveWorkingMilliseconds = 0;
      }

      continue;
    }

    /*
     * POA does not count as working time,
     * but does not automatically reset the
     * consecutive-working clock.
     */
    if (event.activity === "poa") {
      continue;
    }
  }

  /*
   * Compatibility values.
   *
   * These are useful for display and existing
   * code, but they are NOT used for the legal
   * six-hour boundary decision.
   */
  const consecutiveWorkingMinutes = Math.floor(
    consecutiveWorkingMilliseconds / MINUTE_MILLISECONDS,
  );

  const consecutiveWorkingSeconds = Math.floor(
    consecutiveWorkingMilliseconds / 1000,
  );

  const millisecondsUntilSixHourLimit = Math.max(
    0,
    SIX_HOURS_MILLISECONDS - consecutiveWorkingMilliseconds,
  );

  const secondsUntilSixHourLimit = Math.ceil(
    millisecondsUntilSixHourLimit / 1000,
  );

  const minutesUntilSixHourLimit = Math.ceil(
    millisecondsUntilSixHourLimit / MINUTE_MILLISECONDS,
  );

  /*
   * IMPORTANT:
   *
   * Compliance decision uses the precise
   * millisecond duration.
   *
   * 05:59:59 = warning
   * 06:00:00 = warning here
   * 06:00:01 = breach
   *
   * The higher-level prediction engine will
   * convert exactly 6h into ACTION.
   */
  if (consecutiveWorkingMilliseconds > SIX_HOURS_MILLISECONDS) {
    return {
      level: "breach",

      consecutiveWorkingMinutes,
      minutesUntilSixHourLimit,

      consecutiveWorkingMilliseconds,
      consecutiveWorkingSeconds,

      millisecondsUntilSixHourLimit,
      secondsUntilSixHourLimit,

      message:
        "More than 6 consecutive hours of working time without a qualifying WTD break.",
    };
  }

  if (consecutiveWorkingMilliseconds >= WARNING_MILLISECONDS) {
    return {
      level: "warning",

      consecutiveWorkingMinutes,
      minutesUntilSixHourLimit,

      consecutiveWorkingMilliseconds,
      consecutiveWorkingSeconds,

      millisecondsUntilSixHourLimit,
      secondsUntilSixHourLimit,

      message: "WTD break requirement is approaching.",
    };
  }

  return {
    level: "good",

    consecutiveWorkingMinutes,
    minutesUntilSixHourLimit,

    consecutiveWorkingMilliseconds,
    consecutiveWorkingSeconds,

    millisecondsUntilSixHourLimit,
    secondsUntilSixHourLimit,

    message: "WTD consecutive-working status is currently clear.",
  };
}
