import type {
  ActivityHistoryEvent,
  ActivityHistoryState,
} from "../data/activityHistory";

import {
  applyManualDutyBoundaryToActivityHistory,
  buildManualDutyBoundarySnapshot,
  closeActiveActivityHistoryAt,
  type EffectiveManualDutyBoundaryEntry,
  type ManualDutyBoundaryEvidence,
  type ManualDutyBoundaryState,
} from "./manualDutyBoundary";

export type ManualDutyBoundaryActivityOverlapResolution =
  | "reject"
  | "replace-manual";

export interface ManualDutyBoundaryActivityConflict {
  eventId: string;
  activity: ActivityHistoryEvent["activity"];
  source: ActivityHistoryEvent["source"];
  startedAt: string;
  endedAt: string | null;
  overlapStartedAt: string;
  overlapEndedAt: string;
  overlapMinutes: number;
  replaceable: boolean;
}

export class ManualDutyBoundaryActivityConflictError extends Error {
  readonly evidence: ManualDutyBoundaryEvidence;
  readonly conflicts: ManualDutyBoundaryActivityConflict[];
  readonly canReplaceAll: boolean;

  constructor(
    evidence: ManualDutyBoundaryEvidence,
    conflicts: ManualDutyBoundaryActivityConflict[],
  ) {
    super(
      `Manual-duty ${evidence.activity} overlaps ${conflicts.length} existing activity-history ${
        conflicts.length === 1 ? "period" : "periods"
      }.`,
    );
    this.name = "ManualDutyBoundaryActivityConflictError";
    this.evidence = evidence;
    this.conflicts = conflicts;
    this.canReplaceAll = conflicts.every((conflict) => conflict.replaceable);
  }
}

export interface ManualDutyBoundaryActivitySyncOptions {
  /**
   * Close the currently active activity at the confirmed actual duty finish.
   * This should only be enabled while recording the live shift's finish.
   */
  finishActiveHistoryAtActualDutyFinish?: boolean;
  overlapResolution?: ManualDutyBoundaryActivityOverlapResolution;
}

export interface ManualDutyBoundaryActivitySyncResult {
  history: ActivityHistoryState;
  projectedEvidenceIds: string[];
  alreadyCoveredEvidenceIds: string[];
  removedSupersededProjectionIds: string[];
  replacedActivityEventIds: string[];
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

function timestamp(value: string): number {
  const milliseconds = new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error(`Invalid activity-history timestamp: ${value}`);
  }

  return milliseconds;
}

function activityConflicts(
  history: ActivityHistoryState,
  evidence: ManualDutyBoundaryEvidence,
): ManualDutyBoundaryActivityConflict[] {
  const requestedStart = timestamp(evidence.startedAt);
  const requestedEnd = timestamp(evidence.endedAt);

  return history.events.flatMap((event) => {
    const eventStart = timestamp(event.startedAt);
    const eventEnd =
      event.endedAt === null
        ? Number.POSITIVE_INFINITY
        : timestamp(event.endedAt);
    const overlapStart = Math.max(requestedStart, eventStart);
    const overlapEnd = Math.min(requestedEnd, eventEnd);

    if (overlapEnd <= overlapStart) {
      return [];
    }

    return [
      {
        eventId: event.id,
        activity: event.activity,
        source: event.source,
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        overlapStartedAt: new Date(overlapStart).toISOString(),
        overlapEndedAt: new Date(overlapEnd).toISOString(),
        overlapMinutes: Math.floor((overlapEnd - overlapStart) / 60_000),
        replaceable: event.source === "manual",
      },
    ];
  });
}

function replaceManualActivityConflicts(
  history: ActivityHistoryState,
  evidence: ManualDutyBoundaryEvidence,
  conflicts: ManualDutyBoundaryActivityConflict[],
): ActivityHistoryState {
  const error = new ManualDutyBoundaryActivityConflictError(
    evidence,
    conflicts,
  );

  if (!error.canReplaceAll) {
    throw error;
  }

  const conflictIds = new Set(conflicts.map((conflict) => conflict.eventId));
  const requestedStart = timestamp(evidence.startedAt);
  const requestedEnd = timestamp(evidence.endedAt);
  const events: ActivityHistoryEvent[] = [];
  let activeEventId = history.activeEventId;

  for (const event of history.events) {
    if (!conflictIds.has(event.id)) {
      events.push(event);
      continue;
    }

    const eventStart = timestamp(event.startedAt);
    const eventEnd =
      event.endedAt === null
        ? Number.POSITIVE_INFINITY
        : timestamp(event.endedAt);
    const keepsBefore = eventStart < requestedStart;
    const keepsAfter = eventEnd > requestedEnd;

    if (keepsBefore) {
      events.push({
        ...event,
        endedAt: evidence.startedAt,
        durationMilliseconds: requestedStart - eventStart,
      });
    }

    if (keepsAfter) {
      const afterId = keepsBefore
        ? `${event.id}-after-manual-duty-${evidence.id}`
        : event.id;

      events.push({
        ...event,
        id: afterId,
        startedAt: evidence.endedAt,
        durationMilliseconds:
          event.endedAt === null ? null : eventEnd - requestedEnd,
      });

      if (history.activeEventId === event.id) {
        activeEventId = afterId;
      }
    } else if (history.activeEventId === event.id) {
      activeEventId = null;
    }
  }

  return {
    events: events.sort(
      (first, second) => timestamp(first.startedAt) - timestamp(second.startedAt),
    ),
    activeEventId,
  };
}

function applyEntry(
  history: ActivityHistoryState,
  evidence: ManualDutyBoundaryEvidence,
  resolution: ManualDutyBoundaryActivityOverlapResolution,
): {
  history: ActivityHistoryState;
  replacedActivityEventIds: string[];
} {
  try {
    return {
      history: applyManualDutyBoundaryToActivityHistory(history, evidence),
      replacedActivityEventIds: [],
    };
  } catch (caught) {
    if (
      !(caught instanceof Error) ||
      caught.message !==
        "Manual-duty activity overlaps an existing activity-history period."
    ) {
      throw caught;
    }

    const conflicts = activityConflicts(history, evidence);
    const conflictError = new ManualDutyBoundaryActivityConflictError(
      evidence,
      conflicts,
    );

    if (resolution !== "replace-manual" || !conflictError.canReplaceAll) {
      throw conflictError;
    }

    const replaced = replaceManualActivityConflicts(
      history,
      evidence,
      conflicts,
    );

    return {
      history: applyManualDutyBoundaryToActivityHistory(replaced, evidence),
      replacedActivityEventIds: conflicts.map((conflict) => conflict.eventId),
    };
  }
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
  const replacedActivityEventIds: string[] = [];

  for (const entry of entries) {
    const applied = applyEntry(
      nextHistory,
      entry.evidence,
      options.overlapResolution ?? "reject",
    );
    const reconciled = applied.history;
    replacedActivityEventIds.push(...applied.replacedActivityEventIds);

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
    replacedActivityEventIds: [...new Set(replacedActivityEventIds)],
    activeHistoryFinished,
  };
}
