import type { ActivityHistoryEvent } from "../../data/activityHistory";

import { buildActivityComplianceNetworkEvidence } from "../activityComplianceNetworkEvidence";
import { buildComplianceNetworkMap } from "../complianceNetworkMap";

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

function activity(
  overrides: Partial<ActivityHistoryEvent> &
    Pick<ActivityHistoryEvent, "id" | "activity" | "startedAt" | "endedAt">,
): ActivityHistoryEvent {
  const startMilliseconds = new Date(overrides.startedAt).getTime();
  const endMilliseconds =
    overrides.endedAt === null ? null : new Date(overrides.endedAt).getTime();

  return {
    durationMilliseconds:
      endMilliseconds === null ? null : endMilliseconds - startMilliseconds,
    source: "manual",
    ...overrides,
  };
}

const now = "2026-08-24T11:00:00.000Z";

const events: ActivityHistoryEvent[] = [
  activity({
    id: "active-driving",
    activity: "driving",
    startedAt: "2026-08-24T10:00:00.000Z",
    endedAt: null,
  }),
  activity({
    id: "break-one",
    activity: "break",
    startedAt: "2026-08-24T09:00:00.000Z",
    endedAt: "2026-08-24T09:30:00.000Z",
  }),
  activity({
    id: "other-work-one",
    activity: "other-work",
    startedAt: "2026-08-24T08:00:00.000Z",
    endedAt: "2026-08-24T08:15:00.000Z",
  }),
  activity({
    id: "poa-one",
    activity: "poa",
    startedAt: "2026-08-24T09:30:00.000Z",
    endedAt: "2026-08-24T10:00:00.000Z",
  }),
  activity({
    id: "driving-one",
    activity: "driving",
    startedAt: "2026-08-24T08:15:00.000Z",
    endedAt: "2026-08-24T09:00:00.000Z",
  }),
];

const evidence = buildActivityComplianceNetworkEvidence({
  events,
  now,
});

const scenarios: ScenarioResult[] = [];

scenarios.push(
  result(
    "Every activity creates start and end evidence",
    evidence.length === events.length * 2,
    `Activities: ${events.length}, evidence: ${evidence.length}`,
  ),
);

scenarios.push(
  result(
    "Evidence is returned chronologically",
    evidence[0]?.occurredAt === "2026-08-24T08:00:00.000Z" &&
      evidence.at(-1)?.occurredAt === now,
    `First: ${evidence[0]?.occurredAt}, last: ${evidence.at(-1)?.occurredAt}`,
  ),
);

const activeEvidence = evidence.find(
  (item) => item.id === "activity-network-active-driving-live",
);

scenarios.push(
  result(
    "Active driving is snapshotted at the supplied time",
    activeEvidence?.occurredAt === now &&
      activeEvidence.title === "Driving active",
    `Time: ${activeEvidence?.occurredAt}, title: ${activeEvidence?.title}`,
  ),
);

scenarios.push(
  result(
    "Active activity duration is represented in its summary",
    activeEvidence?.summary.includes("1h 00m elapsed") === true,
    `Summary: ${activeEvidence?.summary}`,
  ),
);

scenarios.push(
  result(
    "Building map evidence does not mutate live activity history",
    events[0]?.id === "active-driving" &&
      events[0].endedAt === null &&
      events[0].durationMilliseconds === null,
    `Ended at: ${events[0]?.endedAt}, duration: ${events[0]?.durationMilliseconds}`,
  ),
);

const drivingStart = evidence.find(
  (item) => item.id === "activity-network-driving-one-start",
);

scenarios.push(
  result(
    "Driving joins all driving-limit lines",
    drivingStart?.lineIds.length === 5 &&
      drivingStart.lineIds.includes("continuous-driving") &&
      drivingStart.lineIds.includes("daily-driving") &&
      drivingStart.lineIds.includes("weekly-driving") &&
      drivingStart.lineIds.includes("fortnightly-driving"),
    `Lines: ${drivingStart?.lineIds.join(", ")}`,
  ),
);

const breakStart = evidence.find(
  (item) => item.id === "activity-network-break-one-start",
);

scenarios.push(
  result(
    "Break evidence reaches continuous-driving and WTD lines",
    breakStart?.lineIds.includes("continuous-driving") === true &&
      breakStart.lineIds.includes("wtd"),
    `Lines: ${breakStart?.lineIds.join(", ")}`,
  ),
);

const poaStart = evidence.find(
  (item) => item.id === "activity-network-poa-one-start",
);

scenarios.push(
  result(
    "POA remains visible to relevant rule lines",
    poaStart?.lineIds.includes("activity") === true &&
      poaStart.lineIds.includes("continuous-driving") &&
      poaStart.lineIds.includes("wtd"),
    `Lines: ${poaStart?.lineIds.join(", ")}`,
  ),
);

scenarios.push(
  result(
    "Every evidence event links to its source activity",
    evidence.every(
      (item) =>
        item.sourceIds?.length === 1 &&
        events.some((event) => event.id === item.sourceIds?.[0]),
    ),
    `Linked evidence: ${evidence.filter((item) => item.sourceIds?.length === 1).length}`,
  ),
);

const map = buildComplianceNetworkMap({
  id: "live-activity-day-map",
  scale: "day",
  startAt: "2026-08-24T08:00:00.000Z",
  endAt: "2026-08-24T12:00:00.000Z",
  events: evidence,
  now,
});

scenarios.push(
  result(
    "Adjacent activity transitions merge into map stations",
    map.stations.length === 6,
    `Evidence: ${evidence.length}, stations: ${map.stations.length}`,
  ),
);

const firstTransition = map.stations.find(
  (station) => station.occurredAt === "2026-08-24T08:15:00.000Z",
);

scenarios.push(
  result(
    "Activity changes become auditable interchanges",
    firstTransition?.isInterchange === true &&
      firstTransition.eventIds.includes(
        "activity-network-other-work-one-end",
      ) &&
      firstTransition.eventIds.includes("activity-network-driving-one-start"),
    `Events: ${firstTransition?.eventIds.join(", ")}`,
  ),
);

scenarios.push(
  result(
    "Map live position follows the activity snapshot time",
    map.livePosition?.occurredAt === now && map.livePosition.position === 0.75,
    `Live position: ${map.livePosition?.position}`,
  ),
);

const storedDurationEvidence = buildActivityComplianceNetworkEvidence({
  events: [
    activity({
      id: "stored-duration",
      activity: "other-work",
      startedAt: "2026-08-24T12:00:00.000Z",
      endedAt: "2026-08-24T12:30:00.000Z",
      durationMilliseconds: 20 * 60 * 1000,
    }),
  ],
  now,
});

scenarios.push(
  result(
    "Completed activities preserve their stored duration",
    storedDurationEvidence[1]?.summary.includes("20m") === true,
    `Summary: ${storedDurationEvidence[1]?.summary}`,
  ),
);

let invalidRangeRejected = false;

try {
  buildActivityComplianceNetworkEvidence({
    events: [
      activity({
        id: "invalid-range",
        activity: "driving",
        startedAt: "2026-08-24T13:00:00.000Z",
        endedAt: "2026-08-24T12:00:00.000Z",
      }),
    ],
    now,
  });
} catch {
  invalidRangeRejected = true;
}

scenarios.push(
  result(
    "Activities ending before they start are rejected",
    invalidRangeRejected,
    `Rejected: ${String(invalidRangeRejected)}`,
  ),
);

let duplicateIdRejected = false;

try {
  buildActivityComplianceNetworkEvidence({
    events: [events[1]!, events[1]!],
    now,
  });
} catch {
  duplicateIdRejected = true;
}

scenarios.push(
  result(
    "Duplicate activity identifiers are rejected",
    duplicateIdRejected,
    `Rejected: ${String(duplicateIdRejected)}`,
  ),
);

const passed = scenarios.filter((scenario) => scenario.passed).length;
const failed = scenarios.length - passed;

console.log("============================================================");
console.log("TACHOTRACK ACTIVITY COMPLIANCE NETWORK EVIDENCE TESTS");
console.log("============================================================");

for (const scenario of scenarios) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);
  console.log(`   ${scenario.details}`);
  console.log("----------------------------------------");
}

console.log(
  `ACTIVITY COMPLIANCE NETWORK EVIDENCE RESULT: ${passed}/${scenarios.length} passed`,
);

if (failed > 0) {
  console.log("❌ SOME ACTIVITY COMPLIANCE NETWORK EVIDENCE SCENARIOS FAILED");

  throw new Error(`${failed} activity compliance-network scenarios failed.`);
}

console.log("✅ ALL ACTIVITY COMPLIANCE NETWORK EVIDENCE SCENARIOS PASSED");
console.log("============================================================");
