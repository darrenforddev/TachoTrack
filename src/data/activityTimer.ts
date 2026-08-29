import type { DriverActivityType } from "./activityState";

export interface ActivityTotals {
  driving: number;
  break: number;
  otherWork: number;
  poa: number;
}

export interface ActivityTimerState {
  /**
   * Activity currently running.
   */
  currentActivity: DriverActivityType;

  /**
   * Timestamp when the current activity began.
   */
  currentActivityStartedAt: number;

  /**
   * Accumulated milliseconds for each activity.
   */
  totals: ActivityTotals;
}

/**
 * --------------------------------------------------
 * INITIAL TIMER STATE
 * --------------------------------------------------
 */
export function createInitialActivityTimerState(
  currentActivity: DriverActivityType,
  startedAt: number = Date.now(),
): ActivityTimerState {
  return {
    currentActivity,

    currentActivityStartedAt: startedAt,

    totals: {
      driving: 0,
      break: 0,
      otherWork: 0,
      poa: 0,
    },
  };
}

/**
 * --------------------------------------------------
 * GET TOTAL FOR ONE ACTIVITY
 * --------------------------------------------------
 *
 * This includes:
 *
 * - previously accumulated time
 * - current live elapsed time if that
 *   activity is active right now
 */
export function getActivityElapsedMilliseconds(
  state: ActivityTimerState,
  activity: DriverActivityType,
  now: number = Date.now(),
): number {
  const baseTotal = getStoredActivityTotal(state.totals, activity);

  if (state.currentActivity !== activity) {
    return baseTotal;
  }

  const liveElapsed = Math.max(0, now - state.currentActivityStartedAt);

  return baseTotal + liveElapsed;
}

/**
 * --------------------------------------------------
 * CHANGE ACTIVITY
 * --------------------------------------------------
 *
 * When the driver switches activity:
 *
 * 1. Calculate how long the current activity ran.
 * 2. Add that time to the stored total.
 * 3. Start the new activity timer.
 */
export function changeTimedActivity(
  state: ActivityTimerState,
  nextActivity: DriverActivityType,
  changedAt: number = Date.now(),
): ActivityTimerState {
  /**
   * Pressing the already-active activity
   * does not reset its timer.
   */
  if (state.currentActivity === nextActivity) {
    return state;
  }

  const elapsed = Math.max(0, changedAt - state.currentActivityStartedAt);

  const updatedTotals: ActivityTotals = {
    ...state.totals,
  };

  switch (state.currentActivity) {
    case "driving":
      updatedTotals.driving += elapsed;
      break;

    case "break":
      updatedTotals.break += elapsed;
      break;

    case "other-work":
      updatedTotals.otherWork += elapsed;
      break;

    case "poa":
      updatedTotals.poa += elapsed;
      break;
  }

  return {
    currentActivity: nextActivity,

    currentActivityStartedAt: changedAt,

    totals: updatedTotals,
  };
}

/**
 * --------------------------------------------------
 * STORED TOTAL LOOKUP
 * --------------------------------------------------
 */
function getStoredActivityTotal(
  totals: ActivityTotals,
  activity: DriverActivityType,
): number {
  switch (activity) {
    case "driving":
      return totals.driving;

    case "break":
      return totals.break;

    case "other-work":
      return totals.otherWork;

    case "poa":
      return totals.poa;
  }
}

/**
 * --------------------------------------------------
 * DISPLAY FORMAT
 * --------------------------------------------------
 *
 * milliseconds
 *     ↓
 * HH:MM:SS
 *
 * We use seconds during development so
 * the timer behaviour is easy to verify.
 *
 * Later we can display HH:MM on the main
 * production dashboard if preferred.
 */
export function formatActivityDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);

  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const seconds = totalSeconds % 60;

  return [
    hours.toString().padStart(2, "0"),

    minutes.toString().padStart(2, "0"),

    seconds.toString().padStart(2, "0"),
  ].join(":");
}

/**
 * --------------------------------------------------
 * REBUILD TIMER FROM ACTIVITY HISTORY
 * --------------------------------------------------
 *
 * Reconstructs dashboard timer state from the
 * persisted activity history.
 *
 * Completed events become accumulated totals.
 * The currently open event becomes the live timer.
 */

export function createActivityTimerStateFromHistory(
  events: Array<{
    activity: DriverActivityType;
    startedAt: string;
    endedAt: string | null;
    durationMilliseconds: number | null;
  }>,
  fallbackNow: number = Date.now(),
): ActivityTimerState {
  const totals: ActivityTotals = {
    driving: 0,
    break: 0,
    otherWork: 0,
    poa: 0,
  };

  const currentDate = new Date(fallbackNow);

  const dayStart = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();

  const dayEnd = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate() + 1,
    0,
    0,
    0,
    0,
  ).getTime();

  let currentActivity: DriverActivityType = "other-work";
  let currentActivityStartedAt = fallbackNow;

  for (const event of events) {
    const eventStart = new Date(event.startedAt).getTime();

    const eventEnd =
      event.endedAt !== null ? new Date(event.endedAt).getTime() : fallbackNow;

    if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd)) {
      continue;
    }

    const visibleStart = Math.max(eventStart, dayStart);

    const visibleEnd = Math.min(eventEnd, dayEnd);

    const visibleDuration = Math.max(0, visibleEnd - visibleStart);

    /**
     * Only completed activity belongs in totals.
     *
     * The currently open activity is added live by
     * getActivityElapsedMilliseconds().
     */
    if (event.endedAt !== null && visibleDuration > 0) {
      switch (event.activity) {
        case "driving":
          totals.driving += visibleDuration;
          break;

        case "break":
          totals.break += visibleDuration;
          break;

        case "other-work":
          totals.otherWork += visibleDuration;
          break;

        case "poa":
          totals.poa += visibleDuration;
          break;
      }
    }

    /**
     * Restore the currently open activity.
     *
     * If it began before local midnight, start the
     * dashboard's live portion at midnight so the
     * previous day's time is not counted today.
     */
    if (event.endedAt === null) {
      currentActivity = event.activity;

      currentActivityStartedAt = Math.max(eventStart, dayStart);
    }
  }

  return {
    currentActivity,
    currentActivityStartedAt,
    totals,
  };
}
