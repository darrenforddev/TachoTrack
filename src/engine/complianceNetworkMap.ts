export type ComplianceNetworkScale = "day" | "week" | "month";

export type ComplianceNetworkSeverity =
  | "good"
  | "info"
  | "warning"
  | "limit"
  | "breach";

export type ComplianceNetworkLineId =
  | "activity"
  | "continuous-driving"
  | "daily-driving"
  | "wtd"
  | "daily-rest"
  | "weekly-driving"
  | "fortnightly-driving"
  | "weekly-rest"
  | "compensation";

export interface ComplianceNetworkLineDefinition {
  id: ComplianceNetworkLineId;
  label: string;
  shortLabel: string;
  order: number;
}

export type ComplianceNetworkTimerState =
  | "protected"
  | "safety-buffer"
  | "cleared"
  | "interrupted";

export interface ComplianceNetworkTimer {
  id: string;
  kind: "rest";
  state: ComplianceNetworkTimerState;
  startedAt: string;
  legalCompleteAt: string;
  recommendedResumeAt: string;
  totalRequiredMinutes: number;
  elapsedMinutes: number;
  remainingToLegalMinutes: number;
  remainingToRecommendedMinutes: number;
  legallyComplete: boolean;
  recommendedResumeReached: boolean;
  display: string;
}

export interface ComplianceNetworkEvidenceEvent {
  id: string;
  occurredAt: string;
  title: string;
  summary: string;
  severity: ComplianceNetworkSeverity;
  lineIds: ComplianceNetworkLineId[];
  sourceIds?: string[];
  timers?: ComplianceNetworkTimer[];
}

export interface ComplianceNetworkStation {
  id: string;
  occurredAt: string;
  position: number;
  title: string;
  summary: string;
  severity: ComplianceNetworkSeverity;
  lineIds: ComplianceNetworkLineId[];
  eventIds: string[];
  sourceIds: string[];
  timers: ComplianceNetworkTimer[];
  isInterchange: boolean;
}

export interface ComplianceNetworkLine {
  id: ComplianceNetworkLineId;
  label: string;
  shortLabel: string;
  order: number;
  stationIds: string[];
}

export interface ComplianceNetworkLivePosition {
  occurredAt: string;
  position: number;
}

export interface ComplianceNetworkMap {
  id: string;
  scale: ComplianceNetworkScale;
  startAt: string;
  endAt: string;
  lines: ComplianceNetworkLine[];
  stations: ComplianceNetworkStation[];
  livePosition: ComplianceNetworkLivePosition | null;
}

export interface BuildComplianceNetworkMapOptions {
  id: string;
  scale: ComplianceNetworkScale;
  startAt: string;
  endAt: string;
  events: ComplianceNetworkEvidenceEvent[];
  now?: string | number | Date | null;
}

export const COMPLIANCE_NETWORK_LINE_DEFINITIONS: readonly ComplianceNetworkLineDefinition[] =
  [
    {
      id: "activity",
      label: "Activity",
      shortLabel: "Activity",
      order: 10,
    },
    {
      id: "continuous-driving",
      label: "Continuous Driving",
      shortLabel: "4h 30m",
      order: 20,
    },
    {
      id: "daily-driving",
      label: "Daily Driving",
      shortLabel: "Daily",
      order: 30,
    },
    {
      id: "wtd",
      label: "Working Time Directive",
      shortLabel: "WTD",
      order: 40,
    },
    {
      id: "daily-rest",
      label: "Daily Rest",
      shortLabel: "Daily Rest",
      order: 50,
    },
    {
      id: "weekly-driving",
      label: "Weekly Driving",
      shortLabel: "56h",
      order: 60,
    },
    {
      id: "fortnightly-driving",
      label: "Fortnightly Driving",
      shortLabel: "90h",
      order: 70,
    },
    {
      id: "weekly-rest",
      label: "Weekly Rest",
      shortLabel: "Weekly Rest",
      order: 80,
    },
    {
      id: "compensation",
      label: "Weekly-Rest Compensation",
      shortLabel: "Compensation",
      order: 90,
    },
  ];

const SEVERITY_PRIORITY: Record<ComplianceNetworkSeverity, number> = {
  good: 0,
  info: 1,
  limit: 2,
  warning: 3,
  breach: 4,
};

function parseTimestamp(value: string, fieldName: string): number {
  const milliseconds = new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  return milliseconds;
}

function parseNow(value: string | number | Date): {
  milliseconds: number;
  iso: string;
} {
  const milliseconds =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error("Invalid compliance-network current time.");
  }

  return {
    milliseconds,
    iso: new Date(milliseconds).toISOString(),
  };
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function getWorstSeverity(
  events: ComplianceNetworkEvidenceEvent[],
): ComplianceNetworkSeverity {
  return events.reduce<ComplianceNetworkSeverity>(
    (worst, event) =>
      SEVERITY_PRIORITY[event.severity] > SEVERITY_PRIORITY[worst]
        ? event.severity
        : worst,
    "good",
  );
}

function validateEvent(event: ComplianceNetworkEvidenceEvent): void {
  if (event.id.trim().length === 0) {
    throw new Error("Compliance-network evidence requires a non-empty id.");
  }

  if (event.title.trim().length === 0) {
    throw new Error(`Compliance-network event ${event.id} requires a title.`);
  }

  if (event.lineIds.length === 0) {
    throw new Error(
      `Compliance-network event ${event.id} must belong to at least one line.`,
    );
  }

  parseTimestamp(event.occurredAt, `event timestamp for ${event.id}`);
}

function stationId(occurredAt: string, eventIds: string[]): string {
  return `station-${occurredAt}-${eventIds.join("-")}`;
}

export function buildComplianceNetworkMap(
  options: BuildComplianceNetworkMapOptions,
): ComplianceNetworkMap {
  const startMilliseconds = parseTimestamp(options.startAt, "map start");
  const endMilliseconds = parseTimestamp(options.endAt, "map end");

  if (endMilliseconds <= startMilliseconds) {
    throw new Error("Compliance-network map end must be after its start.");
  }

  const eventIds = new Set<string>();

  for (const event of options.events) {
    validateEvent(event);

    if (eventIds.has(event.id)) {
      throw new Error(`Duplicate compliance-network event id: ${event.id}`);
    }

    eventIds.add(event.id);
  }

  const visibleEvents = options.events
    .filter((event) => {
      const occurredAtMilliseconds = new Date(event.occurredAt).getTime();

      return (
        occurredAtMilliseconds >= startMilliseconds &&
        occurredAtMilliseconds <= endMilliseconds
      );
    })
    .sort((left, right) => {
      const timeDifference =
        new Date(left.occurredAt).getTime() -
        new Date(right.occurredAt).getTime();

      return timeDifference !== 0
        ? timeDifference
        : left.id.localeCompare(right.id);
    });

  const eventsByTimestamp = new Map<string, ComplianceNetworkEvidenceEvent[]>();

  for (const event of visibleEvents) {
    const canonicalTimestamp = new Date(event.occurredAt).toISOString();
    const existing = eventsByTimestamp.get(canonicalTimestamp) ?? [];

    existing.push(event);
    eventsByTimestamp.set(canonicalTimestamp, existing);
  }

  const rangeMilliseconds = endMilliseconds - startMilliseconds;

  const stations = [...eventsByTimestamp.entries()].map(
    ([occurredAt, events]): ComplianceNetworkStation => {
      const stationEventIds = events.map((event) => event.id);
      const lineIds = uniqueSorted(events.flatMap((event) => event.lineIds));
      const sourceIds = uniqueSorted(
        events.flatMap((event) => event.sourceIds ?? []),
      );
      const timers = events.flatMap((event) => event.timers ?? []);
      const occurredAtMilliseconds = new Date(occurredAt).getTime();

      return {
        id: stationId(occurredAt, stationEventIds),
        occurredAt,
        position:
          (occurredAtMilliseconds - startMilliseconds) / rangeMilliseconds,
        title:
          events.length === 1
            ? events[0].title
            : events.map((event) => event.title).join(" · "),
        summary: events.map((event) => event.summary).join(" "),
        severity: getWorstSeverity(events),
        lineIds,
        eventIds: stationEventIds,
        sourceIds,
        timers,
        isInterchange: lineIds.length > 1,
      };
    },
  );

  const activeLineIds = new Set(stations.flatMap((station) => station.lineIds));

  const lines = COMPLIANCE_NETWORK_LINE_DEFINITIONS.filter((definition) =>
    activeLineIds.has(definition.id),
  )
    .map(
      (definition): ComplianceNetworkLine => ({
        ...definition,
        stationIds: stations
          .filter((station) => station.lineIds.includes(definition.id))
          .map((station) => station.id),
      }),
    )
    .sort((left, right) => left.order - right.order);

  let livePosition: ComplianceNetworkLivePosition | null = null;

  if (options.now !== null && options.now !== undefined) {
    const now = parseNow(options.now);

    if (
      now.milliseconds >= startMilliseconds &&
      now.milliseconds <= endMilliseconds
    ) {
      livePosition = {
        occurredAt: now.iso,
        position: (now.milliseconds - startMilliseconds) / rangeMilliseconds,
      };
    }
  }

  return {
    id: options.id,
    scale: options.scale,
    startAt: new Date(startMilliseconds).toISOString(),
    endAt: new Date(endMilliseconds).toISOString(),
    lines,
    stations,
    livePosition,
  };
}
