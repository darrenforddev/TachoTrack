import type { ActivityHistoryEvent } from "./activityHistory";

import type { ActivityPeriod, ActivityType, DriverDay } from "../engine/types";

/**
 * --------------------------------------------------
 * ACTIVITY TYPE MAPPING
 * --------------------------------------------------
 *
 * Live/manual activity uses:
 *
 * "other-work"
 *
 * The compliance engine expects:
 *
 * "otherWork"
 */
function mapActivityType(
  activity: ActivityHistoryEvent["activity"],
): ActivityType {
  switch (activity) {
    case "driving":
      return "driving";

    case "break":
      return "break";

    case "other-work":
      return "otherWork";

    case "poa":
      return "poa";
  }
}

/**
 * --------------------------------------------------
 * LOCAL DATE HELPERS
 * --------------------------------------------------
 *
 * ActivityHistory timestamps remain stored as UTC ISO.
 *
 * These helpers only determine which LOCAL calendar
 * day the activity belongs to.
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLocalDayBounds(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);

  const start = new Date(year, month - 1, day, 0, 0, 0, 0);

  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);

  return {
    startMilliseconds: start.getTime(),
    endMilliseconds: end.getTime(),
  };
}

/**
 * --------------------------------------------------
 * BUILD ACTIVITY PERIOD FOR ONE CALENDAR DAY
 * --------------------------------------------------
 *
 * An event may cross midnight.
 *
 * Example:
 *
 * 23:30 -> 00:15
 *
 * For the first day:
 *
 * 23:30 -> 00:00
 *
 * For the second day:
 *
 * 00:00 -> 00:15
 *
 * The underlying ActivityHistoryEvent is NOT changed.
 */
function eventToActivityPeriodForDay(
  event: ActivityHistoryEvent,
  dayStartMilliseconds: number,
  dayEndMilliseconds: number,
  nowMilliseconds: number,
): ActivityPeriod | null {
  const eventStartMilliseconds = new Date(event.startedAt).getTime();

  const eventEndMilliseconds =
    event.endedAt !== null
      ? new Date(event.endedAt).getTime()
      : nowMilliseconds;

  const visibleStartMilliseconds = Math.max(
    eventStartMilliseconds,
    dayStartMilliseconds,
  );

  const visibleEndMilliseconds = Math.min(
    eventEndMilliseconds,
    dayEndMilliseconds,
  );

  if (
    !Number.isFinite(visibleStartMilliseconds) ||
    !Number.isFinite(visibleEndMilliseconds) ||
    visibleEndMilliseconds <= visibleStartMilliseconds
  ) {
    return null;
  }

  const durationMilliseconds =
    visibleEndMilliseconds - visibleStartMilliseconds;

  const durationMinutes = Math.floor(durationMilliseconds / (60 * 1000));

  return {
    id: `${event.id}-${dayStartMilliseconds}`,

    type: mapActivityType(event.activity),

    start: new Date(visibleStartMilliseconds).toISOString(),

    end: new Date(visibleEndMilliseconds).toISOString(),

    durationMinutes,
  };
}

/**
 * --------------------------------------------------
 * BUILD DRIVER DAY FOR A SPECIFIC DATE
 * --------------------------------------------------
 *
 * This is the core day builder.
 *
 * It includes every event that overlaps the selected
 * local calendar day, including events that began
 * before midnight and continued into this day.
 */
export function buildDriverDayForDate(
  events: ActivityHistoryEvent[],
  dateString: string,
  now: number = Date.now(),
): DriverDay {
  const {
    startMilliseconds: dayStartMilliseconds,
    endMilliseconds: dayEndMilliseconds,
  } = getLocalDayBounds(dateString);

  const activities = events
    .map((event) =>
      eventToActivityPeriodForDay(
        event,
        dayStartMilliseconds,
        dayEndMilliseconds,
        now,
      ),
    )
    .filter((activity): activity is ActivityPeriod => activity !== null)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const drivingMinutes = activities
    .filter((activity) => activity.type === "driving")
    .reduce((total, activity) => total + activity.durationMinutes, 0);

  const otherWorkMinutes = activities
    .filter((activity) => activity.type === "otherWork")
    .reduce((total, activity) => total + activity.durationMinutes, 0);

  const breakMinutes = activities
    .filter((activity) => activity.type === "break")
    .reduce((total, activity) => total + activity.durationMinutes, 0);

  const poaMinutes = activities
    .filter((activity) => activity.type === "poa")
    .reduce((total, activity) => total + activity.durationMinutes, 0);

  /**
   * We do not yet create "rest" activity from
   * the four manual dashboard buttons.
   *
   * Daily/weekly rest remains handled separately.
   */
  const restMinutes = 0;

  return {
    id: `live-driver-day-${dateString}`,

    date: dateString,

    activities,

    drivingMinutes,

    otherWorkMinutes,

    breakMinutes,

    poaMinutes,

    restMinutes,

    dailyRestType: "unknown",

    notes: ["Built from live TachoTrack activity history."],
  };
}

/**
 * --------------------------------------------------
 * LIVE DRIVER DAY
 * --------------------------------------------------
 *
 * Builds today's DriverDay using the driver's LOCAL
 * calendar date.
 *
 * Activity timestamps themselves remain canonical
 * UTC ISO timestamps.
 */
export function buildLiveDriverDay(
  events: ActivityHistoryEvent[],
  now: number = Date.now(),
): DriverDay {
  const currentLocalDate = formatLocalDate(new Date(now));

  return buildDriverDayForDate(events, currentLocalDate, now);
}
