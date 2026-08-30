import type { RestSession, RestSessionType } from "../../data/restSession";

import {
    buildWeeklyRestCompensationEvidence,
    evaluateWeeklyRestCompensationEvidence,
    type CompensationEvidenceRejectionReason,
} from "../weeklyRestCompensationEvidence";

function createSession(
  id: string,
  type: RestSessionType,
  startedAt: string,
  endedAt: string | null,
  overrides: Partial<RestSession> = {},
): RestSession {
  const startTimestamp = new Date(startedAt).getTime();

  const endTimestamp = endedAt === null ? null : new Date(endedAt).getTime();

  return {
    id,

    type,

    startedAt,

    endedAt,

    durationMilliseconds:
      endTimestamp === null ? null : endTimestamp - startTimestamp,

    status: endedAt === null ? "active" : "completed",

    ...overrides,
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(
      `Weekly-rest compensation evidence scenario failed: ${message}`,
    );
  }
}

function assertRejected(
  session: RestSession,
  expectedReason: CompensationEvidenceRejectionReason,
): void {
  const evidence = evaluateWeeklyRestCompensationEvidence(session);

  assert(evidence.status === "rejected", `${session.id} should be rejected.`);

  assert(
    evidence.candidate === null,
    `${session.id} must not create a candidate.`,
  );

  assert(
    evidence.rejectionReason === expectedReason,
    `${session.id} should be rejected as ${expectedReason}, received ${evidence.rejectionReason}.`,
  );
}

/**
 * SCENARIO 1
 * Completed 12h daily rest supplies 1h surplus.
 */
const daily12 = createSession(
  "daily-12h",
  "daily",
  "2026-09-01T00:00:00.000Z",
  "2026-09-01T12:00:00.000Z",
);

const daily12Evidence = evaluateWeeklyRestCompensationEvidence(daily12);

assert(
  daily12Evidence.status === "verified" && daily12Evidence.candidate !== null,
  "A completed 12h daily rest should be verified.",
);

assert(
  daily12Evidence.candidate?.totalRestMinutes === 12 * 60 &&
    daily12Evidence.candidate?.baseRequiredRestMinutes === 11 * 60,
  "A 12h daily rest should expose 1h above its 11h base.",
);

/**
 * SCENARIO 2
 * Completed 66h weekly rest supplies 21h surplus.
 */
const weekly66 = createSession(
  "weekly-66h",
  "weekly",
  "2026-09-01T00:00:00.000Z",
  "2026-09-03T18:00:00.000Z",
);

const weekly66Evidence = evaluateWeeklyRestCompensationEvidence(weekly66);

assert(
  weekly66Evidence.status === "verified" && weekly66Evidence.candidate !== null,
  "A completed 66h weekly rest should be verified.",
);

assert(
  weekly66Evidence.candidate?.totalRestMinutes === 66 * 60 &&
    weekly66Evidence.candidate?.baseRequiredRestMinutes === 45 * 60,
  "A 66h weekly rest should expose 21h above its 45h base.",
);

/**
 * SCENARIO 3
 * Active rest cannot become evidence.
 */
assertRejected(
  createSession("active-weekly", "weekly", "2026-09-01T00:00:00.000Z", null),
  "session-not-completed",
);

/**
 * SCENARIO 4
 * Interrupted rest cannot become evidence.
 */
assertRejected(
  createSession(
    "interrupted-weekly",
    "weekly",
    "2026-09-01T00:00:00.000Z",
    "2026-09-03T18:00:00.000Z",
    {
      status: "interrupted",
    },
  ),
  "session-interrupted",
);

/**
 * SCENARIO 5
 * Completed record requires an end timestamp.
 */
assertRejected(
  createSession(
    "completed-missing-end",
    "weekly",
    "2026-09-01T00:00:00.000Z",
    null,
    {
      status: "completed",
    },
  ),
  "missing-end-timestamp",
);

/**
 * SCENARIO 6
 * Completed record requires stored duration evidence.
 */
assertRejected(
  createSession(
    "completed-missing-duration",
    "weekly",
    "2026-09-01T00:00:00.000Z",
    "2026-09-03T18:00:00.000Z",
    {
      durationMilliseconds: null,
    },
  ),
  "missing-duration",
);

/**
 * SCENARIO 7
 * Backwards timestamps are invalid.
 */
assertRejected(
  createSession(
    "backwards-weekly",
    "weekly",
    "2026-09-03T18:00:00.000Z",
    "2026-09-01T00:00:00.000Z",
  ),
  "invalid-timestamps",
);

/**
 * SCENARIO 8
 * Stored duration must agree with timestamps.
 */
assertRejected(
  createSession(
    "duration-mismatch",
    "weekly",
    "2026-09-01T00:00:00.000Z",
    "2026-09-03T18:00:00.000Z",
    {
      durationMilliseconds: 65 * 60 * 60 * 1000,
    },
  ),
  "duration-mismatch",
);

/**
 * SCENARIO 9
 * Reduced daily rest is excluded conservatively.
 */
assertRejected(
  createSession(
    "daily-10h",
    "daily",
    "2026-09-01T00:00:00.000Z",
    "2026-09-01T10:00:00.000Z",
  ),
  "reduced-daily-rest-unverified",
);

/**
 * SCENARIO 10
 * Reduced weekly rest is excluded conservatively.
 */
assertRejected(
  createSession(
    "weekly-30h",
    "weekly",
    "2026-09-01T00:00:00.000Z",
    "2026-09-02T06:00:00.000Z",
  ),
  "reduced-weekly-rest-unverified",
);

/**
 * SCENARIO 11
 * Exact 11h daily rest has no compensation surplus.
 */
assertRejected(
  createSession(
    "daily-exact-11h",
    "daily",
    "2026-09-01T00:00:00.000Z",
    "2026-09-01T11:00:00.000Z",
  ),
  "no-compensation-surplus",
);

/**
 * SCENARIO 12
 * Exact 45h weekly rest has no compensation surplus.
 */
assertRejected(
  createSession(
    "weekly-exact-45h",
    "weekly",
    "2026-09-01T00:00:00.000Z",
    "2026-09-02T21:00:00.000Z",
  ),
  "no-compensation-surplus",
);

/**
 * SCENARIO 13
 * Daily rest below 9h is not qualifying evidence.
 */
assertRejected(
  createSession(
    "daily-8h",
    "daily",
    "2026-09-01T00:00:00.000Z",
    "2026-09-01T08:00:00.000Z",
  ),
  "daily-rest-below-nine-hours",
);

/**
 * SCENARIO 14
 * Weekly rest below 24h is not qualifying evidence.
 */
assertRejected(
  createSession(
    "weekly-23h",
    "weekly",
    "2026-09-01T00:00:00.000Z",
    "2026-09-01T23:00:00.000Z",
  ),
  "weekly-rest-below-24-hours",
);

/**
 * SCENARIO 15
 * Batch evidence preserves all records and ordering.
 */
const batchEvidence = buildWeeklyRestCompensationEvidence([daily12, weekly66]);

assert(
  batchEvidence.length === 2 &&
    batchEvidence[0].sessionId === daily12.id &&
    batchEvidence[1].sessionId === weekly66.id &&
    batchEvidence.every((item) => item.status === "verified"),
  "Batch evidence should preserve session order and verification.",
);

console.log("✓ Weekly-rest compensation evidence scenarios passed (15/15)");
