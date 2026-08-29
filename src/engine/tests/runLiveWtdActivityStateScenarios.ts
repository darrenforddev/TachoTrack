import type { ActivityHistoryEvent } from "../../data/activityHistory";
import { evaluateLiveWtdActivityState } from "../liveWtdActivityState";

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

function createEvent(
  id: string,
  activity: ActivityHistoryEvent["activity"],
  startedAt: string,
  endedAt: string,
): ActivityHistoryEvent {
  const startMilliseconds = new Date(startedAt).getTime();
  const endMilliseconds = new Date(endedAt).getTime();

  return {
    id,
    activity,
    startedAt,
    endedAt,
    durationMilliseconds: endMilliseconds - startMilliseconds,
    source: "manual",
  };
}

/*
 * Scenario 1
 *
 * 22:00 -> 00:00 = 2h working
 * 00:00 -> 04:00 = 4h working
 *
 * Midnight must NOT reset the WTD clock.
 *
 * Total consecutive working = exactly 6h.
 *
 * Expected:
 * WARNING, not breach.
 */
runScenario("Scenario 1 - exactly 6h across midnight is not breach", () => {
  const events: ActivityHistoryEvent[] = [
    createEvent(
      "scenario-1-driving",
      "driving",
      "2026-08-29T22:00:00.000Z",
      "2026-08-30T00:00:00.000Z",
    ),
    createEvent(
      "scenario-1-other-work",
      "other-work",
      "2026-08-30T00:00:00.000Z",
      "2026-08-30T04:00:00.000Z",
    ),
  ];

  const result = evaluateLiveWtdActivityState(events);

  assert(
    result.consecutiveWorkingMinutes === 6 * 60,
    `Expected 360 consecutive working minutes, got ${result.consecutiveWorkingMinutes}`,
  );

  assert(result.level === "warning", `Expected warning, got ${result.level}`);

  assert(
    result.minutesUntilSixHourLimit === 0,
    `Expected 0 minutes remaining, got ${result.minutesUntilSixHourLimit}`,
  );
});

/*
 * Scenario 2
 *
 * 22:00 -> 00:00 = 2h working
 * 00:00 -> 04:01 = 4h01 working
 *
 * Total consecutive working = 6h01.
 *
 * Expected:
 * BREACH.
 */
runScenario("Scenario 2 - 6h01 across midnight is breach", () => {
  const events: ActivityHistoryEvent[] = [
    createEvent(
      "scenario-2-driving",
      "driving",
      "2026-08-29T22:00:00.000Z",
      "2026-08-30T00:00:00.000Z",
    ),
    createEvent(
      "scenario-2-other-work",
      "other-work",
      "2026-08-30T00:00:00.000Z",
      "2026-08-30T04:01:00.000Z",
    ),
  ];

  const result = evaluateLiveWtdActivityState(events);

  assert(
    result.consecutiveWorkingMinutes === 6 * 60 + 1,
    `Expected 361 consecutive working minutes, got ${result.consecutiveWorkingMinutes}`,
  );

  assert(result.level === "breach", `Expected breach, got ${result.level}`);
});
/*
 * Scenario 3
 *
 * 22:00 -> 23:45 = 1h45 working
 * 23:45 -> 00:00 = 15-minute qualifying break
 * 00:00 -> 05:00 = 5h working
 *
 * The qualifying 15-minute break resets the
 * consecutive-working-time clock.
 *
 * Midnight itself has no effect on the clock.
 *
 * Expected:
 * 5h consecutive working after the reset.
 * GOOD.
 */
runScenario(
  "Scenario 3 - qualifying break resets clock across midnight",
  () => {
    const events: ActivityHistoryEvent[] = [
      createEvent(
        "scenario-3-driving",
        "driving",
        "2026-08-29T22:00:00.000Z",
        "2026-08-29T23:45:00.000Z",
      ),
      createEvent(
        "scenario-3-break",
        "break",
        "2026-08-29T23:45:00.000Z",
        "2026-08-30T00:00:00.000Z",
      ),
      createEvent(
        "scenario-3-other-work",
        "other-work",
        "2026-08-30T00:00:00.000Z",
        "2026-08-30T05:00:00.000Z",
      ),
    ];

    const result = evaluateLiveWtdActivityState(events);

    assert(
      result.consecutiveWorkingMinutes === 5 * 60,
      `Expected 300 consecutive working minutes, got ${result.consecutiveWorkingMinutes}`,
    );

    assert(result.level === "good", `Expected good, got ${result.level}`);

    assert(
      result.minutesUntilSixHourLimit === 60,
      `Expected 60 minutes remaining, got ${result.minutesUntilSixHourLimit}`,
    );
  },
);
/*
 * Scenario 4
 *
 * 6 hours and 1 second of continuous working.
 *
 * This proves the activity-history engine preserves
 * timestamp precision rather than flooring the
 * duration to 360 whole minutes.
 *
 * Expected:
 * BREACH
 */
runScenario("Scenario 4 - 6h00m01s is breach with precise timestamps", () => {
  const history: ActivityHistoryEvent[] = [
    {
      id: "scenario-4-driving",
      activity: "driving",
      startedAt: "2026-08-29T06:00:00.000Z",
      endedAt: "2026-08-29T12:00:01.000Z",
      durationMilliseconds: 6 * 60 * 60 * 1000 + 1000,
      source: "manual",
    },
  ];

  const result = evaluateLiveWtdActivityState(
    history,
    new Date("2026-08-29T12:00:01.000Z").getTime(),
  );

  assert(result.level === "breach", `Expected breach, got ${result.level}`);

  assert(
    result.consecutiveWorkingMilliseconds === 6 * 60 * 60 * 1000 + 1000,
    `Expected 21601000 ms, got ${result.consecutiveWorkingMilliseconds}`,
  );

  assert(
    result.consecutiveWorkingSeconds === 21601,
    `Expected 21601 seconds, got ${result.consecutiveWorkingSeconds}`,
  );

  /*
   * Compatibility value deliberately remains
   * 360 whole minutes.
   *
   * The breach decision must therefore have
   * come from precise timestamps, not this value.
   */
  assert(
    result.consecutiveWorkingMinutes === 360,
    `Expected compatibility value 360 minutes, got ${result.consecutiveWorkingMinutes}`,
  );
});

console.log("All live WTD activity-state scenarios passed.");
