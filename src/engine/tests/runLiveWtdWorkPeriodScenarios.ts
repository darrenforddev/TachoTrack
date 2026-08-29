import type { ActivityHistoryEvent } from "../../data/activityHistory";
import { evaluateLiveWtdWorkPeriod } from "../liveWtdWorkPeriod";

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
 * Work crosses midnight:
 *
 * 22:00 -> 00:00 = 2h
 * 00:00 -> 04:01 = 4h01
 *
 * Total working time = 6h01.
 *
 * Calendar-day logic would see only 4h01
 * after midnight.
 *
 * Work-period logic must see 6h01 and
 * require 30 minutes total WTD break.
 */
runScenario("Scenario 1 - 6h01 across midnight requires 30m", () => {
  const history: ActivityHistoryEvent[] = [
    {
      id: "scenario-1-a",
      activity: "other-work",
      startedAt: "2026-08-29T22:00:00.000Z",
      endedAt: "2026-08-30T00:00:00.000Z",
      durationMilliseconds: 2 * 60 * 60 * 1000,
      source: "manual",
    },
    {
      id: "scenario-1-b",
      activity: "driving",
      startedAt: "2026-08-30T00:00:00.000Z",
      endedAt: "2026-08-30T04:01:00.000Z",
      durationMilliseconds: 4 * 60 * 60 * 1000 + 60 * 1000,
      source: "manual",
    },
  ];

  const result = evaluateLiveWtdWorkPeriod(
    history,
    new Date("2026-08-30T04:01:00.000Z").getTime(),
  );

  assert(
    result.workingMinutes === 361,
    `Expected 361 working minutes, got ${result.workingMinutes}`,
  );

  assert(
    result.requiredBreakMinutes === 30,
    `Expected 30 required break minutes, got ${result.requiredBreakMinutes}`,
  );

  assert(
    result.breakShortfallMinutes === 30,
    `Expected 30-minute shortfall, got ${result.breakShortfallMinutes}`,
  );
});

/*
 * Scenario 2
 *
 * 5h45 work
 * 15m qualifying break
 * 3h15 work
 *
 * Total work = exactly 9h.
 *
 * Required total break = 30m.
 * Only 15m has been recorded.
 */
runScenario("Scenario 2 - exactly 9h requires 30m total break", () => {
  const history: ActivityHistoryEvent[] = [
    {
      id: "scenario-2-a",
      activity: "driving",
      startedAt: "2026-08-29T20:00:00.000Z",
      endedAt: "2026-08-30T01:45:00.000Z",
      durationMilliseconds: 345 * 60 * 1000,
      source: "manual",
    },
    {
      id: "scenario-2-break",
      activity: "break",
      startedAt: "2026-08-30T01:45:00.000Z",
      endedAt: "2026-08-30T02:00:00.000Z",
      durationMilliseconds: 15 * 60 * 1000,
      source: "manual",
    },
    {
      id: "scenario-2-b",
      activity: "other-work",
      startedAt: "2026-08-30T02:00:00.000Z",
      endedAt: "2026-08-30T05:15:00.000Z",
      durationMilliseconds: 195 * 60 * 1000,
      source: "manual",
    },
  ];

  const result = evaluateLiveWtdWorkPeriod(
    history,
    new Date("2026-08-30T05:15:00.000Z").getTime(),
  );

  assert(
    result.workingMinutes === 540,
    `Expected 540 working minutes, got ${result.workingMinutes}`,
  );

  assert(
    result.qualifyingBreakMinutes === 15,
    `Expected 15 qualifying break minutes, got ${result.qualifyingBreakMinutes}`,
  );

  assert(
    result.requiredBreakMinutes === 30,
    `Expected 30 required break minutes, got ${result.requiredBreakMinutes}`,
  );

  assert(
    result.breakShortfallMinutes === 15,
    `Expected 15-minute shortfall, got ${result.breakShortfallMinutes}`,
  );
});

/*
 * Scenario 3
 *
 * Same structure but total work is 9h01.
 *
 * Required total break must rise to 45m.
 */
runScenario("Scenario 3 - 9h01 requires 45m total break", () => {
  const history: ActivityHistoryEvent[] = [
    {
      id: "scenario-3-a",
      activity: "driving",
      startedAt: "2026-08-29T20:00:00.000Z",
      endedAt: "2026-08-30T01:45:00.000Z",
      durationMilliseconds: 345 * 60 * 1000,
      source: "manual",
    },
    {
      id: "scenario-3-break",
      activity: "break",
      startedAt: "2026-08-30T01:45:00.000Z",
      endedAt: "2026-08-30T02:00:00.000Z",
      durationMilliseconds: 15 * 60 * 1000,
      source: "manual",
    },
    {
      id: "scenario-3-b",
      activity: "other-work",
      startedAt: "2026-08-30T02:00:00.000Z",
      endedAt: "2026-08-30T05:16:00.000Z",
      durationMilliseconds: 196 * 60 * 1000,
      source: "manual",
    },
  ];

  const result = evaluateLiveWtdWorkPeriod(
    history,
    new Date("2026-08-30T05:16:00.000Z").getTime(),
  );

  assert(
    result.workingMinutes === 541,
    `Expected 541 working minutes, got ${result.workingMinutes}`,
  );

  assert(
    result.requiredBreakMinutes === 45,
    `Expected 45 required break minutes, got ${result.requiredBreakMinutes}`,
  );

  assert(
    result.breakShortfallMinutes === 30,
    `Expected 30-minute shortfall, got ${result.breakShortfallMinutes}`,
  );
});

/*
 * Scenario 4
 *
 * 9h01 work with three separate
 * qualifying 15-minute breaks.
 *
 * Total qualifying break = 45m.
 */
runScenario("Scenario 4 - three 15m breaks satisfy 45m requirement", () => {
  const history: ActivityHistoryEvent[] = [
    {
      id: "scenario-4-a",
      activity: "driving",
      startedAt: "2026-08-29T20:00:00.000Z",
      endedAt: "2026-08-29T23:00:00.000Z",
      durationMilliseconds: 180 * 60 * 1000,
      source: "manual",
    },
    {
      id: "scenario-4-break-a",
      activity: "break",
      startedAt: "2026-08-29T23:00:00.000Z",
      endedAt: "2026-08-29T23:15:00.000Z",
      durationMilliseconds: 15 * 60 * 1000,
      source: "manual",
    },
    {
      id: "scenario-4-b",
      activity: "other-work",
      startedAt: "2026-08-29T23:15:00.000Z",
      endedAt: "2026-08-30T02:15:00.000Z",
      durationMilliseconds: 180 * 60 * 1000,
      source: "manual",
    },
    {
      id: "scenario-4-break-b",
      activity: "break",
      startedAt: "2026-08-30T02:15:00.000Z",
      endedAt: "2026-08-30T02:30:00.000Z",
      durationMilliseconds: 15 * 60 * 1000,
      source: "manual",
    },
    {
      id: "scenario-4-c",
      activity: "driving",
      startedAt: "2026-08-30T02:30:00.000Z",
      endedAt: "2026-08-30T05:30:00.000Z",
      durationMilliseconds: 180 * 60 * 1000,
      source: "manual",
    },
    {
      id: "scenario-4-break-c",
      activity: "break",
      startedAt: "2026-08-30T05:30:00.000Z",
      endedAt: "2026-08-30T05:45:00.000Z",
      durationMilliseconds: 15 * 60 * 1000,
      source: "manual",
    },
    {
      id: "scenario-4-d",
      activity: "other-work",
      startedAt: "2026-08-30T05:45:00.000Z",
      endedAt: "2026-08-30T05:46:00.000Z",
      durationMilliseconds: 60 * 1000,
      source: "manual",
    },
  ];

  const result = evaluateLiveWtdWorkPeriod(
    history,
    new Date("2026-08-30T05:46:00.000Z").getTime(),
  );

  assert(
    result.workingMinutes === 541,
    `Expected 541 working minutes, got ${result.workingMinutes}`,
  );

  assert(
    result.qualifyingBreakMinutes === 45,
    `Expected 45 qualifying break minutes, got ${result.qualifyingBreakMinutes}`,
  );

  assert(
    result.requiredBreakMinutes === 45,
    `Expected 45 required break minutes, got ${result.requiredBreakMinutes}`,
  );

  assert(
    result.breakShortfallMinutes === 0,
    `Expected no break shortfall, got ${result.breakShortfallMinutes}`,
  );
});

console.log("All live WTD work-period scenarios passed.");
