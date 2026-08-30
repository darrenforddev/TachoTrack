import type { RestSession } from "../data/restSession";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const MILLISECONDS_PER_WEEK = 7 * MILLISECONDS_PER_DAY;

const REDUCED_WEEKLY_REST_MINUTES = 24 * 60;

export interface IsoWeekReference {
  isoYear: number;

  isoWeekNumber: number;

  weekStartDate: string;

  weekEndDate: string;
}

export type WeeklyRestWeekAssignmentRejectionReason =
  | "not-weekly-rest"
  | "session-not-completed"
  | "session-interrupted"
  | "missing-end-timestamp"
  | "missing-duration"
  | "invalid-timestamps"
  | "duration-mismatch"
  | "weekly-rest-below-24-hours"
  | "rest-spans-more-than-two-weeks";

export interface WeeklyRestWeekAssignmentResult {
  restSessionId: string;

  status: "automatic" | "confirmation-required" | "rejected";

  options: IsoWeekReference[];

  assignedWeek: IsoWeekReference | null;

  rejectionReason: WeeklyRestWeekAssignmentRejectionReason | null;

  message: string;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfIsoWeekUtc(timestamp: number): Date {
  const date = new Date(timestamp);

  date.setUTCHours(0, 0, 0, 0);

  const day = date.getUTCDay();

  const distanceFromMonday = day === 0 ? -6 : 1 - day;

  date.setUTCDate(date.getUTCDate() + distanceFromMonday);

  return date;
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);

  result.setUTCDate(result.getUTCDate() + days);

  return result;
}

function getIsoWeekReference(timestamp: number): IsoWeekReference {
  const weekStart = startOfIsoWeekUtc(timestamp);

  const weekEnd = addUtcDays(weekStart, 6);

  const weekThursday = addUtcDays(weekStart, 3);

  const isoYear = weekThursday.getUTCFullYear();

  const januaryFourth = new Date(Date.UTC(isoYear, 0, 4));

  const firstIsoWeekStart = startOfIsoWeekUtc(januaryFourth.getTime());

  const isoWeekNumber =
    Math.round(
      (weekStart.getTime() - firstIsoWeekStart.getTime()) /
        MILLISECONDS_PER_WEEK,
    ) + 1;

  return {
    isoYear,

    isoWeekNumber,

    weekStartDate: toDateOnly(weekStart),

    weekEndDate: toDateOnly(weekEnd),
  };
}

function reject(
  session: RestSession,
  rejectionReason: WeeklyRestWeekAssignmentRejectionReason,
  message: string,
): WeeklyRestWeekAssignmentResult {
  return {
    restSessionId: session.id,

    status: "rejected",

    options: [],

    assignedWeek: null,

    rejectionReason,

    message,
  };
}

export function resolveWeeklyRestWeekAssignment(
  session: RestSession,
): WeeklyRestWeekAssignmentResult {
  if (session.type !== "weekly") {
    return reject(
      session,
      "not-weekly-rest",
      "Only a weekly-rest session can be assigned to an ISO week.",
    );
  }

  if (session.status === "interrupted") {
    return reject(
      session,
      "session-interrupted",
      "An interrupted rest cannot be assigned as weekly rest.",
    );
  }

  if (session.status !== "completed") {
    return reject(
      session,
      "session-not-completed",
      "The weekly rest must be completed before assignment.",
    );
  }

  if (session.endedAt === null) {
    return reject(
      session,
      "missing-end-timestamp",
      "The completed weekly rest has no end timestamp.",
    );
  }

  if (session.durationMilliseconds === null) {
    return reject(
      session,
      "missing-duration",
      "The completed weekly rest has no duration evidence.",
    );
  }

  const startTimestamp = new Date(session.startedAt).getTime();

  const endTimestamp = new Date(session.endedAt).getTime();

  if (
    !Number.isFinite(startTimestamp) ||
    !Number.isFinite(endTimestamp) ||
    endTimestamp <= startTimestamp
  ) {
    return reject(
      session,
      "invalid-timestamps",
      "The weekly-rest timestamps are invalid.",
    );
  }

  const derivedDurationMilliseconds = endTimestamp - startTimestamp;

  if (session.durationMilliseconds !== derivedDurationMilliseconds) {
    return reject(
      session,
      "duration-mismatch",
      "Stored weekly-rest duration does not match its timestamps.",
    );
  }

  const durationMinutes = Math.floor(derivedDurationMilliseconds / (60 * 1000));

  if (durationMinutes < REDUCED_WEEKLY_REST_MINUTES) {
    return reject(
      session,
      "weekly-rest-below-24-hours",
      "The session is below the 24-hour reduced weekly-rest minimum.",
    );
  }

  /**
   * Rest intervals are treated as [start, end).
   *
   * Subtracting one millisecond prevents a rest
   * ending exactly at Monday 00:00 from being
   * treated as occupying the new week.
   */
  const endExclusiveTimestamp = endTimestamp - 1;

  const startWeek = getIsoWeekReference(startTimestamp);

  const endWeek = getIsoWeekReference(endExclusiveTimestamp);

  const startWeekTimestamp = new Date(
    `${startWeek.weekStartDate}T00:00:00.000Z`,
  ).getTime();

  const endWeekTimestamp = new Date(
    `${endWeek.weekStartDate}T00:00:00.000Z`,
  ).getTime();

  const weeksTouched =
    Math.round(
      (endWeekTimestamp - startWeekTimestamp) / MILLISECONDS_PER_WEEK,
    ) + 1;

  if (weeksTouched > 2) {
    return reject(
      session,
      "rest-spans-more-than-two-weeks",
      "Automatic assignment is unavailable because the rest spans more than two ISO weeks.",
    );
  }

  if (startWeek.weekStartDate === endWeek.weekStartDate) {
    return {
      restSessionId: session.id,

      status: "automatic",

      options: [startWeek],

      assignedWeek: startWeek,

      rejectionReason: null,

      message:
        `Weekly rest automatically assigned to ` +
        `ISO Week ${startWeek.isoWeekNumber}, ${startWeek.isoYear}.`,
    };
  }

  return {
    restSessionId: session.id,

    status: "confirmation-required",

    options: [startWeek, endWeek],

    assignedWeek: null,

    rejectionReason: null,

    message:
      `This weekly rest spans ISO Weeks ` +
      `${startWeek.isoWeekNumber} and ${endWeek.isoWeekNumber}. ` +
      `It may count in either week, but not both.`,
  };
}
