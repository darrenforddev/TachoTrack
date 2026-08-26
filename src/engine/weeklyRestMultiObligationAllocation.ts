import type { WeeklyRestCompensationObligation } from "./weeklyRestCompensation";

import {
    allocateRestCompensation,
    type CompensationAllocation,
    type CompensationRestCandidate,
    type RestCompensationCalendarEvent,
} from "./weeklyRestCompensationAllocation";

export interface MultiObligationAllocationInput {
  obligations: WeeklyRestCompensationObligation[];

  rest: CompensationRestCandidate;
}

export interface MultiObligationAllocationResult {
  obligations: WeeklyRestCompensationObligation[];

  allocations: CompensationAllocation[];

  events: RestCompensationCalendarEvent[];

  totalAvailableCompensationMinutes: number;

  totalAppliedCompensationMinutes: number;

  unusedCompensationMinutes: number;
}

function sortObligationsOldestFirst(
  obligations: WeeklyRestCompensationObligation[],
): WeeklyRestCompensationObligation[] {
  return [...obligations].sort((a, b) => {
    const dateA = new Date(`${a.sourceDate}T00:00:00`).getTime();

    const dateB = new Date(`${b.sourceDate}T00:00:00`).getTime();

    if (dateA !== dateB) {
      return dateA - dateB;
    }

    return a.sourceWeekNumber - b.sourceWeekNumber;
  });
}

/**
 * --------------------------------------------------
 * MULTI-OBLIGATION ALLOCATION
 * --------------------------------------------------
 *
 * Compensation is applied oldest-first.
 *
 * The important invariant:
 *
 * One minute of qualifying surplus rest can only
 * be allocated once.
 */
export function allocateAcrossWeeklyRestObligations(
  input: MultiObligationAllocationInput,
): MultiObligationAllocationResult {
  const sortedObligations = sortObligationsOldestFirst(input.obligations);

  const totalAvailableCompensationMinutes = Math.max(
    0,
    input.rest.totalRestMinutes - input.rest.baseRequiredRestMinutes,
  );

  let remainingAvailableMinutes = totalAvailableCompensationMinutes;

  const updatedObligations: WeeklyRestCompensationObligation[] = [];

  const allocations: CompensationAllocation[] = [];

  const events: RestCompensationCalendarEvent[] = [];

  for (const obligation of sortedObligations) {
    /**
     * Already-completed obligations are
     * preserved but skipped.
     */
    if (obligation.remainingMinutes <= 0 || obligation.status === "completed") {
      updatedObligations.push(obligation);

      continue;
    }

    /**
     * No qualifying surplus remains.
     *
     * Preserve the remaining obligations
     * unchanged.
     */
    if (remainingAvailableMinutes <= 0) {
      updatedObligations.push(obligation);

      continue;
    }

    /**
     * Create a temporary rest candidate
     * whose surplus equals exactly the
     * amount still available for allocation.
     *
     * This lets us reuse the already-tested
     * single-obligation allocator.
     */
    const restForThisObligation: CompensationRestCandidate = {
      ...input.rest,

      totalRestMinutes:
        input.rest.baseRequiredRestMinutes + remainingAvailableMinutes,
    };

    const allocationResult = allocateRestCompensation(
      obligation,
      restForThisObligation,
    );

    updatedObligations.push(allocationResult.obligation);

    if (allocationResult.allocation) {
      allocations.push(allocationResult.allocation);

      remainingAvailableMinutes = Math.max(
        0,
        remainingAvailableMinutes - allocationResult.allocation.appliedMinutes,
      );
    }

    events.push(...allocationResult.events);
  }

  /**
   * Preserve original ordering for consumers
   * such as diary/calendar rendering.
   */
  const obligationById = new Map(
    updatedObligations.map((obligation) => [obligation.id, obligation]),
  );

  const obligationsInOriginalOrder = input.obligations.map(
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

    totalAvailableCompensationMinutes,

    totalAppliedCompensationMinutes,

    unusedCompensationMinutes: Math.max(
      0,
      totalAvailableCompensationMinutes - totalAppliedCompensationMinutes,
    ),
  };
}

/**
 * --------------------------------------------------
 * INVARIANT CHECK
 * --------------------------------------------------
 *
 * Handy for tests and later diagnostics.
 */
export function isMultiAllocationValid(
  result: MultiObligationAllocationResult,
): boolean {
  if (
    result.totalAppliedCompensationMinutes >
    result.totalAvailableCompensationMinutes
  ) {
    return false;
  }

  if (result.unusedCompensationMinutes < 0) {
    return false;
  }

  for (const obligation of result.obligations) {
    if (obligation.remainingMinutes < 0) {
      return false;
    }

    if (
      obligation.compensatedMinutes > obligation.requiredCompensationMinutes
    ) {
      return false;
    }
  }

  return true;
}
