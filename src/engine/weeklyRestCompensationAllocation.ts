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

export const WEEKLY_REST_COMPENSATION_ALLOCATION_LIMITS = {
  minimumAttachedRestMinutes: 9 * 60,
} as const;

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
  if (
    rest.baseRequiredRestMinutes <
    WEEKLY_REST_COMPENSATION_ALLOCATION_LIMITS.minimumAttachedRestMinutes
  ) {
    return 0;
  }

  if (rest.totalRestMinutes < rest.baseRequiredRestMinutes) {
    return 0;
  }

  return rest.totalRestMinutes - rest.baseRequiredRestMinutes;
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

function isRestDateWithinObligationWindow(
  obligation: WeeklyRestCompensationObligation,
  rest: CompensationRestCandidate,
): boolean {
  const restDate = new Date(`${rest.date}T12:00:00`).getTime();

  const sourceDate = new Date(`${obligation.sourceDate}T12:00:00`).getTime();

  const dueDate = new Date(`${obligation.dueDate}T12:00:00`).getTime();

  return (
    Number.isFinite(restDate) &&
    Number.isFinite(sourceDate) &&
    Number.isFinite(dueDate) &&
    restDate >= sourceDate &&
    restDate <= dueDate
  );
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

  if (obligation.remainingMinutes <= 0 || obligation.status === "completed") {
    return {
      obligation,
      allocation: null,
      events,
    };
  }

  if (!isRestDateWithinObligationWindow(obligation, rest)) {
    return {
      obligation,
      allocation: null,
      events,
    };
  }

  const availableCompensationMinutes =
    calculateAvailableCompensationMinutes(rest);

  /**
   * Compensation must satisfy the complete
   * original obligation in one continuous block.
   *
   * Insufficient surplus receives no partial
   * legal credit.
   */
  if (
    obligation.requiredCompensationMinutes <= 0 ||
    availableCompensationMinutes < obligation.requiredCompensationMinutes
  ) {
    return {
      obligation,
      allocation: null,
      events,
    };
  }

  const appliedMinutes = obligation.requiredCompensationMinutes;

  const updatedObligation: WeeklyRestCompensationObligation = {
    ...obligation,

    compensatedMinutes: obligation.requiredCompensationMinutes,

    remainingMinutes: 0,

    status: "completed",
  };

  const allocation: CompensationAllocation = {
    id: `allocation-${obligation.id}-${rest.id}`,

    obligationId: obligation.id,

    sourceWeekNumber: obligation.sourceWeekNumber,

    restId: rest.id,

    date: rest.date,

    availableCompensationMinutes,

    appliedMinutes,

    remainingMinutesAfter: 0,
  };

  events.push({
    id: `${allocation.id}-applied`,

    type: "compensation-applied",

    date: rest.date,

    deadline: obligation.dueDate,

    sourceWeekNumber: obligation.sourceWeekNumber,

    sourceObligationId: obligation.id,

    allocationRestId: rest.id,

    minutes: appliedMinutes,

    remainingMinutes: 0,

    message:
      `${appliedMinutes} minutes of weekly-rest ` +
      `compensation were applied en bloc from rest ${rest.id}. ` +
      `Original deadline: ${obligation.dueDate}.`,
  });

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
      `${obligation.sourceWeekNumber} was fully cleared en bloc. ` +
      `Original deadline: ${obligation.dueDate}.`,
  });

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
