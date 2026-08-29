import type { RestSession } from "../data/restSession";

import { DAILY_REST_LIMITS, classifyDailyRest } from "./dailyRestRules";

import type { ReducedDailyRestHistoryState } from "./reducedDailyRestHistory";

export interface DailyRestSessionState {
  elapsedMinutes: number;

  classification: "insufficient" | "reduced" | "regular";

  nineHourReached: boolean;
  elevenHourReached: boolean;

  reducedRestAvailable: boolean;

  reducedRestsUsed: number;
  reducedRestsRemaining: number;

  nineHourCompletionTime: string;
  elevenHourCompletionTime: string;

  earliestLegalStartTime: string;

  earliestLegalStartType: "reduced-9h" | "regular-11h";

  mayResumeWork: boolean;

  message: string;
}

function addMinutes(timestamp: string, minutes: number): string {
  const start = new Date(timestamp).getTime();

  return new Date(start + minutes * 60 * 1000).toISOString();
}

function getElapsedMinutes(session: RestSession, now: number): number {
  const start = new Date(session.startedAt).getTime();

  const end =
    session.endedAt !== null ? new Date(session.endedAt).getTime() : now;

  return Math.max(0, Math.floor((end - start) / (60 * 1000)));
}

export function calculateDailyRestSessionState(
  session: RestSession,
  reducedRestHistory: ReducedDailyRestHistoryState,
  now: number = Date.now(),
): DailyRestSessionState {
  const elapsedMinutes = getElapsedMinutes(session, now);

  const classification = classifyDailyRest(elapsedMinutes);

  const nineHourCompletionTime = addMinutes(
    session.startedAt,
    DAILY_REST_LIMITS.reducedDailyRestMinutes,
  );

  const elevenHourCompletionTime = addMinutes(
    session.startedAt,
    DAILY_REST_LIMITS.regularDailyRestMinutes,
  );

  const reducedRestAvailable = reducedRestHistory.canTakeAnotherReducedRest;

  const reducedRestsUsed = reducedRestHistory.reducedRestsUsed;

  const reducedRestsRemaining = reducedRestHistory.reducedRestsRemaining;

  const earliestLegalStartType: "reduced-9h" | "regular-11h" =
    reducedRestAvailable ? "reduced-9h" : "regular-11h";

  const earliestLegalStartTime = reducedRestAvailable
    ? nineHourCompletionTime
    : elevenHourCompletionTime;

  const nineHourReached =
    elapsedMinutes >= DAILY_REST_LIMITS.reducedDailyRestMinutes;

  const elevenHourReached =
    elapsedMinutes >= DAILY_REST_LIMITS.regularDailyRestMinutes;

  const mayResumeWork = reducedRestAvailable
    ? nineHourReached
    : elevenHourReached;

  let message: string;

  if (elevenHourReached) {
    message =
      "Regular daily rest achieved. The reduced daily-rest allowance is preserved.";
  } else if (nineHourReached && reducedRestAvailable) {
    message =
      "Reduced daily rest achieved. Work may resume, or rest can continue to 11 hours to achieve a regular daily rest.";
  } else if (nineHourReached && !reducedRestAvailable) {
    message =
      "Nine hours has been reached, but all reduced daily rests have already been used. Continue resting until the 11-hour regular-rest milestone.";
  } else if (reducedRestAvailable) {
    message =
      `Daily rest is in progress. ` +
      `${reducedRestsRemaining} reduced daily rest` +
      `${reducedRestsRemaining === 1 ? "" : "s"} remaining.`;
  } else {
    message =
      "Daily rest is in progress. The reduced daily-rest allowance has been used, so 11 hours of rest is required before work resumes.";
  }

  return {
    elapsedMinutes,

    classification,

    nineHourReached,
    elevenHourReached,

    reducedRestAvailable,

    reducedRestsUsed,
    reducedRestsRemaining,

    nineHourCompletionTime,
    elevenHourCompletionTime,

    earliestLegalStartTime,
    earliestLegalStartType,

    mayResumeWork,

    message,
  };
}
