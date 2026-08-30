import type { RestSession } from "./restSession";

import { createWeeklyRestRecord } from "../engine/weeklyRestHistory";

import {
  coordinateWeeklyRestObligation,
  type CoordinatedWeeklyRestObligation,
} from "../engine/weeklyRestObligationCoordinator";

import {
  createCompensationCreatedEvent,
  type RestCompensationCalendarEvent,
} from "../engine/weeklyRestCompensationAllocation";

import { evaluateWeeklyRestCompensationEvidence } from "../engine/weeklyRestCompensationEvidence";

import { allocateVerifiedWeeklyRestCompensation } from "../engine/verifiedWeeklyRestCompensationAllocation";

function createCompletedWeeklyRestSession(
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

/**
 * Week 35:
 *
 * A completed 24-hour reduced weekly rest
 * creates 21 hours of compensation.
 */
const week35WeeklyRest = createWeeklyRestRecord(
  "week-35-weekly-rest",
  "2026-08-29T12:00:00.000Z",
  "2026-08-30T12:00:00.000Z",
);

if (week35WeeklyRest === null) {
  throw new Error("Week 35 weekly rest could not be classified.");
}

const coordinatedWeek35 = coordinateWeeklyRestObligation({
  weeklyRest: week35WeeklyRest,

  sourceWeekNumber: 35,

  sourceWeekReferenceDate: "2026-08-30",

  currentDate: "2026-08-30",
});

if (!coordinatedWeek35.hasObligation || coordinatedWeek35.obligation === null) {
  throw new Error(
    "Week 35 should have created a weekly-rest compensation obligation.",
  );
}

const initialObligation = coordinatedWeek35.obligation;

const createdEvent = createCompensationCreatedEvent(initialObligation);

/**
 * First completed weekly rest:
 *
 * 51 hours total
 * 45-hour regular weekly-rest base
 * 6-hour surplus
 *
 * This is verified evidence, but it cannot
 * partially satisfy the 21-hour obligation.
 */
const firstRestSession = createCompletedWeeklyRestSession(
  "rest-2026-09-12",
  "2026-09-10T09:00:00.000Z",
  "2026-09-12T12:00:00.000Z",
);

const firstEvidence = evaluateWeeklyRestCompensationEvidence(firstRestSession);

const firstAllocation = allocateVerifiedWeeklyRestCompensation(
  initialObligation,
  firstEvidence,
);

const obligationAfterFirst = firstAllocation.allocationResult
  .obligation as CoordinatedWeeklyRestObligation;

/**
 * Second completed weekly rest:
 *
 * 66 hours total
 * 45-hour regular weekly-rest base
 * 21-hour continuous surplus
 *
 * This clears the complete obligation en bloc
 * before the legal deadline.
 */
const secondRestSession = createCompletedWeeklyRestSession(
  "rest-2026-09-19",
  "2026-09-16T09:00:00.000Z",
  "2026-09-19T03:00:00.000Z",
);

const secondEvidence =
  evaluateWeeklyRestCompensationEvidence(secondRestSession);

const secondAllocation = allocateVerifiedWeeklyRestCompensation(
  obligationAfterFirst,
  secondEvidence,
);

export const sampleWeeklyRestCompensationEvents: RestCompensationCalendarEvent[] =
  [
    createdEvent,

    ...firstAllocation.allocationResult.events,

    ...secondAllocation.allocationResult.events,
  ];

export const sampleWeeklyRestCompensationFinalObligation =
  secondAllocation.allocationResult.obligation;

export const sampleWeeklyRestCompensationEvidence = [
  firstEvidence,

  secondEvidence,
];

export const sampleWeek35WeeklyRest = week35WeeklyRest;

export const sampleWeek35CoordinatedObligation = coordinatedWeek35.obligation;
