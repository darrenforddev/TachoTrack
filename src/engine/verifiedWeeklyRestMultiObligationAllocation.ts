import type {
    CompensationAllocation,
    RestCompensationCalendarEvent,
} from "./weeklyRestCompensationAllocation";

import { calculateAvailableCompensationMinutes } from "./weeklyRestCompensationAllocation";

import type { WeeklyRestCompensationEvidence } from "./weeklyRestCompensationEvidence";

import type { CoordinatedWeeklyRestObligation } from "./weeklyRestObligationCoordinator";

import {
    allocateVerifiedWeeklyRestCompensation,
    type VerifiedAllocationRejectionReason,
} from "./verifiedWeeklyRestCompensationAllocation";

export interface VerifiedObligationRejection {
  obligationId: string;

  rejectionReason: VerifiedAllocationRejectionReason;
}

export interface VerifiedMultiObligationAllocationResult {
  obligations: CoordinatedWeeklyRestObligation[];

  allocations: CompensationAllocation[];

  events: RestCompensationCalendarEvent[];

  rejections: VerifiedObligationRejection[];

  evidenceAccepted: boolean;

  totalAvailableCompensationMinutes: number;

  totalAppliedCompensationMinutes: number;

  unusedCompensationMinutes: number;
}

function sortObligationsOldestFirst(
  obligations: CoordinatedWeeklyRestObligation[],
): CoordinatedWeeklyRestObligation[] {
  return [...obligations].sort((a, b) => {
    const endA = new Date(a.sourceRestEnd).getTime();

    const endB = new Date(b.sourceRestEnd).getTime();

    if (endA !== endB) {
      return endA - endB;
    }

    return a.sourceWeekNumber - b.sourceWeekNumber;
  });
}

export function allocateVerifiedCompensationAcrossObligations(
  obligations: CoordinatedWeeklyRestObligation[],
  evidence: WeeklyRestCompensationEvidence,
): VerifiedMultiObligationAllocationResult {
  if (evidence.status !== "verified" || evidence.candidate === null) {
    return {
      obligations,

      allocations: [],

      events: [],

      rejections: [],

      evidenceAccepted: false,

      totalAvailableCompensationMinutes: 0,

      totalAppliedCompensationMinutes: 0,

      unusedCompensationMinutes: 0,
    };
  }

  const totalAvailableCompensationMinutes =
    calculateAvailableCompensationMinutes(evidence.candidate);

  let remainingAvailableMinutes = totalAvailableCompensationMinutes;

  const updatedObligations: CoordinatedWeeklyRestObligation[] = [];

  const allocations: CompensationAllocation[] = [];

  const events: RestCompensationCalendarEvent[] = [];

  const rejections: VerifiedObligationRejection[] = [];

  const sortedObligations = sortObligationsOldestFirst(obligations);

  for (const obligation of sortedObligations) {
    if (obligation.remainingMinutes <= 0 || obligation.status === "completed") {
      updatedObligations.push(obligation);

      continue;
    }

    /**
     * One obligation must be satisfied en bloc.
     *
     * If the remaining continuous surplus is
     * insufficient, preserve this obligation and
     * continue so a smaller later obligation may
     * still be satisfied in full.
     */
    if (remainingAvailableMinutes < obligation.requiredCompensationMinutes) {
      updatedObligations.push(obligation);

      continue;
    }

    const result = allocateVerifiedWeeklyRestCompensation(obligation, evidence);

    if (
      result.status !== "allocated" ||
      result.allocationResult.allocation === null
    ) {
      updatedObligations.push(obligation);

      if (result.rejectionReason !== null) {
        rejections.push({
          obligationId: obligation.id,

          rejectionReason: result.rejectionReason,
        });
      }

      continue;
    }

    const updatedObligation = result.allocationResult
      .obligation as CoordinatedWeeklyRestObligation;

    updatedObligations.push(updatedObligation);

    allocations.push(result.allocationResult.allocation);

    events.push(...result.allocationResult.events);

    remainingAvailableMinutes = Math.max(
      0,
      remainingAvailableMinutes -
        result.allocationResult.allocation.appliedMinutes,
    );
  }

  const obligationById = new Map(
    updatedObligations.map((obligation) => [obligation.id, obligation]),
  );

  const obligationsInOriginalOrder = obligations.map(
    (obligation) => obligationById.get(obligation.id) ?? obligation,
  );

  const totalAppliedCompensationMinutes = allocations.reduce(
    (total, allocation) => total + allocation.appliedMinutes,
    0,
  );

  return {
    obligations: obligationsInOriginalOrder,

    allocations,

    events,

    rejections,

    evidenceAccepted: true,

    totalAvailableCompensationMinutes,

    totalAppliedCompensationMinutes,

    unusedCompensationMinutes: Math.max(
      0,
      totalAvailableCompensationMinutes - totalAppliedCompensationMinutes,
    ),
  };
}
