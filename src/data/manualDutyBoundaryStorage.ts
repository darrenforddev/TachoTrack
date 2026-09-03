import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createManualDutyBoundaryState,
  recordManualDutyBoundaryEvidence,
  type ManualDutyBoundary,
  type ManualDutyBoundaryActivity,
  type ManualDutyBoundaryEvidence,
  type ManualDutyBoundaryReason,
  type ManualDutyBoundaryState,
  type ManualDutyEvidenceSource,
} from "../engine/manualDutyBoundary";

export const MANUAL_DUTY_BOUNDARY_STORAGE_KEY =
  "tachotrack.manual-duty-boundary.v1";

export interface ManualDutyBoundaryStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type ManualDutyBoundaryLoadStatus =
  | "empty"
  | "loaded"
  | "recovered"
  | "invalid";

export type ManualDutyBoundaryRecoveryIssueCode =
  | "invalid-json"
  | "unsupported-version"
  | "invalid-envelope"
  | "invalid-evidence";

export interface ManualDutyBoundaryRecoveryIssue {
  code: ManualDutyBoundaryRecoveryIssueCode;
  message: string;
  evidenceId?: string;
}

export interface ManualDutyBoundaryLoadResult {
  status: ManualDutyBoundaryLoadStatus;
  state: ManualDutyBoundaryState;
  savedAt: string | null;
  issues: ManualDutyBoundaryRecoveryIssue[];
}

interface StoredManualDutyBoundaryState {
  version: 1;
  savedAt: string;
  state: ManualDutyBoundaryState;
}

const BOUNDARIES: readonly ManualDutyBoundary[] = [
  "before-card-insertion",
  "after-card-ejection",
];
const ACTIVITIES: readonly ManualDutyBoundaryActivity[] = [
  "other-work",
  "poa",
  "break",
];
const REASONS: readonly ManualDutyBoundaryReason[] = [
  "office-admin",
  "vehicle-checks",
  "yard-work",
  "loading-paperwork",
  "waiting-known-in-advance",
  "break-rest",
  "other",
];
const SOURCES: readonly ManualDutyEvidenceSource[] = [
  "driver",
  "driver-correction",
  "admin-correction",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function isBoundary(value: unknown): value is ManualDutyBoundary {
  return BOUNDARIES.some((item) => item === value);
}

function isActivity(value: unknown): value is ManualDutyBoundaryActivity {
  return ACTIVITIES.some((item) => item === value);
}

function isReason(value: unknown): value is ManualDutyBoundaryReason {
  return REASONS.some((item) => item === value);
}

function isSource(value: unknown): value is ManualDutyEvidenceSource {
  return SOURCES.some((item) => item === value);
}

function requireEvidence(value: unknown): ManualDutyBoundaryEvidence {
  if (
    !isRecord(value) ||
    !isNonBlankString(value.id) ||
    !isNonBlankString(value.dutyDate) ||
    !isBoundary(value.boundary) ||
    !isActivity(value.activity) ||
    !isIsoTimestamp(value.startedAt) ||
    !isIsoTimestamp(value.endedAt) ||
    !isIsoTimestamp(value.cardEventAt) ||
    !isIsoTimestamp(value.recordedAt) ||
    !isReason(value.reason) ||
    !isSource(value.source) ||
    !isOptionalString(value.note) ||
    !isOptionalString(value.revisesEvidenceId)
  ) {
    throw new Error("Stored manual-duty boundary evidence is invalid.");
  }

  return {
    id: value.id,
    dutyDate: value.dutyDate,
    boundary: value.boundary,
    activity: value.activity,
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    cardEventAt: value.cardEventAt,
    recordedAt: value.recordedAt,
    reason: value.reason,
    source: value.source,
    ...(value.note === undefined ? {} : { note: value.note }),
    ...(value.revisesEvidenceId === undefined
      ? {}
      : { revisesEvidenceId: value.revisesEvidenceId }),
  };
}

/** Replays every item through the engine rather than trusting a JSON cast. */
export function restoreManualDutyBoundaryState(
  value: unknown,
): ManualDutyBoundaryState {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.evidence)
  ) {
    throw new Error("Stored manual-duty boundary state is invalid.");
  }

  return value.evidence.reduce(
    (state, evidence) =>
      recordManualDutyBoundaryEvidence(state, requireEvidence(evidence)),
    createManualDutyBoundaryState(),
  );
}

function recoverState(
  value: unknown,
): Pick<ManualDutyBoundaryLoadResult, "state" | "issues"> | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.evidence)
  ) {
    return null;
  }

  let state = createManualDutyBoundaryState();
  const issues: ManualDutyBoundaryRecoveryIssue[] = [];

  for (const evidenceValue of value.evidence) {
    const hintedId =
      isRecord(evidenceValue) && typeof evidenceValue.id === "string"
        ? evidenceValue.id
        : undefined;

    try {
      state = recordManualDutyBoundaryEvidence(
        state,
        requireEvidence(evidenceValue),
      );
    } catch (error) {
      issues.push({
        code: "invalid-evidence",
        message:
          error instanceof Error
            ? error.message
            : "Invalid manual-duty evidence was skipped.",
        ...(hintedId === undefined ? {} : { evidenceId: hintedId }),
      });
    }
  }

  return { state, issues };
}

export function decodeManualDutyBoundaryStorage(
  raw: string | null,
): ManualDutyBoundaryLoadResult {
  if (raw === null) {
    return {
      status: "empty",
      state: createManualDutyBoundaryState(),
      savedAt: null,
      issues: [],
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      status: "invalid",
      state: createManualDutyBoundaryState(),
      savedAt: null,
      issues: [
        {
          code: "invalid-json",
          message: "Manual-duty boundary storage was not valid JSON.",
        },
      ],
    };
  }

  if (!isRecord(parsed) || parsed.version !== 1) {
    return {
      status: "invalid",
      state: createManualDutyBoundaryState(),
      savedAt: null,
      issues: [
        {
          code: "unsupported-version",
          message: "Manual-duty boundary storage version is unsupported.",
        },
      ],
    };
  }

  if (!isIsoTimestamp(parsed.savedAt)) {
    return {
      status: "invalid",
      state: createManualDutyBoundaryState(),
      savedAt: null,
      issues: [
        {
          code: "invalid-envelope",
          message: "Manual-duty boundary storage envelope is invalid.",
        },
      ],
    };
  }

  const recovered = recoverState(parsed.state);

  if (recovered === null) {
    return {
      status: "invalid",
      state: createManualDutyBoundaryState(),
      savedAt: parsed.savedAt,
      issues: [
        {
          code: "invalid-envelope",
          message: "Stored manual-duty boundary state is invalid.",
        },
      ],
    };
  }

  return {
    status: recovered.issues.length === 0 ? "loaded" : "recovered",
    state: recovered.state,
    savedAt: parsed.savedAt,
    issues: recovered.issues,
  };
}

export async function saveManualDutyBoundaryState(
  state: ManualDutyBoundaryState,
  storage: ManualDutyBoundaryStorageAdapter = AsyncStorage,
): Promise<void> {
  const stored: StoredManualDutyBoundaryState = {
    version: 1,
    savedAt: new Date().toISOString(),
    state: restoreManualDutyBoundaryState(state),
  };

  await storage.setItem(
    MANUAL_DUTY_BOUNDARY_STORAGE_KEY,
    JSON.stringify(stored),
  );
}

export async function loadManualDutyBoundaryStateResult(
  storage: ManualDutyBoundaryStorageAdapter = AsyncStorage,
): Promise<ManualDutyBoundaryLoadResult> {
  const raw = await storage.getItem(MANUAL_DUTY_BOUNDARY_STORAGE_KEY);

  return decodeManualDutyBoundaryStorage(raw);
}

export async function loadManualDutyBoundaryState(
  storage: ManualDutyBoundaryStorageAdapter = AsyncStorage,
): Promise<ManualDutyBoundaryState> {
  return (await loadManualDutyBoundaryStateResult(storage)).state;
}

export async function recordManualDutyBoundaryEvidenceInStorage(
  evidence: ManualDutyBoundaryEvidence,
  storage: ManualDutyBoundaryStorageAdapter = AsyncStorage,
): Promise<ManualDutyBoundaryState> {
  const loaded = await loadManualDutyBoundaryStateResult(storage);

  if (loaded.status === "invalid") {
    throw new Error(
      "Manual-duty boundary storage is invalid and was not overwritten.",
    );
  }

  const updated = recordManualDutyBoundaryEvidence(loaded.state, evidence);

  await saveManualDutyBoundaryState(updated, storage);
  return updated;
}

export async function clearManualDutyBoundaryStorage(
  storage: ManualDutyBoundaryStorageAdapter = AsyncStorage,
): Promise<void> {
  await storage.removeItem(MANUAL_DUTY_BOUNDARY_STORAGE_KEY);
}

export async function hasStoredManualDutyBoundaryState(
  storage: ManualDutyBoundaryStorageAdapter = AsyncStorage,
): Promise<boolean> {
  return (await storage.getItem(MANUAL_DUTY_BOUNDARY_STORAGE_KEY)) !== null;
}
