import type {
    WeeklyRestAssignmentDecisionSource,
    WeeklyRestWeekAssignmentDecision,
} from "./weeklyRestWeekAssignmentDecision";

const VALID_DECISION_SOURCES = new Set<WeeklyRestAssignmentDecisionSource>([
  "automatic",
  "driver-confirmed",
  "jess-recommended-driver-confirmed",
  "driver-overrode-jess-recommendation",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const timestamp = new Date(`${value}T00:00:00.000Z`).getTime();

  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

function isValidTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" && Number.isFinite(new Date(value).getTime())
  );
}

function isValidWeekReference(
  value: unknown,
): value is WeeklyRestWeekAssignmentDecision["selectedWeek"] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isInteger(value.isoYear) &&
    Number.isInteger(value.isoWeekNumber) &&
    (value.isoWeekNumber as number) >= 1 &&
    (value.isoWeekNumber as number) <= 53 &&
    isValidDateOnly(value.weekStartDate) &&
    isValidDateOnly(value.weekEndDate) &&
    (value.weekStartDate as string) <= (value.weekEndDate as string)
  );
}

export function isWeeklyRestWeekAssignmentDecision(
  value: unknown,
): value is WeeklyRestWeekAssignmentDecision {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.restSessionId !== "string" ||
    value.restSessionId.length === 0 ||
    !isValidWeekReference(value.selectedWeek) ||
    !Array.isArray(value.availableWeekStartDates) ||
    value.availableWeekStartDates.length < 1 ||
    value.availableWeekStartDates.length > 2 ||
    !value.availableWeekStartDates.every(isValidDateOnly) ||
    new Set(value.availableWeekStartDates).size !==
      value.availableWeekStartDates.length ||
    !VALID_DECISION_SOURCES.has(
      value.decisionSource as WeeklyRestAssignmentDecisionSource,
    ) ||
    !isValidTimestamp(value.confirmedAt) ||
    value.locked !== true
  ) {
    return false;
  }

  const availableWeekStartDates = value.availableWeekStartDates as string[];

  const selectedWeekStartDate = value.selectedWeek.weekStartDate;

  if (!availableWeekStartDates.includes(selectedWeekStartDate)) {
    return false;
  }

  if (
    value.recommendedWeekStartDate !== null &&
    !isValidDateOnly(value.recommendedWeekStartDate)
  ) {
    return false;
  }

  if (
    value.recommendedWeekStartDate !== null &&
    !availableWeekStartDates.includes(value.recommendedWeekStartDate)
  ) {
    return false;
  }

  const decisionSource =
    value.decisionSource as WeeklyRestAssignmentDecisionSource;

  if (
    decisionSource === "automatic" &&
    (availableWeekStartDates.length !== 1 ||
      value.recommendedWeekStartDate !== null)
  ) {
    return false;
  }

  if (
    decisionSource === "driver-confirmed" &&
    value.recommendedWeekStartDate !== null
  ) {
    return false;
  }

  if (
    (decisionSource === "jess-recommended-driver-confirmed" ||
      decisionSource === "driver-overrode-jess-recommendation") &&
    value.recommendedWeekStartDate === null
  ) {
    return false;
  }

  if (
    decisionSource === "jess-recommended-driver-confirmed" &&
    value.recommendedWeekStartDate !== selectedWeekStartDate
  ) {
    return false;
  }

  if (
    decisionSource === "driver-overrode-jess-recommendation" &&
    value.recommendedWeekStartDate === selectedWeekStartDate
  ) {
    return false;
  }

  return true;
}

export interface ParsedWeeklyRestAssignmentDecisions {
  decisions: WeeklyRestWeekAssignmentDecision[];

  recoveredInvalidData: boolean;
}

export function parseWeeklyRestAssignmentDecisions(
  value: unknown,
): ParsedWeeklyRestAssignmentDecisions {
  if (!Array.isArray(value)) {
    return {
      decisions: [],

      recoveredInvalidData: true,
    };
  }

  const decisions: WeeklyRestWeekAssignmentDecision[] = [];

  const seenRestSessionIds = new Set<string>();

  let recoveredInvalidData = false;

  for (const candidate of value) {
    if (!isWeeklyRestWeekAssignmentDecision(candidate)) {
      recoveredInvalidData = true;

      continue;
    }

    if (seenRestSessionIds.has(candidate.restSessionId)) {
      recoveredInvalidData = true;

      continue;
    }

    seenRestSessionIds.add(candidate.restSessionId);

    decisions.push(candidate);
  }

  return {
    decisions,

    recoveredInvalidData,
  };
}
