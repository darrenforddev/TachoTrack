import {
  createManualDutyBoundaryState,
  recordManualDutyBoundaryEvidence,
  type ManualDutyBoundaryEvidence,
  type ManualDutyBoundaryState,
} from "../manualDutyBoundary";
import {
  isManualDutyActivityPeriod,
  projectManualDutyBoundariesOntoDriverDay,
  projectManualDutyBoundariesOntoDriverDays,
} from "../manualDutyDriverDayAdapter";
import type { DriverDay } from "../types";

let passed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Manual-duty DriverDay scenario failed: ${message}`);
  }

  passed += 1;
  console.log(`✅ ${message}`);
}

function driverDay(overrides: Partial<DriverDay> = {}): DriverDay {
  return {
    id: "day-2026-09-02",
    date: "2026-09-02",
    activities: [],
    drivingMinutes: 480,
    otherWorkMinutes: 60,
    breakMinutes: 45,
    poaMinutes: 0,
    restMinutes: 660,
    dailyRestType: "regular",
    ...overrides,
  };
}

function evidence(
  overrides: Partial<ManualDutyBoundaryEvidence> = {},
): ManualDutyBoundaryEvidence {
  return {
    id: "start-original",
    dutyDate: "2026-09-02",
    boundary: "before-card-insertion",
    activity: "other-work",
    startedAt: "2026-09-02T05:40:00.000Z",
    endedAt: "2026-09-02T06:00:00.000Z",
    cardEventAt: "2026-09-02T06:00:00.000Z",
    recordedAt: "2026-09-02T06:05:00.000Z",
    reason: "vehicle-checks",
    source: "driver",
    ...overrides,
  };
}

function record(
  state: ManualDutyBoundaryState,
  item: ManualDutyBoundaryEvidence,
): ManualDutyBoundaryState {
  return recordManualDutyBoundaryEvidence(state, item);
}

const emptyState = createManualDutyBoundaryState();
const emptyDay = driverDay();
const unchanged = projectManualDutyBoundariesOntoDriverDay(emptyDay, emptyState);
assert(
  unchanged.day === emptyDay && unchanged.summary.entryCount === 0,
  "A day without manual evidence remains unchanged",
);

let state = record(emptyState, evidence());
let projection = projectManualDutyBoundariesOntoDriverDay(driverDay(), state);
assert(
  projection.day.otherWorkMinutes === 80 &&
    projection.day.activities[0]?.durationMinutes === 20,
  "Before-card Other Work is added to the archived day and totals",
);
assert(
  projection.summary.totalMinutes === 20 &&
    projection.summary.appliedMinutes === 20 &&
    projection.summary.conflictingMinutes === 0,
  "Applied manual-duty minutes are explained by the projection summary",
);
assert(
  isManualDutyActivityPeriod(projection.day.activities[0]!),
  "Projected activity is visibly identifiable as manual-duty evidence",
);

const projectedAgain = projectManualDutyBoundariesOntoDriverDay(
  projection.day,
  state,
);
assert(
  projectedAgain.day.otherWorkMinutes === 80 &&
    projectedAgain.day.activities.length === 1 &&
    projectedAgain.summary.alreadyPresentMinutes === 20,
  "Applying the same evidence twice is idempotent",
);

state = record(
  state,
  evidence({
    id: "finish-original",
    boundary: "after-card-ejection",
    activity: "poa",
    startedAt: "2026-09-02T17:00:00.000Z",
    endedAt: "2026-09-02T17:15:00.000Z",
    cardEventAt: "2026-09-02T17:00:00.000Z",
    recordedAt: "2026-09-02T17:20:00.000Z",
    reason: "waiting-known-in-advance",
  }),
);
projection = projectManualDutyBoundariesOntoDriverDay(driverDay(), state);
assert(
  projection.day.otherWorkMinutes === 80 &&
    projection.day.poaMinutes === 15 &&
    projection.summary.entryCount === 2,
  "Start and finish evidence can update different legal activity totals",
);

state = record(
  state,
  evidence({
    id: "start-correction",
    startedAt: "2026-09-02T05:35:00.000Z",
    recordedAt: "2026-09-02T17:25:00.000Z",
    source: "driver-correction",
    revisesEvidenceId: "start-original",
  }),
);
projection = projectManualDutyBoundariesOntoDriverDay(driverDay(), state);
assert(
  projection.summary.entryCount === 2 &&
    projection.summary.totalMinutes === 40 &&
    projection.day.otherWorkMinutes === 85,
  "Only the effective correction contributes to the DriverDay",
);

const sameActivityPresent = projectManualDutyBoundariesOntoDriverDay(
  driverDay({
    activities: [
      {
        id: "existing-manual-projection",
        type: "otherWork",
        start: "2026-09-02T05:35:00.000Z",
        end: "2026-09-02T06:00:00.000Z",
        durationMinutes: 25,
      },
    ],
    otherWorkMinutes: 85,
  }),
  state,
);
assert(
  sameActivityPresent.day.otherWorkMinutes === 85 &&
    sameActivityPresent.summary.alreadyPresentMinutes === 25,
  "Equivalent archived activity is recognized without double-counting",
);

const conflict = projectManualDutyBoundariesOntoDriverDay(
  driverDay({
    activities: [
      {
        id: "recorded-drive",
        type: "driving",
        start: "2026-09-02T05:50:00.000Z",
        end: "2026-09-02T06:10:00.000Z",
        durationMinutes: 20,
      },
    ],
  }),
  state,
);
assert(
  conflict.day.otherWorkMinutes === 75 &&
    conflict.summary.appliedMinutes === 30 &&
    conflict.summary.conflictingMinutes === 10,
  "Conflicting archived time is not double-counted and is exposed for review",
);

const partialSameActivity = projectManualDutyBoundariesOntoDriverDay(
  driverDay({
    activities: [
      {
        id: "partial-other-work",
        type: "otherWork",
        start: "2026-09-02T05:35:00.000Z",
        end: "2026-09-02T05:45:00.000Z",
        durationMinutes: 10,
      },
    ],
    otherWorkMinutes: 70,
  }),
  state,
);
assert(
  partialSameActivity.day.otherWorkMinutes === 85 &&
    partialSameActivity.summary.alreadyPresentMinutes === 10 &&
    partialSameActivity.summary.appliedMinutes === 30,
  "Partially represented evidence adds only its uncovered minutes",
);

const anotherDay = driverDay({ id: "day-2026-09-03", date: "2026-09-03" });
const multiple = projectManualDutyBoundariesOntoDriverDays(
  [driverDay(), anotherDay],
  state,
);
assert(
  multiple.days[0]?.otherWorkMinutes === 85 &&
    multiple.days[1] === anotherDay &&
    multiple.summariesByDate.get("2026-09-03")?.entryCount === 0,
  "A collection projects evidence only onto its matching duty date",
);

const originalDay = driverDay();
projectManualDutyBoundariesOntoDriverDay(originalDay, state);
assert(
  originalDay.otherWorkMinutes === 60 && originalDay.activities.length === 0,
  "Projection never mutates the stored DriverDay",
);

const liveProjection = {
  id: "manual-duty-start-correction-1788332400000",
  type: "otherWork" as const,
  start: "2026-09-02T05:35:00.000Z",
  end: "2026-09-02T06:00:00.000Z",
  durationMinutes: 25,
};
assert(
  isManualDutyActivityPeriod(liveProjection),
  "Live Activity History projections use the same manual-evidence marker",
);

console.log("============================================================");
console.log(`MANUAL DUTY DRIVERDAY RESULT: ${passed}/${passed} passed`);
console.log("✅ ALL MANUAL DUTY DRIVERDAY SCENARIOS PASSED");
console.log("============================================================");
