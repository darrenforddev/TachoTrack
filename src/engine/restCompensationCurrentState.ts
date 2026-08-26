import type { RestCompensationCalendarEvent } from "./weeklyRestCompensationAllocation";

export type RestCompensationCurrentStatus =
  | "outstanding"
  | "partially-applied"
  | "cleared"
  | "overdue";

export interface RestCompensationCurrentState {
  obligationId: string;

  sourceWeekNumber: number;

  originalRequiredMinutes: number;

  totalAppliedMinutes: number;

  remainingMinutes: number;

  deadline?: string;

  status: RestCompensationCurrentStatus;

  createdDate?: string;

  clearedDate?: string;

  overdueDate?: string;

  latestEventDate?: string;
}

/**
 * --------------------------------------------------
 * BUILD CURRENT OBLIGATION STATE
 * --------------------------------------------------
 *
 * This does not replace the audit history.
 *
 * The history tells us what happened.
 * This helper tells us the latest position.
 */
export function buildRestCompensationCurrentState(
  events: RestCompensationCalendarEvent[],
  obligationId: string,
): RestCompensationCurrentState | null {
  const obligationEvents = events
    .filter((event) => event.sourceObligationId === obligationId)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (obligationEvents.length === 0) {
    return null;
  }

  const createdEvent = obligationEvents.find(
    (event) => event.type === "compensation-created",
  );

  const appliedEvents = obligationEvents.filter(
    (event) => event.type === "compensation-applied",
  );

  const clearedEvent = obligationEvents
    .filter((event) => event.type === "compensation-cleared")
    .at(-1);

  const overdueEvent = obligationEvents
    .filter((event) => event.type === "compensation-overdue")
    .at(-1);

  const latestEvent = obligationEvents.at(-1);

  const originalRequiredMinutes =
    createdEvent?.minutes ?? obligationEvents[0].minutes;

  const totalAppliedMinutes = appliedEvents.reduce(
    (total, event) => total + event.minutes,
    0,
  );

  const remainingMinutes =
    latestEvent?.remainingMinutes ?? originalRequiredMinutes;

  let status: RestCompensationCurrentStatus = "outstanding";

  if (overdueEvent && remainingMinutes > 0) {
    status = "overdue";
  } else if (clearedEvent || remainingMinutes === 0) {
    status = "cleared";
  } else if (totalAppliedMinutes > 0) {
    status = "partially-applied";
  }

  return {
    obligationId,

    sourceWeekNumber:
      createdEvent?.sourceWeekNumber ?? obligationEvents[0].sourceWeekNumber,

    originalRequiredMinutes,

    totalAppliedMinutes,

    remainingMinutes,

    deadline: createdEvent?.deadline ?? latestEvent?.deadline,

    status,

    createdDate: createdEvent?.date,

    clearedDate: clearedEvent?.date,

    overdueDate: overdueEvent?.date,

    latestEventDate: latestEvent?.date,
  };
}
