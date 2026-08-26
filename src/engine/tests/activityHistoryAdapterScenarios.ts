import {
    activityHistoryToSegments,
    getTotalDurationForActivity,
} from "../../data/activityHistoryAdapter";

import type { ActivityHistoryEvent } from "../../data/activityHistory";

type ScenarioResult = {
  name: string;
  passed: boolean;
  details: string;
};

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

const scenarios: ScenarioResult[] = [];

/**
 * --------------------------------------------------
 * TEST DATA
 * --------------------------------------------------
 *
 * Deliberately out of chronological order so
 * the adapter must sort it correctly.
 *
 * 08:00 - 08:15 Other Work = 15 min
 * 08:15 - 09:00 Driving    = 45 min
 * 09:00 - 09:30 Break      = 30 min
 * 09:30 - open Driving     = ACTIVE
 */
const events: ActivityHistoryEvent[] = [
  {
    id: "event-driving-active",

    activity: "driving",

    startedAt: "2026-08-26T09:30:00.000Z",

    endedAt: null,

    durationMilliseconds: null,

    source: "manual",
  },

  {
    id: "event-break",

    activity: "break",

    startedAt: "2026-08-26T09:00:00.000Z",

    endedAt: "2026-08-26T09:30:00.000Z",

    durationMilliseconds: 30 * 60 * 1000,

    source: "manual",
  },

  {
    id: "event-other-work",

    activity: "other-work",

    startedAt: "2026-08-26T08:00:00.000Z",

    endedAt: "2026-08-26T08:15:00.000Z",

    durationMilliseconds: 15 * 60 * 1000,

    source: "manual",
  },

  {
    id: "event-driving",

    activity: "driving",

    startedAt: "2026-08-26T08:15:00.000Z",

    endedAt: "2026-08-26T09:00:00.000Z",

    durationMilliseconds: 45 * 60 * 1000,

    source: "manual",
  },
];

const segments = activityHistoryToSegments(events);

/**
 * --------------------------------------------------
 * SCENARIO 1
 *
 * Open activity must not become an immutable
 * compliance segment.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Open activity is excluded from compliance segments",

    segments.length === 3,

    `Segments: ${segments.length}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 2
 *
 * Segments must be chronological.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Completed segments are sorted chronologically",

    segments[0]?.id === "event-other-work" &&
      segments[1]?.id === "event-driving" &&
      segments[2]?.id === "event-break",

    `Order: ${segments.map((segment) => segment.id).join(" -> ")}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 3
 *
 * Activity type must survive the adapter.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Driving activity type is preserved",

    segments[1]?.activity === "driving",

    `Activity: ${segments[1]?.activity}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 4
 *
 * Start/end timestamps must survive unchanged.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Segment timestamps are preserved",

    segments[1]?.startedAt === "2026-08-26T08:15:00.000Z" &&
      segments[1]?.endedAt === "2026-08-26T09:00:00.000Z",

    `Start: ${segments[1]?.startedAt}, end: ${segments[1]?.endedAt}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 5
 *
 * Driving total should equal 45 minutes because
 * the active driving event is deliberately ignored.
 * --------------------------------------------------
 */
const totalDriving = getTotalDurationForActivity(segments, "driving");

scenarios.push(
  result(
    "Driving total uses completed segments only",

    totalDriving === 45 * 60 * 1000,

    `Driving ms: ${totalDriving}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 6
 *
 * Other Work total = 15 minutes.
 * --------------------------------------------------
 */
const totalOtherWork = getTotalDurationForActivity(segments, "other-work");

scenarios.push(
  result(
    "Other Work total is correct",

    totalOtherWork === 15 * 60 * 1000,

    `Other Work ms: ${totalOtherWork}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 7
 *
 * Break total = 30 minutes.
 * --------------------------------------------------
 */
const totalBreak = getTotalDurationForActivity(segments, "break");

scenarios.push(
  result(
    "Break total is correct",

    totalBreak === 30 * 60 * 1000,

    `Break ms: ${totalBreak}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 8
 *
 * POA is absent, so total must be zero.
 * --------------------------------------------------
 */
const totalPoa = getTotalDurationForActivity(segments, "poa");

scenarios.push(
  result(
    "Missing POA activity returns zero total",

    totalPoa === 0,

    `POA ms: ${totalPoa}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 9
 *
 * Source metadata survives.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Activity source is preserved",

    segments.every((segment) => segment.source === "manual"),

    `Sources: ${segments.map((segment) => segment.source).join(", ")}`,
  ),
);

/**
 * --------------------------------------------------
 * SCENARIO 10
 *
 * Duration survives exactly.
 * --------------------------------------------------
 */
scenarios.push(
  result(
    "Duration is preserved exactly",

    segments[2]?.durationMilliseconds === 30 * 60 * 1000,

    `Break duration: ${segments[2]?.durationMilliseconds}`,
  ),
);

export const activityHistoryAdapterScenarioResults = scenarios;

export const activityHistoryAdapterScenarioSummary = {
  total: scenarios.length,

  passed: scenarios.filter((scenario) => scenario.passed).length,

  failed: scenarios.filter((scenario) => !scenario.passed).length,

  allPassed: scenarios.every((scenario) => scenario.passed),
};
