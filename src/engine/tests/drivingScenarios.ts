import type { ActivityPeriod, ComplianceLevel, DriverDay } from "../types";

import {
    checkExtendedDrivingUsage,
    checkFortnightlyDrivingLimit,
    checkWeeklyDrivingLimit,
    evaluateDailyDrivingRules,
} from "../drivingRules";

type ScenarioResult = {
  name: string;
  expectedLevel: ComplianceLevel;
  actualLevel: ComplianceLevel;
  passed: boolean;
  issueCount: number;
  details?: string;
};

function activity(
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

function createDay(
  id: string,
  date: string,
  activities: ActivityPeriod[],
  drivingMinutes: number,
): DriverDay {
  return {
    id,
    date,
    activities,

    drivingMinutes,
    otherWorkMinutes: 0,
    breakMinutes: activities
      .filter((item) => item.type === "break")
      .reduce((total, item) => total + item.durationMinutes, 0),

    poaMinutes: 0,
    restMinutes: 11 * 60,

    dailyRestType: "regular",

    notes: [],
  };
}

function makeSimpleDrivingDay(
  id: string,
  date: string,
  drivingMinutes: number,
): DriverDay {
  return createDay(
    id,
    date,
    [
      activity(
        `${id}-drive`,
        "driving",
        `${date}T06:00:00`,
        `${date}T15:00:00`,
        drivingMinutes,
      ),
    ],
    drivingMinutes,
  );
}

function result(
  name: string,
  expectedLevel: ComplianceLevel,
  actualLevel: ComplianceLevel,
  issueCount: number,
  details?: string,
): ScenarioResult {
  return {
    name,
    expectedLevel,
    actualLevel,

    passed: expectedLevel === actualLevel,

    issueCount,
    details,
  };
}

/**
 * ----------------------------------------------------
 * SCENARIO 1
 *
 * Exactly 4h30 continuous driving.
 *
 * This is legal.
 * ----------------------------------------------------
 */
const exactFourThirty = createDay(
  "exact-4h30",
  "2026-09-01",
  [
    activity(
      "drive",
      "driving",
      "2026-09-01T06:00:00",
      "2026-09-01T10:30:00",
      270,
    ),
  ],
  270,
);

const exactFourThirtyResult = evaluateDailyDrivingRules(exactFourThirty);

/**
 * ----------------------------------------------------
 * SCENARIO 2
 *
 * 4h30 driving
 * 45 minute break
 * 4h30 driving
 *
 * Full qualifying break resets the clock.
 * ----------------------------------------------------
 */
const fullBreakDay = createDay(
  "full-break",
  "2026-09-02",
  [
    activity(
      "drive-1",
      "driving",
      "2026-09-02T06:00:00",
      "2026-09-02T10:30:00",
      270,
    ),

    activity(
      "break-1",
      "break",
      "2026-09-02T10:30:00",
      "2026-09-02T11:15:00",
      45,
    ),

    activity(
      "drive-2",
      "driving",
      "2026-09-02T11:15:00",
      "2026-09-02T15:45:00",
      270,
    ),
  ],

  540,
);

const fullBreakResult = evaluateDailyDrivingRules(fullBreakDay);

/**
 * ----------------------------------------------------
 * SCENARIO 3
 *
 * Valid split break:
 *
 * 2h driving
 * 15m break
 * 2h30 driving
 * 30m break
 * 2h driving
 *
 * 15 + 30 correctly resets the clock.
 * ----------------------------------------------------
 */
const validSplitBreak = createDay(
  "valid-split",
  "2026-09-03",
  [
    activity(
      "drive-1",
      "driving",
      "2026-09-03T06:00:00",
      "2026-09-03T08:00:00",
      120,
    ),

    activity(
      "break-1",
      "break",
      "2026-09-03T08:00:00",
      "2026-09-03T08:15:00",
      15,
    ),

    activity(
      "drive-2",
      "driving",
      "2026-09-03T08:15:00",
      "2026-09-03T10:45:00",
      150,
    ),

    activity(
      "break-2",
      "break",
      "2026-09-03T10:45:00",
      "2026-09-03T11:15:00",
      30,
    ),

    activity(
      "drive-3",
      "driving",
      "2026-09-03T11:15:00",
      "2026-09-03T13:15:00",
      120,
    ),
  ],

  390,
);

const validSplitResult = evaluateDailyDrivingRules(validSplitBreak);

/**
 * ----------------------------------------------------
 * SCENARIO 4
 *
 * 4h31 continuous driving.
 *
 * One minute over the limit.
 * ----------------------------------------------------
 */
const fourThirtyOne = createDay(
  "4h31",
  "2026-09-04",
  [
    activity(
      "drive",
      "driving",
      "2026-09-04T06:00:00",
      "2026-09-04T10:31:00",
      271,
    ),
  ],

  271,
);

const fourThirtyOneResult = evaluateDailyDrivingRules(fourThirtyOne);

/**
 * ----------------------------------------------------
 * SCENARIO 5
 *
 * Invalid split:
 *
 * 15m + 29m
 *
 * Second part is too short.
 * Driving continues beyond 4h30.
 * ----------------------------------------------------
 */
const invalidSplitTwentyNine = createDay(
  "invalid-15-29",
  "2026-09-05",
  [
    activity(
      "drive-1",
      "driving",
      "2026-09-05T06:00:00",
      "2026-09-05T08:00:00",
      120,
    ),

    activity(
      "break-1",
      "break",
      "2026-09-05T08:00:00",
      "2026-09-05T08:15:00",
      15,
    ),

    activity(
      "drive-2",
      "driving",
      "2026-09-05T08:15:00",
      "2026-09-05T10:45:00",
      150,
    ),

    activity(
      "break-2",
      "break",
      "2026-09-05T10:45:00",
      "2026-09-05T11:14:00",
      29,
    ),

    activity(
      "drive-3",
      "driving",
      "2026-09-05T11:14:00",
      "2026-09-05T11:44:00",
      30,
    ),
  ],

  300,
);

const invalidSplitTwentyNineResult = evaluateDailyDrivingRules(
  invalidSplitTwentyNine,
);

/**
 * ----------------------------------------------------
 * SCENARIO 6
 *
 * Reversed split:
 *
 * 30m + 15m
 *
 * This must NOT count as the standard
 * 15 + 30 split sequence.
 * ----------------------------------------------------
 */
const reversedSplit = createDay(
  "reversed-30-15",
  "2026-09-06",
  [
    activity(
      "drive-1",
      "driving",
      "2026-09-06T06:00:00",
      "2026-09-06T08:00:00",
      120,
    ),

    activity(
      "break-1",
      "break",
      "2026-09-06T08:00:00",
      "2026-09-06T08:30:00",
      30,
    ),

    activity(
      "drive-2",
      "driving",
      "2026-09-06T08:30:00",
      "2026-09-06T11:00:00",
      150,
    ),

    activity(
      "break-2",
      "break",
      "2026-09-06T11:00:00",
      "2026-09-06T11:15:00",
      15,
    ),

    activity(
      "drive-3",
      "driving",
      "2026-09-06T11:15:00",
      "2026-09-06T11:45:00",
      30,
    ),
  ],

  300,
);

const reversedSplitResult = evaluateDailyDrivingRules(reversedSplit);

/**
 * ----------------------------------------------------
 * SCENARIO 7
 *
 * Exactly 9h daily driving.
 *
 * Normal daily maximum.
 * ----------------------------------------------------
 */
const nineHourDay = makeSimpleDrivingDay("nine-hour-day", "2026-09-07", 540);

const nineHourResult = evaluateDailyDrivingRules(nineHourDay);

/**
 * We only want to test the DAILY LIMIT here.
 *
 * A single 9-hour activity would obviously also
 * violate continuous-driving rules, so below we
 * inspect the daily-driving issue specifically.
 */
const nineHourDailyLimitIssue = nineHourResult.issues.filter(
  (issue) => issue.rule === "daily-driving",
);

/**
 * ----------------------------------------------------
 * SCENARIO 8
 *
 * Exactly 10h daily driving.
 *
 * Legal extension, but TachoTrack marks the
 * extension as WARNING because one of the
 * permitted extended days has been consumed.
 * ----------------------------------------------------
 */
const tenHourDay = makeSimpleDrivingDay("ten-hour-day", "2026-09-08", 600);

const tenHourResult = evaluateDailyDrivingRules(tenHourDay);

const tenHourDailyIssues = tenHourResult.issues.filter(
  (issue) => issue.rule === "daily-driving",
);

/**
 * ----------------------------------------------------
 * SCENARIO 9
 *
 * More than 10h daily driving.
 * ----------------------------------------------------
 */
const overTenHourDay = makeSimpleDrivingDay("over-ten", "2026-09-09", 601);

const overTenResult = evaluateDailyDrivingRules(overTenHourDay);

/**
 * ----------------------------------------------------
 * SCENARIO 10
 *
 * Three extended driving days in one week.
 *
 * Maximum allowed by our current engine = 2.
 * ----------------------------------------------------
 */
const extendedWeek = [
  makeSimpleDrivingDay("ext-1", "2026-09-14", 570),

  makeSimpleDrivingDay("ext-2", "2026-09-15", 570),

  makeSimpleDrivingDay("ext-3", "2026-09-16", 570),

  makeSimpleDrivingDay("normal-1", "2026-09-17", 480),

  makeSimpleDrivingDay("normal-2", "2026-09-18", 480),
];

const extendedWeekResult = checkExtendedDrivingUsage(extendedWeek);

/**
 * ----------------------------------------------------
 * SCENARIO 11
 *
 * Exactly 56h weekly driving.
 *
 * This should NOT breach the weekly limit.
 * ----------------------------------------------------
 */
const exactly56HourWeek = [
  makeSimpleDrivingDay("56-1", "2026-09-21", 480),

  makeSimpleDrivingDay("56-2", "2026-09-22", 480),

  makeSimpleDrivingDay("56-3", "2026-09-23", 480),

  makeSimpleDrivingDay("56-4", "2026-09-24", 480),

  makeSimpleDrivingDay("56-5", "2026-09-25", 480),

  makeSimpleDrivingDay("56-6", "2026-09-26", 480),

  makeSimpleDrivingDay("56-7", "2026-09-27", 480),
];

const exactly56Result = checkWeeklyDrivingLimit(exactly56HourWeek);

/**
 * ----------------------------------------------------
 * SCENARIO 12
 *
 * 56h + 1 minute.
 * ----------------------------------------------------
 */
const over56HourWeek = [
  ...exactly56HourWeek.slice(0, 6),

  makeSimpleDrivingDay("56-over-final", "2026-09-27", 481),
];

const over56Result = checkWeeklyDrivingLimit(over56HourWeek);

/**
 * ----------------------------------------------------
 * SCENARIO 13
 *
 * Exactly 90h across two consecutive weeks.
 * ----------------------------------------------------
 */
const week45HoursA = [
  makeSimpleDrivingDay("90-a1", "2026-10-05", 540),

  makeSimpleDrivingDay("90-a2", "2026-10-06", 540),

  makeSimpleDrivingDay("90-a3", "2026-10-07", 540),

  makeSimpleDrivingDay("90-a4", "2026-10-08", 540),

  makeSimpleDrivingDay("90-a5", "2026-10-09", 540),
];

const week45HoursB = [
  makeSimpleDrivingDay("90-b1", "2026-10-12", 540),

  makeSimpleDrivingDay("90-b2", "2026-10-13", 540),

  makeSimpleDrivingDay("90-b3", "2026-10-14", 540),

  makeSimpleDrivingDay("90-b4", "2026-10-15", 540),

  makeSimpleDrivingDay("90-b5", "2026-10-16", 540),
];

const exactly90Result = checkFortnightlyDrivingLimit(
  week45HoursB,
  week45HoursA,
);

/**
 * ----------------------------------------------------
 * SCENARIO 14
 *
 * 90h + 1 minute across two consecutive weeks.
 * ----------------------------------------------------
 */
const weekOver45HoursB = [
  ...week45HoursB.slice(0, 4),

  makeSimpleDrivingDay("90-b5-over", "2026-10-16", 541),
];

const over90Result = checkFortnightlyDrivingLimit(
  weekOver45HoursB,
  week45HoursA,
);

/**
 * ----------------------------------------------------
 * FINAL SCENARIO REPORT
 * ----------------------------------------------------
 */

export const drivingScenarioResults: ScenarioResult[] = [
  result(
    "Exactly 4h30 continuous driving",
    "good",
    exactFourThirtyResult.level,
    exactFourThirtyResult.issues.length,
  ),

  result(
    "45-minute full qualifying break",
    "good",
    fullBreakResult.level,
    fullBreakResult.issues.length,
  ),

  result(
    "Valid 15 + 30 split break",
    "good",
    validSplitResult.level,
    validSplitResult.issues.length,
  ),

  result(
    "4h31 continuous driving",
    "breach",
    fourThirtyOneResult.level,
    fourThirtyOneResult.issues.length,
  ),

  result(
    "Invalid 15 + 29 split break",
    "breach",
    invalidSplitTwentyNineResult.level,
    invalidSplitTwentyNineResult.issues.length,
  ),

  result(
    "Invalid reversed 30 + 15 split",
    "breach",
    reversedSplitResult.level,
    reversedSplitResult.issues.length,
  ),

  result(
    "Exactly 9h daily driving",
    "good",
    nineHourDailyLimitIssue.length === 0 ? "good" : "breach",
    nineHourDailyLimitIssue.length,
    "Tests the daily-driving limit only.",
  ),

  result(
    "Exactly 10h extended daily driving",
    "warning",
    tenHourDailyIssues.some((issue) => issue.level === "warning")
      ? "warning"
      : "good",
    tenHourDailyIssues.length,
    "Legal extension, but TachoTrack warns that an extended-driving day has been used.",
  ),

  result(
    "More than 10h daily driving",
    "breach",
    overTenResult.issues.some(
      (issue) => issue.rule === "daily-driving" && issue.level === "breach",
    )
      ? "breach"
      : "good",
    overTenResult.issues.length,
  ),

  result(
    "Third extended-driving day in week",
    "breach",
    extendedWeekResult.level,
    extendedWeekResult.issues.length,
  ),

  result(
    "Exactly 56h weekly driving",
    "good",
    exactly56Result.level,
    exactly56Result.issues.length,
  ),

  result(
    "56h 01m weekly driving",
    "breach",
    over56Result.level,
    over56Result.issues.length,
  ),

  result(
    "Exactly 90h fortnightly driving",
    "good",
    exactly90Result.level,
    exactly90Result.issues.length,
  ),

  result(
    "90h 01m fortnightly driving",
    "breach",
    over90Result.level,
    over90Result.issues.length,
  ),
];

export const drivingScenarioSummary = {
  total: drivingScenarioResults.length,

  passed: drivingScenarioResults.filter((scenario) => scenario.passed).length,

  failed: drivingScenarioResults.filter((scenario) => !scenario.passed).length,

  allPassed: drivingScenarioResults.every((scenario) => scenario.passed),
};
