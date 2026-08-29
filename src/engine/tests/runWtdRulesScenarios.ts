import type { ActivityPeriod, DriverDay } from "../types";

import {
    calculateRollingWtdAverage,
    checkConsecutiveWtdWorkingTime,
    checkDailyWtdBreaks,
    checkRollingWtdAverage,
    checkWeeklyWorkingTime,
    getDailyWorkingMinutes,
    getQualifyingWtdBreakMinutes,
    getRequiredWtdBreakMinutes,
} from "../wtdRules";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`WTD scenario failed: ${message}`);
  }
}

function createActivity(
  id: string,
  type: ActivityPeriod["type"],
  start: string,
  end: string,
  durationMinutes: number,
): ActivityPeriod {
  return {
    id,
    type,
    start,
    end,
    durationMinutes,
  };
}

function createDriverDay(overrides: Partial<DriverDay> = {}): DriverDay {
  return {
    id: "wtd-test-day",
    date: "2026-08-29",
    activities: [],

    drivingMinutes: 0,
    otherWorkMinutes: 0,
    breakMinutes: 0,
    poaMinutes: 0,
    restMinutes: 11 * 60,

    dailyRestType: "regular",

    ...overrides,
  };
}

/**
 * --------------------------------------------------
 * SCENARIO 1
 * EXACTLY 6 HOURS WORKING
 * --------------------------------------------------
 *
 * The driver has reached six hours of working time,
 * but has not worked MORE THAN six consecutive hours.
 */
{
  const day = createDriverDay({
    drivingMinutes: 6 * 60,
  });

  assert(
    getDailyWorkingMinutes(day) === 360,
    "Exactly six hours must equal 360 working minutes.",
  );

  assert(
    getRequiredWtdBreakMinutes(360) === 0,
    "Exactly six hours must not trigger the >6h total-break requirement.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 2
 * MORE THAN 6 HOURS, UP TO 9 HOURS
 * --------------------------------------------------
 *
 * Once total working time exceeds six hours,
 * at least 30 minutes of qualifying break is required.
 */
{
  assert(
    getRequiredWtdBreakMinutes(361) === 30,
    "361 working minutes must require 30 minutes of break.",
  );

  assert(
    getRequiredWtdBreakMinutes(9 * 60) === 30,
    "Exactly nine hours of working time must require 30 minutes of break.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 3
 * MORE THAN 9 HOURS
 * --------------------------------------------------
 *
 * Working time above nine hours requires at least
 * 45 minutes of qualifying break.
 */
{
  assert(
    getRequiredWtdBreakMinutes(9 * 60 + 1) === 45,
    "Nine hours and one minute must require 45 minutes of break.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 4
 * BREAK SEGMENTS UNDER 15 MINUTES DO NOT COUNT
 * --------------------------------------------------
 */
{
  const day = createDriverDay({
    drivingMinutes: 7 * 60,
    breakMinutes: 44,

    activities: [
      createActivity(
        "break-14",
        "break",
        "2026-08-29T12:00:00.000Z",
        "2026-08-29T12:14:00.000Z",
        14,
      ),
      createActivity(
        "break-30",
        "break",
        "2026-08-29T14:00:00.000Z",
        "2026-08-29T14:30:00.000Z",
        30,
      ),
    ],
  });

  assert(
    getQualifyingWtdBreakMinutes(day) === 30,
    "A 14-minute break must not count toward WTD break totals.",
  );

  const result = checkDailyWtdBreaks(day);

  assert(
    result.level === "good",
    "Seven hours working with a qualifying 30-minute break should satisfy the total-break requirement.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 5
 * TWO 15-MINUTE BREAKS CAN PROVIDE 30 MINUTES
 * --------------------------------------------------
 */
{
  const day = createDriverDay({
    drivingMinutes: 7 * 60,
    breakMinutes: 30,

    activities: [
      createActivity(
        "break-15-a",
        "break",
        "2026-08-29T10:00:00.000Z",
        "2026-08-29T10:15:00.000Z",
        15,
      ),
      createActivity(
        "break-15-b",
        "break",
        "2026-08-29T13:00:00.000Z",
        "2026-08-29T13:15:00.000Z",
        15,
      ),
    ],
  });

  assert(
    getQualifyingWtdBreakMinutes(day) === 30,
    "Two qualifying 15-minute breaks must total 30 minutes.",
  );

  const result = checkDailyWtdBreaks(day);

  assert(
    result.level === "good",
    "Seven hours working with 30 qualifying break minutes should satisfy the total-break requirement.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 6
 * INSUFFICIENT TOTAL BREAK
 * --------------------------------------------------
 */
{
  const day = createDriverDay({
    drivingMinutes: 7 * 60,
    breakMinutes: 15,

    activities: [
      createActivity(
        "break-15",
        "break",
        "2026-08-29T12:00:00.000Z",
        "2026-08-29T12:15:00.000Z",
        15,
      ),
    ],
  });

  const result = checkDailyWtdBreaks(day);

  assert(
    result.level === "breach",
    "Seven hours working with only 15 qualifying break minutes must breach the 30-minute requirement.",
  );

  assert(
    result.issues.some(
      (issue) =>
        issue.rule === "working-time-break" && issue.level === "breach",
    ),
    "Insufficient total WTD break must create a working-time-break breach.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 7
 * CURRENT ENGINE GAP:
 * 6 HOURS 1 MINUTE CONTINUOUS WORK
 * --------------------------------------------------
 *
 * Timeline:
 *
 * 06:00 -> 12:01   Working = 6h01
 * 12:01 -> 12:31   Break   = 30m
 *
 * The total-break calculation sees 30 qualifying
 * minutes and currently considers the day compliant.
 *
 * But the timeline contains more than six consecutive
 * hours of working before the break.
 *
 * This scenario deliberately describes the behaviour
 * the upgraded engine must detect.
 */
{
  const day = createDriverDay({
    drivingMinutes: 361,
    breakMinutes: 30,

    activities: [
      createActivity(
        "continuous-work-361",
        "driving",
        "2026-08-29T06:00:00.000Z",
        "2026-08-29T12:01:00.000Z",
        361,
      ),
      createActivity(
        "break-after-breach",
        "break",
        "2026-08-29T12:01:00.000Z",
        "2026-08-29T12:31:00.000Z",
        30,
      ),
    ],
  });

  const result = checkDailyWtdBreaks(day);

  const detectedSixHourBreach = result.issues.some(
    (issue) =>
      issue.rule === "working-time-break" &&
      issue.level === "breach" &&
      issue.description.toLowerCase().includes("consecutive"),
  );

  assert(
    detectedSixHourBreach,
    "6h01 of consecutive working time must be detected even when sufficient total break is taken afterwards.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 8
 * 15-MINUTE BREAK RESETS THE 6-HOUR CLOCK
 * BUT DOES NOT SATISFY THE 30-MINUTE TOTAL
 * --------------------------------------------------
 *
 * Timeline:
 *
 * 06:00 -> 11:45   Work  = 5h45
 * 11:45 -> 12:00   Break = 15m
 * 12:00 -> 15:00   Work  = 3h
 *
 * The 15-minute break prevents a consecutive
 * six-hour working-time breach.
 *
 * However, total working time is 8h45, so the
 * driver requires 30 minutes of qualifying WTD
 * break in total.
 *
 * Only 15 minutes has been recorded, therefore
 * the total-break requirement must still breach.
 */
{
  const day = createDriverDay({
    drivingMinutes: 5 * 60 + 45,
    otherWorkMinutes: 3 * 60,
    breakMinutes: 15,

    activities: [
      createActivity(
        "work-before-break",
        "driving",
        "2026-08-29T06:00:00.000Z",
        "2026-08-29T11:45:00.000Z",
        5 * 60 + 45,
      ),
      createActivity(
        "qualifying-break-15",
        "break",
        "2026-08-29T11:45:00.000Z",
        "2026-08-29T12:00:00.000Z",
        15,
      ),
      createActivity(
        "work-after-break",
        "otherWork",
        "2026-08-29T12:00:00.000Z",
        "2026-08-29T15:00:00.000Z",
        3 * 60,
      ),
    ],
  });

  const consecutiveResult = checkConsecutiveWtdWorkingTime(day);

  assert(
    consecutiveResult.level === "good",
    "A qualifying 15-minute break after 5h45 must reset the consecutive-working clock.",
  );

  const result = checkDailyWtdBreaks(day);

  assert(
    result.level === "breach",
    "8h45 working with only 15 qualifying break minutes must breach the 30-minute total-break requirement.",
  );

  assert(
    result.issues.some(
      (issue) =>
        issue.rule === "working-time-break" &&
        issue.title === "Insufficient working-time break",
    ),
    "The breach must be caused by insufficient total WTD break.",
  );

  assert(
    result.issues.some(
      (issue) => issue.title === "Six-hour working-time limit exceeded",
    ) === false,
    "Scenario 8 must not manufacture a consecutive six-hour breach.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 9
 * TWO 15-MINUTE BREAKS SATISFY THE 30-MINUTE TOTAL
 * --------------------------------------------------
 *
 * Timeline:
 *
 * 06:00 -> 11:45   Work  = 5h45
 * 11:45 -> 12:00   Break = 15m
 * 12:00 -> 15:00   Work  = 3h
 * 15:00 -> 15:15   Break = 15m
 *
 * Total working time = 8h45.
 *
 * The first 15-minute break resets the
 * consecutive-working clock.
 *
 * The two qualifying 15-minute break periods
 * total 30 minutes.
 *
 * Expected result:
 * GOOD.
 */
{
  const day = createDriverDay({
    drivingMinutes: 5 * 60 + 45,
    otherWorkMinutes: 3 * 60,
    breakMinutes: 30,

    activities: [
      createActivity(
        "work-before-break",
        "driving",
        "2026-08-29T06:00:00.000Z",
        "2026-08-29T11:45:00.000Z",
        5 * 60 + 45,
      ),
      createActivity(
        "first-qualifying-break",
        "break",
        "2026-08-29T11:45:00.000Z",
        "2026-08-29T12:00:00.000Z",
        15,
      ),
      createActivity(
        "work-after-break",
        "otherWork",
        "2026-08-29T12:00:00.000Z",
        "2026-08-29T15:00:00.000Z",
        3 * 60,
      ),
      createActivity(
        "second-qualifying-break",
        "break",
        "2026-08-29T15:00:00.000Z",
        "2026-08-29T15:15:00.000Z",
        15,
      ),
    ],
  });

  const consecutiveResult = checkConsecutiveWtdWorkingTime(day);

  assert(
    consecutiveResult.level === "good",
    "Scenario 9 must not create a consecutive six-hour breach.",
  );

  const result = checkDailyWtdBreaks(day);

  assert(
    result.level === "good",
    "8h45 working with two qualifying 15-minute breaks must satisfy the 30-minute WTD break requirement.",
  );

  assert(
    result.issues.length === 0,
    "Scenario 9 should produce no WTD compliance issues.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 10
 * 14-MINUTE BREAK MUST NOT RESET THE 6-HOUR CLOCK
 * --------------------------------------------------
 *
 * Timeline:
 *
 * 06:00 -> 09:00   Work  = 3h
 * 09:00 -> 09:14   Break = 14m
 * 09:14 -> 12:15   Work  = 3h01
 *
 * Total working time = 6h01.
 *
 * Because the break is only 14 minutes, it is not
 * a qualifying WTD break segment.
 *
 * Therefore the consecutive-working counter must
 * continue through it and reach 6h01.
 *
 * Expected result:
 * BREACH for exceeding six consecutive hours
 * without a qualifying break.
 */
{
  const day = createDriverDay({
    drivingMinutes: 3 * 60,
    otherWorkMinutes: 3 * 60 + 1,
    breakMinutes: 14,

    activities: [
      createActivity(
        "first-work-period",
        "driving",
        "2026-08-29T06:00:00.000Z",
        "2026-08-29T09:00:00.000Z",
        3 * 60,
      ),
      createActivity(
        "short-break-14",
        "break",
        "2026-08-29T09:00:00.000Z",
        "2026-08-29T09:14:00.000Z",
        14,
      ),
      createActivity(
        "second-work-period",
        "otherWork",
        "2026-08-29T09:14:00.000Z",
        "2026-08-29T12:15:00.000Z",
        3 * 60 + 1,
      ),
    ],
  });

  const consecutiveResult = checkConsecutiveWtdWorkingTime(day);

  assert(
    consecutiveResult.level === "breach",
    "A 14-minute break must not reset the six-hour WTD working-time clock.",
  );

  assert(
    consecutiveResult.issues.some(
      (issue) => issue.title === "Six-hour working-time limit exceeded",
    ),
    "Scenario 10 must create a consecutive six-hour WTD breach.",
  );

  assert(
    consecutiveResult.issues.some((issue) => issue.varianceMinutes === 1),
    "The consecutive working period should exceed six hours by exactly 1 minute.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 11
 * DRIVING + OTHER WORK SHARE THE SAME 6-HOUR CLOCK
 * --------------------------------------------------
 *
 * Timeline:
 *
 * 06:00 -> 10:00   Driving    = 4h
 * 10:00 -> 12:01   Other Work = 2h01
 *
 * No qualifying break occurs between the two
 * working activities.
 *
 * Total consecutive working time = 6h01.
 *
 * Changing from Driving to Other Work must NOT
 * reset the WTD six-hour working-time clock.
 *
 * Expected result:
 * BREACH by exactly 1 minute.
 */
{
  const day = createDriverDay({
    drivingMinutes: 4 * 60,
    otherWorkMinutes: 2 * 60 + 1,
    breakMinutes: 0,

    activities: [
      createActivity(
        "driving-period",
        "driving",
        "2026-08-29T06:00:00.000Z",
        "2026-08-29T10:00:00.000Z",
        4 * 60,
      ),
      createActivity(
        "other-work-period",
        "otherWork",
        "2026-08-29T10:00:00.000Z",
        "2026-08-29T12:01:00.000Z",
        2 * 60 + 1,
      ),
    ],
  });

  const result = checkConsecutiveWtdWorkingTime(day);

  assert(
    result.level === "breach",
    "Driving followed by Other Work must remain on the same six-hour WTD clock.",
  );

  assert(
    result.issues.some(
      (issue) => issue.title === "Six-hour working-time limit exceeded",
    ),
    "Scenario 11 must create a consecutive six-hour WTD breach.",
  );

  assert(
    result.issues.some((issue) => issue.varianceMinutes === 1),
    "Scenario 11 should exceed the six-hour limit by exactly 1 minute.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 12
 * EXACTLY 6 HOURS IS NOT A BREACH
 * --------------------------------------------------
 *
 * Timeline:
 *
 * 06:00 -> 10:00   Driving    = 4h
 * 10:00 -> 12:00   Other Work = 2h
 *
 * Total consecutive working time = exactly 6h.
 *
 * Expected result:
 * GOOD.
 *
 * The breach begins only when working time
 * exceeds six hours without a qualifying break.
 */
{
  const day = createDriverDay({
    drivingMinutes: 4 * 60,
    otherWorkMinutes: 2 * 60,
    breakMinutes: 0,

    activities: [
      createActivity(
        "driving-period",
        "driving",
        "2026-08-29T06:00:00.000Z",
        "2026-08-29T10:00:00.000Z",
        4 * 60,
      ),
      createActivity(
        "other-work-period",
        "otherWork",
        "2026-08-29T10:00:00.000Z",
        "2026-08-29T12:00:00.000Z",
        2 * 60,
      ),
    ],
  });

  const result = checkConsecutiveWtdWorkingTime(day);

  assert(
    result.level === "good",
    "Exactly six hours of consecutive working time must not be recorded as a breach.",
  );

  assert(
    result.issues.length === 0,
    "Scenario 12 should produce no consecutive-working WTD issues.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 13
 * POA DOES NOT COUNT AS WORKING TIME
 * BUT DOES NOT RESET THE 6-HOUR CLOCK
 * --------------------------------------------------
 *
 * Timeline:
 *
 * 06:00 -> 09:00   Driving    = 3h
 * 09:00 -> 10:00   POA        = 1h
 * 10:00 -> 13:01   Other Work = 3h01
 *
 * POA is excluded from working time.
 *
 * However, POA is not automatically treated by
 * this engine as a qualifying WTD break.
 *
 * Therefore:
 *
 * Working time = 3h + 3h01 = 6h01.
 *
 * The POA does not reset the accumulated
 * working-time counter.
 *
 * Expected result:
 * BREACH by exactly 1 minute.
 */
{
  const day = createDriverDay({
    drivingMinutes: 3 * 60,
    otherWorkMinutes: 3 * 60 + 1,
    breakMinutes: 0,
    poaMinutes: 60,

    activities: [
      createActivity(
        "driving-before-poa",
        "driving",
        "2026-08-29T06:00:00.000Z",
        "2026-08-29T09:00:00.000Z",
        3 * 60,
      ),
      createActivity(
        "poa-period",
        "poa",
        "2026-08-29T09:00:00.000Z",
        "2026-08-29T10:00:00.000Z",
        60,
      ),
      createActivity(
        "other-work-after-poa",
        "otherWork",
        "2026-08-29T10:00:00.000Z",
        "2026-08-29T13:01:00.000Z",
        3 * 60 + 1,
      ),
    ],
  });

  const result = checkConsecutiveWtdWorkingTime(day);

  assert(
    result.level === "breach",
    "POA must not automatically reset the six-hour WTD working-time clock.",
  );

  assert(
    result.issues.some(
      (issue) => issue.title === "Six-hour working-time limit exceeded",
    ),
    "Scenario 13 must create a consecutive six-hour WTD breach.",
  );

  assert(
    result.issues.some((issue) => issue.varianceMinutes === 1),
    "Scenario 13 should exceed six hours of accumulated working time by exactly 1 minute.",
  );

  assert(
    getDailyWorkingMinutes(day) === 6 * 60 + 1,
    "The one-hour POA period must not be included in WTD working time.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 14
 * MORE THAN 9 HOURS REQUIRES 45 MINUTES TOTAL BREAK
 * --------------------------------------------------
 *
 * Timeline:
 *
 * 06:00 -> 11:00   Driving    = 5h
 * 11:00 -> 11:15   Break      = 15m
 * 11:15 -> 15:16   Other Work = 4h01
 * 15:16 -> 15:31   Break      = 15m
 *
 * Total working time = 9h01.
 * Total qualifying break = 30m.
 *
 * The first 15-minute break occurs before six
 * consecutive hours are reached, so there should
 * be no six-hour consecutive-working breach.
 *
 * However, because total working time exceeds
 * 9 hours, 45 minutes of qualifying WTD break
 * is required.
 *
 * Only 30 minutes has been recorded.
 *
 * Expected result:
 * BREACH — 15 minutes short.
 */
{
  const day = createDriverDay({
    drivingMinutes: 5 * 60,
    otherWorkMinutes: 4 * 60 + 1,
    breakMinutes: 30,

    activities: [
      createActivity(
        "driving-before-break",
        "driving",
        "2026-08-29T06:00:00.000Z",
        "2026-08-29T11:00:00.000Z",
        5 * 60,
      ),
      createActivity(
        "first-qualifying-break",
        "break",
        "2026-08-29T11:00:00.000Z",
        "2026-08-29T11:15:00.000Z",
        15,
      ),
      createActivity(
        "other-work-after-break",
        "otherWork",
        "2026-08-29T11:15:00.000Z",
        "2026-08-29T15:16:00.000Z",
        4 * 60 + 1,
      ),
      createActivity(
        "second-qualifying-break",
        "break",
        "2026-08-29T15:16:00.000Z",
        "2026-08-29T15:31:00.000Z",
        15,
      ),
    ],
  });

  const consecutiveResult = checkConsecutiveWtdWorkingTime(day);

  assert(
    consecutiveResult.level === "good",
    "Scenario 14 must not create a consecutive six-hour breach.",
  );

  assert(
    getDailyWorkingMinutes(day) === 9 * 60 + 1,
    "Scenario 14 should contain exactly 9h01 of WTD working time.",
  );

  assert(
    getRequiredWtdBreakMinutes(getDailyWorkingMinutes(day)) === 45,
    "More than 9 hours of working time must require 45 minutes of qualifying WTD break.",
  );

  assert(
    getQualifyingWtdBreakMinutes(day) === 30,
    "Scenario 14 should contain exactly 30 qualifying break minutes.",
  );

  const result = checkDailyWtdBreaks(day);

  assert(
    result.level === "breach",
    "9h01 working with only 30 qualifying break minutes must breach the 45-minute requirement.",
  );

  assert(
    result.issues.some(
      (issue) =>
        issue.title === "Insufficient working-time break" &&
        issue.varianceMinutes === 15,
    ),
    "Scenario 14 must report a 15-minute total WTD break shortfall.",
  );

  assert(
    result.issues.some(
      (issue) => issue.title === "Six-hour working-time limit exceeded",
    ) === false,
    "Scenario 14 must fail only because of the 45-minute total-break requirement, not the six-hour rule.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 15
 * MORE THAN 9 HOURS WITH 45 MINUTES BREAK = GOOD
 * --------------------------------------------------
 *
 * Timeline:
 *
 * 06:00 -> 11:00   Driving    = 5h
 * 11:00 -> 11:15   Break      = 15m
 * 11:15 -> 15:16   Other Work = 4h01
 * 15:16 -> 15:46   Break      = 30m
 *
 * Total working time = 9h01.
 * Total qualifying break = 45m.
 *
 * The first 15-minute break resets the six-hour
 * working-time clock.
 *
 * The later 30-minute break brings total qualifying
 * WTD break to 45 minutes.
 *
 * Expected result:
 * GOOD.
 */
{
  const day = createDriverDay({
    drivingMinutes: 5 * 60,
    otherWorkMinutes: 4 * 60 + 1,
    breakMinutes: 45,

    activities: [
      createActivity(
        "driving-before-break",
        "driving",
        "2026-08-29T06:00:00.000Z",
        "2026-08-29T11:00:00.000Z",
        5 * 60,
      ),
      createActivity(
        "first-break-15",
        "break",
        "2026-08-29T11:00:00.000Z",
        "2026-08-29T11:15:00.000Z",
        15,
      ),
      createActivity(
        "other-work-after-break",
        "otherWork",
        "2026-08-29T11:15:00.000Z",
        "2026-08-29T15:16:00.000Z",
        4 * 60 + 1,
      ),
      createActivity(
        "second-break-30",
        "break",
        "2026-08-29T15:16:00.000Z",
        "2026-08-29T15:46:00.000Z",
        30,
      ),
    ],
  });

  assert(
    getDailyWorkingMinutes(day) === 9 * 60 + 1,
    "Scenario 15 should contain exactly 9h01 of WTD working time.",
  );

  assert(
    getRequiredWtdBreakMinutes(getDailyWorkingMinutes(day)) === 45,
    "9h01 of working time must require 45 minutes of qualifying WTD break.",
  );

  assert(
    getQualifyingWtdBreakMinutes(day) === 45,
    "Scenario 15 should contain exactly 45 qualifying break minutes.",
  );

  const consecutiveResult = checkConsecutiveWtdWorkingTime(day);

  assert(
    consecutiveResult.level === "good",
    "Scenario 15 must not create a consecutive six-hour breach.",
  );

  const result = checkDailyWtdBreaks(day);

  assert(
    result.level === "good",
    "9h01 working with 45 qualifying break minutes should satisfy the WTD break requirements.",
  );

  assert(
    result.issues.length === 0,
    "Scenario 15 should produce no WTD compliance issues.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 16
 * A LATE 45-MINUTE BREAK CANNOT ERASE
 * AN EARLIER 6-HOUR BREACH
 * --------------------------------------------------
 *
 * Timeline:
 *
 * 06:00 -> 12:01   Driving = 6h01
 * 12:01 -> 12:46   Break   = 45m
 *
 * Total working time = 6h01.
 * Total qualifying break = 45m.
 *
 * The 45-minute break is itself a qualifying
 * break and exceeds the total break requirement.
 *
 * However, it was taken too late.
 *
 * The driver had already exceeded six consecutive
 * hours of working time before the break started.
 *
 * Expected result:
 * BREACH — six-hour consecutive-working rule.
 */
{
  const day = createDriverDay({
    drivingMinutes: 6 * 60 + 1,
    otherWorkMinutes: 0,
    breakMinutes: 45,

    activities: [
      createActivity(
        "continuous-driving-period",
        "driving",
        "2026-08-29T06:00:00.000Z",
        "2026-08-29T12:01:00.000Z",
        6 * 60 + 1,
      ),
      createActivity(
        "late-break-45",
        "break",
        "2026-08-29T12:01:00.000Z",
        "2026-08-29T12:46:00.000Z",
        45,
      ),
    ],
  });

  assert(
    getDailyWorkingMinutes(day) === 6 * 60 + 1,
    "Scenario 16 should contain exactly 6h01 of WTD working time.",
  );

  assert(
    getRequiredWtdBreakMinutes(getDailyWorkingMinutes(day)) === 30,
    "6h01 of working time should require 30 minutes of total qualifying WTD break.",
  );

  assert(
    getQualifyingWtdBreakMinutes(day) === 45,
    "Scenario 16 should contain 45 qualifying break minutes.",
  );

  const consecutiveResult = checkConsecutiveWtdWorkingTime(day);

  assert(
    consecutiveResult.level === "breach",
    "Working 6h01 before taking a break must create a consecutive-working breach.",
  );

  assert(
    consecutiveResult.issues.some(
      (issue) =>
        issue.title === "Six-hour working-time limit exceeded" &&
        issue.varianceMinutes === 1,
    ),
    "Scenario 16 must record the six-hour limit as exceeded by exactly 1 minute.",
  );

  const result = checkDailyWtdBreaks(day);

  assert(
    result.level === "breach",
    "A later 45-minute break must not erase an earlier six-hour WTD breach.",
  );

  assert(
    result.issues.some(
      (issue) => issue.title === "Six-hour working-time limit exceeded",
    ),
    "The final daily WTD result must retain the earlier consecutive-working breach.",
  );

  assert(
    result.issues.some(
      (issue) => issue.title === "Insufficient working-time break",
    ) === false,
    "Scenario 16 must not report insufficient total break because 45 qualifying minutes were taken.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 17
 * EXACTLY 60 HOURS WEEKLY WORKING TIME = GOOD
 * --------------------------------------------------
 *
 * Six DriverDay records each contain exactly
 * 10 hours of WTD working time.
 *
 * Weekly total:
 *
 * 6 × 10h = exactly 60h.
 *
 * The legal weekly maximum is 60 hours.
 *
 * Expected result:
 * GOOD.
 *
 * A breach must occur only when weekly working
 * time exceeds 60 hours.
 */
{
  const days = Array.from({ length: 6 }, () =>
    createDriverDay({
      drivingMinutes: 5 * 60,
      otherWorkMinutes: 5 * 60,
      breakMinutes: 45,

      activities: [],
    }),
  );

  const totalWorkingMinutes = days.reduce(
    (total, day) => total + getDailyWorkingMinutes(day),
    0,
  );

  assert(
    totalWorkingMinutes === 60 * 60,
    "Scenario 17 should contain exactly 60 hours of weekly working time.",
  );

  const result = checkWeeklyWorkingTime(days);

  assert(
    result.level === "good",
    "Exactly 60 hours of weekly working time must not be recorded as a breach.",
  );

  assert(
    result.issues.length === 0,
    "Scenario 17 should produce no weekly working-time issues.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 18
 * 60 HOURS 1 MINUTE WEEKLY WORKING TIME = BREACH
 * --------------------------------------------------
 *
 * Five days contain exactly 10 hours of working time.
 *
 * The sixth day contains 10h01.
 *
 * Weekly total:
 *
 * 50h + 10h01 = 60h01.
 *
 * Expected result:
 * BREACH by exactly 1 minute.
 */
{
  const days = [
    ...Array.from({ length: 5 }, () =>
      createDriverDay({
        drivingMinutes: 5 * 60,
        otherWorkMinutes: 5 * 60,
        breakMinutes: 45,
        activities: [],
      }),
    ),

    createDriverDay({
      drivingMinutes: 5 * 60,
      otherWorkMinutes: 5 * 60 + 1,
      breakMinutes: 45,
      activities: [],
    }),
  ];

  const totalWorkingMinutes = days.reduce(
    (total, day) => total + getDailyWorkingMinutes(day),
    0,
  );

  assert(
    totalWorkingMinutes === 60 * 60 + 1,
    "Scenario 18 should contain exactly 60h01 of weekly working time.",
  );

  const result = checkWeeklyWorkingTime(days);

  assert(
    result.level === "breach",
    "60h01 of weekly working time must breach the 60-hour weekly maximum.",
  );

  assert(
    result.issues.some(
      (issue) =>
        issue.title === "Weekly working-time limit exceeded" &&
        issue.varianceMinutes === 1,
    ),
    "Scenario 18 must report the weekly working-time limit exceeded by exactly 1 minute.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 19
 * EXACTLY 48H ROLLING AVERAGE = GOOD
 * --------------------------------------------------
 *
 * 17 weeks × 48h.
 *
 * Expected:
 * GOOD.
 *
 * Exactly 48 hours is the maximum average.
 * The breach begins only above 48 hours.
 */
{
  const weeklyWorkingMinutes = Array.from({ length: 17 }, () => 48 * 60);

  const result = calculateRollingWtdAverage(weeklyWorkingMinutes);

  assert(
    result.numberOfWeeks === 17,
    "Scenario 19 should evaluate exactly 17 weeks.",
  );

  assert(
    result.averageWeeklyWorkingMinutes === 48 * 60,
    "Scenario 19 should produce an exact 48-hour weekly average.",
  );

  assert(
    result.level === "warning",
    "Exactly 48 hours should remain inside TachoTrack's warning band and must not be classified as a legal breach.",
  );

  const ruleResult = checkRollingWtdAverage(weeklyWorkingMinutes);

  assert(
    ruleResult.level === "warning",
    "Exactly 48 hours must not create a rolling-average breach.",
  );

  assert(
    ruleResult.issues.some(
      (issue) => issue.id === "rolling-wtd-average-breach",
    ) === false,
    "Scenario 19 must not create a legal rolling-average breach.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 20
 * 48H01 ROLLING AVERAGE = BREACH
 * --------------------------------------------------
 *
 * 17 weeks × 48h01.
 *
 * Expected:
 * BREACH.
 */
{
  const weeklyWorkingMinutes = Array.from({ length: 17 }, () => 48 * 60 + 1);

  const result = calculateRollingWtdAverage(weeklyWorkingMinutes);

  assert(
    result.averageWeeklyWorkingMinutes === 48 * 60 + 1,
    "Scenario 20 should produce an exact 48h01 weekly average.",
  );

  assert(
    result.level === "breach",
    "An average of 48h01 must breach the 48-hour average limit.",
  );

  const ruleResult = checkRollingWtdAverage(weeklyWorkingMinutes);

  assert(
    ruleResult.level === "breach",
    "Scenario 20 must produce a rolling WTD breach.",
  );

  assert(
    ruleResult.issues.some(
      (issue) =>
        issue.id === "rolling-wtd-average-breach" &&
        issue.varianceMinutes === 1,
    ),
    "Scenario 20 must report the rolling average exceeded by exactly 1 minute per week.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 21
 * EXACTLY 45H AVERAGE = TACHOTRACK WARNING
 * --------------------------------------------------
 *
 * 17 weeks × 45h.
 *
 * 45 hours is NOT a legal breach.
 *
 * TachoTrack deliberately uses 45h as an
 * early-warning threshold as the driver
 * approaches the 48-hour average limit.
 *
 * Expected:
 * WARNING.
 */
{
  const weeklyWorkingMinutes = Array.from({ length: 17 }, () => 45 * 60);

  const result = calculateRollingWtdAverage(weeklyWorkingMinutes);

  assert(
    result.averageWeeklyWorkingMinutes === 45 * 60,
    "Scenario 21 should produce an exact 45-hour weekly average.",
  );

  assert(
    result.level === "warning",
    "Exactly 45 hours should trigger the TachoTrack rolling-average warning band.",
  );

  const ruleResult = checkRollingWtdAverage(weeklyWorkingMinutes);

  assert(
    ruleResult.level === "warning",
    "Scenario 21 should produce a warning, not a breach.",
  );

  assert(
    ruleResult.issues.some(
      (issue) => issue.id === "rolling-wtd-average-warning",
    ),
    "Scenario 21 should create the TachoTrack early-warning issue.",
  );

  assert(
    ruleResult.issues.some(
      (issue) => issue.id === "rolling-wtd-average-breach",
    ) === false,
    "Scenario 21 must not create a legal breach.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 22
 * BELOW 45H AVERAGE = GOOD
 * --------------------------------------------------
 *
 * 17 weeks × 44h59.
 *
 * This is below TachoTrack's 45-hour warning
 * threshold and below the legal 48-hour limit.
 *
 * Expected:
 * GOOD.
 */
{
  const weeklyWorkingMinutes = Array.from({ length: 17 }, () => 44 * 60 + 59);

  const result = calculateRollingWtdAverage(weeklyWorkingMinutes);

  assert(
    result.averageWeeklyWorkingMinutes === 44 * 60 + 59,
    "Scenario 22 should produce an exact 44h59 weekly average.",
  );

  assert(
    result.level === "good",
    "44h59 average working time should remain good.",
  );

  const ruleResult = checkRollingWtdAverage(weeklyWorkingMinutes);

  assert(
    ruleResult.level === "good",
    "Scenario 22 should produce a good rolling WTD result.",
  );

  assert(
    ruleResult.issues.length === 0,
    "Scenario 22 should produce no rolling WTD issues.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 23
 * ONLY THE MOST RECENT 17 WEEKS ARE USED
 * --------------------------------------------------
 *
 * Week 1:
 * 60h
 *
 * Weeks 2 -> 18:
 * 40h each
 *
 * Because the default reference period is 17 weeks,
 * Week 1 must fall outside the rolling window.
 *
 * Expected:
 *
 * 17 × 40h = 680h
 * 680h / 17 = 40h average
 *
 * Result:
 * GOOD.
 */
{
  const weeklyWorkingMinutes = [
    60 * 60,
    ...Array.from({ length: 17 }, () => 40 * 60),
  ];

  const result = calculateRollingWtdAverage(weeklyWorkingMinutes);

  assert(
    result.numberOfWeeks === 17,
    "Scenario 23 should evaluate only the most recent 17 weeks.",
  );

  assert(
    result.totalWorkingMinutes === 17 * 40 * 60,
    "Scenario 23 must exclude the oldest 60-hour week from the 17-week window.",
  );

  assert(
    result.averageWeeklyWorkingMinutes === 40 * 60,
    "Scenario 23 should produce an exact 40-hour rolling average.",
  );

  assert(
    result.level === "good",
    "Scenario 23 should remain good because the active 17-week average is 40 hours.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 24
 * CONFIGURED 26-WEEK REFERENCE PERIOD
 * --------------------------------------------------
 *
 * The engine supports a configurable reference
 * period because some valid arrangements may use
 * 26 weeks instead of the default 17.
 *
 * We provide 27 weeks:
 *
 * Week 1:
 * 60h
 *
 * Weeks 2 -> 27:
 * 40h each
 *
 * When referencePeriodWeeks = 26,
 * the oldest 60-hour week must be excluded.
 *
 * Expected:
 *
 * 26 × 40h = 1040h
 * 1040h / 26 = 40h average
 *
 * Result:
 * GOOD.
 */
{
  const weeklyWorkingMinutes = [
    60 * 60,
    ...Array.from({ length: 26 }, () => 40 * 60),
  ];

  const result = calculateRollingWtdAverage(weeklyWorkingMinutes, 26);

  assert(
    result.numberOfWeeks === 26,
    "Scenario 24 should evaluate exactly 26 weeks when the reference period is configured to 26.",
  );

  assert(
    result.totalWorkingMinutes === 26 * 40 * 60,
    "Scenario 24 must exclude the oldest 60-hour week from the configured 26-week window.",
  );

  assert(
    result.averageWeeklyWorkingMinutes === 40 * 60,
    "Scenario 24 should produce an exact 40-hour average over 26 weeks.",
  );

  assert(
    result.level === "good",
    "Scenario 24 should remain good because the configured 26-week average is 40 hours.",
  );

  const ruleResult = checkRollingWtdAverage(weeklyWorkingMinutes, 26);

  assert(
    ruleResult.level === "good",
    "Scenario 24 should produce a good rolling WTD rule result over 26 weeks.",
  );

  assert(
    ruleResult.issues.length === 0,
    "Scenario 24 should produce no rolling WTD issues.",
  );
}

console.log("✓ WTD rule scenarios passed");
