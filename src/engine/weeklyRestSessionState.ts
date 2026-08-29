import type { RestSession } from "../data/restSession";

export const WEEKLY_REST_SESSION_LIMITS = {
  regularWeeklyRestMinutes: 45 * 60,
} as const;

export interface WeeklyRestSessionState {
  elapsedMinutes: number;

  fortyFiveHourReached: boolean;

  fortyFiveHourCompletionTime: string;

  remainingMinutes: number;

  message: string;
}

function addMinutes(timestamp: string, minutes: number): string {
  const startTimestamp = new Date(timestamp).getTime();

  return new Date(startTimestamp + minutes * 60 * 1000).toISOString();
}

function getElapsedMinutes(session: RestSession, now: number): number {
  const startTimestamp = new Date(session.startedAt).getTime();

  const endTimestamp =
    session.endedAt !== null ? new Date(session.endedAt).getTime() : now;

  return Math.max(0, Math.floor((endTimestamp - startTimestamp) / (60 * 1000)));
}

export function calculateWeeklyRestSessionState(
  session: RestSession,
  now: number = Date.now(),
): WeeklyRestSessionState {
  const elapsedMinutes = getElapsedMinutes(session, now);

  const requiredMinutes = WEEKLY_REST_SESSION_LIMITS.regularWeeklyRestMinutes;

  const fortyFiveHourCompletionTime = addMinutes(
    session.startedAt,
    requiredMinutes,
  );

  const fortyFiveHourReached = elapsedMinutes >= requiredMinutes;

  const remainingMinutes = fortyFiveHourReached
    ? 0
    : requiredMinutes - elapsedMinutes;

  let message: string;

  if (fortyFiveHourReached) {
    message = "Regular weekly rest milestone achieved.";
  } else {
    message =
      "Weekly rest is in progress. Continue resting until the 45-hour regular weekly-rest milestone.";
  }

  return {
    elapsedMinutes,

    fortyFiveHourReached,

    fortyFiveHourCompletionTime,

    remainingMinutes,

    message,
  };
}
