import type { RestSession } from "../../data/restSession";

import { calculateContinuousDrivingState } from "../continuousDrivingState";
import { calculateDailyDrivingState } from "../dailyDrivingState";
import { calculateExtendedDrivingAllowanceState } from "../extendedDrivingAllowanceState";
import { calculateFortnightlyDrivingState } from "../fortnightlyDrivingState";
import { evaluateLiveWtdState } from "../liveWtdState";
import { calculateReducedDailyRestAllowance } from "../reducedDailyRestAllowance";
import type { ActivityPeriod, DriverDay } from "../types";
import { calculateWeeklyDrivingState } from "../weeklyDrivingState";

interface BoundaryScenarioResult {
  name: string;
  passed: boolean;
  details: string;
}

function result(
  name: string,
  passed: boolean,
  details: string,
): BoundaryScenarioResult {
  return {
    name,
    passed,
    details,
  };
}

function driverDay(
  id: string,
  date: string,
  drivingMinutes: number,
  activities: ActivityPeriod[] = [],
): DriverDay {
  return {
    id,
    date,
    activities,
    drivingMinutes,
    otherWorkMinutes: 0,
    breakMinutes: activities
      .filter((activity) => activity.type === "break")
      .reduce((total, activity) => total + activity.durationMinutes, 0),
    poaMinutes: 0,
    restMinutes: 11 * 60,
    dailyRestType: "regular",
  };
}

function completedRest(
  id: string,
  type: RestSession["type"],
  startedAt: string,
  endedAt: string,
): RestSession {
  const startMilliseconds = new Date(startedAt).getTime();
  const endMilliseconds = new Date(endedAt).getTime();

  return {
    id,
    type,
    startedAt,
    endedAt,
    durationMilliseconds: endMilliseconds - startMilliseconds,
    status: "completed",
  };
}

const scenarios: BoundaryScenarioResult[] = [];

/**
 * --------------------------------------------------
 * DAY 1: SPLIT 15 + 30 BREAK
 * --------------------------------------------------
 *
 * 2h driving
 * 15m break
 * 2h30 driving
 * 30m break
 * 4h30 driving
 *
 * Total driving: 9h
 */
const splitBreakActivities: ActivityPeriod[] = [
  {
    id: "boundary-driving-one",
    type: "driving",
    start: "2026-08-24T06:00:00.000Z",
    end: "2026-08-24T08:00:00.000Z",
    durationMinutes: 2 * 60,
  },
  {
    id: "boundary-break-fifteen",
    type: "break",
    start: "2026-08-24T08:00:00.000Z",
    end: "2026-08-24T08:15:00.000Z",
    durationMinutes: 15,
  },
  {
    id: "boundary-driving-two",
    type: "driving",
    start: "2026-08-24T08:15:00.000Z",
    end: "2026-08-24T10:45:00.000Z",
    durationMinutes: 2.5 * 60,
  },
  {
    id: "boundary-break-thirty",
    type: "break",
    start: "2026-08-24T10:45:00.000Z",
    end: "2026-08-24T11:15:00.000Z",
    durationMinutes: 30,
  },
  {
    id: "boundary-driving-three",
    type: "driving",
    start: "2026-08-24T11:15:00.000Z",
    end: "2026-08-24T15:45:00.000Z",
    durationMinutes: 4.5 * 60,
  },
];

const monday = driverDay(
  "boundary-monday",
  "2026-08-24",
  9 * 60,
  splitBreakActivities,
);

const continuousState = calculateContinuousDrivingState(monday);

scenarios.push(
  result(
    "Split 15 + 30 break resets continuous driving",
    continuousState.drivingMinutesUsed === 4.5 * 60 &&
      continuousState.remainingMinutes === 0 &&
      continuousState.status === "limit",
    `Used since reset: ${continuousState.drivingMinutesUsed}, status: ${continuousState.status}`,
  ),
);

const wtdState = evaluateLiveWtdState(monday);

scenarios.push(
  result(
    "Forty-five break minutes satisfy the 9-hour WTD requirement",
    wtdState.workingMinutes === 9 * 60 &&
      wtdState.qualifyingBreakMinutes === 45 &&
      wtdState.requiredBreakMinutes === 30 &&
      wtdState.breakShortfallMinutes === 0,
    `Working: ${wtdState.workingMinutes}, break: ${wtdState.qualifyingBreakMinutes}, shortfall: ${wtdState.breakShortfallMinutes}`,
  ),
);

const mondayDailyState = calculateDailyDrivingState(monday);

scenarios.push(
  result(
    "Exactly 9 hours reaches the standard daily limit",
    mondayDailyState.drivingMinutesUsed === 9 * 60 &&
      mondayDailyState.extensionUsedMinutes === 0 &&
      mondayDailyState.status === "standard-limit",
    `Used: ${mondayDailyState.drivingMinutesUsed}, status: ${mondayDailyState.status}`,
  ),
);

/**
 * --------------------------------------------------
 * LEGAL CURRENT WEEK
 * --------------------------------------------------
 *
 * 9h + 10h + 10h + 9h + 9h + 9h = 56h
 */
const legalCurrentWeek = [
  monday,
  driverDay("boundary-tuesday", "2026-08-25", 10 * 60),
  driverDay("boundary-wednesday", "2026-08-26", 10 * 60),
  driverDay("boundary-thursday", "2026-08-27", 9 * 60),
  driverDay("boundary-friday", "2026-08-28", 9 * 60),
  driverDay("boundary-saturday", "2026-08-29", 9 * 60),
];

const legalWeeklyState = calculateWeeklyDrivingState(legalCurrentWeek);

scenarios.push(
  result(
    "Six-day journey reaches exactly the 56-hour weekly limit",
    legalWeeklyState.drivingMinutesUsed === 56 * 60 &&
      legalWeeklyState.remainingMinutes === 0 &&
      legalWeeklyState.status === "limit",
    `Used: ${legalWeeklyState.drivingMinutesUsed}, status: ${legalWeeklyState.status}`,
  ),
);

const legalExtensionState =
  calculateExtendedDrivingAllowanceState(legalCurrentWeek);

scenarios.push(
  result(
    "Exactly two 10-hour days exhaust the extension allowance",
    legalExtensionState.extensionsUsed === 2 &&
      legalExtensionState.extensionsRemaining === 0 &&
      legalExtensionState.allowanceExhausted === true &&
      legalExtensionState.status === "exhausted",
    `Used: ${legalExtensionState.extensionsUsed}, remaining: ${legalExtensionState.extensionsRemaining}`,
  ),
);

const previousWeek = [
  driverDay("previous-monday", "2026-08-17", 7 * 60),
  driverDay("previous-tuesday", "2026-08-18", 7 * 60),
  driverDay("previous-wednesday", "2026-08-19", 7 * 60),
  driverDay("previous-thursday", "2026-08-20", 7 * 60),
  driverDay("previous-friday", "2026-08-21", 6 * 60),
];

const legalFortnightState = calculateFortnightlyDrivingState(
  previousWeek,
  legalCurrentWeek,
);

scenarios.push(
  result(
    "The two-week journey reaches exactly the 90-hour limit",
    legalFortnightState.drivingMinutesUsed === 90 * 60 &&
      legalFortnightState.remainingMinutes === 0 &&
      legalFortnightState.status === "limit",
    `Used: ${legalFortnightState.drivingMinutesUsed}, status: ${legalFortnightState.status}`,
  ),
);

/**
 * --------------------------------------------------
 * ONE-MINUTE BREACH CASCADE
 * --------------------------------------------------
 */
const breachSaturday = driverDay(
  "boundary-saturday-plus-one",
  "2026-08-29",
  9 * 60 + 1,
);

const breachCurrentWeek = [...legalCurrentWeek.slice(0, -1), breachSaturday];

const breachDailyState = calculateDailyDrivingState(breachSaturday);

scenarios.push(
  result(
    "The extra minute begins a third daily extension",
    breachDailyState.extensionUsedMinutes === 1 &&
      breachDailyState.status === "extended-warning",
    `Extension: ${breachDailyState.extensionUsedMinutes}, status: ${breachDailyState.status}`,
  ),
);

const breachWeeklyState = calculateWeeklyDrivingState(breachCurrentWeek);

scenarios.push(
  result(
    "One extra minute breaches the weekly driving limit",
    breachWeeklyState.drivingMinutesUsed === 56 * 60 + 1 &&
      breachWeeklyState.status === "breach",
    `Used: ${breachWeeklyState.drivingMinutesUsed}, status: ${breachWeeklyState.status}`,
  ),
);

const breachExtensionState =
  calculateExtendedDrivingAllowanceState(breachCurrentWeek);

scenarios.push(
  result(
    "The same minute creates a third-extension breach",
    breachExtensionState.extensionsUsed === 3 &&
      breachExtensionState.excessExtensionDays === 1 &&
      breachExtensionState.status === "breach",
    `Used: ${breachExtensionState.extensionsUsed}, excess days: ${breachExtensionState.excessExtensionDays}`,
  ),
);

const breachFortnightState = calculateFortnightlyDrivingState(
  previousWeek,
  breachCurrentWeek,
);

scenarios.push(
  result(
    "The same minute breaches the fortnightly driving limit",
    breachFortnightState.drivingMinutesUsed === 90 * 60 + 1 &&
      breachFortnightState.remainingMinutes === 0 &&
      breachFortnightState.status === "breach",
    `Used: ${breachFortnightState.drivingMinutesUsed}, status: ${breachFortnightState.status}`,
  ),
);

/**
 * --------------------------------------------------
 * REDUCED DAILY-REST BOUNDARY
 * --------------------------------------------------
 */
const weeklyBaseline = completedRest(
  "boundary-weekly-baseline",
  "weekly",
  "2026-08-16T00:00:00.000Z",
  "2026-08-17T21:00:00.000Z",
);

const reducedOne = completedRest(
  "boundary-reduced-one",
  "daily",
  "2026-08-18T21:00:00.000Z",
  "2026-08-19T06:00:00.000Z",
);

const reducedTwo = completedRest(
  "boundary-reduced-two",
  "daily",
  "2026-08-19T21:00:00.000Z",
  "2026-08-20T06:00:00.000Z",
);

const reducedThree = completedRest(
  "boundary-reduced-three",
  "daily",
  "2026-08-20T21:00:00.000Z",
  "2026-08-21T06:00:00.000Z",
);

const reducedFour = completedRest(
  "boundary-reduced-four",
  "daily",
  "2026-08-21T21:00:00.000Z",
  "2026-08-22T06:00:00.000Z",
);

const threeReducedState = calculateReducedDailyRestAllowance([
  weeklyBaseline,
  reducedOne,
  reducedTwo,
  reducedThree,
]);

scenarios.push(
  result(
    "Three reduced daily rests reach the verified allowance",
    threeReducedState.status === "verified" &&
      threeReducedState.reducedRestsUsed === 3 &&
      threeReducedState.reducedRestsRemaining === 0 &&
      threeReducedState.level === "warning" &&
      !threeReducedState.canTakeAnotherReducedRest,
    `Used: ${threeReducedState.reducedRestsUsed}, level: ${threeReducedState.level}`,
  ),
);

const fourReducedState = calculateReducedDailyRestAllowance([
  weeklyBaseline,
  reducedOne,
  reducedTwo,
  reducedThree,
  reducedFour,
]);

scenarios.push(
  result(
    "A fourth reduced daily rest creates a verified breach",
    fourReducedState.status === "verified" &&
      fourReducedState.reducedRestsUsed === 4 &&
      fourReducedState.level === "breach" &&
      fourReducedState.acceptedReducedRestSessionIds.length === 3 &&
      fourReducedState.rejectedReducedRestSessionIds.includes(reducedFour.id),
    `Used: ${fourReducedState.reducedRestsUsed}, level: ${fourReducedState.level}`,
  ),
);

const secondWeeklyRest = completedRest(
  "boundary-second-weekly-rest",
  "weekly",
  "2026-08-22T04:00:00.000Z",
  "2026-08-24T01:00:00.000Z",
);

const reducedAfterReset = completedRest(
  "boundary-reduced-after-reset",
  "daily",
  "2026-08-24T14:00:00.000Z",
  "2026-08-24T23:00:00.000Z",
);

const resetReducedState = calculateReducedDailyRestAllowance([
  weeklyBaseline,
  reducedOne,
  reducedTwo,
  reducedThree,
  secondWeeklyRest,
  reducedAfterReset,
]);

scenarios.push(
  result(
    "A later regular weekly rest resets the reduced-rest allowance",
    resetReducedState.status === "verified" &&
      resetReducedState.referenceWeeklyRestSessionId === secondWeeklyRest.id &&
      resetReducedState.reducedRestsUsed === 1 &&
      resetReducedState.reducedRestsRemaining === 2 &&
      resetReducedState.canTakeAnotherReducedRest,
    `Reference: ${resetReducedState.referenceWeeklyRestSessionId}, used: ${resetReducedState.reducedRestsUsed}`,
  ),
);

const passed = scenarios.filter((scenario) => scenario.passed).length;
const failed = scenarios.length - passed;

console.log("============================================================");
console.log("TACHOTRACK WHOLE-SYSTEM BOUNDARY JOURNEY TESTS");
console.log("============================================================");

for (const scenario of scenarios) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);
  console.log(`   ${scenario.details}`);
  console.log("----------------------------------------");
}

console.log(
  `WHOLE-SYSTEM BOUNDARY JOURNEY RESULT: ${passed}/${scenarios.length} passed`,
);

if (failed > 0) {
  console.log("❌ SOME WHOLE-SYSTEM BOUNDARY JOURNEY SCENARIOS FAILED");

  throw new Error(`${failed} whole-system boundary journey scenarios failed.`);
}

console.log("✅ ALL WHOLE-SYSTEM BOUNDARY JOURNEY SCENARIOS PASSED");
console.log("============================================================");
