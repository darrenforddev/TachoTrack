import type { ActivityHistoryEvent } from "../data/activityHistory";
import type { RestSession } from "../data/restSession";
import { evaluateLiveWtdActivityState } from "./liveWtdActivityState";
import { evaluateLiveWtdCurrentWorkPeriod } from "./liveWtdCurrentWorkPeriod";
import { evaluateLiveWtdPrecision } from "./liveWtdPrecision";
import type { LiveWtdPrediction } from "./liveWtdPrediction";
import type { DriverDay } from "./types";
import {
  getDailyWorkingMinutes,
  getQualifyingWtdBreakMinutes,
  getRequiredWtdBreakMinutes,
} from "./wtdRules";

export type LiveWtdLevel =
  | "good"
  | "advisory"
  | "warning"
  | "action"
  | "due"
  | "breach";

export interface LiveWtdState {
  level: LiveWtdLevel;

  workingMinutes: number;
  qualifyingBreakMinutes: number;
  requiredBreakMinutes: number;
  breakShortfallMinutes: number;

  consecutiveWorkingMinutes: number;
  minutesUntilSixHourLimit: number;

  prediction: LiveWtdPrediction;

  message: string;
}

export interface LiveWtdStateOptions {
  activityHistory?: ActivityHistoryEvent[];
  restSessions?: RestSession[];
  nowMilliseconds?: number;
}

export function evaluateLiveWtdState(
  day: DriverDay,
  activityHistory?: ActivityHistoryEvent[],
  nowMilliseconds: number = Date.now(),
  options?: LiveWtdStateOptions,
): LiveWtdState {
  /*
   * Backwards compatibility:
   *
   * Existing callers can continue using:
   *
   * evaluateLiveWtdState(day)
   *
   * evaluateLiveWtdState(
   *   day,
   *   activityHistory,
   *   nowMilliseconds,
   * )
   *
   * New callers can additionally provide
   * RestSession evidence through options.
   */

  const resolvedActivityHistory = options?.activityHistory ?? activityHistory;

  const resolvedNowMilliseconds = options?.nowMilliseconds ?? nowMilliseconds;

  const resolvedRestSessions = options?.restSessions;

  /*
   * DriverDay activities remain the fallback
   * when persistent activity history has not
   * been supplied.
   */

  const fallbackActivityHistory: ActivityHistoryEvent[] = day.activities.map(
    (activity) => ({
      id: activity.id,

      activity:
        activity.type === "otherWork"
          ? ("other-work" as const)
          : activity.type === "driving"
            ? ("driving" as const)
            : activity.type === "break"
              ? ("break" as const)
              : ("poa" as const),

      startedAt: activity.start,
      endedAt: activity.end,

      durationMilliseconds: activity.durationMinutes * 60 * 1000,

      source: "manual" as const,
    }),
  );

  const historyForLiveState =
    resolvedActivityHistory ?? fallbackActivityHistory;

  /*
   * TOTAL WTD WORK-PERIOD CALCULATION
   *
   * When both persistent activity history
   * and RestSession evidence are available,
   * calculate working time and qualifying
   * breaks across the current work period
   * rather than the current calendar day.
   *
   * This prevents midnight from incorrectly
   * resetting the 30/45-minute requirement.
   *
   * Without RestSession evidence we retain
   * the existing DriverDay calculation for
   * backwards compatibility.
   */

  let workingMinutes: number;
  let qualifyingBreakMinutes: number;
  let requiredBreakMinutes: number;
  let breakShortfallMinutes: number;

  if (
    resolvedActivityHistory !== undefined &&
    resolvedRestSessions !== undefined
  ) {
    const currentWorkPeriod = evaluateLiveWtdCurrentWorkPeriod(
      resolvedActivityHistory,
      resolvedRestSessions,
      resolvedNowMilliseconds,
    );

    workingMinutes = currentWorkPeriod.workPeriod.workingMinutes;

    qualifyingBreakMinutes =
      currentWorkPeriod.workPeriod.qualifyingBreakMinutes;

    requiredBreakMinutes = currentWorkPeriod.workPeriod.requiredBreakMinutes;

    breakShortfallMinutes = currentWorkPeriod.workPeriod.breakShortfallMinutes;
  } else {
    workingMinutes = getDailyWorkingMinutes(day);

    qualifyingBreakMinutes = getQualifyingWtdBreakMinutes(day);

    requiredBreakMinutes = getRequiredWtdBreakMinutes(workingMinutes);

    breakShortfallMinutes = Math.max(
      0,
      requiredBreakMinutes - qualifyingBreakMinutes,
    );
  }

  /*
   * SIX-HOUR CONSECUTIVE-WORKING CLOCK
   *
   * Persistent activity history is used when
   * available so the clock can continue
   * correctly through midnight.
   */

  const consecutiveState = evaluateLiveWtdActivityState(
    historyForLiveState,
    resolvedNowMilliseconds,
  );

  /*
   * Driver-facing prediction is determined
   * from the precise millisecond value rather
   * than rounded whole minutes.
   *
   * 05:59:59 -> warning
   * 06:00:00 -> action
   * 06:00:01 -> breach
   */

  const precisePrediction = evaluateLiveWtdPrecision(
    consecutiveState.consecutiveWorkingMilliseconds,
  );

  /*
   * Preserve the existing LiveWtdPrediction
   * shape for compatibility.
   */

  const prediction: LiveWtdPrediction = {
    level: precisePrediction.level,

    consecutiveWorkingMinutes: consecutiveState.consecutiveWorkingMinutes,

    minutesUntilSixHourLimit: consecutiveState.minutesUntilSixHourLimit,

    message: precisePrediction.message,
  };

  /*
   * Priority 1:
   * Proven consecutive-working breach.
   */

  if (prediction.level === "breach") {
    return {
      level: "breach",

      workingMinutes,
      qualifyingBreakMinutes,
      requiredBreakMinutes,
      breakShortfallMinutes,

      consecutiveWorkingMinutes: consecutiveState.consecutiveWorkingMinutes,

      minutesUntilSixHourLimit: consecutiveState.minutesUntilSixHourLimit,

      prediction,

      message: prediction.message,
    };
  }

  /*
   * Priority 2:
   * Exactly six hours.
   */

  if (prediction.level === "action") {
    return {
      level: "action",

      workingMinutes,
      qualifyingBreakMinutes,
      requiredBreakMinutes,
      breakShortfallMinutes,

      consecutiveWorkingMinutes: consecutiveState.consecutiveWorkingMinutes,

      minutesUntilSixHourLimit: consecutiveState.minutesUntilSixHourLimit,

      prediction,

      message: prediction.message,
    };
  }

  /*
   * Priority 3:
   * Outstanding total WTD break requirement.
   *
   * During a live shift this remains DUE,
   * rather than being treated as a completed
   * historical breach.
   */

  if (requiredBreakMinutes > 0 && breakShortfallMinutes > 0) {
    return {
      level: "due",

      workingMinutes,
      qualifyingBreakMinutes,
      requiredBreakMinutes,
      breakShortfallMinutes,

      consecutiveWorkingMinutes: consecutiveState.consecutiveWorkingMinutes,

      minutesUntilSixHourLimit: consecutiveState.minutesUntilSixHourLimit,

      prediction,

      message: `${breakShortfallMinutes} minutes of WTD break still required.`,
    };
  }

  /*
   * Priority 4:
   * Product warning.
   */

  if (prediction.level === "warning") {
    return {
      level: "warning",

      workingMinutes,
      qualifyingBreakMinutes,
      requiredBreakMinutes,
      breakShortfallMinutes,

      consecutiveWorkingMinutes: consecutiveState.consecutiveWorkingMinutes,

      minutesUntilSixHourLimit: consecutiveState.minutesUntilSixHourLimit,

      prediction,

      message: prediction.message,
    };
  }

  /*
   * Priority 5:
   * Earlier product advisory.
   */

  if (prediction.level === "advisory") {
    return {
      level: "advisory",

      workingMinutes,
      qualifyingBreakMinutes,
      requiredBreakMinutes,
      breakShortfallMinutes,

      consecutiveWorkingMinutes: consecutiveState.consecutiveWorkingMinutes,

      minutesUntilSixHourLimit: consecutiveState.minutesUntilSixHourLimit,

      prediction,

      message: prediction.message,
    };
  }

  return {
    level: "good",

    workingMinutes,
    qualifyingBreakMinutes,
    requiredBreakMinutes,
    breakShortfallMinutes,

    consecutiveWorkingMinutes: consecutiveState.consecutiveWorkingMinutes,

    minutesUntilSixHourLimit: consecutiveState.minutesUntilSixHourLimit,

    prediction,

    message: prediction.message,
  };
}
