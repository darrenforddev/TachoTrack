import type {
  ActivityHistoryEvent,
  ActivityHistoryState,
} from "./activityHistory";
import type { RestSessionState } from "./restSession";

export const SAMPLE_COMPLIANCE_NETWORK_NOW =
  "2026-08-24T22:15:00.000Z";

const activityEvents: ActivityHistoryEvent[] = [
  {
    id: "network-demo-other-work-start",
    activity: "other-work",
    startedAt: "2026-08-24T05:45:00.000Z",
    endedAt: "2026-08-24T06:00:00.000Z",
    durationMilliseconds: 15 * 60 * 1000,
    source: "manual",
  },
  {
    id: "network-demo-driving-one",
    activity: "driving",
    startedAt: "2026-08-24T06:00:00.000Z",
    endedAt: "2026-08-24T08:00:00.000Z",
    durationMilliseconds: 120 * 60 * 1000,
    source: "manual",
  },
  {
    id: "network-demo-split-break-one",
    activity: "break",
    startedAt: "2026-08-24T08:00:00.000Z",
    endedAt: "2026-08-24T08:15:00.000Z",
    durationMilliseconds: 15 * 60 * 1000,
    source: "manual",
  },
  {
    id: "network-demo-driving-two",
    activity: "driving",
    startedAt: "2026-08-24T08:15:00.000Z",
    endedAt: "2026-08-24T10:45:00.000Z",
    durationMilliseconds: 150 * 60 * 1000,
    source: "manual",
  },
  {
    id: "network-demo-split-break-two",
    activity: "break",
    startedAt: "2026-08-24T10:45:00.000Z",
    endedAt: "2026-08-24T11:15:00.000Z",
    durationMilliseconds: 30 * 60 * 1000,
    source: "manual",
  },
  {
    id: "network-demo-other-work-customer",
    activity: "other-work",
    startedAt: "2026-08-24T11:15:00.000Z",
    endedAt: "2026-08-24T12:00:00.000Z",
    durationMilliseconds: 45 * 60 * 1000,
    source: "manual",
  },
  {
    id: "network-demo-driving-three",
    activity: "driving",
    startedAt: "2026-08-24T12:00:00.000Z",
    endedAt: "2026-08-24T14:00:00.000Z",
    durationMilliseconds: 120 * 60 * 1000,
    source: "manual",
  },
  {
    id: "network-demo-poa",
    activity: "poa",
    startedAt: "2026-08-24T14:00:00.000Z",
    endedAt: "2026-08-24T14:30:00.000Z",
    durationMilliseconds: 30 * 60 * 1000,
    source: "manual",
  },
  {
    id: "network-demo-driving-four",
    activity: "driving",
    startedAt: "2026-08-24T14:30:00.000Z",
    endedAt: "2026-08-24T17:00:00.000Z",
    durationMilliseconds: 150 * 60 * 1000,
    source: "manual",
  },
  {
    id: "network-demo-other-work-finish",
    activity: "other-work",
    startedAt: "2026-08-24T17:00:00.000Z",
    endedAt: "2026-08-24T17:15:00.000Z",
    durationMilliseconds: 15 * 60 * 1000,
    source: "manual",
  },
  {
    id: "network-demo-overnight-break",
    activity: "break",
    startedAt: "2026-08-24T17:15:00.000Z",
    endedAt: null,
    durationMilliseconds: null,
    source: "manual",
  },
];

export function createSampleComplianceNetworkActivityHistory(): ActivityHistoryState {
  return {
    events: activityEvents.map((event) => ({ ...event })),
    activeEventId: "network-demo-overnight-break",
  };
}

export function createSampleComplianceNetworkRestState(): RestSessionState {
  return {
    sessions: [
      {
        id: "network-demo-daily-rest",
        type: "daily",
        startedAt: "2026-08-24T17:15:00.000Z",
        endedAt: null,
        durationMilliseconds: null,
        status: "active",
      },
    ],
    activeSessionId: "network-demo-daily-rest",
  };
}
