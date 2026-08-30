import type { RestSession } from "../../data/restSession";

import {
    resolveWeeklyRestWeekAssignment,
    type WeeklyRestWeekAssignmentResult,
} from "../weeklyRestWeekAssignment";

import {
    addLockedWeeklyRestAssignmentDecision,
    confirmWeeklyRestWeekAssignment,
    createAutomaticWeeklyRestAssignmentDecision,
    getWeeklyRestAssignmentDecision,
} from "../weeklyRestWeekAssignmentDecision";

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
      `Weekly-rest assignment decision scenario failed: ${message}`,
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

/**
 * SCENARIO 1
 * Same-week rest creates a locked automatic decision.
 */
const automaticDecision = createAutomaticWeeklyRestAssignmentDecision(
  automaticAssignment,
  "2026-09-02T00:01:00.000Z",
);

assert(
  automaticDecision !== null &&
    automaticDecision.decisionSource === "automatic" &&
    automaticDecision.selectedWeek.weekStartDate === "2026-08-31" &&
    automaticDecision.locked === true,
  "A same-week rest should create a locked automatic decision.",
);

/**
 * SCENARIO 2
 * Spanning rest cannot be assigned automatically.
 */
assert(
  createAutomaticWeeklyRestAssignmentDecision(spanningAssignment) === null,
  "A spanning rest must not create an automatic decision.",
);

/**
 * SCENARIO 3
 * Driver can confirm either valid week.
 */
const driverDecision = confirmWeeklyRestWeekAssignment(
  spanningAssignment,
  "2026-08-31",
  "2026-09-08T12:01:00.000Z",
);

assert(
  driverDecision !== null &&
    driverDecision.decisionSource === "driver-confirmed" &&
    driverDecision.selectedWeek.weekStartDate === "2026-08-31",
  "The driver should be able to confirm the first valid week.",
);

/**
 * SCENARIO 4
 * Driver can confirm Jess's recommendation.
 */
const jessConfirmedDecision = confirmWeeklyRestWeekAssignment(
  spanningAssignment,
  "2026-09-07",
  "2026-09-08T12:02:00.000Z",
  "2026-09-07",
);

assert(
  jessConfirmedDecision !== null &&
    jessConfirmedDecision.decisionSource ===
      "jess-recommended-driver-confirmed" &&
    jessConfirmedDecision.recommendedWeekStartDate === "2026-09-07",
  "Confirming Jess's recommendation should preserve its provenance.",
);

/**
 * SCENARIO 5
 * Driver may override Jess before confirmation.
 */
const overrideDecision = confirmWeeklyRestWeekAssignment(
  spanningAssignment,
  "2026-08-31",
  "2026-09-08T12:03:00.000Z",
  "2026-09-07",
);

assert(
  overrideDecision !== null &&
    overrideDecision.decisionSource === "driver-overrode-jess-recommendation",
  "A driver override should be recorded explicitly.",
);

/**
 * SCENARIO 6
 * Invalid week selection is rejected.
 */
assert(
  confirmWeeklyRestWeekAssignment(spanningAssignment, "2026-09-14") === null,
  "A week outside the valid options must be rejected.",
);

/**
 * SCENARIO 7
 * Invalid Jess recommendation is rejected.
 */
assert(
  confirmWeeklyRestWeekAssignment(
    spanningAssignment,
    "2026-08-31",
    "2026-09-08T12:04:00.000Z",
    "2026-09-14",
  ) === null,
  "Jess cannot recommend a week outside the legal options.",
);

/**
 * SCENARIO 8
 * Rejected assignment cannot be confirmed.
 */
const rejectedAssignment: WeeklyRestWeekAssignmentResult =
  resolveWeeklyRestWeekAssignment({
    id: "daily-rest",

    type: "daily",

    startedAt: "2026-09-01T00:00:00.000Z",

    endedAt: "2026-09-02T00:00:00.000Z",

    durationMilliseconds: 24 * 60 * 60 * 1000,

    status: "completed",
  });

assert(
  confirmWeeklyRestWeekAssignment(rejectedAssignment, "2026-08-31") === null,
  "A rejected rest cannot create a decision.",
);

/**
 * SCENARIO 9
 * First locked decision cannot be overwritten.
 */
if (driverDecision === null || overrideDecision === null) {
  throw new Error("Required decision fixture was not created.");
}

const lockedDecisions = addLockedWeeklyRestAssignmentDecision(
  [],
  driverDecision,
);

const attemptedOverwrite = addLockedWeeklyRestAssignmentDecision(
  lockedDecisions,
  overrideDecision,
);

assert(
  attemptedOverwrite.length === 1 && attemptedOverwrite[0] === driverDecision,
  "A locked decision must not be silently overwritten.",
);

/**
 * SCENARIO 10
 * Stored decision can be found by rest-session id.
 */
assert(
  getWeeklyRestAssignmentDecision(
    lockedDecisions,
    spanningAssignment.restSessionId,
  ) === driverDecision,
  "The confirmed decision should be retrievable by rest-session id.",
);

console.log("✓ Weekly-rest week-assignment decision scenarios passed (10/10)");
