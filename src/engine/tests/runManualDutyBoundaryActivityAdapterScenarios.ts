import type {
  ActivityHistoryEvent,
  ActivityHistoryState,
} from "../../data/activityHistory";

import {
  createManualDutyBoundaryState,
  recordManualDutyBoundaryEvidence,
  type ManualDutyBoundaryEvidence,
  type ManualDutyBoundaryState,
} from "../manualDutyBoundary";
import {
  ManualDutyBoundaryActivityConflictError,
  syncManualDutyBoundaryActivityHistory,
} from "../manualDutyBoundaryActivityAdapter";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(
      `Manual-duty activity adapter scenario failed: ${message}`,
    );
  }
}

function evidence(
  overrides: Partial<ManualDutyBoundaryEvidence> = {},
): ManualDutyBoundaryEvidence {
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
    ...overrides,
  };
}

function withEvidence(
  ...items: ManualDutyBoundaryEvidence[]
): ManualDutyBoundaryState {
  return items.reduce(
    (state, item) => recordManualDutyBoundaryEvidence(state, item),
    createManualDutyBoundaryState(),
  );
}

function history(
  events: ActivityHistoryEvent[] = [],
  activeEventId: string | null = null,
): ActivityHistoryState {
  return { events, activeEventId };
}

let passed = 0;

function pass(message: string): void {
  passed += 1;
  console.log(`✅ ${message}`);
}

const finish = evidence({
  id: "finish-1",
  boundary: "after-card-ejection",
  startedAt: "2026-09-03T17:00:00.000Z",
  endedAt: "2026-09-03T17:25:00.000Z",
  cardEventAt: "2026-09-03T17:00:00.000Z",
  recordedAt: "2026-09-03T17:26:00.000Z",
  reason: "office-admin",
});
const completeState = withEvidence(evidence(), finish);

const projected = syncManualDutyBoundaryActivityHistory(
  history(),
  completeState,
  "2026-09-03",
);
assert(projected.history.events.length === 2, "two boundaries must project");
assert(
  projected.projectedEvidenceIds.join(",") === "start-1,finish-1",
  "both evidence identifiers must be reported",
);
pass("Effective start and finish evidence projects into activity history");

assert(
  projected.history.events[0]?.startedAt === "2026-09-03T05:40:00.000Z" &&
    projected.history.events[1]?.startedAt === "2026-09-03T17:00:00.000Z",
  "projected history must remain chronological",
);
pass("Projected evidence remains chronological");

const repeated = syncManualDutyBoundaryActivityHistory(
  projected.history,
  completeState,
  "2026-09-03",
);
assert(repeated.history.events.length === 2, "repeat sync must not duplicate");
assert(
  repeated.removedSupersededProjectionIds.length === 2,
  "repeat sync must reconcile stored projections",
);
pass("Repeated synchronisation is idempotent");

const oneLivePeriod: ActivityHistoryEvent = {
  id: "live-other-work",
  activity: "other-work",
  startedAt: "2026-09-03T05:30:00.000Z",
  endedAt: "2026-09-03T17:30:00.000Z",
  durationMilliseconds: 12 * 60 * 60 * 1000,
  source: "manual",
};
const covered = syncManualDutyBoundaryActivityHistory(
  history([oneLivePeriod]),
  completeState,
  "2026-09-03",
);
assert(covered.history.events.length === 1, "covered time must not duplicate");
assert(
  covered.alreadyCoveredEvidenceIds.length === 2,
  "both covered periods must be reported",
);
pass("Activity already captured live is not counted twice");

const correctedFinish = evidence({
  ...finish,
  id: "finish-2",
  endedAt: "2026-09-03T17:30:00.000Z",
  recordedAt: "2026-09-03T17:31:00.000Z",
  source: "admin-correction",
  revisesEvidenceId: "finish-1",
});
const correctedState = recordManualDutyBoundaryEvidence(
  completeState,
  correctedFinish,
);
const corrected = syncManualDutyBoundaryActivityHistory(
  projected.history,
  correctedState,
  "2026-09-03",
);
assert(
  corrected.history.events.some(
    (event) =>
      event.id === "manual-duty-finish-2" &&
      event.source === "admin-correction" &&
      event.endedAt === "2026-09-03T17:30:00.000Z",
  ),
  "corrected projection must replace its predecessor",
);
assert(
  !corrected.history.events.some(
    (event) => event.id === "manual-duty-finish-1",
  ),
  "superseded projection must be removed",
);
pass("Corrections replace superseded projections with an audit source");

assert(
  corrected.history.events.filter((event) =>
    event.id.startsWith("manual-duty-finish-"),
  ).length === 1,
  "only effective finish evidence may remain",
);
pass("Only current effective boundary evidence is projected");

const otherDateProjection: ActivityHistoryEvent = {
  id: "manual-duty-other-date",
  activity: "other-work",
  startedAt: "2026-09-02T05:40:00.000Z",
  endedAt: "2026-09-02T06:00:00.000Z",
  durationMilliseconds: 20 * 60 * 1000,
  source: "manual",
};
const preserved = syncManualDutyBoundaryActivityHistory(
  history([otherDateProjection]),
  completeState,
  "2026-09-03",
);
assert(
  preserved.history.events.some((event) => event.id === otherDateProjection.id),
  "another date's projection must remain",
);
pass("Synchronising one duty date preserves other dates");

const conflict: ActivityHistoryEvent = {
  id: "conflicting-break",
  activity: "break",
  startedAt: "2026-09-03T05:50:00.000Z",
  endedAt: "2026-09-03T06:10:00.000Z",
  durationMilliseconds: 20 * 60 * 1000,
  source: "manual",
};
let conflictError: ManualDutyBoundaryActivityConflictError | null = null;
try {
  syncManualDutyBoundaryActivityHistory(
    history([conflict]),
    completeState,
    "2026-09-03",
  );
} catch (caught) {
  if (caught instanceof ManualDutyBoundaryActivityConflictError) {
    conflictError = caught;
  }
}
assert(conflictError !== null, "conflicting overlap must throw a typed error");
pass("Conflicting activity overlap is rejected");

assert(
  conflictError.conflicts.length === 1 &&
    conflictError.conflicts[0]?.activity === "break" &&
    conflictError.conflicts[0]?.overlapMinutes === 10 &&
    conflictError.canReplaceAll,
  "conflict details must identify the manual break and overlap",
);
pass("Conflict errors explain the activity, overlap and replaceability");

const spanningBreak: ActivityHistoryEvent = {
  id: "spanning-break",
  activity: "break",
  startedAt: "2026-09-03T05:30:00.000Z",
  endedAt: "2026-09-03T06:10:00.000Z",
  durationMilliseconds: 40 * 60 * 1000,
  source: "manual",
};
const resolved = syncManualDutyBoundaryActivityHistory(
  history([spanningBreak]),
  completeState,
  "2026-09-03",
  { overlapResolution: "replace-manual" },
);
assert(
  resolved.replacedActivityEventIds.includes("spanning-break"),
  "replaced event id must be reported",
);
assert(
  resolved.history.events.some(
    (event) =>
      event.id === "spanning-break" &&
      event.startedAt === "2026-09-03T05:30:00.000Z" &&
      event.endedAt === "2026-09-03T05:40:00.000Z",
  ),
  "activity before the replacement must remain",
);
assert(
  resolved.history.events.some(
    (event) =>
      event.id === "spanning-break-after-manual-duty-start-1" &&
      event.startedAt === "2026-09-03T06:00:00.000Z" &&
      event.endedAt === "2026-09-03T06:10:00.000Z",
  ),
  "activity after the replacement must remain",
);
assert(
  resolved.history.events.some(
    (event) => event.id === "manual-duty-start-1",
  ),
  "manual-duty projection must occupy the resolved interval",
);
pass("Replacing a manual overlap preserves activity on both sides");

const protectedTachograph: ActivityHistoryEvent = {
  ...conflict,
  id: "protected-tachograph-break",
  source: "tachograph",
};
let protectedRejected = false;
try {
  syncManualDutyBoundaryActivityHistory(
    history([protectedTachograph]),
    completeState,
    "2026-09-03",
    { overlapResolution: "replace-manual" },
  );
} catch (caught) {
  protectedRejected =
    caught instanceof ManualDutyBoundaryActivityConflictError &&
    !caught.canReplaceAll;
}
assert(protectedRejected, "tachograph evidence must remain protected");
pass("Tachograph activity cannot be replaced automatically");

const active: ActivityHistoryEvent = {
  id: "active-work",
  activity: "other-work",
  startedAt: "2026-09-03T06:00:00.000Z",
  endedAt: null,
  durationMilliseconds: null,
  source: "manual",
};
const finished = syncManualDutyBoundaryActivityHistory(
  history([active], active.id),
  completeState,
  "2026-09-03",
  { finishActiveHistoryAtActualDutyFinish: true },
);
const finishedEvent = finished.history.events.find(
  (event) => event.id === active.id,
);
assert(finished.activeHistoryFinished, "active event must report finished");
assert(finished.history.activeEventId === null, "active id must clear");
assert(
  finishedEvent?.endedAt === "2026-09-03T17:25:00.000Z",
  "active event must finish at actual duty finish",
);
assert(
  finished.alreadyCoveredEvidenceIds.includes("finish-1"),
  "finished live activity must cover post-card work",
);
pass("Confirmed finish can close live activity at the exact finish time");

const leftOpen = syncManualDutyBoundaryActivityHistory(
  history([active], active.id),
  completeState,
  "2026-09-03",
);
assert(
  leftOpen.history.activeEventId === active.id,
  "default sync must leave active event open",
);
pass("Ordinary synchronisation does not close live activity");

const newerActive: ActivityHistoryEvent = {
  ...active,
  id: "newer-active",
  startedAt: "2026-09-03T18:00:00.000Z",
};
let newerDutyProtected = false;
try {
  syncManualDutyBoundaryActivityHistory(
    history([newerActive], newerActive.id),
    completeState,
    "2026-09-03",
    { finishActiveHistoryAtActualDutyFinish: true },
  );
} catch {
  newerDutyProtected = true;
}
assert(newerDutyProtected, "newer active duty must not be closed backwards");
pass("A newer active duty is protected from an older confirmed finish");

const empty = syncManualDutyBoundaryActivityHistory(
  history(),
  createManualDutyBoundaryState(),
  "2026-09-03",
);
assert(empty.history.events.length === 0, "empty state must stay empty");
pass("An empty boundary state manufactures no activity");

console.log("============================================================");
console.log(
  `MANUAL DUTY BOUNDARY ACTIVITY ADAPTER RESULT: ${passed}/${passed} passed`,
);
console.log("✅ ALL MANUAL DUTY ACTIVITY ADAPTER SCENARIOS PASSED");
console.log("============================================================");
