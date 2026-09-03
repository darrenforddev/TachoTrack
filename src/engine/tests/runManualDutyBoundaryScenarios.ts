import {
  applyManualDutyBoundaryToActivityHistory,
  buildManualDutyBoundarySnapshot,
  closeActiveActivityHistoryAt,
  createManualDutyBoundaryState,
  recordManualDutyBoundaryEvidence,
  type ManualDutyBoundaryEvidence,
} from "../manualDutyBoundary";
import {
  createInitialActivityHistory,
  startActivityHistory,
  type ActivityHistoryState,
} from "../../data/activityHistory";

let passed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Manual duty-boundary scenario failed: ${message}`);
  }
}

function expectError(action: () => unknown, message: string): void {
  let failed = false;

  try {
    action();
  } catch {
    failed = true;
  }

  assert(failed, message);
  passed += 1;
}

function before(
  overrides: Partial<ManualDutyBoundaryEvidence> = {},
): ManualDutyBoundaryEvidence {
  return {
    id: "manual-duty-start-2026-09-03",
    dutyDate: "2026-09-03",
    boundary: "before-card-insertion",
    activity: "other-work",
    startedAt: "2026-09-03T05:40:00.000Z",
    endedAt: "2026-09-03T06:00:00.000Z",
    cardEventAt: "2026-09-03T06:00:00.000Z",
    recordedAt: "2026-09-03T06:00:00.000Z",
    reason: "vehicle-checks",
    source: "driver",
    ...overrides,
  };
}

function after(
  overrides: Partial<ManualDutyBoundaryEvidence> = {},
): ManualDutyBoundaryEvidence {
  return {
    id: "manual-duty-finish-2026-09-03",
    dutyDate: "2026-09-03",
    boundary: "after-card-ejection",
    activity: "other-work",
    startedAt: "2026-09-03T17:00:00.000Z",
    endedAt: "2026-09-03T17:25:00.000Z",
    cardEventAt: "2026-09-03T17:00:00.000Z",
    recordedAt: "2026-09-03T17:25:00.000Z",
    reason: "office-admin",
    source: "driver",
    ...overrides,
  };
}

const empty = createManualDutyBoundaryState();
const emptySnapshot = buildManualDutyBoundarySnapshot(empty, "2026-09-03");

assert(emptySnapshot.status === "empty", "A new date must be empty.");
assert(
  emptySnapshot.tachographManualInputsRequired === 0,
  "An empty date must not manufacture a tachograph prompt.",
);
passed += 1;

const started = recordManualDutyBoundaryEvidence(empty, before());
const startedSnapshot = buildManualDutyBoundarySnapshot(
  started,
  "2026-09-03",
);

assert(
  startedSnapshot.status === "start-recorded",
  "A pre-card record must establish the actual duty start.",
);
assert(
  startedSnapshot.actualDutyStartedAt === "2026-09-03T05:40:00.000Z" &&
    startedSnapshot.cardInsertedAt === "2026-09-03T06:00:00.000Z",
  "Actual start and card insertion must remain distinct.",
);
assert(
  startedSnapshot.additionalOtherWorkMinutes === 20,
  "Vehicle checks before card insertion must add 20 minutes of other work.",
);
assert(
  startedSnapshot.beforeCardInsertion?.tachographMode === "OTHER WORK",
  "Vehicle checks must use the Other Work tachograph mode.",
);
assert(
  startedSnapshot.beforeCardInsertion?.requiresTachographManualInput === true,
  "App evidence must still require a tachograph manual input.",
);
passed += 1;

const completed = recordManualDutyBoundaryEvidence(started, after());
const completedSnapshot = buildManualDutyBoundarySnapshot(
  completed,
  "2026-09-03",
);

assert(
  completedSnapshot.status === "complete",
  "Both card boundaries must complete the duty record.",
);
assert(
  completedSnapshot.cardEjectedAt === "2026-09-03T17:00:00.000Z" &&
    completedSnapshot.actualDutyFinishedAt === "2026-09-03T17:25:00.000Z",
  "Card ejection and actual duty finish must remain distinct.",
);
assert(
  completedSnapshot.additionalOtherWorkMinutes === 45 &&
    completedSnapshot.tachographManualInputsRequired === 2,
  "Both extra work periods must be included without replacing tachograph entry.",
);
passed += 1;

const poaState = recordManualDutyBoundaryEvidence(
  empty,
  before({
    id: "known-waiting",
    activity: "poa",
    reason: "waiting-known-in-advance",
  }),
);
const poaSnapshot = buildManualDutyBoundarySnapshot(poaState, "2026-09-03");

assert(
  poaSnapshot.additionalPoaMinutes === 20 &&
    poaSnapshot.beforeCardInsertion?.tachographMode === "AVAILABILITY",
  "Known waiting must remain POA rather than working time.",
);
passed += 1;

const restState = recordManualDutyBoundaryEvidence(
  empty,
  before({
    id: "pre-card-rest",
    activity: "break",
    reason: "break-rest",
  }),
);

assert(
  buildManualDutyBoundarySnapshot(restState, "2026-09-03")
    .additionalBreakRestMinutes === 20,
  "Break or rest must remain separate from working time.",
);
passed += 1;

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      empty,
      before({ activity: "poa", reason: "office-admin" }),
    ),
  "Office administration must not be classified as POA.",
);

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      empty,
      before({ activity: "other-work", reason: "waiting-known-in-advance" }),
    ),
  "Known waiting must not be classified as Other Work.",
);

expectError(
  () => recordManualDutyBoundaryEvidence(empty, before({ reason: "other" })),
  "An other reason must carry an explanatory note.",
);

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      empty,
      before({
        endedAt: "2026-09-03T05:59:00.000Z",
      }),
    ),
  "A pre-card period must finish exactly at insertion.",
);

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      empty,
      after({
        startedAt: "2026-09-03T17:01:00.000Z",
      }),
    ),
  "A post-card period must start exactly at ejection.",
);

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      empty,
      before({
        endedAt: "2026-09-03T05:40:00.000Z",
        cardEventAt: "2026-09-03T05:40:00.000Z",
      }),
    ),
  "A zero-duration boundary must be rejected.",
);

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      empty,
      before({ recordedAt: "2026-09-03T05:50:00.000Z" }),
    ),
  "Evidence must not be recorded before its period has ended.",
);

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      empty,
      before({ activity: "driving" as "other-work" }),
    ),
  "Driving must not be offered as a normal tachograph manual-input mode.",
);

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      empty,
      before({ boundary: "unknown" as "before-card-insertion" }),
    ),
  "Unknown boundary values from storage must be rejected.",
);

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      empty,
      before({ reason: "unknown" as "other" }),
    ),
  "Unknown reason values from storage must be rejected.",
);

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      empty,
      before({ source: "unknown" as "driver" }),
    ),
  "Unknown evidence sources from storage must be rejected.",
);

expectError(
  () => recordManualDutyBoundaryEvidence(started, before()),
  "Duplicate evidence identifiers must be rejected.",
);

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      started,
      before({ id: "second-unrevised-start" }),
    ),
  "A second effective start boundary must be rejected.",
);

const correctedStart = recordManualDutyBoundaryEvidence(
  started,
  before({
    id: "corrected-duty-start",
    startedAt: "2026-09-03T05:35:00.000Z",
    recordedAt: "2026-09-03T06:10:00.000Z",
    source: "driver-correction",
    revisesEvidenceId: "manual-duty-start-2026-09-03",
    note: "Corrected after checking the gatehouse time.",
  }),
);
const correctedSnapshot = buildManualDutyBoundarySnapshot(
  correctedStart,
  "2026-09-03",
);

assert(
  correctedStart.evidence.length === 2,
  "A correction must retain the original audit evidence.",
);
assert(
  correctedSnapshot.actualDutyStartedAt === "2026-09-03T05:35:00.000Z" &&
    correctedSnapshot.additionalOtherWorkMinutes === 25,
  "The latest valid correction must become effective.",
);
passed += 1;

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      correctedStart,
      before({
        id: "wrong-revision-chain",
        source: "driver-correction",
        revisesEvidenceId: "manual-duty-start-2026-09-03",
        recordedAt: "2026-09-03T06:20:00.000Z",
      }),
    ),
  "A superseded entry must not be revised again.",
);

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      started,
      before({
        id: "driver-with-revision",
        source: "driver",
        revisesEvidenceId: "manual-duty-start-2026-09-03",
        recordedAt: "2026-09-03T06:20:00.000Z",
      }),
    ),
  "A revision must identify itself as a correction.",
);

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      started,
      after({
        id: "wrong-boundary-revision",
        source: "admin-correction",
        revisesEvidenceId: "manual-duty-start-2026-09-03",
        recordedAt: "2026-09-03T17:30:00.000Z",
      }),
    ),
  "A correction must preserve the original boundary.",
);

expectError(
  () =>
    recordManualDutyBoundaryEvidence(
      started,
      after({
        id: "ejected-before-inserted",
        startedAt: "2026-09-03T05:30:00.000Z",
        endedAt: "2026-09-03T05:50:00.000Z",
        cardEventAt: "2026-09-03T05:30:00.000Z",
        recordedAt: "2026-09-03T06:10:00.000Z",
      }),
    ),
  "Card ejection before insertion must be rejected.",
);

const insertedHistory = applyManualDutyBoundaryToActivityHistory(
  createInitialActivityHistory(),
  before(),
);

assert(
  insertedHistory.events.length === 1 &&
    insertedHistory.events[0]?.durationMilliseconds === 20 * 60_000 &&
    insertedHistory.activeEventId === null,
  "A missing pre-card period must project into activity history.",
);
passed += 1;

const alreadyCovered: ActivityHistoryState = {
  events: [
    {
      id: "live-other-work",
      activity: "other-work",
      startedAt: "2026-09-03T05:35:00.000Z",
      endedAt: "2026-09-03T06:15:00.000Z",
      durationMilliseconds: 40 * 60_000,
      source: "manual",
    },
  ],
  activeEventId: null,
};
const unchanged = applyManualDutyBoundaryToActivityHistory(
  alreadyCovered,
  before(),
);

assert(
  unchanged === alreadyCovered,
  "Already-recorded matching activity must not be duplicated.",
);
passed += 1;

expectError(
  () =>
    applyManualDutyBoundaryToActivityHistory(
      {
        events: [
          {
            id: "conflicting-break",
            activity: "break",
            startedAt: "2026-09-03T05:50:00.000Z",
            endedAt: "2026-09-03T06:05:00.000Z",
            durationMilliseconds: 15 * 60_000,
            source: "manual",
          },
        ],
        activeEventId: null,
      },
      before(),
    ),
  "Conflicting overlapping activity must not be silently overwritten.",
);

const activeHistory = startActivityHistory(
  "other-work",
  "2026-09-03T05:40:00.000Z",
  "manual",
);
const closedHistory = closeActiveActivityHistoryAt(
  activeHistory,
  "2026-09-03T17:25:00.000Z",
);

assert(
  closedHistory.activeEventId === null &&
    closedHistory.events[0]?.endedAt === "2026-09-03T17:25:00.000Z" &&
    closedHistory.events[0]?.durationMilliseconds === 705 * 60_000,
  "Actual duty finish must close the active activity at the chosen time.",
);
passed += 1;

expectError(
  () =>
    closeActiveActivityHistoryAt(
      createInitialActivityHistory(),
      "2026-09-03T17:25:00.000Z",
    ),
  "Finishing without an active activity must be rejected.",
);

expectError(
  () =>
    closeActiveActivityHistoryAt(
      activeHistory,
      "2026-09-03T05:30:00.000Z",
    ),
  "An activity cannot finish before it starts.",
);

const anotherDate = recordManualDutyBoundaryEvidence(
  started,
  before({
    id: "manual-duty-start-2026-09-04",
    dutyDate: "2026-09-04",
    startedAt: "2026-09-04T05:45:00.000Z",
    endedAt: "2026-09-04T06:00:00.000Z",
    cardEventAt: "2026-09-04T06:00:00.000Z",
    recordedAt: "2026-09-04T06:00:00.000Z",
  }),
);

assert(
  buildManualDutyBoundarySnapshot(anotherDate, "2026-09-03")
    .additionalOtherWorkMinutes === 20 &&
    buildManualDutyBoundarySnapshot(anotherDate, "2026-09-04")
      .additionalOtherWorkMinutes === 15,
  "Evidence for separate duty dates must remain isolated.",
);
passed += 1;

console.log(`✓ Manual duty-boundary scenarios passed (${passed}/${passed})`);
