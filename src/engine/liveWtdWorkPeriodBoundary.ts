import type { ActivityHistoryEvent } from "../data/activityHistory";
import type { RestSession } from "../data/restSession";

export interface LiveWtdWorkPeriodBoundary {
  referenceStart: string | null;

  source:
    | "completed-daily-rest"
    | "completed-weekly-rest"
    | "first-recorded-activity"
    | "none";

  events: ActivityHistoryEvent[];
}

const REDUCED_DAILY_REST_MILLISECONDS = 9 * 60 * 60 * 1000;

const REDUCED_WEEKLY_REST_MILLISECONDS = 24 * 60 * 60 * 1000;

function getCompletedRestDurationMilliseconds(session: RestSession): number {
  if (session.status !== "completed" || session.endedAt === null) {
    return 0;
  }

  if (
    session.durationMilliseconds !== null &&
    session.durationMilliseconds >= 0
  ) {
    return session.durationMilliseconds;
  }

  const startMilliseconds = new Date(session.startedAt).getTime();

  const endMilliseconds = new Date(session.endedAt).getTime();

  if (
    !Number.isFinite(startMilliseconds) ||
    !Number.isFinite(endMilliseconds) ||
    endMilliseconds <= startMilliseconds
  ) {
    return 0;
  }

  return endMilliseconds - startMilliseconds;
}

function isQualifyingBoundaryRest(session: RestSession): boolean {
  const durationMilliseconds = getCompletedRestDurationMilliseconds(session);

  if (session.type === "daily") {
    return durationMilliseconds >= REDUCED_DAILY_REST_MILLISECONDS;
  }

  if (session.type === "weekly") {
    return durationMilliseconds >= REDUCED_WEEKLY_REST_MILLISECONDS;
  }

  return false;
}

export function getLiveWtdWorkPeriodBoundary(
  activityHistory: ActivityHistoryEvent[],
  restSessions: RestSession[],
  nowMilliseconds?: number,
): LiveWtdWorkPeriodBoundary {
  const sortedActivities = [...activityHistory].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );

  const qualifyingRests = restSessions
    .filter(isQualifyingBoundaryRest)
    .filter((session) => {
      if (session.endedAt === null) {
        return false;
      }

      const endedAtMilliseconds = new Date(session.endedAt).getTime();

      if (!Number.isFinite(endedAtMilliseconds)) {
        return false;
      }

      /*
       * Only perform the future-rest
       * protection when a live/current
       * timestamp has explicitly been
       * supplied.
       *
       * This preserves deterministic
       * historical calculations and
       * existing fixed-date tests.
       */

      if (
        nowMilliseconds !== undefined &&
        endedAtMilliseconds > nowMilliseconds
      ) {
        return false;
      }

      return true;
    })
    .sort(
      (a, b) =>
        new Date(a.endedAt as string).getTime() -
        new Date(b.endedAt as string).getTime(),
    );

  const latestQualifyingRest = qualifyingRests[qualifyingRests.length - 1];

  if (
    latestQualifyingRest !== undefined &&
    latestQualifyingRest.endedAt !== null
  ) {
    const boundaryMilliseconds = new Date(
      latestQualifyingRest.endedAt,
    ).getTime();

    const events = sortedActivities.filter((event) => {
      const startedAtMilliseconds = new Date(event.startedAt).getTime();

      return (
        Number.isFinite(startedAtMilliseconds) &&
        startedAtMilliseconds >= boundaryMilliseconds
      );
    });

    return {
      referenceStart: latestQualifyingRest.endedAt,

      source:
        latestQualifyingRest.type === "weekly"
          ? "completed-weekly-rest"
          : "completed-daily-rest",

      events,
    };
  }

  const firstActivity = sortedActivities[0];

  if (firstActivity !== undefined) {
    return {
      referenceStart: firstActivity.startedAt,

      source: "first-recorded-activity",

      events: sortedActivities,
    };
  }

  return {
    referenceStart: null,
    source: "none",
    events: [],
  };
}
