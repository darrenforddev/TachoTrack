import {
    allocateRestCompensation,
    calculateAvailableCompensationMinutes,
    createCompensationCreatedEvent,
    createCompensationOverdueEvent,
    type CompensationRestCandidate,
} from "../weeklyRestCompensationAllocation";

import type { WeeklyRestCompensationObligation } from "../weeklyRestCompensation";

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

const scenarios: ScenarioResult[] = [];

/**
 * Base test obligation:
 *
 * Week 35 reduced weekly rest
 * 21h compensation owed
 */
const obligation: WeeklyRestCompensationObligation = {
  id: "week-35-comp",

  sourceWeekNumber: 35,

  sourceDate: "2026-08-30",

  weeklyRestMinutesTaken: 24 * 60,

  requiredCompensationMinutes: 21 * 60,

  compensatedMinutes: 0,

  remainingMinutes: 21 * 60,

  dueDate: "2026-09-20",

  status: "outstanding",
};

/**
 * --------------------------------------------------
 * SCENARIO 1
 *
 * 54h rest against 45h base
 * creates 9h available compensation.
 * --------------------------------------------------
 */
const rest54: CompensationRestCandidate = {
  id: "rest-54h",

  date: "2026-09-12",

  totalRestMinutes: 54 * 60,

  baseRequiredRestMinutes: 45 * 60,
};

const available54 = calculateAvailableCompensationMinutes(rest54);

scenarios.push(
  result(
    "54h rest provides 9h compensation surplus",

    available54 === 9 * 60,

    `Available: ${available54} minutes`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 *
 * 45h rest creates no surplus.
 * --------------------------------------------------
 */
const rest45: CompensationRestCandidate = {
  id: "rest-45h",

  date: "2026-09-12",

  totalRestMinutes: 45 * 60,

  baseRequiredRestMinutes: 45 * 60,
};

const available45 = calculateAvailableCompensationMinutes(rest45);

scenarios.push(
  result(
    "45h rest provides no compensation surplus",

    available45 === 0,

    `Available: ${available45} minutes`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 *
 * Apply 9h to a 21h obligation.
 *
 * 12h should remain.
 * --------------------------------------------------
 */
const partialAllocation = allocateRestCompensation(obligation, rest54);

scenarios.push(
  result(
    "9h compensation applies to 21h obligation",

    partialAllocation.allocation?.appliedMinutes === 9 * 60 &&
      partialAllocation.obligation.remainingMinutes === 12 * 60 &&
      partialAllocation.obligation.status === "partially-compensated",

    `Applied: ${
      partialAllocation.allocation?.appliedMinutes ?? 0
    }, remaining: ${partialAllocation.obligation.remainingMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 *
 * Partial allocation creates
 * compensation-applied audit event.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Partial allocation creates audit event",

    partialAllocation.events.length === 1 &&
      partialAllocation.events[0].type === "compensation-applied" &&
      partialAllocation.events[0].remainingMinutes === 12 * 60,

    `Events: ${partialAllocation.events.length}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 *
 * Second rest supplies remaining 12h.
 * --------------------------------------------------
 */
const rest57: CompensationRestCandidate = {
  id: "rest-57h",

  date: "2026-09-19",

  totalRestMinutes: 57 * 60,

  baseRequiredRestMinutes: 45 * 60,
};

const completedAllocation = allocateRestCompensation(
  partialAllocation.obligation,
  rest57,
);

scenarios.push(
  result(
    "Remaining 12h compensation clears obligation",

    completedAllocation.allocation?.appliedMinutes === 12 * 60 &&
      completedAllocation.obligation.remainingMinutes === 0 &&
      completedAllocation.obligation.status === "completed",

    `Remaining: ${completedAllocation.obligation.remainingMinutes}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 *
 * Completion creates both:
 *
 * compensation-applied
 * compensation-cleared
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Full clearance creates cleared audit event",

    completedAllocation.events.some(
      (event) => event.type === "compensation-cleared",
    ) &&
      completedAllocation.events.some(
        (event) => event.type === "compensation-applied",
      ),

    `Events: ${completedAllocation.events
      .map((event) => event.type)
      .join(", ")}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 *
 * Overpayment gets capped.
 *
 * 21h owed.
 * Rest offers 30h surplus.
 * Only 21h should apply.
 * --------------------------------------------------
 */
const hugeRest: CompensationRestCandidate = {
  id: "rest-huge",

  date: "2026-09-10",

  totalRestMinutes: 75 * 60,

  baseRequiredRestMinutes: 45 * 60,
};

const cappedAllocation = allocateRestCompensation(obligation, hugeRest);

scenarios.push(
  result(
    "Allocation cannot exceed amount owed",

    cappedAllocation.allocation?.appliedMinutes === 21 * 60 &&
      cappedAllocation.obligation.remainingMinutes === 0 &&
      cappedAllocation.obligation.compensatedMinutes === 21 * 60,

    `Applied: ${cappedAllocation.allocation?.appliedMinutes ?? 0}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 *
 * No surplus creates no allocation.
 * --------------------------------------------------
 */
const noSurplus = allocateRestCompensation(obligation, rest45);

scenarios.push(
  result(
    "Rest with no surplus creates no allocation",

    noSurplus.allocation === null &&
      noSurplus.events.length === 0 &&
      noSurplus.obligation.remainingMinutes === obligation.remainingMinutes,

    `Allocation exists: ${noSurplus.allocation !== null}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 *
 * Completed obligation ignores later rests.
 * --------------------------------------------------
 */
const completedAgain = allocateRestCompensation(
  completedAllocation.obligation,
  hugeRest,
);

scenarios.push(
  result(
    "Completed obligation cannot receive more compensation",

    completedAgain.allocation === null &&
      completedAgain.events.length === 0 &&
      completedAgain.obligation.remainingMinutes === 0,

    `Allocation exists: ${completedAgain.allocation !== null}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 *
 * Creation event preserves source.
 * --------------------------------------------------
 */
const createdEvent = createCompensationCreatedEvent(obligation);

scenarios.push(
  result(
    "Created event preserves source obligation",

    createdEvent.type === "compensation-created" &&
      createdEvent.sourceWeekNumber === 35 &&
      createdEvent.minutes === 21 * 60 &&
      createdEvent.remainingMinutes === 21 * 60,

    `Source week: ${createdEvent.sourceWeekNumber}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 11
 *
 * Outstanding obligation can create
 * an overdue calendar event.
 * --------------------------------------------------
 */
const overdueEvent = createCompensationOverdueEvent(obligation, "2026-09-21");

scenarios.push(
  result(
    "Outstanding obligation creates overdue event",

    overdueEvent !== null &&
      overdueEvent.type === "compensation-overdue" &&
      overdueEvent.remainingMinutes === 21 * 60 &&
      overdueEvent.date === "2026-09-21",

    `Event: ${overdueEvent?.type}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 12
 *
 * Completed obligation must not
 * produce overdue event.
 * --------------------------------------------------
 */
const completedOverdueEvent = createCompensationOverdueEvent(
  completedAllocation.obligation,
  "2026-09-21",
);

scenarios.push(
  result(
    "Completed obligation creates no overdue event",

    completedOverdueEvent === null,

    `Event created: ${completedOverdueEvent !== null}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 13
 *
 * Audit event links clearance
 * back to original source week.
 * --------------------------------------------------
 */
const clearedEvent = completedAllocation.events.find(
  (event) => event.type === "compensation-cleared",
);

scenarios.push(
  result(
    "Cleared event links back to source week",

    clearedEvent?.sourceWeekNumber === 35 &&
      clearedEvent?.sourceObligationId === obligation.id &&
      clearedEvent?.allocationRestId === rest57.id,

    `Source week: ${clearedEvent?.sourceWeekNumber}`,
  ),
);

export const weeklyRestCompensationAllocationScenarioResults = scenarios;

export const weeklyRestCompensationAllocationScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
