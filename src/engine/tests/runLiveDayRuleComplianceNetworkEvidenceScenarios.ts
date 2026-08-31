import type { ActivityHistoryEvent } from "../../data/activityHistory";

import { buildComplianceNetworkMap } from "../complianceNetworkMap";
import { calculateContinuousDrivingState } from "../continuousDrivingState";
import { calculateDailyDrivingState } from "../dailyDrivingState";
import { calculateLiveDailyRestState } from "../liveDailyRestState";
import { buildLiveDayRuleComplianceNetworkEvidence } from "../liveDayRuleComplianceNetworkEvidence";
import { evaluateLiveWtdState } from "../liveWtdState";
import type { ActivityPeriod, DriverDay } from "../types";

interface ScenarioResult {
  name: string;
  passed: boolean;
  details: string;
}

function result(
  name: string,
  passed: boolean,
  details: string,
): ScenarioResult {
  return {
    name,
    passed,
    details,
  };
}

function driverDay(
  id: string,
  activities: ActivityPeriod[],
  drivingMinutes: number,
  otherWorkMinutes: number,
): DriverDay {
  return {
    id,
    date: "2026-08-24",
    activities,
    drivingMinutes,
    otherWorkMinutes,
    breakMinutes: activities
      .filter((activity) => activity.type === "break")
      .reduce((total, activity) => total + activity.durationMinutes, 0),
    poaMinutes: activities
      .filter((activity) => activity.type === "poa")
      .reduce((total, activity) => total + activity.durationMinutes, 0),
    restMinutes: 0,
    dailyRestType: "unknown",
  };
}

const goodActivities: ActivityPeriod[] = [
  {
    id: "rule-other-work",
    type: "otherWork",
    start: "2026-08-24T06:00:00.000Z",
    end: "2026-08-24T07:00:00.000Z",
    durationMinutes: 60,
  },
  {
    id: "rule-driving",
    type: "driving",
    start: "2026-08-24T07:00:00.000Z",
    end: "2026-08-24T08:00:00.000Z",
    durationMinutes: 60,
  },
];

const activityHistory: ActivityHistoryEvent[] = [
  {
    id: "rule-history-other-work",
    activity: "other-work",
    startedAt: "2026-08-24T06:00:00.000Z",
    endedAt: "2026-08-24T07:00:00.000Z",
    durationMilliseconds: 60 * 60 * 1000,
    source: "manual",
  },
  {
    id: "rule-history-driving",
    activity: "driving",
    startedAt: "2026-08-24T07:00:00.000Z",
    endedAt: "2026-08-24T08:00:00.000Z",
    durationMilliseconds: 60 * 60 * 1000,
    source: "manual",
  },
];

const goodDay = driverDay("live-rule-good-day", goodActivities, 60, 60);
const occurredAt = "2026-08-24T08:00:00.000Z";
const nowMilliseconds = new Date(occurredAt).getTime();

const goodContinuous = calculateContinuousDrivingState(goodDay);
const goodDaily = calculateDailyDrivingState(goodDay);
const goodWtd = evaluateLiveWtdState(goodDay);
const goodDailyRest = calculateLiveDailyRestState(
  activityHistory,
  nowMilliseconds,
);

const goodEvidence = buildLiveDayRuleComplianceNetworkEvidence({
  occurredAt,
  sourceId: goodDay.id,
  continuousDriving: goodContinuous,
  dailyDriving: goodDaily,
  wtd: goodWtd,
  dailyRest: goodDailyRest,
});

const scenarios: ScenarioResult[] = [];

scenarios.push(
  result(
    "Live snapshot creates one event for each day-rule line",
    goodEvidence.length === 4,
    `Events: ${goodEvidence.length}`,
  ),
);

scenarios.push(
  result(
    "All live rule events share the snapshot timestamp",
    goodEvidence.every((event) => event.occurredAt === occurredAt),
    `Timestamps: ${[...new Set(goodEvidence.map((event) => event.occurredAt))].join(", ")}`,
  ),
);

scenarios.push(
  result(
    "Each rule event owns its correct network line",
    goodEvidence.map((event) => event.lineIds[0]).join(",") ===
      "continuous-driving,daily-driving,wtd,daily-rest" &&
      goodEvidence.every((event) => event.lineIds.length === 1),
    `Lines: ${goodEvidence.map((event) => event.lineIds[0]).join(" -> ")}`,
  ),
);

scenarios.push(
  result(
    "Every live rule event links to the driver-day source",
    goodEvidence.every(
      (event) =>
        event.sourceIds?.length === 1 && event.sourceIds[0] === goodDay.id,
    ),
    `Linked: ${goodEvidence.filter((event) => event.sourceIds?.[0] === goodDay.id).length}`,
  ),
);

const goodMap = buildComplianceNetworkMap({
  id: "live-rule-good-map",
  scale: "day",
  startAt: "2026-08-24T06:00:00.000Z",
  endAt: "2026-08-24T18:00:00.000Z",
  events: goodEvidence,
  now: occurredAt,
});

scenarios.push(
  result(
    "Four live states merge into one current interchange",
    goodMap.stations.length === 1 &&
      goodMap.stations[0]?.eventIds.length === 4 &&
      goodMap.stations[0]?.isInterchange === true,
    `Stations: ${goodMap.stations.length}, events: ${goodMap.stations[0]?.eventIds.length}`,
  ),
);

scenarios.push(
  result(
    "Fully compliant live states create a good station",
    goodMap.stations[0]?.severity === "good",
    `Severity: ${goodMap.stations[0]?.severity}`,
  ),
);

const continuousEvidence = goodEvidence.find(
  (event) => event.lineIds[0] === "continuous-driving",
);

scenarios.push(
  result(
    "Continuous-driving summary exposes used and remaining time",
    continuousEvidence?.summary.includes("1h 00m driven") === true &&
      continuousEvidence.summary.includes("3h 30m remains"),
    `Summary: ${continuousEvidence?.summary}`,
  ),
);

const dailyRestEvidence = goodEvidence.find(
  (event) => event.lineIds[0] === "daily-rest",
);

scenarios.push(
  result(
    "Daily-rest summary exposes the live deadline countdown",
    goodDailyRest.minutesUntilDeadline === 22 * 60 &&
      dailyRestEvidence?.summary.includes("22h 00m remains") === true,
    `Remaining: ${goodDailyRest.minutesUntilDeadline}, summary: ${dailyRestEvidence?.summary}`,
  ),
);

const continuousLimitActivities: ActivityPeriod[] = [
  {
    id: "continuous-limit-driving",
    type: "driving",
    start: "2026-08-24T06:00:00.000Z",
    end: "2026-08-24T10:30:00.000Z",
    durationMinutes: 4.5 * 60,
  },
];

const continuousLimitDay = driverDay(
  "continuous-limit-day",
  continuousLimitActivities,
  4.5 * 60,
  0,
);

const continuousLimitState =
  calculateContinuousDrivingState(continuousLimitDay);

const continuousLimitEvidence = buildLiveDayRuleComplianceNetworkEvidence({
  occurredAt: "2026-08-24T10:30:00.000Z",
  sourceId: continuousLimitDay.id,
  continuousDriving: continuousLimitState,
  dailyDriving: calculateDailyDrivingState(continuousLimitDay),
  wtd: evaluateLiveWtdState(continuousLimitDay),
  dailyRest: calculateLiveDailyRestState(
    activityHistory,
    new Date("2026-08-24T10:30:00.000Z").getTime(),
  ),
});

scenarios.push(
  result(
    "Exact continuous-driving limit maps to limit severity",
    continuousLimitState.status === "limit" &&
      continuousLimitEvidence.find(
        (event) => event.lineIds[0] === "continuous-driving",
      )?.severity === "limit",
    `Status: ${continuousLimitState.status}`,
  ),
);

const dailyLimitDay = driverDay("daily-limit-day", [], 9 * 60, 0);

const dailyLimitEvidence = buildLiveDayRuleComplianceNetworkEvidence({
  occurredAt: "2026-08-24T15:00:00.000Z",
  sourceId: dailyLimitDay.id,
  continuousDriving: goodContinuous,
  dailyDriving: calculateDailyDrivingState(dailyLimitDay),
  wtd: goodWtd,
  dailyRest: goodDailyRest,
});

const dailyLimitEvent = dailyLimitEvidence.find(
  (event) => event.lineIds[0] === "daily-driving",
);

scenarios.push(
  result(
    "Exact 9-hour daily limit maps to limit severity",
    dailyLimitEvent?.severity === "limit",
    `Severity: ${dailyLimitEvent?.severity}`,
  ),
);

const sixHourWorkDay = driverDay(
  "six-hour-work-day",
  [
    {
      id: "six-hour-work",
      type: "otherWork",
      start: "2026-08-24T06:00:00.000Z",
      end: "2026-08-24T12:00:00.000Z",
      durationMinutes: 6 * 60,
    },
  ],
  0,
  6 * 60,
);

const actionWtd = evaluateLiveWtdState(sixHourWorkDay);

const actionEvidence = buildLiveDayRuleComplianceNetworkEvidence({
  occurredAt: "2026-08-24T12:00:00.000Z",
  sourceId: sixHourWorkDay.id,
  continuousDriving: calculateContinuousDrivingState(sixHourWorkDay),
  dailyDriving: calculateDailyDrivingState(sixHourWorkDay),
  wtd: actionWtd,
  dailyRest: goodDailyRest,
});

const actionWtdEvent = actionEvidence.find(
  (event) => event.lineIds[0] === "wtd",
);

scenarios.push(
  result(
    "Exact six-hour WTD action point maps to limit severity",
    actionWtd.level === "action" && actionWtdEvent?.severity === "limit",
    `Level: ${actionWtd.level}, severity: ${actionWtdEvent?.severity}`,
  ),
);

const warningDailyRest = calculateLiveDailyRestState(
  activityHistory,
  new Date("2026-08-25T05:00:00.000Z").getTime(),
);

const warningRestEvidence = buildLiveDayRuleComplianceNetworkEvidence({
  occurredAt: "2026-08-25T05:00:00.000Z",
  sourceId: goodDay.id,
  continuousDriving: goodContinuous,
  dailyDriving: goodDaily,
  wtd: goodWtd,
  dailyRest: warningDailyRest,
});

const warningRestEvent = warningRestEvidence.find(
  (event) => event.lineIds[0] === "daily-rest",
);

scenarios.push(
  result(
    "Daily-rest warning reaches the network without reinterpretation",
    warningDailyRest.level === "warning" &&
      warningRestEvent?.severity === "warning",
    `Level: ${warningDailyRest.level}, severity: ${warningRestEvent?.severity}`,
  ),
);

let invalidSourceRejected = false;

try {
  buildLiveDayRuleComplianceNetworkEvidence({
    occurredAt,
    sourceId: "",
    continuousDriving: goodContinuous,
    dailyDriving: goodDaily,
    wtd: goodWtd,
    dailyRest: goodDailyRest,
  });
} catch {
  invalidSourceRejected = true;
}

scenarios.push(
  result(
    "Empty live source identifiers are rejected",
    invalidSourceRejected,
    `Rejected: ${String(invalidSourceRejected)}`,
  ),
);

let invalidTimestampRejected = false;

try {
  buildLiveDayRuleComplianceNetworkEvidence({
    occurredAt: "invalid-date",
    sourceId: goodDay.id,
    continuousDriving: goodContinuous,
    dailyDriving: goodDaily,
    wtd: goodWtd,
    dailyRest: goodDailyRest,
  });
} catch {
  invalidTimestampRejected = true;
}

scenarios.push(
  result(
    "Invalid live timestamps are rejected",
    invalidTimestampRejected,
    `Rejected: ${String(invalidTimestampRejected)}`,
  ),
);

const passed = scenarios.filter((scenario) => scenario.passed).length;
const failed = scenarios.length - passed;

console.log("============================================================");
console.log("TACHOTRACK LIVE DAY-RULE NETWORK EVIDENCE TESTS");
console.log("============================================================");

for (const scenario of scenarios) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);
  console.log(`   ${scenario.details}`);
  console.log("----------------------------------------");
}

console.log(
  `LIVE DAY-RULE NETWORK EVIDENCE RESULT: ${passed}/${scenarios.length} passed`,
);

if (failed > 0) {
  console.log("❌ SOME LIVE DAY-RULE NETWORK EVIDENCE SCENARIOS FAILED");

  throw new Error(`${failed} live day-rule network scenarios failed.`);
}

console.log("✅ ALL LIVE DAY-RULE NETWORK EVIDENCE SCENARIOS PASSED");
console.log("============================================================");
