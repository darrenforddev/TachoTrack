import type { ActivityHistoryEvent } from "../data/activityHistory";
import type { RestSession } from "../data/restSession";

import {
    getLiveWtdWorkPeriodBoundary,
    type LiveWtdWorkPeriodBoundary,
} from "./liveWtdWorkPeriodBoundary";

import {
    evaluateLiveWtdWorkPeriod,
    type LiveWtdWorkPeriodState,
} from "./liveWtdWorkPeriod";

export interface LiveWtdCurrentWorkPeriodState {
  boundary: LiveWtdWorkPeriodBoundary;
  workPeriod: LiveWtdWorkPeriodState;
}

export function evaluateLiveWtdCurrentWorkPeriod(
  activityHistory: ActivityHistoryEvent[],
  restSessions: RestSession[],
  nowMilliseconds: number = Date.now(),
): LiveWtdCurrentWorkPeriodState {
  /*
   * First determine which activities belong
   * to the current work period.
   */
  const boundary = getLiveWtdWorkPeriodBoundary(activityHistory, restSessions);

  /*
   * Then calculate WTD working time and
   * qualifying break totals using only
   * activities inside that work period.
   */
  const workPeriod = evaluateLiveWtdWorkPeriod(
    boundary.events,
    nowMilliseconds,
  );

  return {
    boundary,
    workPeriod,
  };
}
