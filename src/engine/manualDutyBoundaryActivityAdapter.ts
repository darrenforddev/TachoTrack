import type {
  ActivityHistoryEvent,
  ActivityHistoryState,
} from "../data/activityHistory";

import {
  applyManualDutyBoundaryToActivityHistory,
  buildManualDutyBoundarySnapshot,
  closeActiveActivityHistoryAt,
  type EffectiveManualDutyBoundaryEntry,
  type ManualDutyBoundaryState,
} from "./manualDutyBoundary";

export interface ManualDutyBoundaryActivitySyncOptions {
  /**
   * Close the currently active activity at the confirmed actual duty finish.
   * This should only be enabled while recording the live shift's finish.
   */
  finishActiveHistoryAtActualDutyFinish?: boolean;
}

export interface ManualDutyBoundaryActivitySyncResult {
  history: ActivityHistoryState;
  projectedEvidenceIds: string[];
  alreadyCoveredEvidenceIds: string[];
  removedSupersededProjectionIds: string[];
  activeHistoryFinished: boolean;
}

function projectedEventId(evidenceId: string): string {
  return `manual-duty-${evidenceId}`;
}

function effectiveEntries(
  state: ManualDutyBoundaryState,
  dutyDate: string,
): EffectiveManualDutyBoundaryEntry[] {
  const snapshot = buildManualDutyBoundarySnapshot(state, dutyDate);

  return [snapshot.beforeCardInsertion, snapshot.afterCardEjection]
    .filter(
      (entry): entry is EffectiveManualDutyBoundaryEntry => entry !== null,
    )
    .sort(
      (first, second) =>
        new Date(first.evidence.startedAt).getTime() -
        new Date(second.evidence.startedAt).getTime(),
    );
}

function removeStoredProjectionsForDutyDate(
  history: ActivityHistoryState,
  state: ManualDutyBoundaryState,
  dutyDate: string,
): {
  history: ActivityHistoryState;
  removedIds: string[];
} {
  const projectionIds = new Set(
    state.evidence
      .filter((evidence) => evidence.dutyDate === dutyDate)
      .map((evidence) => projectedEventId(evidence.id)),
  );
  const removedIds = history.events
    .filter((event) => projectionIds.has(event.id))
    .map((event) => event.id);

  if (
    history.activeEventId !== null &&
    projectionIds.has(history.activeEventId)
  ) {
    throw new Error("A projected manual-duty event cannot be active.");
  }

  if (removedIds.length === 0) {
    return { history, removedIds };
  }

  return {
    history: {
      events: history.events.filter((event) => !projectionIds.has(event.id)),
      activeEventId: history.activeEventId,
    },
    removedIds,
  };
}

function activeEvent(history: ActivityHistoryState): ActivityHistoryEvent | null {
  if (history.activeEventId === null) {
    return null;
  }

  return (
    history.events.find((event) => event.id === history.activeEventId) ?? null
  );
}

/**
 * Reconciles the effective manual duty-boundary evidence for one duty date
 * into activity history. Superseded projections are removed first, so
 * corrections replace rather than duplicate earlier evidence.
 */
export function syncManualDutyBoundaryActivityHistory(
  history: ActivityHistoryState,
  state: ManualDutyBoundaryState,
  dutyDate: string,
  options: ManualDutyBoundaryActivitySyncOptions = {},
): ManualDutyBoundaryActivitySyncResult {
  const entries = effectiveEntries(state, dutyDate);
  const removed = removeStoredProjectionsForDutyDate(
    history,
    state,
    dutyDate,
  );
  let nextHistory = removed.history;
  let activeHistoryFinished = false;
  const finishEntry = entries.find(
    (entry) => entry.evidence.boundary === "after-card-ejection",
  );

  if (
    options.finishActiveHistoryAtActualDutyFinish === true &&
    finishEntry !== undefined &&
    activeEvent(nextHistory) !== null
  ) {
    nextHistory = closeActiveActivityHistoryAt(
      nextHistory,
      finishEntry.evidence.endedAt,
    );
    activeHistoryFinished = true;
  }

  const projectedEvidenceIds: string[] = [];
  const alreadyCoveredEvidenceIds: string[] = [];

  for (const entry of entries) {
    const reconciled = applyManualDutyBoundaryToActivityHistory(
      nextHistory,
      entry.evidence,
    );

    if (reconciled === nextHistory) {
      alreadyCoveredEvidenceIds.push(entry.evidence.id);
    } else {
      projectedEvidenceIds.push(entry.evidence.id);
      nextHistory = reconciled;
    }
  }

  return {
    history: nextHistory,
    projectedEvidenceIds,
    alreadyCoveredEvidenceIds,
    removedSupersededProjectionIds: removed.removedIds,
    activeHistoryFinished,
  };
}
