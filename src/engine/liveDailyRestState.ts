import type { ActivityHistoryEvent } from "../data/activityHistory";

import {
    calculateDailyRestDeadline,
    DAILY_REST_LIMITS,
} from "./dailyRestRules";

export type LiveDailyRestLevel = "good" | "warning" | "breach";

export interface LiveDailyRestState {
  level: LiveDailyRestLevel;

  referenceStart: string | null;

  dailyRestDeadline: string | null;

  minutesUntilDeadline: number | null;

  regularRestMinutesRequired: number;

  reducedRestMinutesRequired: number;

  message: string;
}

function toTimestamp(dateTime: string): number {
  return new Date(dateTime).getTime();
}

/**
 * --------------------------------------------------
 * FIND CURRENT DUTY REFERENCE START
 * --------------------------------------------------
 *
 * For the first version of the live engine,
 * the reference point is the beginning of the
 * first work activity in the current activity
 * history.
 *
 * Driving and Other Work are unambiguous
 * work activities.
 *
 * POA and Break are deliberately not used to
 * establish the reference point here.
 *
 * Later this can be replaced by a dedicated
 * shift/rest-session detector without changing
 * the dashboard API.
 */
export function findLiveDailyRestReferenceStart(
  events: ActivityHistoryEvent[],
): string | null {
  const firstWorkEvent = events.find(
    (event) => event.activity === "driving" || event.activity === "other-work",
  );

  return firstWorkEvent?.startedAt ?? null;
}

/**
 * --------------------------------------------------
 * LIVE DAILY REST STATE
 * --------------------------------------------------
 *
 * This does NOT attempt to classify a completed
 * daily rest.
 *
 * Its purpose is to prevent the live dashboard
 * from declaring a daily-rest breach merely
 * because today's calendar-day restMinutes is 0.
 *
 * Completed daily-rest periods remain the
 * responsibility of dailyRestRules.ts.
 */
export function calculateLiveDailyRestState(
  events: ActivityHistoryEvent[],
  now: number = Date.now(),
): LiveDailyRestState {
  const referenceStart = findLiveDailyRestReferenceStart(events);

  if (referenceStart === null) {
    return {
      level: "good",

      referenceStart: null,

      dailyRestDeadline: null,

      minutesUntilDeadline: null,

      regularRestMinutesRequired: DAILY_REST_LIMITS.regularDailyRestMinutes,

      reducedRestMinutesRequired: DAILY_REST_LIMITS.reducedDailyRestMinutes,

      message: "No active daily-rest reference period has been established.",
    };
  }

  const dailyRestDeadline = calculateDailyRestDeadline(referenceStart);

  const deadlineTimestamp = toTimestamp(dailyRestDeadline);

  const remainingMilliseconds = deadlineTimestamp - now;

  const minutesUntilDeadline = Math.max(
    0,
    Math.ceil(remainingMilliseconds / (60 * 1000)),
  );

  /**
   * Once the 24-hour deadline has passed we
   * cannot automatically claim compliance.
   *
   * A qualifying daily rest must have been
   * completed within that reference period.
   *
   * Until the rest-session detector supplies
   * that evidence, treat this as a breach-risk
   * condition represented by BREACH in the
   * existing dashboard status model.
   */
  if (remainingMilliseconds < 0) {
    return {
      level: "breach",

      referenceStart,

      dailyRestDeadline,

      minutesUntilDeadline: 0,

      regularRestMinutesRequired: DAILY_REST_LIMITS.regularDailyRestMinutes,

      reducedRestMinutesRequired: DAILY_REST_LIMITS.reducedDailyRestMinutes,

      message:
        "The 24-hour daily-rest deadline has passed. Daily-rest completion must be verified.",
    };
  }

  /**
   * Warning during the final hour of the
   * reference period.
   *
   * This is intentionally conservative.
   * A later version will calculate the latest
   * safe time to begin a qualifying 9h/11h rest.
   */
  if (minutesUntilDeadline <= 60) {
    return {
      level: "warning",

      referenceStart,

      dailyRestDeadline,

      minutesUntilDeadline,

      regularRestMinutesRequired: DAILY_REST_LIMITS.regularDailyRestMinutes,

      reducedRestMinutesRequired: DAILY_REST_LIMITS.reducedDailyRestMinutes,

      message: `${minutesUntilDeadline} minutes remain in the current 24-hour daily-rest reference period.`,
    };
  }

  return {
    level: "good",

    referenceStart,

    dailyRestDeadline,

    minutesUntilDeadline,

    regularRestMinutesRequired: DAILY_REST_LIMITS.regularDailyRestMinutes,

    reducedRestMinutesRequired: DAILY_REST_LIMITS.reducedDailyRestMinutes,

    message: "Daily-rest reference period is currently open.",
  };
}
