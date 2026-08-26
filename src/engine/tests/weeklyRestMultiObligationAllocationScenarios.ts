import type { WeeklyRestCompensationObligation } from "../weeklyRestCompensation";

import {
    allocateAcrossWeeklyRestObligations,
    isMultiAllocationValid,
    type MultiObligationAllocationResult,
} from "../weeklyRestMultiObligationAllocation";

import type { CompensationRestCandidate } from "../weeklyRestCompensationAllocation";

type ScenarioResult = {
  name: string;
  passed: boolean;
  details: string;
};

function result(
  name: string,
  passed: boolean,
  details: string,
): ScenarioResult {
  return {
    name,
    passed,
    details,
  };
}

function obligation(
  id: string,
  sourceWeekNumber: number,
  sourceDate: string,
  requiredMinutes: number,
  compensatedMinutes = 0,
  status: WeeklyRestCompensationObligation["status"] = "outstanding",
): WeeklyRestCompensationObligation {
  return {
    id,

    sourceWeekNumber,

    sourceDate,

    weeklyRestMinutesTaken: 45 * 60 - requiredMinutes,

    requiredCompensationMinutes: requiredMinutes,

    compensatedMinutes,

    remainingMinutes: Math.max(0, requiredMinutes - compensatedMinutes),

    dueDate: "2026-09-30",

    status,
  };
}

function rest(
  id: string,
  date: string,
  surplusMinutes: number,
): CompensationRestCandidate {
  return {
    id,
    date,

    baseRequiredRestMinutes: 45 * 60,

    totalRestMinutes: 45 * 60 + surplusMinutes,
  };
}

function findObligation(
  resultValue: MultiObligationAllocationResult,
  id: string,
) {
  return resultValue.obligations.find((item) => item.id === id);
}

const scenarios: ScenarioResult[] = [];

/**
 * --------------------------------------------------
 * BASE OBLIGATIONS
 *
 * Week 35 → 9h owed
 * Week 36 → 6h owed
 * --------------------------------------------------
 */

const week35 = obligation("week-35-obligation", 35, "2026-08-30", 9 * 60);

const week36 = obligation("week-36-obligation", 36, "2026-09-06", 6 * 60);

/**
 * --------------------------------------------------
 * SCENARIO 1
 *
 * 12h available.
 *
 * Oldest first:
 * Week 35 gets 9h.
 * Week 36 gets 3h.
 * --------------------------------------------------
 */

const twelveHours = allocateAcrossWeeklyRestObligations({
  obligations: [week35, week36],

  rest: rest("rest-12h", "2026-09-19", 12 * 60),
});

const week35After12 = findObligation(twelveHours, week35.id);

const week36After12 = findObligation(twelveHours, week36.id);

scenarios.push(
  result(
    "12h surplus clears oldest 9h debt then applies 3h to next",

    week35After12?.remainingMinutes === 0 &&
      week35After12?.status === "completed" &&
      week36After12?.compensatedMinutes === 3 * 60 &&
      week36After12?.remainingMinutes === 3 * 60,

    `Week35 remaining: ${
      week35After12?.remainingMinutes ?? -1
    }, Week36 remaining: ${week36After12?.remainingMinutes ?? -1}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 *
 * Total allocation must equal 12h.
 * --------------------------------------------------
 */

scenarios.push(
  result(
    "12h surplus is never double counted",

    twelveHours.totalAvailableCompensationMinutes === 12 * 60 &&
      twelveHours.totalAppliedCompensationMinutes === 12 * 60 &&
      twelveHours.unusedCompensationMinutes === 0,

    `Available: ${twelveHours.totalAvailableCompensationMinutes}, applied: ${
      twelveHours.totalAppliedCompensationMinutes
    }`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 *
 * Exactly enough to clear first obligation only.
 * --------------------------------------------------
 */

const exactNine = allocateAcrossWeeklyRestObligations({
  obligations: [week35, week36],

  rest: rest("rest-9h", "2026-09-19", 9 * 60),
});

const week35After9 = findObligation(exactNine, week35.id);

const week36After9 = findObligation(exactNine, week36.id);

scenarios.push(
  result(
    "Exactly 9h clears first obligation and leaves second untouched",

    week35After9?.remainingMinutes === 0 &&
      week36After9?.remainingMinutes === 6 * 60 &&
      week36After9?.compensatedMinutes === 0,

    `Week36 remaining: ${week36After9?.remainingMinutes ?? -1}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 *
 * Smaller than first obligation.
 *
 * 5h applied only to Week 35.
 * --------------------------------------------------
 */

const fiveHours = allocateAcrossWeeklyRestObligations({
  obligations: [week35, week36],

  rest: rest("rest-5h", "2026-09-19", 5 * 60),
});

const week35After5 = findObligation(fiveHours, week35.id);

const week36After5 = findObligation(fiveHours, week36.id);

scenarios.push(
  result(
    "5h surplus applies only to oldest obligation",

    week35After5?.compensatedMinutes === 5 * 60 &&
      week35After5?.remainingMinutes === 4 * 60 &&
      week36After5?.compensatedMinutes === 0,

    `Week35 remaining: ${week35After5?.remainingMinutes ?? -1}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 *
 * Enough to clear all obligations.
 *
 * Total debt = 15h
 * Surplus = 20h
 * Unused = 5h
 * --------------------------------------------------
 */

const twentyHours = allocateAcrossWeeklyRestObligations({
  obligations: [week35, week36],

  rest: rest("rest-20h", "2026-09-19", 20 * 60),
});

scenarios.push(
  result(
    "20h surplus clears both obligations and leaves 5h unused",

    twentyHours.totalAppliedCompensationMinutes === 15 * 60 &&
      twentyHours.unusedCompensationMinutes === 5 * 60 &&
      twentyHours.obligations.every((item) => item.remainingMinutes === 0),

    `Applied: ${twentyHours.totalAppliedCompensationMinutes}, unused: ${
      twentyHours.unusedCompensationMinutes
    }`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 *
 * Already completed obligation must be skipped.
 * --------------------------------------------------
 */

const completedWeek35 = obligation(
  "completed-week-35",
  35,
  "2026-08-30",
  9 * 60,
  9 * 60,
  "completed",
);

const skipCompleted = allocateAcrossWeeklyRestObligations({
  obligations: [completedWeek35, week36],

  rest: rest("rest-4h", "2026-09-19", 4 * 60),
});

const week36AfterSkip = findObligation(skipCompleted, week36.id);

scenarios.push(
  result(
    "Completed obligation is skipped",

    week36AfterSkip?.compensatedMinutes === 4 * 60 &&
      week36AfterSkip?.remainingMinutes === 2 * 60 &&
      skipCompleted.totalAppliedCompensationMinutes === 4 * 60,

    `Week36 remaining: ${week36AfterSkip?.remainingMinutes ?? -1}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 *
 * Zero surplus changes nothing.
 * --------------------------------------------------
 */

const zeroSurplus = allocateAcrossWeeklyRestObligations({
  obligations: [week35, week36],

  rest: rest("rest-zero", "2026-09-19", 0),
});

scenarios.push(
  result(
    "Zero surplus changes no obligations",

    zeroSurplus.totalAppliedCompensationMinutes === 0 &&
      zeroSurplus.allocations.length === 0 &&
      zeroSurplus.events.length === 0 &&
      findObligation(zeroSurplus, week35.id)?.remainingMinutes === 9 * 60 &&
      findObligation(zeroSurplus, week36.id)?.remainingMinutes === 6 * 60,

    `Applied: ${zeroSurplus.totalAppliedCompensationMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 *
 * Input arrives in reverse order.
 *
 * Engine should still allocate oldest-first.
 * --------------------------------------------------
 */

const reverseInput = allocateAcrossWeeklyRestObligations({
  obligations: [week36, week35],

  rest: rest("rest-reverse", "2026-09-19", 10 * 60),
});

const oldAfterReverse = findObligation(reverseInput, week35.id);

const newAfterReverse = findObligation(reverseInput, week36.id);

scenarios.push(
  result(
    "Allocation order is deterministic oldest-first",

    oldAfterReverse?.remainingMinutes === 0 &&
      newAfterReverse?.compensatedMinutes === 1 * 60,

    `Older remaining: ${
      oldAfterReverse?.remainingMinutes ?? -1
    }, newer compensated: ${newAfterReverse?.compensatedMinutes ?? -1}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 *
 * Original array order is preserved for consumers.
 * --------------------------------------------------
 */

scenarios.push(
  result(
    "Returned obligations preserve original input order",

    reverseInput.obligations[0]?.id === week36.id &&
      reverseInput.obligations[1]?.id === week35.id,

    `Order: ${reverseInput.obligations.map((item) => item.id).join(", ")}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 *
 * Allocation events should include a clear event
 * for Week 35 and partial application for Week 36.
 * --------------------------------------------------
 */

scenarios.push(
  result(
    "Multi allocation preserves per-obligation audit events",

    twelveHours.events.some(
      (event) =>
        event.type === "compensation-cleared" && event.sourceWeekNumber === 35,
    ) &&
      twelveHours.events.some(
        (event) =>
          event.type === "compensation-applied" &&
          event.sourceWeekNumber === 36,
      ),

    `Events: ${twelveHours.events
      .map((event) => `${event.sourceWeekNumber}:${event.type}`)
      .join(", ")}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 11
 *
 * Three obligations.
 *
 * One rest must allocate across all three
 * without double counting.
 * --------------------------------------------------
 */

const week37 = obligation("week-37-obligation", 37, "2026-09-13", 3 * 60);

const threeObligations = allocateAcrossWeeklyRestObligations({
  obligations: [week37, week35, week36],

  rest: rest("rest-18h", "2026-09-20", 18 * 60),
});

scenarios.push(
  result(
    "18h surplus clears 9h + 6h + 3h obligations",

    threeObligations.totalAppliedCompensationMinutes === 18 * 60 &&
      threeObligations.unusedCompensationMinutes === 0 &&
      threeObligations.obligations.every((item) => item.remainingMinutes === 0),

    `Applied: ${threeObligations.totalAppliedCompensationMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 12
 *
 * Core invariant checker accepts valid result.
 * --------------------------------------------------
 */

scenarios.push(
  result(
    "Invariant checker accepts valid allocation",

    isMultiAllocationValid(twelveHours) === true,

    `Valid: ${isMultiAllocationValid(twelveHours)}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 13
 *
 * Total allocations must always equal
 * the sum of allocation records.
 * --------------------------------------------------
 */

const summedAllocations = twelveHours.allocations.reduce(
  (total, allocation) => total + allocation.appliedMinutes,
  0,
);

scenarios.push(
  result(
    "Allocation summary matches individual records",

    summedAllocations === twelveHours.totalAppliedCompensationMinutes,

    `Records: ${summedAllocations}, summary: ${
      twelveHours.totalAppliedCompensationMinutes
    }`,
  ),
);

export const weeklyRestMultiObligationScenarioResults = scenarios;

export const weeklyRestMultiObligationScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
