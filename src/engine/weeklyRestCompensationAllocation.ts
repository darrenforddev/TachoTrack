import type { WeeklyRestCompensationObligation } from "./weeklyRestCompensation";

export type RestCompensationCalendarEventType =
  | "compensation-created"
  | "compensation-applied"
  | "compensation-cleared"
  | "compensation-overdue";

export interface RestCompensationCalendarEvent {
  id: string;

  type: RestCompensationCalendarEventType;

  date: string;

  /**
   * Original legal compensation deadline.
   *
   * YYYY-MM-DD
   */
  deadline?: string;

  sourceWeekNumber: number;

  sourceObligationId: string;

  /**
   * The rest period that supplied
   * compensation, where applicable.
   */
  allocationRestId?: string;

  /**
   * Amount involved in this event.
   */
  minutes: number;

  /**
   * Remaining obligation after the event.
   */
  remainingMinutes: number;

  /**
   * Human-readable audit message.
   */
  message: string;
}

export interface CompensationRestCandidate {
  id: string;

  /**
   * Calendar date associated with the
   * qualifying rest.
   *
   * YYYY-MM-DD
   */
  date: string;

  /**
   * Total continuous qualifying rest.
   */
  totalRestMinutes: number;

  /**
   * Base rest requirement that must exist
   * before extra time can be considered
   * for compensation.
   *
   * Example:
   * 9h daily rest
   * or 45h weekly rest.
   */
  baseRequiredRestMinutes: number;
}

export interface CompensationAllocation {
  id: string;

  obligationId: string;

  sourceWeekNumber: number;

  restId: string;

  date: string;

  availableCompensationMinutes: number;

  appliedMinutes: number;

  remainingMinutesAfter: number;
}

export interface CompensationAllocationResult {
  obligation: WeeklyRestCompensationObligation;

  allocation: CompensationAllocation | null;

  events: RestCompensationCalendarEvent[];
}

/**
 * --------------------------------------------------
 * AVAILABLE EXTRA REST
 * --------------------------------------------------
 *
 * Example:
 *
 * qualifying rest = 54h
 * base requirement = 45h
 *
 * available compensation = 9h
 */
export function calculateAvailableCompensationMinutes(
  rest: CompensationRestCandidate,
): number {
  return Math.max(0, rest.totalRestMinutes - rest.baseRequiredRestMinutes);
}

/**
 * --------------------------------------------------
 * CREATE OBLIGATION EVENT
 * --------------------------------------------------
 *
 * This lets the calendar retain the point
 * at which the compensation debt was created.
 */
export function createCompensationCreatedEvent(
  obligation: WeeklyRestCompensationObligation,
): RestCompensationCalendarEvent {
  return {
    id: `${obligation.id}-created`,

    type: "compensation-created",

    date: obligation.sourceDate,

    deadline: obligation.dueDate,

    sourceWeekNumber: obligation.sourceWeekNumber,

    sourceObligationId: obligation.id,

    minutes: obligation.requiredCompensationMinutes,

    remainingMinutes: obligation.remainingMinutes,

    message:
      `${obligation.requiredCompensationMinutes} minutes ` +
      `of weekly-rest compensation were created. ` +
      `Due by ${obligation.dueDate}.`,
  };
}

/**
 * --------------------------------------------------
 * APPLY QUALIFYING REST TO AN OBLIGATION
 * --------------------------------------------------
 *
 * IMPORTANT:
 *
 * This function does not automatically
 * manufacture compensation out of every
 * long rest.
 *
 * It receives an explicit qualifying rest
 * candidate and applies only the amount
 * above that rest's base requirement.
 */
export function allocateRestCompensation(
  obligation: WeeklyRestCompensationObligation,
  rest: CompensationRestCandidate,
): CompensationAllocationResult {
  const events: RestCompensationCalendarEvent[] = [];

  /**
   * Nothing left to satisfy.
   */
  if (obligation.remainingMinutes <= 0 || obligation.status === "completed") {
    return {
      obligation,
      allocation: null,
      events,
    };
  }

  const availableCompensationMinutes =
    calculateAvailableCompensationMinutes(rest);

  /**
   * No qualifying surplus rest.
   */
  if (availableCompensationMinutes <= 0) {
    return {
      obligation,
      allocation: null,
      events,
    };
  }

  const appliedMinutes = Math.min(
    availableCompensationMinutes,
    obligation.remainingMinutes,
  );

  const compensatedMinutes = obligation.compensatedMinutes + appliedMinutes;

  const remainingMinutes = Math.max(
    0,
    obligation.requiredCompensationMinutes - compensatedMinutes,
  );

  const completed = remainingMinutes === 0;

  const updatedObligation: WeeklyRestCompensationObligation = {
    ...obligation,

    compensatedMinutes,

    remainingMinutes,

    status: completed ? "completed" : "partially-compensated",
  };

  const allocation: CompensationAllocation = {
    id: `allocation-${obligation.id}-${rest.id}`,

    obligationId: obligation.id,

    sourceWeekNumber: obligation.sourceWeekNumber,

    restId: rest.id,

    date: rest.date,

    availableCompensationMinutes,

    appliedMinutes,

    remainingMinutesAfter: remainingMinutes,
  };

  /**
   * ------------------------------------------------
   * COMPENSATION APPLIED EVENT
   * ------------------------------------------------
   */
  events.push({
    id: `${allocation.id}-applied`,

    type: "compensation-applied",

    date: rest.date,

    deadline: obligation.dueDate,

    sourceWeekNumber: obligation.sourceWeekNumber,

    sourceObligationId: obligation.id,

    allocationRestId: rest.id,

    minutes: appliedMinutes,

    remainingMinutes: remainingMinutes,

    message:
      `${appliedMinutes} minutes of weekly-rest ` +
      `compensation were applied from rest ${rest.id}. ` +
      `${remainingMinutes} minutes remain. ` +
      `Original deadline: ${obligation.dueDate}.`,
  });

  /**
   * ------------------------------------------------
   * COMPENSATION CLEARED EVENT
   * ------------------------------------------------
   */
  if (completed) {
    events.push({
      id: `${allocation.id}-cleared`,

      type: "compensation-cleared",

      date: rest.date,

      deadline: obligation.dueDate,

      sourceWeekNumber: obligation.sourceWeekNumber,

      sourceObligationId: obligation.id,

      allocationRestId: rest.id,

      minutes: appliedMinutes,

      remainingMinutes: 0,

      message:
        `Weekly-rest compensation from Week ` +
        `${obligation.sourceWeekNumber} was fully cleared. ` +
        `Original deadline: ${obligation.dueDate}.`,
    });
  }

  return {
    obligation: updatedObligation,

    allocation,

    events,
  };
}

/**
 * --------------------------------------------------
 * OVERDUE EVENT
 * --------------------------------------------------
 *
 * This creates an immutable audit record
 * for the date the outstanding obligation
 * became overdue.
 */
export function createCompensationOverdueEvent(
  obligation: WeeklyRestCompensationObligation,
  eventDate: string,
): RestCompensationCalendarEvent | null {
  if (obligation.remainingMinutes <= 0) {
    return null;
  }

  return {
    id: `${obligation.id}-overdue-${eventDate}`,

    type: "compensation-overdue",

    date: eventDate,

    deadline: obligation.dueDate,

    sourceWeekNumber: obligation.sourceWeekNumber,

    sourceObligationId: obligation.id,

    minutes: obligation.remainingMinutes,

    remainingMinutes: obligation.remainingMinutes,

    message:
      `${obligation.remainingMinutes} minutes of weekly-rest ` +
      `compensation remained outstanding after the deadline ` +
      `of ${obligation.dueDate}.`,
  };
}
