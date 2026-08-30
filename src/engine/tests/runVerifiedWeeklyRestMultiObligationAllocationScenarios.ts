import type { RestSession } from "../../data/restSession";

import { createWeeklyRestRecord } from "../weeklyRestHistory";

import {
    coordinateWeeklyRestObligation,
    type CoordinatedWeeklyRestObligation,
} from "../weeklyRestObligationCoordinator";

import { evaluateWeeklyRestCompensationEvidence } from "../weeklyRestCompensationEvidence";

import { allocateVerifiedCompensationAcrossObligations } from "../verifiedWeeklyRestMultiObligationAllocation";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Verified multi-obligation scenario failed: ${message}`);
  }
}

function createObligation(
  id: string,
  restStart: string,
  restEnd: string,
  sourceWeekNumber: number,
  sourceWeekReferenceDate: string,
): CoordinatedWeeklyRestObligation {
  const weeklyRest = createWeeklyRestRecord(id, restStart, restEnd);

  if (weeklyRest === null) {
    throw new Error(`${id} could not be classified.`);
  }

  const coordinated = coordinateWeeklyRestObligation({
    weeklyRest,

    sourceWeekNumber,

    sourceWeekReferenceDate,

    currentDate: sourceWeekReferenceDate,
  });

  if (coordinated.obligation === null) {
    throw new Error(`${id} created no obligation.`);
  }

  return coordinated.obligation;
}

function evidenceWithWeeklySurplus(
  id: string,
  completedAt: string,
  surplusMinutes: number,
) {
  const totalRestMinutes = 45 * 60 + surplusMinutes;

  const endTimestamp = new Date(completedAt).getTime();

  const startTimestamp = endTimestamp - totalRestMinutes * 60 * 1000;

  const session: RestSession = {
    id,

    type: "weekly",

    startedAt: new Date(startTimestamp).toISOString(),

    endedAt: new Date(endTimestamp).toISOString(),

    durationMilliseconds: totalRestMinutes * 60 * 1000,

    status: "completed",
  };

  return evaluateWeeklyRestCompensationEvidence(session);
}

/**
 * Week 35:
 * 36h weekly rest creates 9h compensation.
 */
const week35 = createObligation(
  "week-35-rest",
  "2026-08-29T00:00:00.000Z",
  "2026-08-30T12:00:00.000Z",
  35,
  "2026-08-30",
);

/**
 * Week 36:
 * 39h weekly rest creates 6h compensation.
 */
const week36 = createObligation(
  "week-36-rest",
  "2026-09-05T00:00:00.000Z",
  "2026-09-06T15:00:00.000Z",
  36,
  "2026-09-06",
);

/**
 * SCENARIO 1
 * 20h surplus clears complete 9h and 6h
 * obligations, leaving 5h unused.
 */
const twentyHourResult = allocateVerifiedCompensationAcrossObligations(
  [week36, week35],
  evidenceWithWeeklySurplus(
    "rest-20h-surplus",
    "2026-09-19T00:00:00.000Z",
    20 * 60,
  ),
);

assert(
  twentyHourResult.totalAvailableCompensationMinutes === 20 * 60 &&
    twentyHourResult.totalAppliedCompensationMinutes === 15 * 60 &&
    twentyHourResult.unusedCompensationMinutes === 5 * 60 &&
    twentyHourResult.obligations.every(
      (obligation) => obligation.status === "completed",
    ),
  "20h surplus should clear both complete obligations.",
);

/**
 * SCENARIO 2
 * 12h surplus clears only the 9h obligation.
 */
const twelveHourResult = allocateVerifiedCompensationAcrossObligations(
  [week35, week36],
  evidenceWithWeeklySurplus(
    "rest-12h-surplus",
    "2026-09-19T00:00:00.000Z",
    12 * 60,
  ),
);

assert(
  twelveHourResult.totalAppliedCompensationMinutes === 9 * 60 &&
    twelveHourResult.unusedCompensationMinutes === 3 * 60 &&
    twelveHourResult.obligations[0].status === "completed" &&
    twelveHourResult.obligations[1].status === "outstanding" &&
    twelveHourResult.obligations[1].remainingMinutes === 6 * 60,
  "12h surplus must not partially reduce the 6h obligation.",
);

/**
 * SCENARIO 3
 * 5h surplus cannot satisfy either obligation.
 */
const fiveHourResult = allocateVerifiedCompensationAcrossObligations(
  [week35, week36],
  evidenceWithWeeklySurplus(
    "rest-5h-surplus",
    "2026-09-19T00:00:00.000Z",
    5 * 60,
  ),
);

assert(
  fiveHourResult.allocations.length === 0 &&
    fiveHourResult.totalAppliedCompensationMinutes === 0 &&
    fiveHourResult.unusedCompensationMinutes === 5 * 60 &&
    fiveHourResult.obligations.every(
      (obligation) => obligation.status === "outstanding",
    ),
  "5h surplus must remain unused.",
);

/**
 * SCENARIO 4
 * Candidate after Week 35's deadline may still
 * clear Week 36 before its later deadline.
 */
const laterCandidateResult = allocateVerifiedCompensationAcrossObligations(
  [week35, week36],
  evidenceWithWeeklySurplus(
    "rest-later-9h-surplus",
    "2026-09-22T00:00:00.000Z",
    9 * 60,
  ),
);

assert(
  laterCandidateResult.obligations[0].status === "outstanding" &&
    laterCandidateResult.obligations[1].status === "completed" &&
    laterCandidateResult.totalAppliedCompensationMinutes === 6 * 60 &&
    laterCandidateResult.unusedCompensationMinutes === 3 * 60 &&
    laterCandidateResult.rejections.some(
      (rejection) =>
        rejection.obligationId === week35.id &&
        rejection.rejectionReason ===
          "compensation-rest-completes-after-deadline",
    ),
  "A late Week 35 candidate may still clear the later Week 36 obligation.",
);

/**
 * SCENARIO 5
 * Rejected evidence cannot allocate anything.
 */
const rejectedEvidence = evaluateWeeklyRestCompensationEvidence({
  id: "reduced-30h-rest",

  type: "weekly",

  startedAt: "2026-09-18T00:00:00.000Z",

  endedAt: "2026-09-19T06:00:00.000Z",

  durationMilliseconds: 30 * 60 * 60 * 1000,

  status: "completed",
});

const rejectedEvidenceResult = allocateVerifiedCompensationAcrossObligations(
  [week35, week36],
  rejectedEvidence,
);

assert(
  rejectedEvidenceResult.evidenceAccepted === false &&
    rejectedEvidenceResult.allocations.length === 0 &&
    rejectedEvidenceResult.events.length === 0,
  "Rejected evidence must not reach allocation.",
);

/**
 * SCENARIO 6
 * Original obligation order is preserved.
 */
assert(
  twentyHourResult.obligations[0].id === week36.id &&
    twentyHourResult.obligations[1].id === week35.id,
  "Returned obligations should preserve input order.",
);

/**
 * SCENARIO 7
 * Applied minutes never exceed verified surplus.
 */
assert(
  twentyHourResult.totalAppliedCompensationMinutes <=
    twentyHourResult.totalAvailableCompensationMinutes &&
    twentyHourResult.unusedCompensationMinutes >= 0,
  "Verified surplus must never be double counted.",
);

console.log("✓ Verified weekly-rest multi-obligation scenarios passed (7/7)");
