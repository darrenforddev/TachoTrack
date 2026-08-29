import type { ActivityHistoryEvent } from "../../data/activityHistory";
import type { RestSession } from "../../data/restSession";
import { getLiveWtdWorkPeriodBoundary } from "../liveWtdWorkPeriodBoundary";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function runScenario(name: string, test: () => void): void {
  try {
    test();
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}

/*
 * Scenario 1
 *
 * No rest evidence.
 *
 * The first recorded activity becomes the
 * provisional work-period reference start.
 */
runScenario("Scenario 1 - first activity used when no rest exists", () => {
  const history: ActivityHistoryEvent[] = [
    {
      id: "s1-a",
      activity: "driving",
      startedAt: "2026-08-29T22:00:00.000Z",
      endedAt: "2026-08-30T00:00:00.000Z",
      durationMilliseconds: 2 * 60 * 60 * 1000,
      source: "manual",
    },
    {
      id: "s1-b",
      activity: "other-work",
      startedAt: "2026-08-30T00:00:00.000Z",
      endedAt: "2026-08-30T04:00:00.000Z",
      durationMilliseconds: 4 * 60 * 60 * 1000,
      source: "manual",
    },
  ];

  const result = getLiveWtdWorkPeriodBoundary(history, []);

  assert(
    result.source === "first-recorded-activity",
    `Expected first-recorded-activity, got ${result.source}`,
  );

  assert(
    result.referenceStart === "2026-08-29T22:00:00.000Z",
    `Unexpected reference start: ${result.referenceStart}`,
  );

  assert(
    result.events.length === 2,
    `Expected 2 events, got ${result.events.length}`,
  );
});

/*
 * Scenario 2
 *
 * Midnight must NOT reset the work period.
 */
runScenario("Scenario 2 - midnight does not reset work period", () => {
  const history: ActivityHistoryEvent[] = [
    {
      id: "s2-a",
      activity: "driving",
      startedAt: "2026-08-29T22:00:00.000Z",
      endedAt: "2026-08-30T00:00:00.000Z",
      durationMilliseconds: 2 * 60 * 60 * 1000,
      source: "manual",
    },
    {
      id: "s2-b",
      activity: "other-work",
      startedAt: "2026-08-30T00:00:00.000Z",
      endedAt: "2026-08-30T04:00:00.000Z",
      durationMilliseconds: 4 * 60 * 60 * 1000,
      source: "manual",
    },
  ];

  const result = getLiveWtdWorkPeriodBoundary(history, []);

  assert(
    result.events.length === 2,
    `Expected both cross-midnight events, got ${result.events.length}`,
  );
});

/*
 * Scenario 3
 *
 * A completed 9-hour daily rest establishes
 * a new work-period boundary.
 *
 * Earlier activity must be excluded.
 */
runScenario("Scenario 3 - completed 9h daily rest creates boundary", () => {
  const history: ActivityHistoryEvent[] = [
    {
      id: "s3-before-rest",
      activity: "other-work",
      startedAt: "2026-08-29T06:00:00.000Z",
      endedAt: "2026-08-29T16:00:00.000Z",
      durationMilliseconds: 10 * 60 * 60 * 1000,
      source: "manual",
    },
    {
      id: "s3-after-rest",
      activity: "driving",
      startedAt: "2026-08-30T01:00:00.000Z",
      endedAt: "2026-08-30T05:00:00.000Z",
      durationMilliseconds: 4 * 60 * 60 * 1000,
      source: "manual",
    },
  ];

  const rests: RestSession[] = [
    {
      id: "s3-rest",
      type: "daily",
      startedAt: "2026-08-29T16:00:00.000Z",
      endedAt: "2026-08-30T01:00:00.000Z",
      durationMilliseconds: 9 * 60 * 60 * 1000,
      status: "completed",
    },
  ];

  const result = getLiveWtdWorkPeriodBoundary(history, rests);

  assert(
    result.source === "completed-daily-rest",
    `Expected completed-daily-rest, got ${result.source}`,
  );

  assert(
    result.referenceStart === "2026-08-30T01:00:00.000Z",
    `Unexpected reference start: ${result.referenceStart}`,
  );

  assert(
    result.events.length === 1,
    `Expected 1 event after rest, got ${result.events.length}`,
  );

  assert(
    result.events[0]?.id === "s3-after-rest",
    `Unexpected event after boundary`,
  );
});

/*
 * Scenario 4
 *
 * An 8h59m daily rest is not long enough
 * to establish this boundary.
 */
runScenario("Scenario 4 - 8h59 daily rest does not create boundary", () => {
  const history: ActivityHistoryEvent[] = [
    {
      id: "s4-before",
      activity: "driving",
      startedAt: "2026-08-29T06:00:00.000Z",
      endedAt: "2026-08-29T16:00:00.000Z",
      durationMilliseconds: 10 * 60 * 60 * 1000,
      source: "manual",
    },
    {
      id: "s4-after",
      activity: "other-work",
      startedAt: "2026-08-30T00:59:00.000Z",
      endedAt: "2026-08-30T02:00:00.000Z",
      durationMilliseconds: 61 * 60 * 1000,
      source: "manual",
    },
  ];

  const rests: RestSession[] = [
    {
      id: "s4-rest",
      type: "daily",
      startedAt: "2026-08-29T16:00:00.000Z",
      endedAt: "2026-08-30T00:59:00.000Z",
      durationMilliseconds: 539 * 60 * 1000,
      status: "completed",
    },
  ];

  const result = getLiveWtdWorkPeriodBoundary(history, rests);

  assert(
    result.source === "first-recorded-activity",
    `Expected first-recorded-activity, got ${result.source}`,
  );

  assert(
    result.events.length === 2,
    `Expected both events to remain, got ${result.events.length}`,
  );
});

/*
 * Scenario 5
 *
 * A completed 24-hour weekly rest establishes
 * a new work-period boundary.
 */
runScenario("Scenario 5 - completed 24h weekly rest creates boundary", () => {
  const history: ActivityHistoryEvent[] = [
    {
      id: "s5-before",
      activity: "driving",
      startedAt: "2026-08-27T06:00:00.000Z",
      endedAt: "2026-08-27T14:00:00.000Z",
      durationMilliseconds: 8 * 60 * 60 * 1000,
      source: "manual",
    },
    {
      id: "s5-after",
      activity: "other-work",
      startedAt: "2026-08-28T14:00:00.000Z",
      endedAt: "2026-08-28T16:00:00.000Z",
      durationMilliseconds: 2 * 60 * 60 * 1000,
      source: "manual",
    },
  ];

  const rests: RestSession[] = [
    {
      id: "s5-rest",
      type: "weekly",
      startedAt: "2026-08-27T14:00:00.000Z",
      endedAt: "2026-08-28T14:00:00.000Z",
      durationMilliseconds: 24 * 60 * 60 * 1000,
      status: "completed",
    },
  ];

  const result = getLiveWtdWorkPeriodBoundary(history, rests);

  assert(
    result.source === "completed-weekly-rest",
    `Expected completed-weekly-rest, got ${result.source}`,
  );

  assert(
    result.events.length === 1,
    `Expected 1 event after weekly rest, got ${result.events.length}`,
  );

  assert(
    result.events[0]?.id === "s5-after",
    `Unexpected event after weekly-rest boundary`,
  );
});

/*
 * Scenario 6
 *
 * An ordinary 45-minute break must NOT
 * become a work-period boundary.
 */
runScenario(
  "Scenario 6 - ordinary 45m break does not reset work period",
  () => {
    const history: ActivityHistoryEvent[] = [
      {
        id: "s6-a",
        activity: "driving",
        startedAt: "2026-08-29T20:00:00.000Z",
        endedAt: "2026-08-29T23:00:00.000Z",
        durationMilliseconds: 3 * 60 * 60 * 1000,
        source: "manual",
      },
      {
        id: "s6-break",
        activity: "break",
        startedAt: "2026-08-29T23:00:00.000Z",
        endedAt: "2026-08-29T23:45:00.000Z",
        durationMilliseconds: 45 * 60 * 1000,
        source: "manual",
      },
      {
        id: "s6-b",
        activity: "other-work",
        startedAt: "2026-08-29T23:45:00.000Z",
        endedAt: "2026-08-30T02:45:00.000Z",
        durationMilliseconds: 3 * 60 * 60 * 1000,
        source: "manual",
      },
    ];

    const result = getLiveWtdWorkPeriodBoundary(history, []);

    assert(
      result.events.length === 3,
      `Expected all 3 events, got ${result.events.length}`,
    );
  },
);
/*
 * Scenario 7
 *
 * A completed rest whose end timestamp is in
 * the future must NOT establish the current
 * work-period boundary.
 *
 * This protects the live engine from malformed,
 * imported, or incorrectly timestamped evidence.
 */
runScenario(
  "Scenario 7 - future completed rest does not create boundary",
  () => {
    const history: ActivityHistoryEvent[] = [
      {
        id: "s7-work",
        activity: "driving",
        startedAt: "2026-08-30T06:00:00.000Z",
        endedAt: "2026-08-30T08:00:00.000Z",
        durationMilliseconds: 2 * 60 * 60 * 1000,
        source: "manual",
      },
    ];

    const rests: RestSession[] = [
      {
        id: "s7-future-rest",
        type: "daily",
        startedAt: "2026-08-30T09:00:00.000Z",
        endedAt: "2026-08-30T18:00:00.000Z",
        durationMilliseconds: 9 * 60 * 60 * 1000,
        status: "completed",
      },
    ];

    const nowMilliseconds = new Date("2026-08-30T08:00:00.000Z").getTime();

    const result = getLiveWtdWorkPeriodBoundary(
      history,
      rests,
      nowMilliseconds,
    );

    assert(
      result.source === "first-recorded-activity",
      `Expected future rest to be ignored, got ${result.source}`,
    );

    assert(
      result.referenceStart === "2026-08-30T06:00:00.000Z",
      `Expected first activity as reference start, got ${result.referenceStart}`,
    );

    assert(
      result.events.length === 1,
      `Expected work event to remain, got ${result.events.length}`,
    );
  },
);

console.log("All live WTD work-period boundary scenarios passed.");
