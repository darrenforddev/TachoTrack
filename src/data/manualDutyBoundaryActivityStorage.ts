import {
  createInitialActivityHistory,
  type ActivityHistoryState,
} from "./activityHistory";
import {
  loadActivityHistory,
  saveActivityHistory,
} from "./activityHistoryStorage";
import {
  loadManualDutyBoundaryStateResult,
  saveManualDutyBoundaryState,
  type ManualDutyBoundaryLoadResult,
} from "./manualDutyBoundaryStorage";
import {
  buildManualDutyBoundarySnapshot,
  recordManualDutyBoundaryEvidence,
  type ManualDutyBoundaryEvidence,
  type ManualDutyBoundaryState,
} from "../engine/manualDutyBoundary";
import {
  syncManualDutyBoundaryActivityHistory,
  type ManualDutyBoundaryActivityOverlapResolution,
  type ManualDutyBoundaryActivitySyncResult,
} from "../engine/manualDutyBoundaryActivityAdapter";

export interface RecordManualDutyBoundaryActivityOptions {
  overlapResolution?: ManualDutyBoundaryActivityOverlapResolution;
}

export interface ManualDutyBoundaryActivityPersistence {
  loadBoundaryResult(): Promise<ManualDutyBoundaryLoadResult>;
  saveBoundaryState(state: ManualDutyBoundaryState): Promise<void>;
  loadActivityHistory(): Promise<ActivityHistoryState | null>;
  saveActivityHistory(history: ActivityHistoryState): Promise<void>;
}

export interface ManualDutyBoundaryActivityStorageResult {
  boundaryLoadResult: ManualDutyBoundaryLoadResult;
  boundaryState: ManualDutyBoundaryState;
  activityHistory: ActivityHistoryState;
  sync: ManualDutyBoundaryActivitySyncResult;
}

export class ManualDutyBoundaryActivitySyncPendingError extends Error {
  readonly boundaryEvidenceSaved = true;

  constructor() {
    super(
      "Duty evidence was saved, but activity totals could not be updated. Refresh this screen to repair the projection.",
    );
    this.name = "ManualDutyBoundaryActivitySyncPendingError";
  }
}

const defaultPersistence: ManualDutyBoundaryActivityPersistence = {
  loadBoundaryResult: loadManualDutyBoundaryStateResult,
  saveBoundaryState: saveManualDutyBoundaryState,
  loadActivityHistory,
  saveActivityHistory,
};

function requireWritableBoundaryState(
  result: ManualDutyBoundaryLoadResult,
): ManualDutyBoundaryState {
  if (result.status === "invalid") {
    throw new Error(
      "Manual-duty boundary storage is invalid and was not overwritten.",
    );
  }

  return result.state;
}

function historiesMatch(
  first: ActivityHistoryState,
  second: ActivityHistoryState,
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function shouldRepairActiveFinish(
  history: ActivityHistoryState,
  boundaryState: ManualDutyBoundaryState,
  dutyDate: string,
): boolean {
  const finish = buildManualDutyBoundarySnapshot(
    boundaryState,
    dutyDate,
  ).actualDutyFinishedAt;
  const active = history.events.find(
    (event) => event.id === history.activeEventId,
  );

  return (
    finish !== null &&
    active !== undefined &&
    new Date(active.startedAt).getTime() <= new Date(finish).getTime()
  );
}

export async function recordManualDutyBoundaryEvidenceWithActivityHistory(
  evidence: ManualDutyBoundaryEvidence,
  options: RecordManualDutyBoundaryActivityOptions = {},
  persistence: ManualDutyBoundaryActivityPersistence = defaultPersistence,
): Promise<ManualDutyBoundaryActivityStorageResult> {
  const [boundaryLoadResult, storedActivityHistory] = await Promise.all([
    persistence.loadBoundaryResult(),
    persistence.loadActivityHistory(),
  ]);
  const currentBoundaryState = requireWritableBoundaryState(
    boundaryLoadResult,
  );
  const currentActivityHistory =
    storedActivityHistory ?? createInitialActivityHistory();
  const boundaryState = recordManualDutyBoundaryEvidence(
    currentBoundaryState,
    evidence,
  );
  const sync = syncManualDutyBoundaryActivityHistory(
    currentActivityHistory,
    boundaryState,
    evidence.dutyDate,
    {
      finishActiveHistoryAtActualDutyFinish:
        evidence.boundary === "after-card-ejection" &&
        shouldRepairActiveFinish(
          currentActivityHistory,
          boundaryState,
          evidence.dutyDate,
        ),
      overlapResolution: options.overlapResolution ?? "reject",
    },
  );

  // Audit evidence is authoritative and is saved first. If the derived write
  // is interrupted, reconcileManualDutyBoundaryActivityStorage can rebuild it.
  await persistence.saveBoundaryState(boundaryState);

  try {
    await persistence.saveActivityHistory(sync.history);
  } catch {
    throw new ManualDutyBoundaryActivitySyncPendingError();
  }

  return {
    boundaryLoadResult,
    boundaryState,
    activityHistory: sync.history,
    sync,
  };
}

export async function reconcileManualDutyBoundaryActivityStorage(
  dutyDate: string,
  persistence: ManualDutyBoundaryActivityPersistence = defaultPersistence,
): Promise<ManualDutyBoundaryActivityStorageResult> {
  const [boundaryLoadResult, storedActivityHistory] = await Promise.all([
    persistence.loadBoundaryResult(),
    persistence.loadActivityHistory(),
  ]);
  const boundaryState = requireWritableBoundaryState(boundaryLoadResult);
  const activityHistory =
    storedActivityHistory ?? createInitialActivityHistory();
  const sync = syncManualDutyBoundaryActivityHistory(
    activityHistory,
    boundaryState,
    dutyDate,
    {
      finishActiveHistoryAtActualDutyFinish: shouldRepairActiveFinish(
        activityHistory,
        boundaryState,
        dutyDate,
      ),
    },
  );

  if (!historiesMatch(activityHistory, sync.history)) {
    await persistence.saveActivityHistory(sync.history);
  }

  return {
    boundaryLoadResult,
    boundaryState,
    activityHistory: sync.history,
    sync,
  };
}
