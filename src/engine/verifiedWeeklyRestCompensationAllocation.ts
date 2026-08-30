import {
    allocateRestCompensation,
    calculateAvailableCompensationMinutes,
    type CompensationAllocationResult,
} from "./weeklyRestCompensationAllocation";

import type { WeeklyRestCompensationEvidence } from "./weeklyRestCompensationEvidence";

import {
    synchroniseCoordinatedWeeklyRestObligation,
    type CoordinatedWeeklyRestObligation,
} from "./weeklyRestObligationCoordinator";

export type VerifiedAllocationRejectionReason =
  | "evidence-rejected"
  | "invalid-source-rest-end"
  | "invalid-candidate-timestamps"
  | "compensation-rest-starts-before-source-rest-ended"
  | "compensation-rest-completes-after-deadline"
  | "obligation-already-completed"
  | "insufficient-en-bloc-surplus"
  | "allocation-rejected";

export interface VerifiedWeeklyRestAllocationResult {
  status: "allocated" | "rejected";

  rejectionReason: VerifiedAllocationRejectionReason | null;

  allocationResult: CompensationAllocationResult;
}

function unchangedResult(
  obligation: CoordinatedWeeklyRestObligation,
): CompensationAllocationResult {
  return {
    obligation,

    allocation: null,

    events: [],
  };
}

function reject(
  obligation: CoordinatedWeeklyRestObligation,
  rejectionReason: VerifiedAllocationRejectionReason,
): VerifiedWeeklyRestAllocationResult {
  return {
    status: "rejected",

    rejectionReason,

    allocationResult: unchangedResult(obligation),
  };
}

function endOfLocalDate(date: string): number {
  return new Date(`${date}T23:59:59.999`).getTime();
}

export function allocateVerifiedWeeklyRestCompensation(
  obligation: CoordinatedWeeklyRestObligation,
  evidence: WeeklyRestCompensationEvidence,
): VerifiedWeeklyRestAllocationResult {
  if (evidence.status !== "verified" || evidence.candidate === null) {
    return reject(obligation, "evidence-rejected");
  }

  if (obligation.remainingMinutes <= 0 || obligation.status === "completed") {
    return reject(obligation, "obligation-already-completed");
  }

  const sourceRestEndTimestamp = new Date(obligation.sourceRestEnd).getTime();

  if (!Number.isFinite(sourceRestEndTimestamp)) {
    return reject(obligation, "invalid-source-rest-end");
  }

  const candidateStartTimestamp = new Date(
    evidence.candidate.startedAt,
  ).getTime();

  const candidateEndTimestamp = new Date(evidence.candidate.endedAt).getTime();

  if (
    !Number.isFinite(candidateStartTimestamp) ||
    !Number.isFinite(candidateEndTimestamp) ||
    candidateEndTimestamp <= candidateStartTimestamp
  ) {
    return reject(obligation, "invalid-candidate-timestamps");
  }

  if (candidateStartTimestamp < sourceRestEndTimestamp) {
    return reject(
      obligation,
      "compensation-rest-starts-before-source-rest-ended",
    );
  }

  const deadlineTimestamp = endOfLocalDate(obligation.dueDate);

  if (
    !Number.isFinite(deadlineTimestamp) ||
    candidateEndTimestamp > deadlineTimestamp
  ) {
    return reject(obligation, "compensation-rest-completes-after-deadline");
  }

  const availableCompensationMinutes = calculateAvailableCompensationMinutes(
    evidence.candidate,
  );

  if (availableCompensationMinutes < obligation.requiredCompensationMinutes) {
    return reject(obligation, "insufficient-en-bloc-surplus");
  }

  const allocationResult = allocateRestCompensation(
    obligation,
    evidence.candidate,
  );

  if (allocationResult.allocation === null) {
    return {
      status: "rejected",

      rejectionReason: "allocation-rejected",

      allocationResult,
    };
  }

  const synchronisedObligation = synchroniseCoordinatedWeeklyRestObligation(
    allocationResult.obligation as CoordinatedWeeklyRestObligation,
  );

  return {
    status: "allocated",

    rejectionReason: null,

    allocationResult: {
      ...allocationResult,

      obligation: synchronisedObligation,
    },
  };
}
