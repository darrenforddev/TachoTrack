import type { RestSession } from "../data/restSession";

import type { WeeklyRestWeekAssignmentDecision } from "./weeklyRestWeekAssignmentDecision";

import {
    createCompensationCreatedEvent,
    createCompensationOverdueEvent,
    type RestCompensationCalendarEvent,
} from "./weeklyRestCompensationAllocation";

import {
    buildWeeklyRestCompensationEvidence,
    type WeeklyRestCompensationEvidence,
} from "./weeklyRestCompensationEvidence";

import { getWeeklyRestCompensationStatus } from "./weeklyRestCompensation";

import { createWeeklyRestRecord } from "./weeklyRestHistory";

import {
    coordinateWeeklyRestObligation,
    synchroniseCoordinatedWeeklyRestObligation,
    type CoordinatedWeeklyRestObligation,
} from "./weeklyRestObligationCoordinator";

import {
    resolveWeeklyRestWeekAssignment,
    type IsoWeekReference,
    type WeeklyRestWeekAssignmentResult,
} from "./weeklyRestWeekAssignment";

import {
    allocateVerifiedCompensationAcrossObligations,
    type VerifiedMultiObligationAllocationResult,
} from "./verifiedWeeklyRestMultiObligationAllocation";

export interface WeeklyRestCompensationTimeline {
  obligations: CoordinatedWeeklyRestObligation[];

  events: RestCompensationCalendarEvent[];

  evidence: WeeklyRestCompensationEvidence[];

  assignmentResults: WeeklyRestWeekAssignmentResult[];

  pendingAssignments: WeeklyRestWeekAssignmentResult[];

  rejectedAssignments: WeeklyRestWeekAssignmentResult[];

  allocationRuns: VerifiedMultiObligationAllocationResult[];

  totalOutstandingCompensationMinutes: number;

  hasOutstandingCompensation: boolean;

  hasPendingAssignments: boolean;
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const timestamp = new Date(`${value}T00:00:00.000Z`).getTime();

  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

function addOneUtcDay(date: string): string {
  const timestamp = new Date(`${date}T00:00:00.000Z`).getTime();

  return new Date(timestamp + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function sessionEndTimestamp(session: RestSession): number {
  if (session.endedAt === null) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(session.endedAt).getTime();

  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function findApplicableDecisionWeek(
  assignment: WeeklyRestWeekAssignmentResult,
  decisions: WeeklyRestWeekAssignmentDecision[],
): IsoWeekReference | null {
  const decision = decisions.find(
    (candidate) => candidate.restSessionId === assignment.restSessionId,
  );

  if (decision === undefined || decision.locked !== true) {
    return null;
  }

  return (
    assignment.options.find(
      (option) =>
        option.weekStartDate === decision.selectedWeek.weekStartDate &&
        option.isoYear === decision.selectedWeek.isoYear &&
        option.isoWeekNumber === decision.selectedWeek.isoWeekNumber,
    ) ?? null
  );
}

function sortCalendarEvents(
  events: RestCompensationCalendarEvent[],
): RestCompensationCalendarEvent[] {
  const eventOrder: Record<RestCompensationCalendarEvent["type"], number> = {
    "compensation-created": 0,

    "compensation-applied": 1,

    "compensation-cleared": 2,

    "compensation-overdue": 3,
  };

  return [...events].sort((a, b) => {
    const dateDifference = a.date.localeCompare(b.date);

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return eventOrder[a.type] - eventOrder[b.type];
  });
}

export function buildWeeklyRestCompensationTimeline(
  sessions: RestSession[],
  decisions: WeeklyRestWeekAssignmentDecision[],
  currentDate: string,
): WeeklyRestCompensationTimeline {
  if (!isValidDateOnly(currentDate)) {
    throw new Error("A valid YYYY-MM-DD current date is required.");
  }

  const chronologicalSessions = [...sessions].sort(
    (a, b) => sessionEndTimestamp(a) - sessionEndTimestamp(b),
  );

  const weeklySessions = chronologicalSessions.filter(
    (session) => session.type === "weekly",
  );

  const assignmentResults = weeklySessions.map(resolveWeeklyRestWeekAssignment);

  const assignedWeekBySessionId = new Map<string, IsoWeekReference>();

  const pendingAssignments: WeeklyRestWeekAssignmentResult[] = [];

  const rejectedAssignments: WeeklyRestWeekAssignmentResult[] = [];

  for (const assignment of assignmentResults) {
    if (assignment.status === "automatic" && assignment.assignedWeek !== null) {
      assignedWeekBySessionId.set(
        assignment.restSessionId,
        assignment.assignedWeek,
      );

      continue;
    }

    if (assignment.status === "confirmation-required") {
      const selectedWeek = findApplicableDecisionWeek(assignment, decisions);

      if (selectedWeek === null) {
        pendingAssignments.push(assignment);
      } else {
        assignedWeekBySessionId.set(assignment.restSessionId, selectedWeek);
      }

      continue;
    }

    rejectedAssignments.push(assignment);
  }

  const obligations: CoordinatedWeeklyRestObligation[] = [];

  const events: RestCompensationCalendarEvent[] = [];

  for (const session of weeklySessions) {
    if (session.status !== "completed" || session.endedAt === null) {
      continue;
    }

    const assignedWeek = assignedWeekBySessionId.get(session.id);

    if (assignedWeek === undefined) {
      continue;
    }

    const weeklyRest = createWeeklyRestRecord(
      session.id,
      session.startedAt,
      session.endedAt,
    );

    if (weeklyRest === null) {
      continue;
    }

    const coordinated = coordinateWeeklyRestObligation({
      weeklyRest,

      sourceWeekNumber: assignedWeek.isoWeekNumber,

      sourceWeekReferenceDate: assignedWeek.weekEndDate,

      currentDate,
    });

    if (coordinated.obligation === null) {
      continue;
    }

    obligations.push(coordinated.obligation);

    events.push(createCompensationCreatedEvent(coordinated.obligation));
  }

  const evidence = buildWeeklyRestCompensationEvidence(chronologicalSessions);

  const sessionById = new Map(
    chronologicalSessions.map((session) => [session.id, session]),
  );

  const allocatableEvidence = evidence
    .filter((item) => {
      if (item.status !== "verified" || item.candidate === null) {
        return false;
      }

      const session = sessionById.get(item.sessionId);

      if (session === undefined) {
        return false;
      }

      /**
       * A weekly rest spanning two weeks cannot
       * supply compensation until its own week
       * assignment is confirmed.
       */
      if (
        session.type === "weekly" &&
        !assignedWeekBySessionId.has(session.id)
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const endA =
        a.candidate === null ? 0 : new Date(a.candidate.endedAt).getTime();

      const endB =
        b.candidate === null ? 0 : new Date(b.candidate.endedAt).getTime();

      return endA - endB;
    });

  let updatedObligations = obligations;

  const allocationRuns: VerifiedMultiObligationAllocationResult[] = [];

  for (const evidenceItem of allocatableEvidence) {
    const allocationRun = allocateVerifiedCompensationAcrossObligations(
      updatedObligations,
      evidenceItem,
    );

    updatedObligations = allocationRun.obligations;

    allocationRuns.push(allocationRun);

    events.push(...allocationRun.events);
  }

  updatedObligations = updatedObligations.map((obligation) => {
    const updatedStatus = getWeeklyRestCompensationStatus(
      obligation,
      currentDate,
    ) as CoordinatedWeeklyRestObligation;

    return synchroniseCoordinatedWeeklyRestObligation(updatedStatus);
  });

  for (const obligation of updatedObligations) {
    if (obligation.status !== "overdue") {
      continue;
    }

    const overdueEvent = createCompensationOverdueEvent(
      obligation,
      addOneUtcDay(obligation.dueDate),
    );

    if (overdueEvent !== null) {
      events.push(overdueEvent);
    }
  }

  const totalOutstandingCompensationMinutes = updatedObligations.reduce(
    (total, obligation) => total + obligation.remainingMinutes,
    0,
  );

  return {
    obligations: updatedObligations,

    events: sortCalendarEvents(events),

    evidence,

    assignmentResults,

    pendingAssignments,

    rejectedAssignments,

    allocationRuns,

    totalOutstandingCompensationMinutes,

    hasOutstandingCompensation: totalOutstandingCompensationMinutes > 0,

    hasPendingAssignments: pendingAssignments.length > 0,
  };
}
