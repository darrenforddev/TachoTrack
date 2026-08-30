import type {
    IsoWeekReference,
    WeeklyRestWeekAssignmentResult,
} from "./weeklyRestWeekAssignment";

export type WeeklyRestAssignmentDecisionSource =
  | "automatic"
  | "driver-confirmed"
  | "jess-recommended-driver-confirmed"
  | "driver-overrode-jess-recommendation";

export interface WeeklyRestWeekAssignmentDecision {
  restSessionId: string;

  selectedWeek: IsoWeekReference;

  availableWeekStartDates: string[];

  decisionSource: WeeklyRestAssignmentDecisionSource;

  recommendedWeekStartDate: string | null;

  confirmedAt: string;

  locked: true;
}

function isValidTimestamp(timestamp: string): boolean {
  return Number.isFinite(new Date(timestamp).getTime());
}

function findOption(
  assignment: WeeklyRestWeekAssignmentResult,
  weekStartDate: string,
): IsoWeekReference | null {
  return (
    assignment.options.find(
      (option) => option.weekStartDate === weekStartDate,
    ) ?? null
  );
}

export function createAutomaticWeeklyRestAssignmentDecision(
  assignment: WeeklyRestWeekAssignmentResult,
  recordedAt: string = new Date().toISOString(),
): WeeklyRestWeekAssignmentDecision | null {
  if (
    assignment.status !== "automatic" ||
    assignment.assignedWeek === null ||
    !isValidTimestamp(recordedAt)
  ) {
    return null;
  }

  return {
    restSessionId: assignment.restSessionId,

    selectedWeek: assignment.assignedWeek,

    availableWeekStartDates: assignment.options.map(
      (option) => option.weekStartDate,
    ),

    decisionSource: "automatic",

    recommendedWeekStartDate: null,

    confirmedAt: recordedAt,

    locked: true,
  };
}

export function confirmWeeklyRestWeekAssignment(
  assignment: WeeklyRestWeekAssignmentResult,
  selectedWeekStartDate: string,
  confirmedAt: string = new Date().toISOString(),
  recommendedWeekStartDate: string | null = null,
): WeeklyRestWeekAssignmentDecision | null {
  if (
    assignment.status !== "confirmation-required" ||
    !isValidTimestamp(confirmedAt)
  ) {
    return null;
  }

  const selectedWeek = findOption(assignment, selectedWeekStartDate);

  if (selectedWeek === null) {
    return null;
  }

  if (
    recommendedWeekStartDate !== null &&
    findOption(assignment, recommendedWeekStartDate) === null
  ) {
    return null;
  }

  let decisionSource: WeeklyRestAssignmentDecisionSource = "driver-confirmed";

  if (recommendedWeekStartDate !== null) {
    decisionSource =
      recommendedWeekStartDate === selectedWeekStartDate
        ? "jess-recommended-driver-confirmed"
        : "driver-overrode-jess-recommendation";
  }

  return {
    restSessionId: assignment.restSessionId,

    selectedWeek,

    availableWeekStartDates: assignment.options.map(
      (option) => option.weekStartDate,
    ),

    decisionSource,

    recommendedWeekStartDate,

    confirmedAt,

    locked: true,
  };
}

export function getWeeklyRestAssignmentDecision(
  decisions: WeeklyRestWeekAssignmentDecision[],
  restSessionId: string,
): WeeklyRestWeekAssignmentDecision | null {
  return (
    decisions.find((decision) => decision.restSessionId === restSessionId) ??
    null
  );
}

export function addLockedWeeklyRestAssignmentDecision(
  decisions: WeeklyRestWeekAssignmentDecision[],
  decision: WeeklyRestWeekAssignmentDecision,
): WeeklyRestWeekAssignmentDecision[] {
  const existing = getWeeklyRestAssignmentDecision(
    decisions,
    decision.restSessionId,
  );

  /**
   * Confirmed assignments are immutable.
   *
   * A future correction must use a separate,
   * explicit audit process rather than silently
   * overwriting the original decision.
   */
  if (existing !== null) {
    return decisions;
  }

  return [...decisions, decision];
}
