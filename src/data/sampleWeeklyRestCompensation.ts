import { createWeeklyRestRecord } from "../engine/weeklyRestHistory";

import { coordinateWeeklyRestObligation } from "../engine/weeklyRestObligationCoordinator";

import {
    allocateRestCompensation,
    createCompensationCreatedEvent,
    type RestCompensationCalendarEvent,
} from "../engine/weeklyRestCompensationAllocation";

/**
 * --------------------------------------------------
 * WEEK 35 WEEKLY REST
 * --------------------------------------------------
 *
 * Start:
 * 29 Aug 2026 12:00
 *
 * End:
 * 30 Aug 2026 12:00
 *
 * Total:
 * 24h
 *
 * Regular weekly rest:
 * 45h
 *
 * Compensation created:
 * 21h
 */
const week35WeeklyRest = createWeeklyRestRecord(
  "week-35-weekly-rest",
  "2026-08-29T12:00:00",
  "2026-08-30T12:00:00",
);

if (!week35WeeklyRest) {
  throw new Error("Week 35 weekly rest could not be classified.");
}

/**
 * --------------------------------------------------
 * COORDINATE WEEK 35 OBLIGATION
 * --------------------------------------------------
 *
 * The coordinator now returns the canonical
 * WeeklyRestCompensationObligation shape.
 *
 * No adapter is needed between coordinator
 * and allocation engine.
 */
const coordinatedWeek35 = coordinateWeeklyRestObligation({
  weeklyRest: week35WeeklyRest,

  sourceWeekNumber: 35,

  sourceWeekReferenceDate: "2026-08-30",

  currentDate: "2026-08-30",

  satisfiedMinutes: 0,
});

if (!coordinatedWeek35.hasObligation || !coordinatedWeek35.obligation) {
  throw new Error(
    "Week 35 should have created a weekly-rest compensation obligation.",
  );
}

/**
 * --------------------------------------------------
 * CANONICAL INITIAL OBLIGATION
 * --------------------------------------------------
 *
 * This comes directly from the coordinator.
 */
const initialObligation = coordinatedWeek35.obligation;

/**
 * --------------------------------------------------
 * EVENT 1
 * COMPENSATION CREATED
 * --------------------------------------------------
 */
const createdEvent = createCompensationCreatedEvent(initialObligation);

/**
 * --------------------------------------------------
 * FIRST QUALIFYING REST
 * --------------------------------------------------
 *
 * 12 Sep 2026
 *
 * Total rest:
 * 51h
 *
 * Base requirement:
 * 45h
 *
 * Surplus:
 * 6h
 *
 * 21h owed
 * - 6h applied
 * = 15h remaining
 */
const firstAllocation = allocateRestCompensation(initialObligation, {
  id: "rest-2026-09-12",

  date: "2026-09-12",

  totalRestMinutes: 51 * 60,

  baseRequiredRestMinutes: 45 * 60,
});

/**
 * --------------------------------------------------
 * SECOND QUALIFYING REST
 * --------------------------------------------------
 *
 * 19 Sep 2026
 *
 * Total rest:
 * 60h
 *
 * Base requirement:
 * 45h
 *
 * Surplus:
 * 15h
 *
 * 15h remaining
 * - 15h applied
 * = 0h
 *
 * Obligation cleared before deadline.
 */
const secondAllocation = allocateRestCompensation(firstAllocation.obligation, {
  id: "rest-2026-09-19",

  date: "2026-09-19",

  totalRestMinutes: 60 * 60,

  baseRequiredRestMinutes: 45 * 60,
});

/**
 * --------------------------------------------------
 * COMPLETE ENGINE-GENERATED AUDIT HISTORY
 * --------------------------------------------------
 */
export const sampleWeeklyRestCompensationEvents: RestCompensationCalendarEvent[] =
  [createdEvent, ...firstAllocation.events, ...secondAllocation.events];

/**
 * --------------------------------------------------
 * FINAL OBLIGATION
 * --------------------------------------------------
 */
export const sampleWeeklyRestCompensationFinalObligation =
  secondAllocation.obligation;

/**
 * --------------------------------------------------
 * SOURCE WEEKLY REST
 * --------------------------------------------------
 */
export const sampleWeek35WeeklyRest = week35WeeklyRest;

/**
 * --------------------------------------------------
 * ORIGINAL COORDINATED OBLIGATION
 * --------------------------------------------------
 */
export const sampleWeek35CoordinatedObligation = coordinatedWeek35.obligation;
