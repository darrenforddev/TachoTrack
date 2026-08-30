import type { RestSession } from "../../data/restSession";

import { createWeeklyRestRecord } from "../weeklyRestHistory";

import {
    coordinateWeeklyRestObligation,
    type CoordinatedWeeklyRestObligation,
} from "../weeklyRestObligationCoordinator";

import { evaluateWeeklyRestCompensationEvidence } from "../weeklyRestCompensationEvidence";

import { allocateVerifiedWeeklyRestCompensation } from "../verifiedWeeklyRestCompensationAllocation";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(
      `Verified weekly-rest allocation scenario failed: ${message}`,
    );
  }
}

function completedWeeklySession(
  id: string,
  startedAt: string,
  endedAt: string,
): RestSession {
  const startTimestamp = new Date(startedAt).getTime();

  const endTimestamp = new Date(endedAt).getTime();

  return {
    id,

    type: "weekly",

    startedAt,

    endedAt,

    durationMilliseconds: endTimestamp - startTimestamp,

    status: "completed",
  };
}

const reducedWeeklyRest = createWeeklyRestRecord(
  "source-reduced-weekly-rest",
  "2026-08-29T12:00:00.000Z",
  "2026-08-30T12:00:00.000Z",
);

if (reducedWeeklyRest === null) {
  throw new Error("Source reduced weekly rest was not classified.");
}

const coordinated = coordinateWeeklyRestObligation({
  weeklyRest: reducedWeeklyRest,

  sourceWeekNumber: 35,

  sourceWeekReferenceDate: "2026-08-30",

  currentDate: "2026-08-30",
});

if (coordinated.obligation === null) {
  throw new Error("Source weekly rest did not create an obligation.");
}

const obligation = coordinated.obligation;

/**
 * SCENARIO 1
 * A verified 66h weekly rest supplies the full
 * 21h compensation block before the deadline.
 */
const validEvidence = evaluateWeeklyRestCompensationEvidence(
  completedWeeklySession(
    "valid-66h-weekly-rest",
    "2026-09-10T00:00:00.000Z",
    "2026-09-12T18:00:00.000Z",
  ),
);

const validAllocation = allocateVerifiedWeeklyRestCompensation(
  obligation,
  validEvidence,
);

assert(
  validAllocation.status === "allocated" &&
    validAllocation.rejectionReason === null &&
    validAllocation.allocationResult.obligation.status === "completed" &&
    validAllocation.allocationResult.obligation.remainingMinutes === 0,
  "A valid 66h rest should clear the 21h obligation.",
);

/**
 * SCENARIO 2
 * A verified 51h weekly rest contains only
 * 6h surplus and cannot partially compensate.
 */
const insufficientEvidence = evaluateWeeklyRestCompensationEvidence(
  completedWeeklySession(
    "insufficient-51h-weekly-rest",
    "2026-09-10T00:00:00.000Z",
    "2026-09-12T03:00:00.000Z",
  ),
);

const insufficientAllocation = allocateVerifiedWeeklyRestCompensation(
  obligation,
  insufficientEvidence,
);

assert(
  insufficientAllocation.status === "rejected" &&
    insufficientAllocation.rejectionReason === "insufficient-en-bloc-surplus" &&
    insufficientAllocation.allocationResult.obligation.remainingMinutes ===
      21 * 60,
  "A 6h surplus must not partially reduce a 21h obligation.",
);

/**
 * SCENARIO 3
 * Compensation rest cannot begin before
 * the source reduced weekly rest ended.
 */
const overlappingEvidence = evaluateWeeklyRestCompensationEvidence(
  completedWeeklySession(
    "overlapping-66h-weekly-rest",
    "2026-08-30T11:00:00.000Z",
    "2026-09-02T05:00:00.000Z",
  ),
);

const overlappingAllocation = allocateVerifiedWeeklyRestCompensation(
  obligation,
  overlappingEvidence,
);

assert(
  overlappingAllocation.status === "rejected" &&
    overlappingAllocation.rejectionReason ===
      "compensation-rest-starts-before-source-rest-ended",
  "An overlapping rest must not compensate the source obligation.",
);

/**
 * SCENARIO 4
 * Compensation rest must complete before
 * the legal deadline ends.
 */
const lateEvidence = evaluateWeeklyRestCompensationEvidence(
  completedWeeklySession(
    "late-66h-weekly-rest",
    "2026-09-19T12:00:00.000Z",
    "2026-09-22T06:00:00.000Z",
  ),
);

const lateAllocation = allocateVerifiedWeeklyRestCompensation(
  obligation,
  lateEvidence,
);

assert(
  lateAllocation.status === "rejected" &&
    lateAllocation.rejectionReason ===
      "compensation-rest-completes-after-deadline",
  "A rest completing after the deadline must be rejected.",
);

/**
 * SCENARIO 5
 * Rejected reduced-rest evidence cannot
 * reach the allocation engine.
 */
const reducedEvidence = evaluateWeeklyRestCompensationEvidence(
  completedWeeklySession(
    "reduced-30h-weekly-rest",
    "2026-09-10T00:00:00.000Z",
    "2026-09-11T06:00:00.000Z",
  ),
);

const rejectedEvidenceAllocation = allocateVerifiedWeeklyRestCompensation(
  obligation,
  reducedEvidence,
);

assert(
  rejectedEvidenceAllocation.status === "rejected" &&
    rejectedEvidenceAllocation.rejectionReason === "evidence-rejected",
  "Unverified reduced-rest evidence must not be allocated.",
);

/**
 * SCENARIO 6
 * A completed obligation cannot receive
 * compensation twice.
 */
const completedObligation = validAllocation.allocationResult
  .obligation as CoordinatedWeeklyRestObligation;

const repeatedAllocation = allocateVerifiedWeeklyRestCompensation(
  completedObligation,
  validEvidence,
);

assert(
  repeatedAllocation.status === "rejected" &&
    repeatedAllocation.rejectionReason === "obligation-already-completed",
  "A completed obligation must not be allocated twice.",
);

/**
 * SCENARIO 7
 * Invalid source-rest provenance blocks allocation.
 */
const invalidSourceObligation: CoordinatedWeeklyRestObligation = {
  ...obligation,

  sourceRestEnd: "invalid-timestamp",
};

const invalidSourceAllocation = allocateVerifiedWeeklyRestCompensation(
  invalidSourceObligation,
  validEvidence,
);

assert(
  invalidSourceAllocation.status === "rejected" &&
    invalidSourceAllocation.rejectionReason === "invalid-source-rest-end",
  "Invalid source-rest provenance must block allocation.",
);

/**
 * SCENARIO 8
 * A compensation rest may start at the exact
 * instant the source rest ends.
 */
const boundaryEvidence = evaluateWeeklyRestCompensationEvidence(
  completedWeeklySession(
    "boundary-66h-weekly-rest",
    "2026-08-30T12:00:00.000Z",
    "2026-09-02T06:00:00.000Z",
  ),
);

const boundaryAllocation = allocateVerifiedWeeklyRestCompensation(
  obligation,
  boundaryEvidence,
);

assert(
  boundaryAllocation.status === "allocated" &&
    boundaryAllocation.allocationResult.obligation.status === "completed",
  "A rest beginning exactly at the source-rest boundary should be accepted.",
);

/**
 * SCENARIO 9
 * Completed allocation synchronises all
 * diary compatibility fields.
 */
const synchronisedCompletedObligation = validAllocation.allocationResult
  .obligation as CoordinatedWeeklyRestObligation;

assert(
  synchronisedCompletedObligation.satisfiedMinutes === 21 * 60 &&
    synchronisedCompletedObligation.calendarVisible === false &&
    synchronisedCompletedObligation.hasOutstandingCompensation === false &&
    synchronisedCompletedObligation.overdue === false,
  "Completed allocation must synchronise diary compatibility fields.",
);

console.log(
  "✓ Verified weekly-rest compensation allocation scenarios passed (9/9)",
);
