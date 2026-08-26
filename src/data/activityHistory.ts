import type { DriverActivityType } from "./activityState";

export type ActivityEventSource =
  | "manual"
  | "tachograph"
  | "gps"
  | "admin-correction";

export interface ActivityHistoryEvent {
  id: string;

  activity: DriverActivityType;

  /**
   * ISO timestamps.
   */
  startedAt: string;

  endedAt: string | null;

  /**
   * Null while the activity is still active.
   */
  durationMilliseconds: number | null;

  /**
   * Where this event came from.
   *
   * For now all dashboard button presses
   * will use "manual".
   */
  source: ActivityEventSource;
}

export interface ActivityHistoryState {
  events: ActivityHistoryEvent[];

  /**
   * ID of the currently open event.
   */
  activeEventId: string | null;
}

/**
 * --------------------------------------------------
 * CREATE EMPTY HISTORY
 * --------------------------------------------------
 */
export function createInitialActivityHistory(): ActivityHistoryState {
  return {
    events: [],
    activeEventId: null,
  };
}

/**
 * --------------------------------------------------
 * START FIRST ACTIVITY
 * --------------------------------------------------
 *
 * Used when a driver session begins.
 */
export function startActivityHistory(
  activity: DriverActivityType,
  startedAt: string = new Date().toISOString(),
  source: ActivityEventSource = "manual",
): ActivityHistoryState {
  const id = `activity-${startedAt}-${activity}`;

  const event: ActivityHistoryEvent = {
    id,

    activity,

    startedAt,

    endedAt: null,

    durationMilliseconds: null,

    source,
  };

  return {
    events: [event],

    activeEventId: id,
  };
}

/**
 * --------------------------------------------------
 * CHANGE ACTIVITY
 * --------------------------------------------------
 *
 * This mirrors a tachograph-style activity trace:
 *
 * 1. Close the currently active event.
 * 2. Calculate its duration.
 * 3. Add a new open event.
 *
 * Pressing the already-active activity does nothing.
 */
export function changeActivityHistory(
  state: ActivityHistoryState,
  nextActivity: DriverActivityType,
  changedAt: string = new Date().toISOString(),
  source: ActivityEventSource = "manual",
): ActivityHistoryState {
  const activeEvent = state.events.find(
    (event) => event.id === state.activeEventId,
  );

  /**
   * If there is no active event yet,
   * begin a new history.
   */
  if (!activeEvent) {
    return startActivityHistory(nextActivity, changedAt, source);
  }

  /**
   * Do not create duplicate consecutive
   * records for the same activity.
   */
  if (activeEvent.activity === nextActivity) {
    return state;
  }

  const changedTime = new Date(changedAt).getTime();

  const startedTime = new Date(activeEvent.startedAt).getTime();

  const durationMilliseconds = Math.max(0, changedTime - startedTime);

  const closedEvents = state.events.map((event) => {
    if (event.id !== activeEvent.id) {
      return event;
    }

    return {
      ...event,

      endedAt: changedAt,

      durationMilliseconds,
    };
  });

  const nextId = `activity-${changedAt}-${nextActivity}`;

  const nextEvent: ActivityHistoryEvent = {
    id: nextId,

    activity: nextActivity,

    startedAt: changedAt,

    endedAt: null,

    durationMilliseconds: null,

    source,
  };

  return {
    events: [...closedEvents, nextEvent],

    activeEventId: nextId,
  };
}

/**
 * --------------------------------------------------
 * GET CURRENT EVENT
 * --------------------------------------------------
 */
export function getActiveActivityEvent(
  state: ActivityHistoryState,
): ActivityHistoryEvent | null {
  return state.events.find((event) => event.id === state.activeEventId) ?? null;
}

/**
 * --------------------------------------------------
 * GET COMPLETED EVENTS
 * --------------------------------------------------
 *
 * Useful later for:
 *
 * - compliance calculations
 * - diary
 * - printout-style views
 */
export function getCompletedActivityEvents(
  state: ActivityHistoryState,
): ActivityHistoryEvent[] {
  return state.events.filter(
    (event) => event.endedAt !== null && event.durationMilliseconds !== null,
  );
}

/**
 * --------------------------------------------------
 * FORMAT DURATION
 * --------------------------------------------------
 */
export function formatActivityHistoryDuration(
  milliseconds: number | null,
): string {
  if (milliseconds === null) {
    return "ACTIVE";
  }

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
 * DRIVER-FACING ACTIVITY LABEL
 * --------------------------------------------------
 */
export function getActivityHistoryLabel(activity: DriverActivityType): string {
  switch (activity) {
    case "driving":
      return "Driving";

    case "break":
      return "Break";

    case "other-work":
      return "Other Work";

    case "poa":
      return "POA";
  }
}
