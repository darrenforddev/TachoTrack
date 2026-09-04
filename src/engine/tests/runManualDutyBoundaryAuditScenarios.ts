import {
  createManualDutyBoundaryState,
  recordManualDutyBoundaryEvidence,
  type ManualDutyBoundaryEvidence,
  type ManualDutyBoundaryState,
} from "../manualDutyBoundary";
import {
  buildManualDutyAuditArchive,
  buildManualDutyAuditDay,
} from "../manualDutyBoundaryAudit";

let passed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Manual-duty audit scenario failed: ${message}`);
  }

  passed += 1;
  console.log(`✅ ${message}`);
}

function evidence(
  overrides: Partial<ManualDutyBoundaryEvidence> = {},
): ManualDutyBoundaryEvidence {
  return {
    id: "start-original",
    dutyDate: "2026-09-02",
    boundary: "before-card-insertion",
    activity: "other-work",
    startedAt: "2026-09-02T04:40:00.000Z",
    endedAt: "2026-09-02T05:00:00.000Z",
    cardEventAt: "2026-09-02T05:00:00.000Z",
    recordedAt: "2026-09-02T05:05:00.000Z",
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

const empty = buildManualDutyAuditArchive(createManualDutyBoundaryState());
assert(
  empty.dutyDayCount === 0 && empty.evidenceCount === 0,
  "An empty protected store produces an empty audit archive",
);

let state = record(createManualDutyBoundaryState(), evidence({ note: "Checks complete" }));
let day = buildManualDutyAuditDay(state, "2026-09-02");
assert(
  day.entries.length === 1 && day.entries[0]?.status === "effective",
  "A first entry is marked as effective",
);
assert(
  day.entries[0]?.revisionLabel === "Original entry" &&
    day.entries[0]?.sourceLabel === "Driver entry",
  "Original driver evidence receives clear audit labels",
);
assert(
  day.entries[0]?.boundaryLabel === "Start of duty" &&
    day.entries[0]?.reasonLabel === "Vehicle checks" &&
    day.entries[0]?.note === "Checks complete",
  "Boundary, reason and supporting note remain inspectable",
);

state = record(
  state,
  evidence({
    id: "start-correction-one",
    startedAt: "2026-09-02T04:35:00.000Z",
    recordedAt: "2026-09-02T05:10:00.000Z",
    source: "driver-correction",
    revisesEvidenceId: "start-original",
    activityAdjustment: {
      resolution: "replace-manual",
      conflicts: [
        {
          eventId: "manual-break",
          activity: "break",
          source: "manual",
          startedAt: "2026-09-01T20:00:00.000Z",
          endedAt: "2026-09-02T04:40:00.000Z",
          overlapStartedAt: "2026-09-02T04:35:00.000Z",
          overlapEndedAt: "2026-09-02T04:40:00.000Z",
          overlapMinutes: 5,
        },
      ],
    },
  }),
);
day = buildManualDutyAuditDay(state, "2026-09-02");
assert(
  day.entries[0]?.status === "superseded" &&
    day.entries[1]?.status === "effective" &&
    day.entries[1]?.revisionLabel === "Correction 1",
  "A correction preserves and supersedes the original evidence",
);
assert(
  day.entries[0]?.revisedByEvidenceId === "start-correction-one" &&
    day.entries[1]?.revisesEvidenceId === "start-original",
  "The revision chain is explicit in both directions",
);
assert(
  day.adjustedActivityCount === 1 &&
    day.adjustedOverlapMinutes === 5 &&
    day.entries[1]?.adjustment?.conflicts[0]?.eventId === "manual-break",
  "Manual overlap adjustments remain available for audit",
);
assert(
  day.effectiveActivityMinutes === 25 && day.correctionCount === 1,
  "Day totals use effective evidence without counting superseded time",
);

state = record(
  state,
  evidence({
    id: "finish-original",
    boundary: "after-card-ejection",
    activity: "other-work",
    startedAt: "2026-09-02T17:00:00.000Z",
    endedAt: "2026-09-02T17:20:00.000Z",
    cardEventAt: "2026-09-02T17:00:00.000Z",
    recordedAt: "2026-09-02T17:25:00.000Z",
    reason: "office-admin",
  }),
);
day = buildManualDutyAuditDay(state, "2026-09-02");
assert(
  day.status === "complete" && day.effectiveEvidenceCount === 2,
  "Effective start and finish evidence marks the audit day complete",
);

state = record(
  state,
  evidence({
    id: "later-day-start",
    dutyDate: "2026-09-04",
    startedAt: "2026-09-04T05:40:00.000Z",
    endedAt: "2026-09-04T06:00:00.000Z",
    cardEventAt: "2026-09-04T06:00:00.000Z",
    recordedAt: "2026-09-04T06:05:00.000Z",
  }),
);
const archive = buildManualDutyAuditArchive(state);
assert(
  archive.days.map((item) => item.dutyDate).join(",") ===
    "2026-09-04,2026-09-02",
  "Audit days are presented newest first",
);
assert(
  archive.evidenceCount === 4 &&
    archive.effectiveEvidenceCount === 3 &&
    archive.correctionCount === 1 &&
    archive.adjustedOverlapMinutes === 5,
  "Archive totals distinguish evidence, corrections and adjustments",
);

console.log("============================================================");
console.log(`MANUAL DUTY AUDIT RESULT: ${passed}/${passed} passed`);
console.log("✅ ALL MANUAL DUTY AUDIT SCENARIOS PASSED");
console.log("============================================================");
