import type { RestCompensationCalendarEvent } from "../weeklyRestCompensationAllocation";

import {
    getCalendarEventBadge,
    getCalendarEventsForDate,
    getWorstCalendarSeverity,
    mapCompensationEventSeverity,
    mapCompensationEventSummary,
    mapCompensationEventTitle,
    toCalendarComplianceEvent,
    toCalendarComplianceEvents,
} from "../calendarComplianceEvents";

type ScenarioResult = {
  name: string;
  passed: boolean;
  details: string;
};

function result(
  name: string,
  passed: boolean,
  details: string,
): ScenarioResult {
  return {
    name,
    passed,
    details,
  };
}

const scenarios: ScenarioResult[] = [];

const createdEvent: RestCompensationCalendarEvent = {
  id: "created-1",
  type: "compensation-created",
  date: "2026-08-30",
  sourceWeekNumber: 35,
  sourceObligationId: "week-35-obligation",
  minutes: 9 * 60,
  remainingMinutes: 9 * 60,
  message: "Compensation created.",
};

const appliedEvent: RestCompensationCalendarEvent = {
  id: "applied-1",
  type: "compensation-applied",
  date: "2026-09-12",
  sourceWeekNumber: 35,
  sourceObligationId: "week-35-obligation",
  allocationRestId: "rest-54h",
  minutes: 6 * 60,
  remainingMinutes: 3 * 60,
  message: "Compensation applied.",
};

const clearedEvent: RestCompensationCalendarEvent = {
  id: "cleared-1",
  type: "compensation-cleared",
  date: "2026-09-19",
  sourceWeekNumber: 35,
  sourceObligationId: "week-35-obligation",
  allocationRestId: "rest-48h",
  minutes: 3 * 60,
  remainingMinutes: 0,
  message: "Compensation cleared.",
};

const overdueEvent: RestCompensationCalendarEvent = {
  id: "overdue-1",
  type: "compensation-overdue",
  date: "2026-09-20",
  sourceWeekNumber: 36,
  sourceObligationId: "week-36-obligation",
  minutes: 4 * 60,
  remainingMinutes: 4 * 60,
  message: "Compensation overdue.",
};

/**
 * --------------------------------------------------
 * SCENARIO 1
 * Created event maps to warning.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Created compensation maps to warning",
    mapCompensationEventSeverity(createdEvent) === "warning",
    `Severity: ${mapCompensationEventSeverity(createdEvent)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 * Applied event maps to info.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Applied compensation maps to info",
    mapCompensationEventSeverity(appliedEvent) === "info",
    `Severity: ${mapCompensationEventSeverity(appliedEvent)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 * Cleared event maps to good.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Cleared compensation maps to good",
    mapCompensationEventSeverity(clearedEvent) === "good",
    `Severity: ${mapCompensationEventSeverity(clearedEvent)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 * Overdue event maps to breach.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Overdue compensation maps to breach",
    mapCompensationEventSeverity(overdueEvent) === "breach",
    `Severity: ${mapCompensationEventSeverity(overdueEvent)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 * Titles are presentation friendly.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Cleared event gets correct title",
    mapCompensationEventTitle(clearedEvent) === "Rest Compensation Cleared",
    `Title: ${mapCompensationEventTitle(clearedEvent)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 * Summary preserves source week.
 * --------------------------------------------------
 */
const clearedSummary = mapCompensationEventSummary(clearedEvent);

scenarios.push(
  result(
    "Cleared summary references source week",
    clearedSummary.includes("Week 35"),
    `Summary: ${clearedSummary}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 * Single adapter preserves source data.
 * --------------------------------------------------
 */
const adaptedCreated = toCalendarComplianceEvent(createdEvent);

scenarios.push(
  result(
    "Single adapter preserves source obligation",
    adaptedCreated.sourceWeekNumber === 35 &&
      adaptedCreated.sourceObligationId === "week-35-obligation" &&
      adaptedCreated.date === "2026-08-30",
    `Week: ${adaptedCreated.sourceWeekNumber}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 * Multiple adapter preserves count.
 * --------------------------------------------------
 */
const adaptedEvents = toCalendarComplianceEvents([
  createdEvent,
  appliedEvent,
  clearedEvent,
  overdueEvent,
]);

scenarios.push(
  result(
    "Multiple adapter preserves all events",
    adaptedEvents.length === 4,
    `Events: ${adaptedEvents.length}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 * Date filtering returns only matching day.
 * --------------------------------------------------
 */
const eventsOnSep19 = getCalendarEventsForDate(adaptedEvents, "2026-09-19");

scenarios.push(
  result(
    "Date filter returns exact day event",
    eventsOnSep19.length === 1 &&
      eventsOnSep19[0].title === "Rest Compensation Cleared",
    `Events: ${eventsOnSep19.length}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 * Breach dominates day severity.
 * --------------------------------------------------
 */
const mixedDay = [
  toCalendarComplianceEvent(clearedEvent),
  toCalendarComplianceEvent(overdueEvent),
];

scenarios.push(
  result(
    "Breach dominates good event on same day",
    getWorstCalendarSeverity(mixedDay) === "breach",
    `Severity: ${getWorstCalendarSeverity(mixedDay)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 11
 * Warning dominates good/info.
 * --------------------------------------------------
 */
const warningDay = [
  toCalendarComplianceEvent(clearedEvent),
  toCalendarComplianceEvent(appliedEvent),
  toCalendarComplianceEvent(createdEvent),
];

scenarios.push(
  result(
    "Warning dominates good and info",
    getWorstCalendarSeverity(warningDay) === "warning",
    `Severity: ${getWorstCalendarSeverity(warningDay)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 12
 * Good dominates info.
 * --------------------------------------------------
 */
const goodDay = [
  toCalendarComplianceEvent(appliedEvent),
  toCalendarComplianceEvent(clearedEvent),
];

scenarios.push(
  result(
    "Good dominates info",
    getWorstCalendarSeverity(goodDay) === "good",
    `Severity: ${getWorstCalendarSeverity(goodDay)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 13
 * Applied-only day remains informational.
 * --------------------------------------------------
 */
const infoDay = [toCalendarComplianceEvent(appliedEvent)];

scenarios.push(
  result(
    "Applied-only day remains info",
    getWorstCalendarSeverity(infoDay) === "info",
    `Severity: ${getWorstCalendarSeverity(infoDay)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 14
 * Good event badge.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Cleared event gets ✓C badge",
    getCalendarEventBadge(toCalendarComplianceEvent(clearedEvent)) === "✓C",
    `Badge: ${getCalendarEventBadge(toCalendarComplianceEvent(clearedEvent))}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 15
 * Breach event badge.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Overdue event gets !C badge",
    getCalendarEventBadge(toCalendarComplianceEvent(overdueEvent)) === "!C",
    `Badge: ${getCalendarEventBadge(toCalendarComplianceEvent(overdueEvent))}`,
  ),
);

export const calendarComplianceEventScenarioResults = scenarios;

export const calendarComplianceEventScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
