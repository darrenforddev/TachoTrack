import type { ActivityHistoryEvent } from "../data/activityHistory";
import { WTD_LIMITS } from "./wtdRules";

export interface LiveWtdWorkPeriodState {
  workingMilliseconds: number;
  workingMinutes: number;

  qualifyingBreakMilliseconds: number;
  qualifyingBreakMinutes: number;

  requiredBreakMinutes: number;
  breakShortfallMinutes: number;
}

const MINUTE_MILLISECONDS = 60 * 1000;

const MINIMUM_BREAK_MILLISECONDS =
  WTD_LIMITS.minimumBreakSegmentMinutes * MINUTE_MILLISECONDS;

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

function getRequiredBreakMinutes(workingMilliseconds: number): number {
  const sixHourThresholdMilliseconds =
    WTD_LIMITS.sixHourThresholdMinutes * MINUTE_MILLISECONDS;

  const nineHourThresholdMilliseconds =
    WTD_LIMITS.nineHourThresholdMinutes * MINUTE_MILLISECONDS;

  if (workingMilliseconds > nineHourThresholdMilliseconds) {
    return WTD_LIMITS.minimumBreakOverNineHoursMinutes;
  }

  if (workingMilliseconds > sixHourThresholdMilliseconds) {
    return WTD_LIMITS.minimumBreakOverSixHoursMinutes;
  }

  return 0;
}

export function evaluateLiveWtdWorkPeriod(
  events: ActivityHistoryEvent[],
  nowMilliseconds: number = Date.now(),
): LiveWtdWorkPeriodState {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );

  let workingMilliseconds = 0;
  let qualifyingBreakMilliseconds = 0;

  for (const event of sortedEvents) {
    const durationMilliseconds = getEventDurationMilliseconds(
      event,
      nowMilliseconds,
    );

    if (event.activity === "driving" || event.activity === "other-work") {
      workingMilliseconds += durationMilliseconds;

      continue;
    }

    if (
      event.activity === "break" &&
      durationMilliseconds >= MINIMUM_BREAK_MILLISECONDS
    ) {
      qualifyingBreakMilliseconds += durationMilliseconds;

      continue;
    }

    /*
     * POA is excluded from working time.
     *
     * It is deliberately not counted here
     * as a qualifying WTD break.
     */
    if (event.activity === "poa") {
      continue;
    }
  }

  const workingMinutes = Math.floor(workingMilliseconds / MINUTE_MILLISECONDS);

  const qualifyingBreakMinutes = Math.floor(
    qualifyingBreakMilliseconds / MINUTE_MILLISECONDS,
  );

  const requiredBreakMinutes = getRequiredBreakMinutes(workingMilliseconds);

  const breakShortfallMinutes = Math.max(
    0,
    requiredBreakMinutes - qualifyingBreakMinutes,
  );

  return {
    workingMilliseconds,
    workingMinutes,

    qualifyingBreakMilliseconds,
    qualifyingBreakMinutes,

    requiredBreakMinutes,
    breakShortfallMinutes,
  };
}
