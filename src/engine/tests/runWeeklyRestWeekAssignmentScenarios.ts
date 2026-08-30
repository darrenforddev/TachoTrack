import type { RestSession, RestSessionType } from "../../data/restSession";

import { resolveWeeklyRestWeekAssignment } from "../weeklyRestWeekAssignment";

function createSession(
  id: string,
  type: RestSessionType,
  startedAt: string,
  endedAt: string | null,
  overrides: Partial<RestSession> = {},
): RestSession {
  const startTimestamp = new Date(startedAt).getTime();

  const endTimestamp = endedAt === null ? null : new Date(endedAt).getTime();

  return {
    id,

    type,

    startedAt,

    endedAt,

    durationMilliseconds:
      endTimestamp === null ? null : endTimestamp - startTimestamp,

    status: endedAt === null ? "active" : "completed",

    ...overrides,
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Weekly-rest week-assignment scenario failed: ${message}`);
  }
}

/**
 * SCENARIO 1
 * Rest contained in one ISO week is automatic.
 */
const sameWeek = resolveWeeklyRestWeekAssignment(
  createSession(
    "same-week",
    "weekly",
    "2026-09-01T00:00:00.000Z",
    "2026-09-02T00:00:00.000Z",
  ),
);

assert(
  sameWeek.status === "automatic" &&
    sameWeek.options.length === 1 &&
    sameWeek.assignedWeek?.weekStartDate === "2026-08-31" &&
    sameWeek.assignedWeek?.isoWeekNumber === 36,
  "A same-week rest should be assigned automatically to Week 36.",
);

/**
 * SCENARIO 2
 * Rest with time in two ISO weeks requires confirmation.
 */
const spanningWeeks = resolveWeeklyRestWeekAssignment(
  createSession(
    "spanning-weeks",
    "weekly",
    "2026-09-06T12:00:00.000Z",
    "2026-09-08T12:00:00.000Z",
  ),
);

assert(
  spanningWeeks.status === "confirmation-required" &&
    spanningWeeks.assignedWeek === null &&
    spanningWeeks.options.length === 2 &&
    spanningWeeks.options[0].weekStartDate === "2026-08-31" &&
    spanningWeeks.options[1].weekStartDate === "2026-09-07",
  "A rest spanning Weeks 36 and 37 should require confirmation.",
);

/**
 * SCENARIO 3
 * Ending exactly Monday 00:00 does not occupy
 * the new week.
 */
const exactMondayBoundary = resolveWeeklyRestWeekAssignment(
  createSession(
    "exact-monday-boundary",
    "weekly",
    "2026-09-05T00:00:00.000Z",
    "2026-09-07T00:00:00.000Z",
  ),
);

assert(
  exactMondayBoundary.status === "automatic" &&
    exactMondayBoundary.assignedWeek?.weekStartDate === "2026-08-31",
  "A rest ending exactly Monday 00:00 should remain in the previous week.",
);

/**
 * SCENARIO 4
 * Daily rest cannot be assigned as weekly rest.
 */
const dailyRest = resolveWeeklyRestWeekAssignment(
  createSession(
    "daily-rest",
    "daily",
    "2026-09-01T00:00:00.000Z",
    "2026-09-02T00:00:00.000Z",
  ),
);

assert(
  dailyRest.status === "rejected" &&
    dailyRest.rejectionReason === "not-weekly-rest",
  "Daily rest must be rejected.",
);

/**
 * SCENARIO 5
 * Active weekly rest cannot be assigned.
 */
const activeRest = resolveWeeklyRestWeekAssignment(
  createSession("active-rest", "weekly", "2026-09-01T00:00:00.000Z", null),
);

assert(
  activeRest.status === "rejected" &&
    activeRest.rejectionReason === "session-not-completed",
  "Active weekly rest must be rejected.",
);

/**
 * SCENARIO 6
 * Interrupted weekly rest cannot be assigned.
 */
const interruptedRest = resolveWeeklyRestWeekAssignment(
  createSession(
    "interrupted-rest",
    "weekly",
    "2026-09-01T00:00:00.000Z",
    "2026-09-03T00:00:00.000Z",
    {
      status: "interrupted",
    },
  ),
);

assert(
  interruptedRest.status === "rejected" &&
    interruptedRest.rejectionReason === "session-interrupted",
  "Interrupted weekly rest must be rejected.",
);

/**
 * SCENARIO 7
 * Rest below 24h cannot be assigned.
 */
const belowMinimum = resolveWeeklyRestWeekAssignment(
  createSession(
    "below-minimum",
    "weekly",
    "2026-09-01T00:00:00.000Z",
    "2026-09-01T23:00:00.000Z",
  ),
);

assert(
  belowMinimum.status === "rejected" &&
    belowMinimum.rejectionReason === "weekly-rest-below-24-hours",
  "A 23h rest must not qualify as weekly rest.",
);

/**
 * SCENARIO 8
 * Stored duration must match timestamps.
 */
const durationMismatch = resolveWeeklyRestWeekAssignment(
  createSession(
    "duration-mismatch",
    "weekly",
    "2026-09-01T00:00:00.000Z",
    "2026-09-03T00:00:00.000Z",
    {
      durationMilliseconds: 47 * 60 * 60 * 1000,
    },
  ),
);

assert(
  durationMismatch.status === "rejected" &&
    durationMismatch.rejectionReason === "duration-mismatch",
  "Mismatched duration evidence must be rejected.",
);

/**
 * SCENARIO 9
 * Backwards timestamps are invalid.
 */
const backwards = resolveWeeklyRestWeekAssignment(
  createSession(
    "backwards",
    "weekly",
    "2026-09-03T00:00:00.000Z",
    "2026-09-01T00:00:00.000Z",
  ),
);

assert(
  backwards.status === "rejected" &&
    backwards.rejectionReason === "invalid-timestamps",
  "Backwards timestamps must be rejected.",
);

/**
 * SCENARIO 10
 * ISO year transition remains correct.
 */
const yearBoundary = resolveWeeklyRestWeekAssignment(
  createSession(
    "year-boundary",
    "weekly",
    "2026-12-31T00:00:00.000Z",
    "2027-01-01T00:00:00.000Z",
  ),
);

assert(
  yearBoundary.status === "automatic" &&
    yearBoundary.assignedWeek?.isoYear === 2026 &&
    yearBoundary.assignedWeek?.isoWeekNumber === 53 &&
    yearBoundary.assignedWeek?.weekStartDate === "2026-12-28" &&
    yearBoundary.assignedWeek?.weekEndDate === "2027-01-03",
  "The 2026/2027 boundary should remain ISO Week 53 of 2026.",
);

/**
 * SCENARIO 11
 * Rest spanning more than two weeks is not
 * assigned automatically.
 */
const excessiveSpan = resolveWeeklyRestWeekAssignment(
  createSession(
    "excessive-span",
    "weekly",
    "2026-09-06T00:00:00.000Z",
    "2026-09-21T00:00:00.000Z",
  ),
);

assert(
  excessiveSpan.status === "rejected" &&
    excessiveSpan.rejectionReason === "rest-spans-more-than-two-weeks",
  "A rest spanning more than two weeks must require specialist handling.",
);

/**
 * SCENARIO 12
 * Completed state without an end timestamp is invalid.
 */
const missingEnd = resolveWeeklyRestWeekAssignment(
  createSession("missing-end", "weekly", "2026-09-01T00:00:00.000Z", null, {
    status: "completed",
  }),
);

assert(
  missingEnd.status === "rejected" &&
    missingEnd.rejectionReason === "missing-end-timestamp",
  "Completed weekly rest must retain its end timestamp.",
);

console.log("✓ Weekly-rest week-assignment scenarios passed (12/12)");
