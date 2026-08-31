import type {
  ActivityHistoryEvent,
  ActivityHistoryState,
} from "../../data/activityHistory";
import type { RestSessionState } from "../../data/restSession";
import { evaluateLongRunningActivityGuard } from "../longRunningActivityGuard";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Long-running activity guard scenario failed: ${message}`);
  }
}

function makeHistory(
  event: ActivityHistoryEvent | null,
): ActivityHistoryState {
  return {
    events: event === null ? [] : [event],
    activeEventId: event?.id ?? null,
  };
}

function makeOpenBreak(startedAt: string): ActivityHistoryEvent {
  return {
    id: "open-break",
    activity: "break",
    startedAt,
    endedAt: null,
    durationMilliseconds: null,
    source: "manual",
  };
}

const emptyRestState: RestSessionState = {
  sessions: [],
  activeSessionId: null,
};

const weeklyRestState: RestSessionState = {
  sessions: [
    {
      id: "active-weekly-rest",
      type: "weekly",
      startedAt: "2026-08-29T20:00:00.000Z",
      endedAt: null,
      durationMilliseconds: null,
      status: "active",
    },
  ],
  activeSessionId: "active-weekly-rest",
};

{
  const state = evaluateLongRunningActivityGuard(
    makeHistory(null),
    emptyRestState,
    "2026-08-31T20:00:00.000Z",
  );

  assert(
    state.status === "inactive" && !state.confirmationRequired,
    "No open activity must not require confirmation.",
  );
}

{
  const state = evaluateLongRunningActivityGuard(
    makeHistory(makeOpenBreak("2026-08-30T20:01:00.000Z")),
    emptyRestState,
    "2026-08-31T20:00:00.000Z",
  );

  assert(
    state.status === "within-threshold" && state.elapsedMinutes === 1439,
    "An ordinary activity at 23h59 must remain below the guard threshold.",
  );
}

{
  const state = evaluateLongRunningActivityGuard(
    makeHistory(makeOpenBreak("2026-08-30T20:00:00.000Z")),
    emptyRestState,
    "2026-08-31T20:00:00.000Z",
  );

  assert(
    state.status === "confirmation-required" &&
      state.confirmationRequired &&
      state.elapsedMinutes === 1440,
    "An ordinary activity must require confirmation at exactly 24 hours.",
  );
}

{
  const state = evaluateLongRunningActivityGuard(
    makeHistory(makeOpenBreak("2026-08-29T20:00:00.000Z")),
    weeklyRestState,
    "2026-08-31T13:00:00.000Z",
  );

  assert(
    state.status === "within-threshold" &&
      state.matchedRestType === "weekly" &&
      state.thresholdMinutes === 4320,
    "A matched weekly rest must use the extended 72-hour threshold.",
  );
}

{
  const state = evaluateLongRunningActivityGuard(
    makeHistory(makeOpenBreak("2026-08-29T20:00:00.000Z")),
    weeklyRestState,
    "2026-09-01T20:00:00.000Z",
  );

  assert(
    state.status === "confirmation-required" &&
      state.elapsedMinutes === 4320,
    "A matched weekly rest must require confirmation at 72 hours.",
  );
}

{
  const state = evaluateLongRunningActivityGuard(
    makeHistory(makeOpenBreak("2026-08-30T18:00:00.000Z")),
    emptyRestState,
    "2026-08-31T20:00:00.000Z",
    {
      confirmation: {
        eventId: "open-break",
        confirmedAt: "2026-08-31T19:00:00.000Z",
      },
    },
  );

  assert(
    state.status === "confirmed" && !state.confirmationRequired,
    "A recent matching confirmation must temporarily clear the warning.",
  );
}

{
  const state = evaluateLongRunningActivityGuard(
    makeHistory(makeOpenBreak("2026-08-30T06:00:00.000Z")),
    emptyRestState,
    "2026-08-31T20:00:00.000Z",
    {
      confirmation: {
        eventId: "open-break",
        confirmedAt: "2026-08-31T07:59:00.000Z",
      },
    },
  );

  assert(
    state.status === "confirmation-required",
    "A confirmation older than 12 hours must require a fresh check.",
  );
}

{
  const state = evaluateLongRunningActivityGuard(
    makeHistory(makeOpenBreak("2026-08-30T18:00:00.000Z")),
    emptyRestState,
    "2026-08-31T20:00:00.000Z",
    {
      confirmation: {
        eventId: "different-event",
        confirmedAt: "2026-08-31T19:00:00.000Z",
      },
    },
  );

  assert(
    state.status === "confirmation-required",
    "Confirmation for another activity must not clear the warning.",
  );
}

let invalidTimeRejected = false;

try {
  evaluateLongRunningActivityGuard(
    makeHistory(makeOpenBreak("2026-08-30T18:00:00.000Z")),
    emptyRestState,
    "invalid-time",
  );
} catch {
  invalidTimeRejected = true;
}

assert(invalidTimeRejected, "An invalid current time must be rejected.");

console.log("✓ Long-running activity guard scenarios passed (9/9)");
