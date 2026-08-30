import type { RestSession } from "../../data/restSession";

import { resolveWeeklyRestWeekAssignment } from "../weeklyRestWeekAssignment";

import {
    confirmWeeklyRestWeekAssignment,
    createAutomaticWeeklyRestAssignmentDecision,
} from "../weeklyRestWeekAssignmentDecision";

import {
    isWeeklyRestWeekAssignmentDecision,
    parseWeeklyRestAssignmentDecisions,
} from "../weeklyRestWeekAssignmentDecisionValidation";

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

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(
      `Weekly-rest decision validation scenario failed: ${message}`,
    );
  }
}

const automaticAssignment = resolveWeeklyRestWeekAssignment(
  completedWeeklySession(
    "automatic-rest",
    "2026-09-01T00:00:00.000Z",
    "2026-09-02T00:00:00.000Z",
  ),
);

const spanningAssignment = resolveWeeklyRestWeekAssignment(
  completedWeeklySession(
    "spanning-rest",
    "2026-09-06T12:00:00.000Z",
    "2026-09-08T12:00:00.000Z",
  ),
);

const automaticDecision = createAutomaticWeeklyRestAssignmentDecision(
  automaticAssignment,
  "2026-09-02T00:01:00.000Z",
);

const driverDecision = confirmWeeklyRestWeekAssignment(
  spanningAssignment,
  "2026-08-31",
  "2026-09-08T12:01:00.000Z",
);

const jessDecision = confirmWeeklyRestWeekAssignment(
  spanningAssignment,
  "2026-09-07",
  "2026-09-08T12:02:00.000Z",
  "2026-09-07",
);

const overrideDecision = confirmWeeklyRestWeekAssignment(
  spanningAssignment,
  "2026-08-31",
  "2026-09-08T12:03:00.000Z",
  "2026-09-07",
);

if (
  automaticDecision === null ||
  driverDecision === null ||
  jessDecision === null ||
  overrideDecision === null
) {
  throw new Error("Required decision fixtures were not created.");
}

/**
 * SCENARIO 1
 * Valid automatic decision passes validation.
 */
assert(
  isWeeklyRestWeekAssignmentDecision(automaticDecision),
  "A valid automatic decision should pass validation.",
);

/**
 * SCENARIO 2
 * Valid driver decision passes validation.
 */
assert(
  isWeeklyRestWeekAssignmentDecision(driverDecision),
  "A valid driver-confirmed decision should pass validation.",
);

/**
 * SCENARIO 3
 * Valid Jess and override provenance passes.
 */
assert(
  isWeeklyRestWeekAssignmentDecision(jessDecision) &&
    isWeeklyRestWeekAssignmentDecision(overrideDecision),
  "Valid recommendation provenance should pass validation.",
);

/**
 * SCENARIO 4
 * Unlocked stored decision is rejected.
 */
assert(
  !isWeeklyRestWeekAssignmentDecision({
    ...automaticDecision,

    locked: false,
  }),
  "An unlocked stored decision must be rejected.",
);

/**
 * SCENARIO 5
 * Selected week must be one of the options.
 */
assert(
  !isWeeklyRestWeekAssignmentDecision({
    ...driverDecision,

    selectedWeek: {
      ...driverDecision.selectedWeek,

      weekStartDate: "2026-09-14",

      weekEndDate: "2026-09-20",

      isoWeekNumber: 38,
    },
  }),
  "A selected week outside the available options must be rejected.",
);

/**
 * SCENARIO 6
 * ISO week number must be in the valid range.
 */
assert(
  !isWeeklyRestWeekAssignmentDecision({
    ...automaticDecision,

    selectedWeek: {
      ...automaticDecision.selectedWeek,

      isoWeekNumber: 54,
    },
  }),
  "ISO Week 54 must be rejected.",
);

/**
 * SCENARIO 7
 * Automatic decision cannot contain two options.
 */
assert(
  !isWeeklyRestWeekAssignmentDecision({
    ...automaticDecision,

    availableWeekStartDates: ["2026-08-31", "2026-09-07"],
  }),
  "Automatic assignment cannot retain two week options.",
);

/**
 * SCENARIO 8
 * Jess provenance requires a recommendation.
 */
assert(
  !isWeeklyRestWeekAssignmentDecision({
    ...jessDecision,

    recommendedWeekStartDate: null,
  }),
  "Jess-confirmed provenance requires its recommendation.",
);

/**
 * SCENARIO 9
 * Parser keeps the first locked decision and
 * rejects duplicate or malformed entries.
 */
const parsed = parseWeeklyRestAssignmentDecisions([
  driverDecision,

  overrideDecision,

  {
    ...automaticDecision,

    locked: false,
  },
]);

assert(
  parsed.decisions.length === 1 &&
    parsed.decisions[0] === driverDecision &&
    parsed.recoveredInvalidData === true,
  "Parser should preserve the first locked decision and flag recovery.",
);

/**
 * SCENARIO 10
 * Non-array stored data recovers safely.
 */
const invalidContainer = parseWeeklyRestAssignmentDecisions({
  decisions: [],
});

assert(
  invalidContainer.decisions.length === 0 &&
    invalidContainer.recoveredInvalidData === true,
  "Non-array stored decision data should recover to empty.",
);

console.log(
  "✓ Weekly-rest assignment decision validation scenarios passed (10/10)",
);
