import type { ActivityHistoryEvent } from "../../data/activityHistory";
import type { RestSession } from "../../data/restSession";

import { buildLiveDayComplianceNetworkMap } from "../liveDayComplianceNetworkMap";
import type { ActivityPeriod, ActivityType, DriverDay } from "../types";

interface ScenarioResult {
  name: string;
  passed: boolean;
  details: string;
}

interface ActivityFixture {
  id: string;
  historyType: ActivityHistoryEvent["activity"];
  dayType: ActivityType;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
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

const now = "2026-08-24T22:15:00.000Z";
const nowMilliseconds = new Date(now).getTime();

const fixtures: ActivityFixture[] = [
  {
    id: "full-day-other-work-one",
    historyType: "other-work",
    dayType: "otherWork",
    startedAt: "2026-08-24T05:45:00.000Z",
    endedAt: "2026-08-24T06:00:00.000Z",
    durationMinutes: 15,
  },
  {
    id: "full-day-driving-one",
    historyType: "driving",
    dayType: "driving",
    startedAt: "2026-08-24T06:00:00.000Z",
    endedAt: "2026-08-24T08:00:00.000Z",
    durationMinutes: 120,
  },
  {
    id: "full-day-break-fifteen",
    historyType: "break",
    dayType: "break",
    startedAt: "2026-08-24T08:00:00.000Z",
    endedAt: "2026-08-24T08:15:00.000Z",
    durationMinutes: 15,
  },
  {
    id: "full-day-driving-two",
    historyType: "driving",
    dayType: "driving",
    startedAt: "2026-08-24T08:15:00.000Z",
    endedAt: "2026-08-24T10:45:00.000Z",
    durationMinutes: 150,
  },
  {
    id: "full-day-break-thirty",
    historyType: "break",
    dayType: "break",
    startedAt: "2026-08-24T10:45:00.000Z",
    endedAt: "2026-08-24T11:15:00.000Z",
    durationMinutes: 30,
  },
  {
    id: "full-day-other-work-two",
    historyType: "other-work",
    dayType: "otherWork",
    startedAt: "2026-08-24T11:15:00.000Z",
    endedAt: "2026-08-24T12:00:00.000Z",
    durationMinutes: 45,
  },
  {
    id: "full-day-driving-three",
    historyType: "driving",
    dayType: "driving",
    startedAt: "2026-08-24T12:00:00.000Z",
    endedAt: "2026-08-24T14:00:00.000Z",
    durationMinutes: 120,
  },
  {
    id: "full-day-poa",
    historyType: "poa",
    dayType: "poa",
    startedAt: "2026-08-24T14:00:00.000Z",
    endedAt: "2026-08-24T14:30:00.000Z",
    durationMinutes: 30,
  },
  {
    id: "full-day-driving-four",
    historyType: "driving",
    dayType: "driving",
    startedAt: "2026-08-24T14:30:00.000Z",
    endedAt: "2026-08-24T17:00:00.000Z",
    durationMinutes: 150,
  },
  {
    id: "full-day-other-work-three",
    historyType: "other-work",
    dayType: "otherWork",
    startedAt: "2026-08-24T17:00:00.000Z",
    endedAt: "2026-08-24T17:15:00.000Z",
    durationMinutes: 15,
  },
  {
    id: "full-day-overnight-break",
    historyType: "break",
    dayType: "break",
    startedAt: "2026-08-24T17:15:00.000Z",
    endedAt: null,
    durationMinutes: 5 * 60,
  },
];

const activityHistory: ActivityHistoryEvent[] = fixtures.map((fixture) => ({
  id: fixture.id,
  activity: fixture.historyType,
  startedAt: fixture.startedAt,
  endedAt: fixture.endedAt,
  durationMilliseconds:
    fixture.endedAt === null ? null : fixture.durationMinutes * 60 * 1000,
  source: "manual",
}));

const dayActivities: ActivityPeriod[] = fixtures.map((fixture) => ({
  id: fixture.id,
  type: fixture.dayType,
  start: fixture.startedAt,
  end: fixture.endedAt ?? now,
  durationMinutes: fixture.durationMinutes,
}));

const day: DriverDay = {
  id: "fully-populated-driver-day",
  date: "2026-08-24",
  activities: dayActivities,
  drivingMinutes: 9 * 60,
  otherWorkMinutes: 75,
  breakMinutes: 15 + 30 + 5 * 60,
  poaMinutes: 30,
  restMinutes: 0,
  dailyRestType: "unknown",
};

const overnightRest: RestSession = {
  id: "full-day-overnight-rest",
  type: "daily",
  startedAt: "2026-08-24T17:15:00.000Z",
  endedAt: null,
  durationMilliseconds: null,
  status: "active",
};

const built = buildLiveDayComplianceNetworkMap({
  id: "complete-day-network-map",
  startAt: "2026-08-24T05:45:00.000Z",
  endAt: "2026-08-25T04:20:00.000Z",
  now,
  day,
  activityHistory,
  restSessions: [overnightRest],
  restRequirements: [
    {
      session: overnightRest,
      baseRestMinutes: 11 * 60,
    },
  ],
});

const scenarios: ScenarioResult[] = [];

scenarios.push(
  result(
    "Coordinator produces the requested live day map",
    built.map.id === "complete-day-network-map" && built.map.scale === "day",
    `Id: ${built.map.id}, scale: ${built.map.scale}`,
  ),
);

scenarios.push(
  result(
    "Complete day combines activity, rule and rest evidence",
    built.evidence.length === fixtures.length * 2 + 4 + 1,
    `Activity: ${fixtures.length * 2}, rule: 4, rest: 1, total: ${built.evidence.length}`,
  ),
);

scenarios.push(
  result(
    "Activity transitions collapse into chronological stations",
    built.map.stations.length === 12 &&
      built.map.stations[0]?.occurredAt === "2026-08-24T05:45:00.000Z" &&
      built.map.stations.at(-1)?.occurredAt === now,
    `Stations: ${built.map.stations.length}, first: ${built.map.stations[0]?.occurredAt}, last: ${built.map.stations.at(-1)?.occurredAt}`,
  ),
);

scenarios.push(
  result(
    "Complete day activates all relevant day-map lines",
    built.map.lines.map((line) => line.id).join(",") ===
      "activity,continuous-driving,daily-driving,wtd,daily-rest,weekly-driving,fortnightly-driving",
    `Lines: ${built.map.lines.map((line) => line.id).join(" -> ")}`,
  ),
);

scenarios.push(
  result(
    "Five-hour overnight break resets continuous driving",
    built.states.continuousDriving.drivingMinutesUsed === 0 &&
      built.states.continuousDriving.remainingMinutes === 4.5 * 60 &&
      built.states.continuousDriving.status === "good",
    `Used: ${built.states.continuousDriving.drivingMinutesUsed}, remaining: ${built.states.continuousDriving.remainingMinutes}`,
  ),
);

scenarios.push(
  result(
    "Complete day reaches exactly the standard daily driving limit",
    built.states.dailyDriving.drivingMinutesUsed === 9 * 60 &&
      built.states.dailyDriving.status === "standard-limit",
    `Used: ${built.states.dailyDriving.drivingMinutesUsed}, status: ${built.states.dailyDriving.status}`,
  ),
);

scenarios.push(
  result(
    "Working-time state includes driving and Other Work only",
    built.states.wtd.workingMinutes === 10 * 60 + 15 &&
      built.states.wtd.breakShortfallMinutes === 0 &&
      built.states.wtd.level === "good",
    `Working: ${built.states.wtd.workingMinutes}, shortfall: ${built.states.wtd.breakShortfallMinutes}, level: ${built.states.wtd.level}`,
  ),
);

scenarios.push(
  result(
    "Daily-rest deadline remains tied to the first work event",
    built.states.dailyRest.referenceStart === "2026-08-24T05:45:00.000Z" &&
      built.states.dailyRest.dailyRestDeadline === "2026-08-25T05:45:00.000Z" &&
      built.states.dailyRest.minutesUntilDeadline === 7 * 60 + 30,
    `Reference: ${built.states.dailyRest.referenceStart}, deadline: ${built.states.dailyRest.dailyRestDeadline}, remaining: ${built.states.dailyRest.minutesUntilDeadline}`,
  ),
);

const restStartStation = built.map.stations.find(
  (station) => station.occurredAt === "2026-08-24T17:15:00.000Z",
);

scenarios.push(
  result(
    "Overnight rest opens at the activity-to-rest interchange",
    restStartStation?.isInterchange === true &&
      restStartStation.lineIds.includes("daily-rest") &&
      restStartStation.eventIds.includes(
        "rest-network-full-day-overnight-rest",
      ),
    `Lines: ${restStartStation?.lineIds.join(", ")}, events: ${restStartStation?.eventIds.length}`,
  ),
);

const restTimer = restStartStation?.timers[0];

scenarios.push(
  result(
    "Overnight station carries the live 11-hour timer",
    restTimer?.state === "protected" &&
      restTimer.elapsedMinutes === 5 * 60 &&
      restTimer.remainingToLegalMinutes === 6 * 60 &&
      restTimer.remainingToRecommendedMinutes === 6 * 60 + 5,
    `State: ${restTimer?.state}, elapsed: ${restTimer?.elapsedMinutes}, legal remaining: ${restTimer?.remainingToLegalMinutes}`,
  ),
);

const liveStation = built.map.stations.find(
  (station) => station.occurredAt === now,
);

scenarios.push(
  result(
    "Current station merges live activity with all four rule states",
    liveStation?.eventIds.length === 5 &&
      liveStation.eventIds.includes(
        "activity-network-full-day-overnight-break-live",
      ) &&
      liveStation.eventIds.filter((id) => id.startsWith("live-rule-"))
        .length === 4,
    `Events: ${liveStation?.eventIds.join(", ")}`,
  ),
);

scenarios.push(
  result(
    "Daily driving limit controls current interchange severity",
    liveStation?.severity === "limit",
    `Severity: ${liveStation?.severity}`,
  ),
);

scenarios.push(
  result(
    "Map live position uses the coordinator snapshot time",
    built.map.livePosition?.occurredAt === now &&
      built.map.livePosition.position > 0.73 &&
      built.map.livePosition.position < 0.731,
    `Position: ${built.map.livePosition?.position}`,
  ),
);

scenarios.push(
  result(
    "Coordinator never closes the source active break",
    activityHistory.at(-1)?.endedAt === null &&
      activityHistory.at(-1)?.durationMilliseconds === null,
    `Ended at: ${activityHistory.at(-1)?.endedAt}, duration: ${activityHistory.at(-1)?.durationMilliseconds}`,
  ),
);

let invalidIdRejected = false;

try {
  buildLiveDayComplianceNetworkMap({
    id: "",
    startAt: "2026-08-24T05:45:00.000Z",
    endAt: "2026-08-25T04:20:00.000Z",
    now: nowMilliseconds,
    day,
    activityHistory,
  });
} catch {
  invalidIdRejected = true;
}

scenarios.push(
  result(
    "Empty complete-day map identifiers are rejected",
    invalidIdRejected,
    `Rejected: ${String(invalidIdRejected)}`,
  ),
);

const passed = scenarios.filter((scenario) => scenario.passed).length;
const failed = scenarios.length - passed;

console.log("============================================================");
console.log("TACHOTRACK LIVE DAY COMPLIANCE NETWORK MAP TESTS");
console.log("============================================================");

for (const scenario of scenarios) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);
  console.log(`   ${scenario.details}`);
  console.log("----------------------------------------");
}

console.log(
  `LIVE DAY COMPLIANCE NETWORK MAP RESULT: ${passed}/${scenarios.length} passed`,
);

if (failed > 0) {
  console.log("❌ SOME LIVE DAY COMPLIANCE NETWORK MAP SCENARIOS FAILED");

  throw new Error(`${failed} live day compliance-network scenarios failed.`);
}

console.log("✅ ALL LIVE DAY COMPLIANCE NETWORK MAP SCENARIOS PASSED");
console.log("============================================================");
