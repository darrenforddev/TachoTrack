import type { ActivityHistoryEvent } from "../../data/activityHistory";
import type { RestSession } from "../../data/restSession";
import { evaluateLiveWtdCurrentWorkPeriod } from "../liveWtdCurrentWorkPeriod";

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
 * Previous shift:
 * 06:00 -> 16:00 = 10h work
 *
 * Then:
 * 16:00 -> 01:00 = completed 9h daily rest
 *
 * New shift:
 * 01:00 -> 04:00 = 3h
 * 04:00 -> 07:01 = 3h01
 *
 * Current work period = 6h01.
 *
 * The previous 10h must NOT be counted.
 */
runScenario(
  "Scenario 1 - qualifying daily rest excludes previous shift",
  () => {
    const history: ActivityHistoryEvent[] = [
      {
        id: "s1-old-shift",
        activity: "other-work",
        startedAt: "2026-08-29T06:00:00.000Z",
        endedAt: "2026-08-29T16:00:00.000Z",
        durationMilliseconds: 10 * 60 * 60 * 1000,
        source: "manual",
      },
      {
        id: "s1-new-a",
        activity: "driving",
        startedAt: "2026-08-30T01:00:00.000Z",
        endedAt: "2026-08-30T04:00:00.000Z",
        durationMilliseconds: 3 * 60 * 60 * 1000,
        source: "manual",
      },
      {
        id: "s1-new-b",
        activity: "other-work",
        startedAt: "2026-08-30T04:00:00.000Z",
        endedAt: "2026-08-30T07:01:00.000Z",
        durationMilliseconds: 181 * 60 * 1000,
        source: "manual",
      },
    ];

    const rests: RestSession[] = [
      {
        id: "s1-rest",
        type: "daily",
        startedAt: "2026-08-29T16:00:00.000Z",
        endedAt: "2026-08-30T01:00:00.000Z",
        durationMilliseconds: 9 * 60 * 60 * 1000,
        status: "completed",
      },
    ];

    const result = evaluateLiveWtdCurrentWorkPeriod(
      history,
      rests,
      new Date("2026-08-30T07:01:00.000Z").getTime(),
    );

    assert(
      result.boundary.source === "completed-daily-rest",
      `Expected completed-daily-rest, got ${result.boundary.source}`,
    );

    assert(
      result.boundary.events.length === 2,
      `Expected 2 current-period events, got ${result.boundary.events.length}`,
    );

    assert(
      result.workPeriod.workingMinutes === 361,
      `Expected 361 current-period working minutes, got ${result.workPeriod.workingMinutes}`,
    );

    assert(
      result.workPeriod.requiredBreakMinutes === 30,
      `Expected 30 required break minutes, got ${result.workPeriod.requiredBreakMinutes}`,
    );
  },
);

/*
 * Scenario 2
 *
 * Midnight occurs during the current work period.
 *
 * 22:00 -> 00:00 = 2h
 * 00:00 -> 04:01 = 4h01
 *
 * No qualifying daily/weekly rest exists.
 *
 * Midnight must not reset the total.
 */
runScenario("Scenario 2 - midnight remains inside current work period", () => {
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
      endedAt: "2026-08-30T04:01:00.000Z",
      durationMilliseconds: 241 * 60 * 1000,
      source: "manual",
    },
  ];

  const result = evaluateLiveWtdCurrentWorkPeriod(
    history,
    [],
    new Date("2026-08-30T04:01:00.000Z").getTime(),
  );

  assert(
    result.workPeriod.workingMinutes === 361,
    `Expected 361 working minutes, got ${result.workPeriod.workingMinutes}`,
  );

  assert(
    result.workPeriod.requiredBreakMinutes === 30,
    `Expected 30 required break minutes, got ${result.workPeriod.requiredBreakMinutes}`,
  );
});

/*
 * Scenario 3
 *
 * A 45-minute ordinary break belongs inside
 * the work period and contributes to the
 * total qualifying WTD break.
 *
 * It must NOT become a period boundary.
 */
runScenario(
  "Scenario 3 - 45m break counts but does not end work period",
  () => {
    const history: ActivityHistoryEvent[] = [
      {
        id: "s3-a",
        activity: "driving",
        startedAt: "2026-08-29T20:00:00.000Z",
        endedAt: "2026-08-29T23:00:00.000Z",
        durationMilliseconds: 180 * 60 * 1000,
        source: "manual",
      },
      {
        id: "s3-break",
        activity: "break",
        startedAt: "2026-08-29T23:00:00.000Z",
        endedAt: "2026-08-29T23:45:00.000Z",
        durationMilliseconds: 45 * 60 * 1000,
        source: "manual",
      },
      {
        id: "s3-b",
        activity: "other-work",
        startedAt: "2026-08-29T23:45:00.000Z",
        endedAt: "2026-08-30T03:46:00.000Z",
        durationMilliseconds: 241 * 60 * 1000,
        source: "manual",
      },
    ];

    const result = evaluateLiveWtdCurrentWorkPeriod(
      history,
      [],
      new Date("2026-08-30T03:46:00.000Z").getTime(),
    );

    assert(
      result.workPeriod.workingMinutes === 421,
      `Expected 421 working minutes, got ${result.workPeriod.workingMinutes}`,
    );

    assert(
      result.workPeriod.qualifyingBreakMinutes === 45,
      `Expected 45 qualifying break minutes, got ${result.workPeriod.qualifyingBreakMinutes}`,
    );

    assert(
      result.workPeriod.requiredBreakMinutes === 30,
      `Expected 30 required break minutes, got ${result.workPeriod.requiredBreakMinutes}`,
    );

    assert(
      result.workPeriod.breakShortfallMinutes === 0,
      `Expected no break shortfall, got ${result.workPeriod.breakShortfallMinutes}`,
    );
  },
);

/*
 * Scenario 4
 *
 * An 8h59m daily rest is not enough to
 * establish a new work-period boundary.
 *
 * Therefore the earlier work remains part
 * of the current period.
 */
runScenario(
  "Scenario 4 - insufficient daily rest does not exclude earlier work",
  () => {
    const history: ActivityHistoryEvent[] = [
      {
        id: "s4-old",
        activity: "driving",
        startedAt: "2026-08-29T06:00:00.000Z",
        endedAt: "2026-08-29T10:00:00.000Z",
        durationMilliseconds: 4 * 60 * 60 * 1000,
        source: "manual",
      },
      {
        id: "s4-new",
        activity: "other-work",
        startedAt: "2026-08-29T18:59:00.000Z",
        endedAt: "2026-08-29T21:00:00.000Z",
        durationMilliseconds: 121 * 60 * 1000,
        source: "manual",
      },
    ];

    const rests: RestSession[] = [
      {
        id: "s4-rest",
        type: "daily",
        startedAt: "2026-08-29T10:00:00.000Z",
        endedAt: "2026-08-29T18:59:00.000Z",
        durationMilliseconds: 539 * 60 * 1000,
        status: "completed",
      },
    ];

    const result = evaluateLiveWtdCurrentWorkPeriod(
      history,
      rests,
      new Date("2026-08-29T21:00:00.000Z").getTime(),
    );

    assert(
      result.boundary.source === "first-recorded-activity",
      `Expected first-recorded-activity, got ${result.boundary.source}`,
    );

    assert(
      result.workPeriod.workingMinutes === 361,
      `Expected 361 combined working minutes, got ${result.workPeriod.workingMinutes}`,
    );

    assert(
      result.workPeriod.requiredBreakMinutes === 30,
      `Expected 30 required break minutes, got ${result.workPeriod.requiredBreakMinutes}`,
    );
  },
);

console.log("All live WTD current-work-period scenarios passed.");
