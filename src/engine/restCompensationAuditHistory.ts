import type { RestCompensationCalendarEvent } from "./weeklyRestCompensationAllocation";

export interface RestCompensationAuditHistoryItem {
  id: string;

  date: string;

  type: RestCompensationCalendarEvent["type"];

  sourceWeekNumber: number;

  title: string;

  description: string;

  minutes: number;

  remainingMinutes: number;

  deadline?: string;
}

/**
 * Convert one compensation engine event into
 * a driver-facing audit-history item.
 */
export function toRestCompensationAuditHistoryItem(
  event: RestCompensationCalendarEvent,
): RestCompensationAuditHistoryItem {
  let title: string;

  switch (event.type) {
    case "compensation-created":
      title = "Compensation created";
      break;

    case "compensation-applied":
      title = "Compensation applied";
      break;

    case "compensation-cleared":
      title = "Compensation cleared";
      break;

    case "compensation-overdue":
      title = "Compensation deadline missed";
      break;
  }

  return {
    id: event.id,

    date: event.date,

    type: event.type,

    sourceWeekNumber: event.sourceWeekNumber,

    title,

    description: event.message,

    minutes: event.minutes,

    remainingMinutes: event.remainingMinutes,

    deadline: event.deadline,
  };
}

/**
 * Build the complete history for one
 * compensation obligation.
 *
 * Events are sorted oldest → newest so the
 * driver can read the story chronologically.
 */
export function buildRestCompensationAuditHistory(
  events: RestCompensationCalendarEvent[],
  obligationId: string,
): RestCompensationAuditHistoryItem[] {
  return events
    .filter((event) => event.sourceObligationId === obligationId)
    .map(toRestCompensationAuditHistoryItem)
    .sort((a, b) => a.date.localeCompare(b.date));
}
