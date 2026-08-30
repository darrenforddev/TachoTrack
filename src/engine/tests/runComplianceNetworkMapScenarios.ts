import {
    buildComplianceNetworkMap,
    type ComplianceNetworkEvidenceEvent,
} from "../complianceNetworkMap";

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

function evidence(
  overrides: Partial<ComplianceNetworkEvidenceEvent> &
    Pick<ComplianceNetworkEvidenceEvent, "id" | "occurredAt" | "title">,
): ComplianceNetworkEvidenceEvent {
  return {
    summary: `${overrides.title} evidence.`,
    severity: "good",
    lineIds: ["activity"],
    ...overrides,
  };
}

const startAt = "2026-08-24T06:00:00.000Z";
const endAt = "2026-08-24T18:00:00.000Z";

const events: ComplianceNetworkEvidenceEvent[] = [
  evidence({
    id: "daily-limit",
    occurredAt: "2026-08-24T15:00:00.000Z",
    title: "Daily driving limit",
    severity: "limit",
    lineIds: ["daily-driving"],
    sourceIds: ["driver-day-2026-08-24"],
  }),
  evidence({
    id: "shift-start",
    occurredAt: startAt,
    title: "Shift starts",
    lineIds: ["activity", "wtd", "daily-rest"],
    sourceIds: ["activity-other-work"],
  }),
  evidence({
    id: "continuous-limit",
    occurredAt: "2026-08-24T10:45:00.000Z",
    title: "Continuous-driving limit",
    severity: "limit",
    lineIds: ["continuous-driving"],
    sourceIds: ["activity-driving-one"],
  }),
  evidence({
    id: "split-break-required",
    occurredAt: "2026-08-24T10:45:00.000Z",
    title: "Second split break required",
    severity: "warning",
    lineIds: ["continuous-driving", "wtd"],
    sourceIds: ["activity-driving-one", "activity-driving-two"],
  }),
  evidence({
    id: "outside-window",
    occurredAt: "2026-08-25T06:00:00.000Z",
    title: "Tomorrow starts",
    lineIds: ["activity"],
  }),
];

const map = buildComplianceNetworkMap({
  id: "day-map-2026-08-24",
  scale: "day",
  startAt,
  endAt,
  events,
  now: "2026-08-24T12:00:00.000Z",
});

const scenarios: ScenarioResult[] = [];

scenarios.push(
  result(
    "Map preserves its requested identity and scale",
    map.id === "day-map-2026-08-24" && map.scale === "day",
    `Id: ${map.id}, scale: ${map.scale}`,
  ),
);

scenarios.push(
  result(
    "Out-of-window evidence is excluded",
    map.stations.every(
      (station) => !station.eventIds.includes("outside-window"),
    ) && map.stations.length === 3,
    `Visible stations: ${map.stations.length}`,
  ),
);

scenarios.push(
  result(
    "Stations are ordered chronologically",
    map.stations[0]?.occurredAt === startAt &&
      map.stations[1]?.occurredAt === "2026-08-24T10:45:00.000Z" &&
      map.stations[2]?.occurredAt === "2026-08-24T15:00:00.000Z",
    `Order: ${map.stations.map((station) => station.occurredAt).join(" -> ")}`,
  ),
);

const limitStation = map.stations.find(
  (station) => station.occurredAt === "2026-08-24T10:45:00.000Z",
);

scenarios.push(
  result(
    "Evidence sharing one timestamp becomes one station",
    limitStation?.eventIds.length === 2 &&
      limitStation.eventIds.includes("continuous-limit") &&
      limitStation.eventIds.includes("split-break-required"),
    `Events: ${limitStation?.eventIds.join(", ") ?? "missing"}`,
  ),
);

scenarios.push(
  result(
    "A station serving multiple rule lines becomes an interchange",
    limitStation?.isInterchange === true &&
      limitStation.lineIds.includes("continuous-driving") &&
      limitStation.lineIds.includes("wtd"),
    `Interchange: ${String(limitStation?.isInterchange)}, lines: ${limitStation?.lineIds.join(", ") ?? "missing"}`,
  ),
);

scenarios.push(
  result(
    "Worst evidence severity controls the station",
    limitStation?.severity === "warning",
    `Severity: ${limitStation?.severity ?? "missing"}`,
  ),
);

scenarios.push(
  result(
    "Station source evidence is merged without duplicates",
    limitStation?.sourceIds.length === 2 &&
      limitStation.sourceIds[0] === "activity-driving-one" &&
      limitStation.sourceIds[1] === "activity-driving-two",
    `Sources: ${limitStation?.sourceIds.join(", ") ?? "missing"}`,
  ),
);

scenarios.push(
  result(
    "Only lines with visible stations are returned",
    map.lines.length === 5 &&
      map.lines.every((line) => line.stationIds.length > 0) &&
      !map.lines.some((line) => line.id === "compensation"),
    `Lines: ${map.lines.map((line) => line.id).join(", ")}`,
  ),
);

scenarios.push(
  result(
    "Lines retain their stable display order",
    map.lines.map((line) => line.id).join(",") ===
      "activity,continuous-driving,daily-driving,wtd,daily-rest",
    `Order: ${map.lines.map((line) => line.id).join(" -> ")}`,
  ),
);

scenarios.push(
  result(
    "Station positions are proportional to the map window",
    map.stations[0]?.position === 0 && map.stations[2]?.position === 0.75,
    `Positions: ${map.stations.map((station) => station.position).join(", ")}`,
  ),
);

scenarios.push(
  result(
    "Current time creates the live map position",
    map.livePosition?.occurredAt === "2026-08-24T12:00:00.000Z" &&
      map.livePosition.position === 0.5,
    `Live position: ${map.livePosition?.position ?? "none"}`,
  ),
);

const historicalMap = buildComplianceNetworkMap({
  id: "historical-day-map",
  scale: "day",
  startAt,
  endAt,
  events,
  now: "2026-08-25T12:00:00.000Z",
});

scenarios.push(
  result(
    "Current time outside the map window creates no live marker",
    historicalMap.livePosition === null,
    `Live marker: ${historicalMap.livePosition === null ? "none" : "present"}`,
  ),
);

let invalidWindowRejected = false;

try {
  buildComplianceNetworkMap({
    id: "invalid-window",
    scale: "day",
    startAt: endAt,
    endAt: startAt,
    events: [],
  });
} catch {
  invalidWindowRejected = true;
}

scenarios.push(
  result(
    "Invalid map windows are rejected",
    invalidWindowRejected,
    `Rejected: ${String(invalidWindowRejected)}`,
  ),
);

let duplicateEventRejected = false;

try {
  buildComplianceNetworkMap({
    id: "duplicate-event-map",
    scale: "day",
    startAt,
    endAt,
    events: [events[0]!, events[0]!],
  });
} catch {
  duplicateEventRejected = true;
}

scenarios.push(
  result(
    "Duplicate evidence identifiers are rejected",
    duplicateEventRejected,
    `Rejected: ${String(duplicateEventRejected)}`,
  ),
);

const passed = scenarios.filter((scenario) => scenario.passed).length;
const failed = scenarios.length - passed;

console.log("============================================================");
console.log("TACHOTRACK COMPLIANCE NETWORK MAP TESTS");
console.log("============================================================");

for (const scenario of scenarios) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);
  console.log(`   ${scenario.details}`);
  console.log("----------------------------------------");
}

console.log(
  `COMPLIANCE NETWORK MAP RESULT: ${passed}/${scenarios.length} passed`,
);

if (failed > 0) {
  console.log("❌ SOME COMPLIANCE NETWORK MAP SCENARIOS FAILED");

  throw new Error(`${failed} compliance-network map scenarios failed.`);
}

console.log("✅ ALL COMPLIANCE NETWORK MAP SCENARIOS PASSED");
console.log("============================================================");
