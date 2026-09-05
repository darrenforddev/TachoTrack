import type {
  ManualDutyBoundary,
  ManualDutyBoundarySnapshot,
} from "./manualDutyBoundary";

export type DutyBoundaryPromptOperationsStatus =
  | "not-started"
  | "active"
  | "finish-requested";

export type DutyBoundaryPromptStatus =
  | "not-due"
  | "choice-required"
  | "entry-recorded"
  | "confirmed-no-entry";

export interface DutyBoundaryNoEntryAcknowledgement {
  id: string;
  dutyDate: string;
  boundary: ManualDutyBoundary;
  decision: "nothing-to-record";
  cardEventAt: string;
  acknowledgedAt: string;
  source: "driver";
}

export interface DutyBoundaryPromptAssistantState {
  version: 1;
  acknowledgements: DutyBoundaryNoEntryAcknowledgement[];
}

export interface DutyBoundaryPromptResult {
  boundary: ManualDutyBoundary;
  status: DutyBoundaryPromptStatus;
  requiresDriverChoice: boolean;
  canRecordEntry: boolean;
  canConfirmNoEntry: boolean;
  effectiveAcknowledgement: DutyBoundaryNoEntryAcknowledgement | null;
}

export interface DutyBoundaryPromptAssistantPlan {
  dutyDate: string;
  operationsStatus: DutyBoundaryPromptOperationsStatus;
  beforeCardInsertion: DutyBoundaryPromptResult;
  afterCardEjection: DutyBoundaryPromptResult;
  primaryPrompt: ManualDutyBoundary | null;
  unresolvedPromptCount: number;
  canContinueOperations: true;
  canCompleteShift: boolean;
}

export interface RecordDutyBoundaryNoEntryOptions {
  id: string;
  dutyDate: string;
  boundary: ManualDutyBoundary;
  cardEventAt: string;
  acknowledgedAt?: string;
}

const BOUNDARIES: readonly ManualDutyBoundary[] = [
  "before-card-insertion",
  "after-card-ejection",
];

const OPERATIONS_STATUSES: readonly DutyBoundaryPromptOperationsStatus[] = [
  "not-started",
  "active",
  "finish-requested",
];

function requireNonBlank(value: string, label: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${label} must not be blank.`);
  }

  return trimmed;
}

function requireDutyDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid duty prompt date: ${value}`);
  }

  const milliseconds = new Date(`${value}T00:00:00.000Z`).getTime();

  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid duty prompt date: ${value}`);
  }

  return value;
}

function requireBoundary(value: ManualDutyBoundary): ManualDutyBoundary {
  if (!BOUNDARIES.includes(value)) {
    throw new Error(`Invalid duty prompt boundary: ${String(value)}`);
  }

  return value;
}

function requireTimestamp(value: string, label: string): number {
  const milliseconds = new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return milliseconds;
}

function validateAcknowledgement(
  acknowledgement: DutyBoundaryNoEntryAcknowledgement,
): void {
  requireNonBlank(acknowledgement.id, "Duty prompt acknowledgement id");
  requireDutyDate(acknowledgement.dutyDate);
  requireBoundary(acknowledgement.boundary);

  if (acknowledgement.decision !== "nothing-to-record") {
    throw new Error("Invalid duty prompt acknowledgement decision.");
  }

  if (acknowledgement.source !== "driver") {
    throw new Error("A no-entry decision must be acknowledged by the driver.");
  }

  const cardEventMilliseconds = requireTimestamp(
    acknowledgement.cardEventAt,
    "duty prompt card-event time",
  );
  const acknowledgedMilliseconds = requireTimestamp(
    acknowledgement.acknowledgedAt,
    "duty prompt acknowledgement time",
  );

  if (acknowledgedMilliseconds < cardEventMilliseconds) {
    throw new Error(
      "A no-entry decision cannot be acknowledged before the card event.",
    );
  }
}

function restoreState(
  state: DutyBoundaryPromptAssistantState,
): DutyBoundaryPromptAssistantState {
  if (state.version !== 1 || !Array.isArray(state.acknowledgements)) {
    throw new Error("Invalid duty boundary prompt assistant state.");
  }

  const ids = new Set<string>();

  for (const acknowledgement of state.acknowledgements) {
    validateAcknowledgement(acknowledgement);

    if (ids.has(acknowledgement.id)) {
      throw new Error(
        `Duplicate duty prompt acknowledgement id: ${acknowledgement.id}`,
      );
    }

    ids.add(acknowledgement.id);
  }

  return {
    version: 1,
    acknowledgements: [...state.acknowledgements].sort((left, right) =>
      left.acknowledgedAt.localeCompare(right.acknowledgedAt),
    ),
  };
}

export function createDutyBoundaryPromptAssistantState(): DutyBoundaryPromptAssistantState {
  return {
    version: 1,
    acknowledgements: [],
  };
}

export function recordDutyBoundaryNoEntryAcknowledgement(
  state: DutyBoundaryPromptAssistantState,
  options: RecordDutyBoundaryNoEntryOptions,
): DutyBoundaryPromptAssistantState {
  const restored = restoreState(state);
  const acknowledgedAt =
    options.acknowledgedAt ?? new Date().toISOString();
  const acknowledgement: DutyBoundaryNoEntryAcknowledgement = {
    id: requireNonBlank(options.id, "Duty prompt acknowledgement id"),
    dutyDate: requireDutyDate(options.dutyDate),
    boundary: requireBoundary(options.boundary),
    decision: "nothing-to-record",
    cardEventAt: options.cardEventAt,
    acknowledgedAt,
    source: "driver",
  };

  validateAcknowledgement(acknowledgement);

  if (restored.acknowledgements.some((item) => item.id === acknowledgement.id)) {
    throw new Error(
      `Duplicate duty prompt acknowledgement id: ${acknowledgement.id}`,
    );
  }

  return restoreState({
    version: 1,
    acknowledgements: restored.acknowledgements.concat(acknowledgement),
  });
}

function hasRecordedEntry(
  snapshot: ManualDutyBoundarySnapshot,
  boundary: ManualDutyBoundary,
): boolean {
  return boundary === "before-card-insertion"
    ? snapshot.beforeCardInsertion !== null
    : snapshot.afterCardEjection !== null;
}

function effectiveAcknowledgement(
  state: DutyBoundaryPromptAssistantState,
  dutyDate: string,
  boundary: ManualDutyBoundary,
): DutyBoundaryNoEntryAcknowledgement | null {
  const matching = state.acknowledgements.filter(
    (item) => item.dutyDate === dutyDate && item.boundary === boundary,
  );

  return matching.length === 0 ? null : matching[matching.length - 1]!;
}

function buildPromptResult(
  state: DutyBoundaryPromptAssistantState,
  snapshot: ManualDutyBoundarySnapshot,
  dutyDate: string,
  boundary: ManualDutyBoundary,
  due: boolean,
): DutyBoundaryPromptResult {
  const acknowledgement = effectiveAcknowledgement(
    state,
    dutyDate,
    boundary,
  );

  if (hasRecordedEntry(snapshot, boundary)) {
    return {
      boundary,
      status: "entry-recorded",
      requiresDriverChoice: false,
      canRecordEntry: false,
      canConfirmNoEntry: false,
      effectiveAcknowledgement: acknowledgement,
    };
  }

  if (acknowledgement !== null) {
    return {
      boundary,
      status: "confirmed-no-entry",
      requiresDriverChoice: false,
      canRecordEntry: true,
      canConfirmNoEntry: false,
      effectiveAcknowledgement: acknowledgement,
    };
  }

  if (!due) {
    return {
      boundary,
      status: "not-due",
      requiresDriverChoice: false,
      canRecordEntry: false,
      canConfirmNoEntry: false,
      effectiveAcknowledgement: null,
    };
  }

  return {
    boundary,
    status: "choice-required",
    requiresDriverChoice: true,
    canRecordEntry: true,
    canConfirmNoEntry: true,
    effectiveAcknowledgement: null,
  };
}

export function buildDutyBoundaryPromptAssistantPlan(
  state: DutyBoundaryPromptAssistantState,
  snapshot: ManualDutyBoundarySnapshot,
  operationsStatus: DutyBoundaryPromptOperationsStatus,
): DutyBoundaryPromptAssistantPlan {
  const restored = restoreState(state);
  const dutyDate = requireDutyDate(snapshot.dutyDate);

  if (!OPERATIONS_STATUSES.includes(operationsStatus)) {
    throw new Error(
      `Invalid duty prompt operations status: ${String(operationsStatus)}`,
    );
  }

  const beforeDue = operationsStatus !== "not-started";
  const afterDue = operationsStatus === "finish-requested";
  const beforeCardInsertion = buildPromptResult(
    restored,
    snapshot,
    dutyDate,
    "before-card-insertion",
    beforeDue,
  );
  const afterCardEjection = buildPromptResult(
    restored,
    snapshot,
    dutyDate,
    "after-card-ejection",
    afterDue,
  );
  const required = [beforeCardInsertion, afterCardEjection].filter(
    (item) => item.requiresDriverChoice,
  );

  return {
    dutyDate,
    operationsStatus,
    beforeCardInsertion,
    afterCardEjection,
    primaryPrompt: required[0]?.boundary ?? null,
    unresolvedPromptCount: required.length,
    canContinueOperations: true,
    canCompleteShift:
      operationsStatus === "finish-requested" && required.length === 0,
  };
}
