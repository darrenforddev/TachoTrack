import type { RestSession } from "../../data/restSession";

import { confirmWeeklyRestWeekAssignment } from "../weeklyRestWeekAssignmentDecision";

import { resolveWeeklyRestWeekAssignment } from "../weeklyRestWeekAssignment";

import { buildWeeklyRestCompensationTimeline } from "../weeklyRestCompensationTimeline";

function completedWeeklySession(
  id: string,
  startedAt: string,
  endedAt: string,
): RestSession {
  const startTimestamp = new Date(startedAt).getTime();

  const endTimestamp = new Date(endedAt).getTime();

  return {
    id,

    type: "weekly",

    startedAt,

    endedAt,

    durationMilliseconds: endTimestamp - startTimestamp,

    status: "completed",
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(
      `Weekly-rest compensation timeline scenario failed: ${message}`,
    );
  }
}

/**
 * Automatic Week 35 reduced weekly rest:
 * 24h taken, 21h compensation created.
 */
const sourceReducedRest = completedWeeklySession(
  "source-reduced-rest",
  "2026-08-29T00:00:00.000Z",
  "2026-08-30T00:00:00.000Z",
);

/**
 * SCENARIO 1
 * Automatic same-week assignment creates
 * an outstanding obligation and calendar event.
 */
const outstandingTimeline = buildWeeklyRestCompensationTimeline(
  [sourceReducedRest],
  [],
  "2026-09-10",
);

assert(
  outstandingTimeline.obligations.length === 1 &&
    outstandingTimeline.obligations[0].requiredCompensationMinutes ===
      21 * 60 &&
    outstandingTimeline.obligations[0].status === "outstanding" &&
    outstandingTimeline.events.some(
      (event) => event.type === "compensation-created",
    ) &&
    outstandingTimeline.hasPendingAssignments === false,
  "A same-week reduced rest should create an outstanding obligation.",
);

/**
 * SCENARIO 2
 * Later verified 66h regular weekly rest clears
 * the 21h obligation en bloc.
 */
const regular66SameWeek = completedWeeklySession(
  "regular-66h-same-week",
  "2026-09-16T00:00:00.000Z",
  "2026-09-18T18:00:00.000Z",
);

const completedTimeline = buildWeeklyRestCompensationTimeline(
  [sourceReducedRest, regular66SameWeek],
  [],
  "2026-09-19",
);

assert(
  completedTimeline.obligations.length === 1 &&
    completedTimeline.obligations[0].status === "completed" &&
    completedTimeline.obligations[0].remainingMinutes === 0 &&
    completedTimeline.obligations[0].calendarVisible === false &&
    completedTimeline.events.map((event) => event.type).join(",") ===
      "compensation-created,compensation-applied,compensation-cleared",
  "A verified 66h rest should clear the obligation and preserve audit events.",
);

/**
 * Spanning 36h reduced weekly rest:
 * Sunday into Monday.
 */
const spanningReducedRest = completedWeeklySession(
  "spanning-reduced-rest",
  "2026-09-06T00:00:00.000Z",
  "2026-09-07T12:00:00.000Z",
);

/**
 * SCENARIO 3
 * Unconfirmed spanning rest creates no obligation.
 */
const pendingTimeline = buildWeeklyRestCompensationTimeline(
  [spanningReducedRest],
  [],
  "2026-09-08",
);

assert(
  pendingTimeline.obligations.length === 0 &&
    pendingTimeline.pendingAssignments.length === 1 &&
    pendingTimeline.hasPendingAssignments === true,
  "An unconfirmed spanning rest must remain pending.",
);

/**
 * SCENARIO 4
 * Confirmed spanning rest creates one obligation
 * in the selected week only.
 */
const spanningReducedAssignment =
  resolveWeeklyRestWeekAssignment(spanningReducedRest);

const spanningReducedDecision = confirmWeeklyRestWeekAssignment(
  spanningReducedAssignment,
  "2026-08-31",
  "2026-09-08T00:00:00.000Z",
);

if (spanningReducedDecision === null) {
  throw new Error("Spanning reduced-rest decision was not created.");
}

const confirmedTimeline = buildWeeklyRestCompensationTimeline(
  [spanningReducedRest],
  [spanningReducedDecision],
  "2026-09-08",
);

assert(
  confirmedTimeline.obligations.length === 1 &&
    confirmedTimeline.obligations[0].sourceWeekNumber === 36 &&
    confirmedTimeline.pendingAssignments.length === 0,
  "A confirmed spanning rest should count in exactly the selected week.",
);

/**
 * Spanning 66h regular weekly rest:
 * verified surplus exists, but week assignment
 * is still required.
 */
const spanningRegular66 = completedWeeklySession(
  "spanning-regular-66h",
  "2026-09-13T12:00:00.000Z",
  "2026-09-16T06:00:00.000Z",
);

/**
 * SCENARIO 5
 * Unconfirmed spanning regular weekly rest cannot
 * supply compensation.
 */
const blockedEvidenceTimeline = buildWeeklyRestCompensationTimeline(
  [sourceReducedRest, spanningRegular66],
  [],
  "2026-09-19",
);

assert(
  blockedEvidenceTimeline.obligations[0].status === "outstanding" &&
    blockedEvidenceTimeline.obligations[0].remainingMinutes === 21 * 60 &&
    blockedEvidenceTimeline.pendingAssignments.length === 1,
  "Unconfirmed spanning weekly rest must not supply compensation.",
);

/**
 * SCENARIO 6
 * Once confirmed, the same 66h rest may clear
 * the earlier obligation.
 */
const spanningRegularAssignment =
  resolveWeeklyRestWeekAssignment(spanningRegular66);

const spanningRegularDecision = confirmWeeklyRestWeekAssignment(
  spanningRegularAssignment,
  "2026-09-07",
  "2026-09-16T06:01:00.000Z",
);

if (spanningRegularDecision === null) {
  throw new Error("Spanning regular-rest decision was not created.");
}

const confirmedEvidenceTimeline = buildWeeklyRestCompensationTimeline(
  [sourceReducedRest, spanningRegular66],
  [spanningRegularDecision],
  "2026-09-19",
);

assert(
  confirmedEvidenceTimeline.obligations[0].status === "completed" &&
    confirmedEvidenceTimeline.obligations[0].remainingMinutes === 0 &&
    confirmedEvidenceTimeline.pendingAssignments.length === 0,
  "Confirmed spanning regular rest should supply verified compensation.",
);

/**
 * SCENARIO 7
 * Outstanding obligation becomes overdue on
 * the day after its deadline.
 */
const overdueTimeline = buildWeeklyRestCompensationTimeline(
  [sourceReducedRest],
  [],
  "2026-09-21",
);

const overdueEvent = overdueTimeline.events.find(
  (event) => event.type === "compensation-overdue",
);

assert(
  overdueTimeline.obligations[0].status === "overdue" &&
    overdueTimeline.obligations[0].overdue === true &&
    overdueEvent?.date === "2026-09-21",
  "An outstanding obligation should become overdue after the deadline.",
);

/**
 * SCENARIO 8
 * Invalid current date is rejected.
 */
let invalidDateRejected = false;

try {
  buildWeeklyRestCompensationTimeline([sourceReducedRest], [], "invalid-date");
} catch {
  invalidDateRejected = true;
}

assert(invalidDateRejected, "Timeline must reject an invalid current date.");

console.log("✓ Weekly-rest compensation timeline scenarios passed (8/8)");
