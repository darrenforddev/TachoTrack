import type { ActivityHistoryEvent } from "../../data/activityHistory";
import { evaluateLiveWtdState } from "../liveWtdState";
import type { DriverDay } from "../types";

function createDriverDay(overrides: Partial<DriverDay> = {}): DriverDay {
  return {
    id: "live-wtd-test-day",
    date: "2026-08-29",
    activities: [],
    drivingMinutes: 0,
    otherWorkMinutes: 0,
    breakMinutes: 0,
    poaMinutes: 0,
    restMinutes: 0,
    dailyRestType: "unknown",
    ...overrides,
  };
}

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
 * Below the warning threshold:
 * 5h29 working.
 *
 * Expected:
 * GOOD
 */
runScenario("Scenario 1 - 5h29 working is good", () => {
  const day = createDriverDay({
    drivingMinutes: 5 * 60 + 29,
  });

  const result = evaluateLiveWtdState(day);

  assert(result.level === "good", `Expected good, got ${result.level}`);
});

/*
 * Scenario 2
 *
 * Exactly 5h30 working.
 *
 * This is TachoTrack's advance warning point,
 * not a legal breach.
 *
 * Expected:
 * WARNING
 */
runScenario("Scenario 2 - 5h30 working gives warning", () => {
  const day = createDriverDay({
    drivingMinutes: 5 * 60 + 30,
    activities: [
      {
        id: "scenario-2-driving",
        type: "driving",
        start: "2026-08-29T06:00:00.000Z",
        end: "2026-08-29T11:30:00.000Z",
        durationMinutes: 5 * 60 + 30,
      },
    ],
  });

  const result = evaluateLiveWtdState(day);

  assert(result.level === "warning", `Expected warning, got ${result.level}`);
});

/*
 * Scenario 3
 *
 * Exactly 6h working.
 *
 * The driver has not exceeded six hours.
 *
 * Expected:
 * WARNING
 */
runScenario("Scenario 3 - exactly 6h requires action", () => {
  const day = createDriverDay({
    drivingMinutes: 6 * 60,
    activities: [
      {
        id: "scenario-3-driving",
        type: "driving",
        start: "2026-08-29T06:00:00.000Z",
        end: "2026-08-29T12:00:00.000Z",
        durationMinutes: 6 * 60,
      },
    ],
  });

  const result = evaluateLiveWtdState(day);

  assert(result.level === "action", `Expected action, got ${result.level}`);
});

/*
 * Scenario 4
 *
 * 6h01 total working.
 *
 * More than six hours means the live day now
 * carries a 30-minute total WTD break requirement.
 *
 * In this live-state engine that requirement is
 * DUE rather than automatically labelled as a
 * completed historical breach.
 *
 * Expected:
 * DUE
 */
runScenario("Scenario 4 - 6h01 with no break is due", () => {
  const day = createDriverDay({
    drivingMinutes: 6 * 60 + 1,
  });

  const result = evaluateLiveWtdState(day);

  assert(result.level === "due", `Expected due, got ${result.level}`);

  assert(
    result.requiredBreakMinutes === 30,
    `Expected 30 required minutes, got ${result.requiredBreakMinutes}`,
  );

  assert(
    result.breakShortfallMinutes === 30,
    `Expected 30-minute shortfall, got ${result.breakShortfallMinutes}`,
  );
});
/*
 * Scenario 5
 *
 * 6h01 continuous working with no qualifying break.
 *
 * This is no longer merely a total-break requirement
 * that is due. The six-hour consecutive working-time
 * rule has actually been exceeded.
 *
 * Expected:
 * BREACH
 */
runScenario("Scenario 5 - 6h01 continuous working is breach", () => {
  const day = createDriverDay({
    drivingMinutes: 6 * 60 + 1,
    activities: [
      {
        id: "scenario-5-driving",
        type: "driving",
        start: "2026-08-29T06:00:00.000Z",
        end: "2026-08-29T12:01:00.000Z",
        durationMinutes: 6 * 60 + 1,
      },
    ],
  });

  const result = evaluateLiveWtdState(day);

  assert(result.level === "breach", `Expected breach, got ${result.level}`);
});
/*
 * Scenario 6
 *
 * 5h45 working
 * + 15-minute qualifying break
 * + 3h further working.
 *
 * The 15-minute break resets the six-hour
 * consecutive-working-time clock.
 *
 * Total working time is 8h45, so 30 minutes of
 * total WTD break is required. Only 15 minutes
 * has been taken.
 *
 * Expected:
 * DUE, not BREACH.
 */
runScenario(
  "Scenario 6 - 15-minute break resets consecutive working clock",
  () => {
    const day = createDriverDay({
      drivingMinutes: 5 * 60 + 45,
      otherWorkMinutes: 3 * 60,
      breakMinutes: 15,
      activities: [
        {
          id: "scenario-6-driving",
          type: "driving",
          start: "2026-08-29T06:00:00.000Z",
          end: "2026-08-29T11:45:00.000Z",
          durationMinutes: 5 * 60 + 45,
        },
        {
          id: "scenario-6-break",
          type: "break",
          start: "2026-08-29T11:45:00.000Z",
          end: "2026-08-29T12:00:00.000Z",
          durationMinutes: 15,
        },
        {
          id: "scenario-6-other-work",
          type: "otherWork",
          start: "2026-08-29T12:00:00.000Z",
          end: "2026-08-29T15:00:00.000Z",
          durationMinutes: 3 * 60,
        },
      ],
    });

    const result = evaluateLiveWtdState(day);

    assert(result.level === "due", `Expected due, got ${result.level}`);

    assert(
      result.requiredBreakMinutes === 30,
      `Expected 30 required minutes, got ${result.requiredBreakMinutes}`,
    );

    assert(
      result.qualifyingBreakMinutes === 15,
      `Expected 15 qualifying break minutes, got ${result.qualifyingBreakMinutes}`,
    );

    assert(
      result.breakShortfallMinutes === 15,
      `Expected 15-minute shortfall, got ${result.breakShortfallMinutes}`,
    );
  },
);
/*
 * Scenario 7
 *
 * 5h45 working
 * + 14-minute break
 * + 16 minutes further working.
 *
 * A WTD break segment must be at least 15 minutes.
 * Therefore the 14-minute break does NOT reset the
 * consecutive-working-time clock.
 *
 * Total consecutive working reaches 6h01.
 *
 * Expected:
 * BREACH
 */
runScenario(
  "Scenario 7 - 14-minute break does not reset consecutive working clock",
  () => {
    const day = createDriverDay({
      drivingMinutes: 5 * 60 + 45,
      otherWorkMinutes: 16,
      breakMinutes: 14,
      activities: [
        {
          id: "scenario-7-driving",
          type: "driving",
          start: "2026-08-29T06:00:00.000Z",
          end: "2026-08-29T11:45:00.000Z",
          durationMinutes: 5 * 60 + 45,
        },
        {
          id: "scenario-7-break",
          type: "break",
          start: "2026-08-29T11:45:00.000Z",
          end: "2026-08-29T11:59:00.000Z",
          durationMinutes: 14,
        },
        {
          id: "scenario-7-other-work",
          type: "otherWork",
          start: "2026-08-29T11:59:00.000Z",
          end: "2026-08-29T12:15:00.000Z",
          durationMinutes: 16,
        },
      ],
    });

    const result = evaluateLiveWtdState(day);

    assert(result.level === "breach", `Expected breach, got ${result.level}`);

    assert(
      result.qualifyingBreakMinutes === 0,
      `Expected 0 qualifying break minutes, got ${result.qualifyingBreakMinutes}`,
    );
  },
);
/*
 * Scenario 8
 *
 * 3h driving
 * + 1h POA
 * + 3h01 other work.
 *
 * POA is excluded from WTD working time, but it
 * does not automatically count as a qualifying
 * WTD break that resets the six-hour working clock.
 *
 * Accumulated working time therefore reaches 6h01.
 *
 * Expected:
 * BREACH
 */
runScenario("Scenario 8 - POA does not reset consecutive working clock", () => {
  const day = createDriverDay({
    drivingMinutes: 3 * 60,
    otherWorkMinutes: 3 * 60 + 1,
    poaMinutes: 60,
    activities: [
      {
        id: "scenario-8-driving",
        type: "driving",
        start: "2026-08-29T06:00:00.000Z",
        end: "2026-08-29T09:00:00.000Z",
        durationMinutes: 3 * 60,
      },
      {
        id: "scenario-8-poa",
        type: "poa",
        start: "2026-08-29T09:00:00.000Z",
        end: "2026-08-29T10:00:00.000Z",
        durationMinutes: 60,
      },
      {
        id: "scenario-8-other-work",
        type: "otherWork",
        start: "2026-08-29T10:00:00.000Z",
        end: "2026-08-29T13:01:00.000Z",
        durationMinutes: 3 * 60 + 1,
      },
    ],
  });

  const result = evaluateLiveWtdState(day);

  assert(
    result.workingMinutes === 6 * 60 + 1,
    `Expected 361 working minutes, got ${result.workingMinutes}`,
  );

  assert(
    result.qualifyingBreakMinutes === 0,
    `Expected 0 qualifying break minutes, got ${result.qualifyingBreakMinutes}`,
  );

  assert(result.level === "breach", `Expected breach, got ${result.level}`);
});
/*
 * Scenario 9
 *
 * The current DriverDay only contains today's
 * 4h01 of working time.
 *
 * Persistent activity history also contains 2h
 * of working immediately before midnight.
 *
 * The integrated live WTD engine must therefore
 * see 6h01 consecutive working across midnight.
 *
 * Expected:
 * BREACH
 */
runScenario(
  "Scenario 9 - activity history detects 6h01 across midnight",
  () => {
    const day = createDriverDay({
      date: "2026-08-30",
      drivingMinutes: 0,
      otherWorkMinutes: 4 * 60 + 1,
      activities: [
        {
          id: "scenario-9-today-work",
          type: "otherWork",
          start: "2026-08-30T00:00:00.000Z",
          end: "2026-08-30T04:01:00.000Z",
          durationMinutes: 4 * 60 + 1,
        },
      ],
    });

    const activityHistory = [
      {
        id: "scenario-9-before-midnight",
        activity: "driving" as const,
        startedAt: "2026-08-29T22:00:00.000Z",
        endedAt: "2026-08-30T00:00:00.000Z",
        durationMilliseconds: 2 * 60 * 60 * 1000,
        source: "manual" as const,
      },
      {
        id: "scenario-9-after-midnight",
        activity: "other-work" as const,
        startedAt: "2026-08-30T00:00:00.000Z",
        endedAt: "2026-08-30T04:01:00.000Z",
        durationMilliseconds: (4 * 60 + 1) * 60 * 1000,
        source: "manual" as const,
      },
    ];

    const result = evaluateLiveWtdState(
      day,
      activityHistory,
      new Date("2026-08-30T04:01:00.000Z").getTime(),
    );

    assert(
      result.consecutiveWorkingMinutes === 6 * 60 + 1,
      `Expected 361 consecutive working minutes, got ${result.consecutiveWorkingMinutes}`,
    );

    assert(result.level === "breach", `Expected breach, got ${result.level}`);
  },
);
/*
 * Scenario 10
 *
 * Exactly 6h consecutive working.
 *
 * The six-hour ACTION state must take priority over
 * any broader total-break requirement.
 *
 * Expected:
 * ACTION
 */
runScenario("Scenario 10 - action takes priority at exactly 6h", () => {
  const day = createDriverDay({
    drivingMinutes: 6 * 60,
    breakMinutes: 0,
    activities: [
      {
        id: "scenario-10-driving",
        type: "driving",
        start: "2026-08-29T06:00:00.000Z",
        end: "2026-08-29T12:00:00.000Z",
        durationMinutes: 6 * 60,
      },
    ],
  });

  const result = evaluateLiveWtdState(day);

  assert(result.level === "action", `Expected action, got ${result.level}`);

  assert(
    result.consecutiveWorkingMinutes === 6 * 60,
    `Expected 360 consecutive working minutes, got ${result.consecutiveWorkingMinutes}`,
  );

  assert(
    result.minutesUntilSixHourLimit === 0,
    `Expected 0 minutes remaining, got ${result.minutesUntilSixHourLimit}`,
  );
});
/*
 * Scenario 11
 *
 * 8h total working, but a qualifying 15-minute
 * break has already reset the consecutive clock.
 *
 * The driver has not breached the six-hour clock,
 * but the total WTD break requirement is 30 minutes.
 * Only 15 minutes has been taken.
 *
 * Expected:
 * DUE
 */
runScenario("Scenario 11 - total break due without consecutive breach", () => {
  const day = createDriverDay({
    drivingMinutes: 5 * 60,
    otherWorkMinutes: 3 * 60,
    breakMinutes: 15,
    activities: [
      {
        id: "scenario-11-driving",
        type: "driving",
        start: "2026-08-29T06:00:00.000Z",
        end: "2026-08-29T11:00:00.000Z",
        durationMinutes: 5 * 60,
      },
      {
        id: "scenario-11-break",
        type: "break",
        start: "2026-08-29T11:00:00.000Z",
        end: "2026-08-29T11:15:00.000Z",
        durationMinutes: 15,
      },
      {
        id: "scenario-11-other-work",
        type: "otherWork",
        start: "2026-08-29T11:15:00.000Z",
        end: "2026-08-29T14:15:00.000Z",
        durationMinutes: 3 * 60,
      },
    ],
  });

  const result = evaluateLiveWtdState(day);

  assert(result.level === "due", `Expected due, got ${result.level}`);

  assert(
    result.requiredBreakMinutes === 30,
    `Expected 30 required break minutes, got ${result.requiredBreakMinutes}`,
  );

  assert(
    result.qualifyingBreakMinutes === 15,
    `Expected 15 qualifying break minutes, got ${result.qualifyingBreakMinutes}`,
  );

  assert(
    result.breakShortfallMinutes === 15,
    `Expected 15-minute shortfall, got ${result.breakShortfallMinutes}`,
  );
});
/*
 * Scenario 12
 *
 * 6 hours and 1 second of continuous working
 * from persistent activity history.
 *
 * This proves millisecond precision survives
 * the complete live WTD state pipeline.
 *
 * Expected:
 * BREACH
 */
runScenario("Scenario 12 - 6h00m01s precise history is breach", () => {
  const day = createDriverDay({
    drivingMinutes: 360,
  });

  const history: ActivityHistoryEvent[] = [
    {
      id: "scenario-12-driving",
      activity: "driving",
      startedAt: "2026-08-29T06:00:00.000Z",
      endedAt: "2026-08-29T12:00:01.000Z",
      durationMilliseconds: 6 * 60 * 60 * 1000 + 1000,
      source: "manual",
    },
  ];

  const result = evaluateLiveWtdState(
    day,
    history,
    new Date("2026-08-29T12:00:01.000Z").getTime(),
  );

  assert(result.level === "breach", `Expected breach, got ${result.level}`);

  assert(
    result.consecutiveWorkingMinutes === 360,
    `Expected compatibility value 360 minutes, got ${result.consecutiveWorkingMinutes}`,
  );

  assert(
    result.prediction.level === "breach",
    `Expected prediction breach, got ${result.prediction.level}`,
  );
});
/*
 * Scenario 13
 *
 * Full integrated work-period test.
 *
 * Previous shift:
 * 06:00 -> 16:00 = 10h work
 *
 * Completed daily rest:
 * 16:00 -> 01:00 = 9h
 *
 * New work period:
 * 01:00 -> 04:00 = 3h
 * 04:00 -> 07:01 = 3h01
 *
 * The old 10h shift must be excluded.
 *
 * Current work-period total = 6h01.
 * Required WTD break = 30 minutes.
 *
 * Because the consecutive-working clock is also
 * beyond six hours, breach has priority over due.
 */
runScenario(
  "Scenario 13 - rest evidence resets cross-midnight work-period totals",
  () => {
    const day = createDriverDay({
      drivingMinutes: 181,
      otherWorkMinutes: 180,
    });

    const history: ActivityHistoryEvent[] = [
      {
        id: "scenario-13-old-work",
        activity: "other-work",
        startedAt: "2026-08-29T06:00:00.000Z",
        endedAt: "2026-08-29T16:00:00.000Z",
        durationMilliseconds: 10 * 60 * 60 * 1000,
        source: "manual",
      },
      {
        id: "scenario-13-new-driving",
        activity: "driving",
        startedAt: "2026-08-30T01:00:00.000Z",
        endedAt: "2026-08-30T04:00:00.000Z",
        durationMilliseconds: 3 * 60 * 60 * 1000,
        source: "manual",
      },
      {
        id: "scenario-13-new-work",
        activity: "other-work",
        startedAt: "2026-08-30T04:00:00.000Z",
        endedAt: "2026-08-30T07:01:00.000Z",
        durationMilliseconds: 181 * 60 * 1000,
        source: "manual",
      },
    ];

    const restSessions = [
      {
        id: "scenario-13-daily-rest",
        type: "daily" as const,
        startedAt: "2026-08-29T16:00:00.000Z",
        endedAt: "2026-08-30T01:00:00.000Z",
        durationMilliseconds: 9 * 60 * 60 * 1000,
        status: "completed" as const,
      },
    ];

    const result = evaluateLiveWtdState(
      day,
      history,
      new Date("2026-08-30T07:01:00.000Z").getTime(),
      {
        activityHistory: history,
        restSessions,
      },
    );

    assert(
      result.workingMinutes === 361,
      `Expected current work-period total 361 minutes, got ${result.workingMinutes}`,
    );

    assert(
      result.requiredBreakMinutes === 30,
      `Expected 30 required break minutes, got ${result.requiredBreakMinutes}`,
    );

    assert(
      result.breakShortfallMinutes === 30,
      `Expected 30 minute break shortfall, got ${result.breakShortfallMinutes}`,
    );

    assert(
      result.level === "breach",
      `Expected breach from >6h consecutive work, got ${result.level}`,
    );
  },
);
/*
 * Scenario 14
 *
 * No qualifying daily/weekly rest exists.
 *
 * Work begins before midnight and continues
 * after midnight.
 *
 * The earlier work must remain part of the
 * current work period.
 *
 * 22:00 -> 00:00 = 2h
 * 00:00 -> 04:01 = 4h01
 *
 * Total working time = 6h01.
 * Required WTD break = 30 minutes.
 *
 * Consecutive working also exceeds six hours,
 * so breach has priority.
 */
runScenario(
  "Scenario 14 - midnight does not reset integrated work-period totals",
  () => {
    const day = createDriverDay({
      drivingMinutes: 241,
      otherWorkMinutes: 0,
    });

    const history: ActivityHistoryEvent[] = [
      {
        id: "scenario-14-before-midnight",
        activity: "driving",
        startedAt: "2026-08-29T22:00:00.000Z",
        endedAt: "2026-08-30T00:00:00.000Z",
        durationMilliseconds: 2 * 60 * 60 * 1000,
        source: "manual",
      },
      {
        id: "scenario-14-after-midnight",
        activity: "driving",
        startedAt: "2026-08-30T00:00:00.000Z",
        endedAt: "2026-08-30T04:01:00.000Z",
        durationMilliseconds: 241 * 60 * 1000,
        source: "manual",
      },
    ];

    const result = evaluateLiveWtdState(
      day,
      history,
      new Date("2026-08-30T04:01:00.000Z").getTime(),
      {
        activityHistory: history,
        restSessions: [],
      },
    );

    assert(
      result.workingMinutes === 361,
      `Expected 361 cross-midnight working minutes, got ${result.workingMinutes}`,
    );

    assert(
      result.requiredBreakMinutes === 30,
      `Expected 30 required break minutes, got ${result.requiredBreakMinutes}`,
    );

    assert(
      result.breakShortfallMinutes === 30,
      `Expected 30 minute break shortfall, got ${result.breakShortfallMinutes}`,
    );

    assert(
      result.level === "breach",
      `Expected breach from >6h consecutive work, got ${result.level}`,
    );
  },
);
/*
 * Scenario 15
 *
 * A qualifying 15-minute WTD break resets the
 * consecutive-working clock, but it does NOT
 * start a new work period.
 *
 * 20:00 -> 23:00 = 3h work
 * 23:00 -> 23:15 = 15m qualifying break
 * 23:15 -> 02:15 = 3h work
 * 02:15 -> 02:30 = 15m qualifying break
 * 02:30 -> 05:31 = 3h01 work
 *
 * Total working time = 9h01.
 * Total qualifying break = 30m.
 *
 * Therefore:
 * required WTD break = 45m
 * shortfall = 15m
 *
 * Consecutive clock after the final break is
 * only 3h01, so this must be DUE, not breach.
 */
runScenario(
  "Scenario 15 - WTD breaks reset consecutive clock but not work-period total",
  () => {
    const day = createDriverDay({
      drivingMinutes: 181,
      otherWorkMinutes: 0,
    });

    const history: ActivityHistoryEvent[] = [
      {
        id: "scenario-15-work-a",
        activity: "driving",
        startedAt: "2026-08-29T20:00:00.000Z",
        endedAt: "2026-08-29T23:00:00.000Z",
        durationMilliseconds: 180 * 60 * 1000,
        source: "manual",
      },
      {
        id: "scenario-15-break-a",
        activity: "break",
        startedAt: "2026-08-29T23:00:00.000Z",
        endedAt: "2026-08-29T23:15:00.000Z",
        durationMilliseconds: 15 * 60 * 1000,
        source: "manual",
      },
      {
        id: "scenario-15-work-b",
        activity: "other-work",
        startedAt: "2026-08-29T23:15:00.000Z",
        endedAt: "2026-08-30T02:15:00.000Z",
        durationMilliseconds: 180 * 60 * 1000,
        source: "manual",
      },
      {
        id: "scenario-15-break-b",
        activity: "break",
        startedAt: "2026-08-30T02:15:00.000Z",
        endedAt: "2026-08-30T02:30:00.000Z",
        durationMilliseconds: 15 * 60 * 1000,
        source: "manual",
      },
      {
        id: "scenario-15-work-c",
        activity: "driving",
        startedAt: "2026-08-30T02:30:00.000Z",
        endedAt: "2026-08-30T05:31:00.000Z",
        durationMilliseconds: 181 * 60 * 1000,
        source: "manual",
      },
    ];

    const result = evaluateLiveWtdState(
      day,
      history,
      new Date("2026-08-30T05:31:00.000Z").getTime(),
      {
        activityHistory: history,
        restSessions: [],
      },
    );

    assert(
      result.workingMinutes === 541,
      `Expected 541 working minutes, got ${result.workingMinutes}`,
    );

    assert(
      result.qualifyingBreakMinutes === 30,
      `Expected 30 qualifying break minutes, got ${result.qualifyingBreakMinutes}`,
    );

    assert(
      result.requiredBreakMinutes === 45,
      `Expected 45 required break minutes, got ${result.requiredBreakMinutes}`,
    );

    assert(
      result.breakShortfallMinutes === 15,
      `Expected 15 minute break shortfall, got ${result.breakShortfallMinutes}`,
    );

    assert(
      result.consecutiveWorkingMinutes === 181,
      `Expected consecutive clock to be 181 minutes, got ${result.consecutiveWorkingMinutes}`,
    );

    assert(result.level === "due", `Expected due, got ${result.level}`);
  },
);

console.log("All live WTD state scenarios passed.");
