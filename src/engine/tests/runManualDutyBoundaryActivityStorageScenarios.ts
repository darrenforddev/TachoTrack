import type { ActivityHistoryState } from "../../data/activityHistory";
import {
  ManualDutyBoundaryActivitySyncPendingError,
  reconcileManualDutyBoundaryActivityStorage,
  recordManualDutyBoundaryEvidenceWithActivityHistory,
  type ManualDutyBoundaryActivityPersistence,
} from "../../data/manualDutyBoundaryActivityStorage";
import type { ManualDutyBoundaryLoadResult } from "../../data/manualDutyBoundaryStorage";
import {
  createManualDutyBoundaryState,
  type ManualDutyBoundaryEvidence,
  type ManualDutyBoundaryState,
} from "../manualDutyBoundary";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(
      `Manual-duty activity storage scenario failed: ${message}`,
    );
  }
}

function startEvidence(): ManualDutyBoundaryEvidence {
  return {
    id: "start-1",
    dutyDate: "2026-09-03",
    boundary: "before-card-insertion",
    activity: "other-work",
    startedAt: "2026-09-03T05:40:00.000Z",
    endedAt: "2026-09-03T06:00:00.000Z",
    cardEventAt: "2026-09-03T06:00:00.000Z",
    recordedAt: "2026-09-03T06:01:00.000Z",
    reason: "vehicle-checks",
    source: "driver",
  };
}

function finishEvidence(): ManualDutyBoundaryEvidence {
  return {
    id: "finish-1",
    dutyDate: "2026-09-03",
    boundary: "after-card-ejection",
    activity: "other-work",
    startedAt: "2026-09-03T17:00:00.000Z",
    endedAt: "2026-09-03T17:25:00.000Z",
    cardEventAt: "2026-09-03T17:00:00.000Z",
    recordedAt: "2026-09-03T17:26:00.000Z",
    reason: "office-admin",
    source: "driver",
  };
}

interface MemoryPersistence extends ManualDutyBoundaryActivityPersistence {
  boundaryState: ManualDutyBoundaryState;
  activityState: ActivityHistoryState | null;
  writes: string[];
  failNextActivitySave: boolean;
}

function memoryPersistence(): MemoryPersistence {
  const memory: MemoryPersistence = {
    boundaryState: createManualDutyBoundaryState(),
    activityState: null,
    writes: [],
    failNextActivitySave: false,
    async loadBoundaryResult(): Promise<ManualDutyBoundaryLoadResult> {
      return {
        status: "loaded",
        state: memory.boundaryState,
        savedAt: "2026-09-03T05:00:00.000Z",
        issues: [],
      };
    },
    async saveBoundaryState(state): Promise<void> {
      memory.writes.push("boundary");
      memory.boundaryState = state;
    },
    async loadActivityHistory(): Promise<ActivityHistoryState | null> {
      return memory.activityState;
    },
    async saveActivityHistory(state): Promise<void> {
      memory.writes.push("activity");

      if (memory.failNextActivitySave) {
        memory.failNextActivitySave = false;
        throw new Error("Simulated activity write failure");
      }

      memory.activityState = state;
    },
  };

  return memory;
}

let passed = 0;
function pass(message: string): void {
  passed += 1;
  console.log(`✅ ${message}`);
}

async function runScenarios(): Promise<void> {
const memory = memoryPersistence();
const started = await recordManualDutyBoundaryEvidenceWithActivityHistory(
  startEvidence(),
  memory,
);
assert(started.boundaryState.evidence.length === 1, "start must be stored");
assert(started.activityHistory.events.length === 1, "start must project");
pass("Recording a boundary stores evidence and projected activity");

assert(
  memory.writes.join(",") === "boundary,activity",
  "evidence must be saved before its derived projection",
);
pass("Authoritative evidence is persisted before derived activity");

memory.activityState = {
  events: [
    ...(memory.activityState?.events ?? []),
    {
      id: "live-other-work",
      activity: "other-work",
      startedAt: "2026-09-03T06:00:00.000Z",
      endedAt: null,
      durationMilliseconds: null,
      source: "manual",
    },
  ],
  activeEventId: "live-other-work",
};
const finished = await recordManualDutyBoundaryEvidenceWithActivityHistory(
  finishEvidence(),
  memory,
);
assert(finished.activityHistory.activeEventId === null, "active id must clear");
assert(
  finished.activityHistory.events.find(
    (event) => event.id === "live-other-work",
  )?.endedAt === "2026-09-03T17:25:00.000Z",
  "live work must finish at actual finish",
);
pass("A saved actual finish closes the active activity exactly");

assert(
  finished.activityHistory.events.filter((event) =>
    event.id.startsWith("manual-duty-"),
  ).length === 1,
  "covered post-card work must not project twice",
);
pass("Live activity covering the finish interval is counted once");

const failedMemory = memoryPersistence();
failedMemory.failNextActivitySave = true;
let pendingError = false;
try {
  await recordManualDutyBoundaryEvidenceWithActivityHistory(
    startEvidence(),
    failedMemory,
  );
} catch (caught) {
  pendingError = caught instanceof ManualDutyBoundaryActivitySyncPendingError;
}
assert(pendingError, "derived write failure must be explicit");
assert(
  failedMemory.boundaryState.evidence.length === 1,
  "authoritative evidence must survive derived write failure",
);
pass("An interrupted activity write preserves protected audit evidence");

const repaired = await reconcileManualDutyBoundaryActivityStorage(
  "2026-09-03",
  failedMemory,
);
assert(repaired.activityHistory.events.length === 1, "repair must project");
assert(failedMemory.activityState?.events.length === 1, "repair must persist");
pass("Refresh reconciliation repairs an interrupted projection");

const writeCount = failedMemory.writes.length;
await reconcileManualDutyBoundaryActivityStorage("2026-09-03", failedMemory);
assert(
  failedMemory.writes.length === writeCount,
  "unchanged history must not be rewritten",
);
pass("A fully reconciled activity history is not rewritten");

const invalidMemory = memoryPersistence();
invalidMemory.loadBoundaryResult = async () => ({
  status: "invalid",
  state: createManualDutyBoundaryState(),
  savedAt: null,
  issues: [
    {
      code: "invalid-envelope",
      message: "Invalid storage",
    },
  ],
});
let invalidRejected = false;
try {
  await recordManualDutyBoundaryEvidenceWithActivityHistory(
    startEvidence(),
    invalidMemory,
  );
} catch {
  invalidRejected = true;
}
assert(invalidRejected, "invalid boundary storage must reject");
assert(invalidMemory.writes.length === 0, "invalid storage must not be written");
pass("Invalid protected boundary storage is never overwritten");

const historicalMemory = memoryPersistence();
await recordManualDutyBoundaryEvidenceWithActivityHistory(
  startEvidence(),
  historicalMemory,
);
historicalMemory.activityState = {
  events: [
    ...(historicalMemory.activityState?.events ?? []),
    {
      id: "newer-live-activity",
      activity: "other-work",
      startedAt: "2026-09-04T06:00:00.000Z",
      endedAt: null,
      durationMilliseconds: null,
      source: "manual",
    },
  ],
  activeEventId: "newer-live-activity",
};
const historicalFinish = await recordManualDutyBoundaryEvidenceWithActivityHistory(
  finishEvidence(),
  historicalMemory,
);
assert(
  historicalFinish.activityHistory.activeEventId === "newer-live-activity",
  "a later live activity must remain active",
);
assert(
  historicalFinish.activityHistory.events.find(
    (event) => event.id === "newer-live-activity",
  )?.endedAt === null,
  "a later live activity must remain open",
);
assert(
  historicalFinish.activityHistory.events.some(
    (event) => event.id === "manual-duty-finish-1",
  ),
  "historical finish evidence must still project",
);
pass("A historical finish preserves a newer live activity");

console.log("============================================================");
console.log(
  `MANUAL DUTY ACTIVITY STORAGE RESULT: ${passed}/${passed} passed`,
);
console.log("✅ ALL MANUAL DUTY ACTIVITY STORAGE SCENARIOS PASSED");
console.log("============================================================");
}

void runScenarios().catch((caught: unknown) => {
  console.error(caught);
  process.exitCode = 1;
});
