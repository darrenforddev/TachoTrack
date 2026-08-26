import type { RestCompensationCalendarEvent } from "./weeklyRestCompensationAllocation";

export type CalendarComplianceSeverity = "good" | "warning" | "breach" | "info";

export type CalendarComplianceCategory = "weekly-rest-compensation";

export interface CalendarComplianceEvent {
  id: string;

  date: string;

  category: CalendarComplianceCategory;

  severity: CalendarComplianceSeverity;

  title: string;

  summary: string;

  sourceWeekNumber: number;

  sourceObligationId: string;

  allocationRestId?: string;

  /**
   * Original legal compensation deadline.
   *
   * YYYY-MM-DD
   */
  deadline?: string;

  minutes: number;

  remainingMinutes: number;

  showOnDay: boolean;

  showInDiary: boolean;

  drillDownAvailable: boolean;
}

/**
 * --------------------------------------------------
 * EVENT SEVERITY
 * --------------------------------------------------
 */
export function mapCompensationEventSeverity(
  event: RestCompensationCalendarEvent,
): CalendarComplianceSeverity {
  switch (event.type) {
    case "compensation-created":
      return "warning";

    case "compensation-applied":
      return "info";

    case "compensation-cleared":
      return "good";

    case "compensation-overdue":
      return "breach";
  }
}

/**
 * --------------------------------------------------
 * EVENT TITLE
 * --------------------------------------------------
 */
export function mapCompensationEventTitle(
  event: RestCompensationCalendarEvent,
): string {
  switch (event.type) {
    case "compensation-created":
      return "Rest Compensation Created";

    case "compensation-applied":
      return "Rest Compensation Applied";

    case "compensation-cleared":
      return "Rest Compensation Cleared";

    case "compensation-overdue":
      return "Rest Compensation Missed";
  }
}

/**
 * --------------------------------------------------
 * EVENT SUMMARY
 * --------------------------------------------------
 */
export function mapCompensationEventSummary(
  event: RestCompensationCalendarEvent,
): string {
  switch (event.type) {
    case "compensation-created":
      return (
        `${event.minutes} minutes of weekly-rest ` +
        `compensation were created from Week ` +
        `${event.sourceWeekNumber}.` +
        (event.deadline ? ` Due by ${event.deadline}.` : "")
      );

    case "compensation-applied":
      return (
        `${event.minutes} minutes of compensation ` +
        `were applied to the Week ` +
        `${event.sourceWeekNumber} obligation. ` +
        `${event.remainingMinutes} minutes remain.` +
        (event.deadline ? ` Original deadline: ${event.deadline}.` : "")
      );

    case "compensation-cleared":
      return (
        `Weekly-rest compensation from Week ` +
        `${event.sourceWeekNumber} was fully cleared.` +
        (event.deadline ? ` Original deadline: ${event.deadline}.` : "")
      );

    case "compensation-overdue":
      return (
        `${event.remainingMinutes} minutes of weekly-rest ` +
        `compensation from Week ${event.sourceWeekNumber} ` +
        `remained outstanding after the deadline` +
        (event.deadline ? ` of ${event.deadline}.` : ".")
      );
  }
}

/**
 * --------------------------------------------------
 * SINGLE EVENT ADAPTER
 * --------------------------------------------------
 */
export function toCalendarComplianceEvent(
  event: RestCompensationCalendarEvent,
): CalendarComplianceEvent {
  return {
    id: `calendar-${event.id}`,

    date: event.date,

    category: "weekly-rest-compensation",

    severity: mapCompensationEventSeverity(event),

    title: mapCompensationEventTitle(event),

    summary: mapCompensationEventSummary(event),

    sourceWeekNumber: event.sourceWeekNumber,

    sourceObligationId: event.sourceObligationId,

    allocationRestId: event.allocationRestId,

    deadline: event.deadline,

    minutes: event.minutes,

    remainingMinutes: event.remainingMinutes,

    showOnDay: true,

    showInDiary: true,

    drillDownAvailable: true,
  };
}

/**
 * --------------------------------------------------
 * MULTIPLE EVENT ADAPTER
 * --------------------------------------------------
 */
export function toCalendarComplianceEvents(
  events: RestCompensationCalendarEvent[],
): CalendarComplianceEvent[] {
  return events.map(toCalendarComplianceEvent);
}

/**
 * --------------------------------------------------
 * EVENTS FOR ONE DAY
 * --------------------------------------------------
 */
export function getCalendarEventsForDate(
  events: CalendarComplianceEvent[],
  date: string,
): CalendarComplianceEvent[] {
  return events.filter((event) => event.date === date);
}

/**
 * --------------------------------------------------
 * WORST SEVERITY FOR A DAY
 * --------------------------------------------------
 */
export function getWorstCalendarSeverity(
  events: CalendarComplianceEvent[],
): CalendarComplianceSeverity {
  if (events.some((event) => event.severity === "breach")) {
    return "breach";
  }

  if (events.some((event) => event.severity === "warning")) {
    return "warning";
  }

  if (events.some((event) => event.severity === "good")) {
    return "good";
  }

  return "info";
}

/**
 * --------------------------------------------------
 * CALENDAR BADGE
 * --------------------------------------------------
 */
export function getCalendarEventBadge(event: CalendarComplianceEvent): string {
  switch (event.severity) {
    case "good":
      return "✓C";

    case "warning":
      return "C";

    case "breach":
      return "!C";

    case "info":
      return "C+";
  }
}
