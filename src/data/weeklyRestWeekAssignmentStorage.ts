import AsyncStorage from "@react-native-async-storage/async-storage";

import {
    addLockedWeeklyRestAssignmentDecision,
    getWeeklyRestAssignmentDecision,
    type WeeklyRestWeekAssignmentDecision,
} from "../engine/weeklyRestWeekAssignmentDecision";

import {
    isWeeklyRestWeekAssignmentDecision,
    parseWeeklyRestAssignmentDecisions,
} from "../engine/weeklyRestWeekAssignmentDecisionValidation";

const WEEKLY_REST_ASSIGNMENT_STORAGE_KEY =
  "@tachotrack/weekly-rest-week-assignments/v1";

interface StoredWeeklyRestAssignmentState {
  version: 1;

  savedAt: string;

  decisions: WeeklyRestWeekAssignmentDecision[];
}

export type WeeklyRestAssignmentLoadStatus =
  | "empty"
  | "loaded"
  | "recovered-invalid";

export interface LoadedWeeklyRestAssignments {
  decisions: WeeklyRestWeekAssignmentDecision[];

  status: WeeklyRestAssignmentLoadStatus;
}

export interface RecordWeeklyRestAssignmentResult {
  decisions: WeeklyRestWeekAssignmentDecision[];

  decision: WeeklyRestWeekAssignmentDecision;

  added: boolean;

  loadStatus: WeeklyRestAssignmentLoadStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" && Number.isFinite(new Date(value).getTime())
  );
}

export async function loadWeeklyRestAssignmentDecisions(): Promise<LoadedWeeklyRestAssignments> {
  const stored = await AsyncStorage.getItem(WEEKLY_REST_ASSIGNMENT_STORAGE_KEY);

  if (stored === null) {
    return {
      decisions: [],

      status: "empty",
    };
  }

  try {
    const parsed: unknown = JSON.parse(stored);

    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      !isValidTimestamp(parsed.savedAt)
    ) {
      return {
        decisions: [],

        status: "recovered-invalid",
      };
    }

    const parsedDecisions = parseWeeklyRestAssignmentDecisions(
      parsed.decisions,
    );

    return {
      decisions: parsedDecisions.decisions,

      status: parsedDecisions.recoveredInvalidData
        ? "recovered-invalid"
        : "loaded",
    };
  } catch {
    return {
      decisions: [],

      status: "recovered-invalid",
    };
  }
}

export async function saveWeeklyRestAssignmentDecisions(
  decisions: WeeklyRestWeekAssignmentDecision[],
): Promise<void> {
  if (!decisions.every(isWeeklyRestWeekAssignmentDecision)) {
    throw new Error(
      "Refusing to store an invalid weekly-rest assignment decision.",
    );
  }

  const payload: StoredWeeklyRestAssignmentState = {
    version: 1,

    savedAt: new Date().toISOString(),

    decisions,
  };

  await AsyncStorage.setItem(
    WEEKLY_REST_ASSIGNMENT_STORAGE_KEY,
    JSON.stringify(payload),
  );
}

export async function recordWeeklyRestAssignmentDecision(
  decision: WeeklyRestWeekAssignmentDecision,
): Promise<RecordWeeklyRestAssignmentResult> {
  if (!isWeeklyRestWeekAssignmentDecision(decision)) {
    throw new Error(
      "Refusing to record an invalid weekly-rest assignment decision.",
    );
  }

  const loaded = await loadWeeklyRestAssignmentDecisions();

  const existing = getWeeklyRestAssignmentDecision(
    loaded.decisions,
    decision.restSessionId,
  );

  if (existing !== null) {
    return {
      decisions: loaded.decisions,

      decision: existing,

      added: false,

      loadStatus: loaded.status,
    };
  }

  const decisions = addLockedWeeklyRestAssignmentDecision(
    loaded.decisions,
    decision,
  );

  await saveWeeklyRestAssignmentDecisions(decisions);

  return {
    decisions,

    decision,

    added: true,

    loadStatus: loaded.status,
  };
}

export async function clearWeeklyRestAssignmentDecisions(): Promise<void> {
  await AsyncStorage.removeItem(WEEKLY_REST_ASSIGNMENT_STORAGE_KEY);
}

export async function hasStoredWeeklyRestAssignmentDecisions(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(WEEKLY_REST_ASSIGNMENT_STORAGE_KEY);

  return stored !== null;
}
