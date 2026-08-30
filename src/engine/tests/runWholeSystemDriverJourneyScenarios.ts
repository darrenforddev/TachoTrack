import type { ActivityHistoryEvent } from "../../data/activityHistory";
import { buildLiveDriverDay } from "../../data/liveDriverDayAdapter";
import type { RestSession } from "../../data/restSession";

import {
    getCalendarEventsForDate,
    getWorstCalendarSeverity,
    toCalendarComplianceEvents,
} from "../calendarComplianceEvents";
import { evaluateDriverDay } from "../complianceEngine";
import { calculateFortnightlyDrivingState } from "../fortnightlyDrivingState";
import { buildRestCompensationCurrentState } from "../restCompensationCurrentState";
import type { DriverDay } from "../types";
import { calculateWeeklyDrivingState } from "../weeklyDrivingState";
import { buildWeeklyRestCompensationTimeline } from "../weeklyRestCompensationTimeline";
import { resolveWeeklyRestWeekAssignment } from "../weeklyRestWeekAssignment";
import { confirmWeeklyRestWeekAssignment } from "../weeklyRestWeekAssignmentDecision";

interface JourneyScenarioResult {
  name: string;
  passed: boolean;
  details: string;
}

function result(
  name: string,
  passed: boolean,
  details: string,
): JourneyScenarioResult {
  return {
    name,
    passed,
    details,
  };
}

function completedWeeklyRest(
  id: string,
  startedAt: string,
  endedAt: string,
): RestSession {
  const startMilliseconds = new Date(startedAt).getTime();
  const endMilliseconds = new Date(endedAt).getTime();

  return {
    id,
    type: "weekly",
    startedAt,
    endedAt,
    durationMilliseconds: endMilliseconds - startMilliseconds,
    status: "completed",
  };
}

const scenarios: JourneyScenarioResult[] = [];

/**
 * --------------------------------------------------
 * DRIVER JOURNEY: LIVE SHIFT
 * --------------------------------------------------
 *
 * 06:00 - 07:00 Other Work
 * 07:00 - 11:30 Driving
 * 11:30 - 12:15 Break
 * 12:15 - 16:15 Active Driving
 */
const liveNow = new Date("2026-08-24T16:15:00.000Z").getTime();

const activityEvents: ActivityHistoryEvent[] = [
  {
    id: "journey-other-work",
    activity: "other-work",
    startedAt: "2026-08-24T06:00:00.000Z",
    endedAt: "2026-08-24T07:00:00.000Z",
    durationMilliseconds: 60 * 60 * 1000,
    source: "manual",
  },
  {
    id: "journey-driving-one",
    activity: "driving",
    startedAt: "2026-08-24T07:00:00.000Z",
    endedAt: "2026-08-24T11:30:00.000Z",
    durationMilliseconds: 4.5 * 60 * 60 * 1000,
    source: "manual",
  },
  {
    id: "journey-break",
    activity: "break",
    startedAt: "2026-08-24T11:30:00.000Z",
    endedAt: "2026-08-24T12:15:00.000Z",
    durationMilliseconds: 45 * 60 * 1000,
    source: "manual",
  },
  {
    id: "journey-driving-active",
    activity: "driving",
    startedAt: "2026-08-24T12:15:00.000Z",
    endedAt: null,
    durationMilliseconds: null,
    source: "manual",
  },
];

const liveDay = buildLiveDriverDay(activityEvents, liveNow);

const activeDriving = liveDay.activities.find((activity) =>
  activity.id.startsWith("journey-driving-active-"),
);

scenarios.push(
  result(
    "Live activity history builds exact driver-day totals",
    liveDay.drivingMinutes === 8.5 * 60 &&
      liveDay.otherWorkMinutes === 60 &&
      liveDay.breakMinutes === 45 &&
      liveDay.poaMinutes === 0,
    `Driving: ${liveDay.drivingMinutes}, work: ${liveDay.otherWorkMinutes}, break: ${liveDay.breakMinutes}`,
  ),
);

scenarios.push(
  result(
    "Active driving is snapshotted at the journey time",
    activeDriving?.end === "2026-08-24T16:15:00.000Z" &&
      activeDriving.durationMinutes === 4 * 60,
    `End: ${activeDriving?.end}, duration: ${activeDriving?.durationMinutes ?? 0}`,
  ),
);

const liveCompliance = evaluateDriverDay(liveDay, {
  isLiveDay: true,
});

scenarios.push(
  result(
    "Live compliance does not manufacture a daily-rest breach",
    liveCompliance.issues.every((issue) => issue.rule !== "daily-rest"),
    `Daily-rest issues: ${liveCompliance.issues.filter((issue) => issue.rule === "daily-rest").length}`,
  ),
);

const weeklyDrivingState = calculateWeeklyDrivingState([liveDay]);

scenarios.push(
  result(
    "Live driver day feeds the weekly driving state",
    weeklyDrivingState.drivingMinutesUsed === 8.5 * 60 &&
      weeklyDrivingState.remainingMinutes === 47.5 * 60,
    `Used: ${weeklyDrivingState.drivingMinutesUsed}, remaining: ${weeklyDrivingState.remainingMinutes}`,
  ),
);

const previousWeekDay: DriverDay = {
  ...liveDay,
  id: "journey-previous-week-day",
  date: "2026-08-17",
  activities: [],
  drivingMinutes: 40 * 60,
};

const fortnightlyDrivingState = calculateFortnightlyDrivingState(
  [previousWeekDay],
  [liveDay],
);

scenarios.push(
  result(
    "Previous and current weeks feed the fortnight state",
    fortnightlyDrivingState.previousWeekDrivingMinutes === 40 * 60 &&
      fortnightlyDrivingState.currentWeekDrivingMinutes === 8.5 * 60 &&
      fortnightlyDrivingState.drivingMinutesUsed === 48.5 * 60,
    `Previous: ${fortnightlyDrivingState.previousWeekDrivingMinutes}, current: ${fortnightlyDrivingState.currentWeekDrivingMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * DRIVER JOURNEY: WEEKLY REST AND COMPENSATION
 * --------------------------------------------------
 */
const reducedWeeklyRest = completedWeeklyRest(
  "journey-reduced-weekly-rest",
  "2026-08-29T12:00:00.000Z",
  "2026-08-30T12:00:00.000Z",
);

const spanningCompensationRest = completedWeeklyRest(
  "journey-spanning-66h-weekly-rest",
  "2026-09-11T12:00:00.000Z",
  "2026-09-14T06:00:00.000Z",
);

const unconfirmedTimeline = buildWeeklyRestCompensationTimeline(
  [reducedWeeklyRest, spanningCompensationRest],
  [],
  "2026-09-14",
);

const unconfirmedObligation = unconfirmedTimeline.obligations[0];

scenarios.push(
  result(
    "Reduced weekly rest creates the exact 21-hour obligation",
    unconfirmedTimeline.obligations.length === 1 &&
      unconfirmedObligation?.requiredCompensationMinutes === 21 * 60 &&
      unconfirmedObligation.remainingMinutes === 21 * 60,
    `Obligations: ${unconfirmedTimeline.obligations.length}, remaining: ${unconfirmedObligation?.remainingMinutes ?? 0}`,
  ),
);

scenarios.push(
  result(
    "Spanning compensation rest remains pending without confirmation",
    unconfirmedTimeline.pendingAssignments.some(
      (assignment) => assignment.restSessionId === spanningCompensationRest.id,
    ),
    `Pending assignments: ${unconfirmedTimeline.pendingAssignments.length}`,
  ),
);

scenarios.push(
  result(
    "Unconfirmed spanning rest cannot clear compensation",
    unconfirmedObligation?.status === "outstanding" &&
      !unconfirmedTimeline.events.some(
        (event) => event.type === "compensation-cleared",
      ),
    `Status: ${unconfirmedObligation?.status}, events: ${unconfirmedTimeline.events.map((event) => event.type).join(", ")}`,
  ),
);

const spanningAssignment = resolveWeeklyRestWeekAssignment(
  spanningCompensationRest,
);

const selectedWeek = spanningAssignment.options[0];

if (
  spanningAssignment.status !== "confirmation-required" ||
  selectedWeek === undefined
) {
  throw new Error(
    "Golden journey fixture did not create a two-week assignment choice.",
  );
}

const lockedDecision = confirmWeeklyRestWeekAssignment(
  spanningAssignment,
  selectedWeek.weekStartDate,
  "2026-09-14T06:05:00.000Z",
);

if (lockedDecision === null) {
  throw new Error("Golden journey could not create a locked assignment.");
}

scenarios.push(
  result(
    "Driver confirmation creates a locked auditable decision",
    lockedDecision.locked === true &&
      lockedDecision.decisionSource === "driver-confirmed" &&
      lockedDecision.restSessionId === spanningCompensationRest.id,
    `Source: ${lockedDecision.decisionSource}, locked: ${lockedDecision.locked}`,
  ),
);

const completedTimeline = buildWeeklyRestCompensationTimeline(
  [reducedWeeklyRest, spanningCompensationRest],
  [lockedDecision],
  "2026-09-14",
);

const completedObligation = completedTimeline.obligations[0];

scenarios.push(
  result(
    "Confirmed 66-hour rest clears the 21-hour debt en bloc",
    completedObligation?.status === "completed" &&
      completedObligation.remainingMinutes === 0 &&
      completedObligation.compensatedMinutes === 21 * 60,
    `Status: ${completedObligation?.status}, remaining: ${completedObligation?.remainingMinutes ?? 0}`,
  ),
);

const currentState = completedObligation
  ? buildRestCompensationCurrentState(
      completedTimeline.events,
      completedObligation.id,
    )
  : null;

scenarios.push(
  result(
    "Audit events rebuild the cleared current state",
    currentState?.status === "cleared" &&
      currentState.remainingMinutes === 0 &&
      currentState.totalAppliedMinutes === 21 * 60,
    `Status: ${currentState?.status}, applied: ${currentState?.totalAppliedMinutes ?? 0}`,
  ),
);

const calendarEvents = toCalendarComplianceEvents(completedTimeline.events);

const clearedCalendarEvent = calendarEvents.find(
  (event) => event.severity === "good",
);

const eventsOnClearedDate = clearedCalendarEvent
  ? getCalendarEventsForDate(calendarEvents, clearedCalendarEvent.date)
  : [];

scenarios.push(
  result(
    "Completed compensation reaches the calendar as compliant",
    clearedCalendarEvent !== undefined &&
      getWorstCalendarSeverity(eventsOnClearedDate) === "good",
    `Date: ${clearedCalendarEvent?.date}, severity: ${getWorstCalendarSeverity(eventsOnClearedDate)}`,
  ),
);

const overdueTimeline = buildWeeklyRestCompensationTimeline(
  [reducedWeeklyRest],
  [],
  "2026-09-21",
);

const overdueCalendarEvents = toCalendarComplianceEvents(
  overdueTimeline.events,
);

const overdueEvent = overdueCalendarEvents.find(
  (event) => event.severity === "breach",
);

scenarios.push(
  result(
    "Uncleared compensation becomes an overdue calendar breach",
    overdueTimeline.obligations[0]?.status === "overdue" &&
      overdueEvent !== undefined &&
      getWorstCalendarSeverity(
        getCalendarEventsForDate(overdueCalendarEvents, overdueEvent.date),
      ) === "breach",
    `Status: ${overdueTimeline.obligations[0]?.status}, date: ${overdueEvent?.date}`,
  ),
);

const passed = scenarios.filter((scenario) => scenario.passed).length;
const failed = scenarios.length - passed;

console.log("============================================================");
console.log("TACHOTRACK WHOLE-SYSTEM DRIVER JOURNEY TESTS");
console.log("============================================================");

for (const scenario of scenarios) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);
  console.log(`   ${scenario.details}`);
  console.log("----------------------------------------");
}

console.log(
  `WHOLE-SYSTEM DRIVER JOURNEY RESULT: ${passed}/${scenarios.length} passed`,
);

if (failed > 0) {
  console.log("❌ SOME WHOLE-SYSTEM DRIVER JOURNEY SCENARIOS FAILED");

  throw new Error(`${failed} whole-system driver journey scenarios failed.`);
}

console.log("✅ ALL WHOLE-SYSTEM DRIVER JOURNEY SCENARIOS PASSED");
console.log("============================================================");
