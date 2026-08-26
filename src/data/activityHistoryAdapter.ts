import type { ActivityHistoryEvent } from "./activityHistory";

import type { DriverActivityType } from "./activityState";

/**
 * --------------------------------------------------
 * COMPLIANCE ACTIVITY TYPE
 * --------------------------------------------------
 *
 * This is the normalised activity vocabulary
 * that the compliance engine can consume.
 *
 * We keep this separate from the UI-facing
 * DriverActivityType so that future inputs
 * such as tachograph packets can be adapted
 * into the same engine model.
 */
export type ComplianceActivityType = "driving" | "break" | "other-work" | "poa";

/**
 * --------------------------------------------------
 * COMPLIANCE ACTIVITY SEGMENT
 * --------------------------------------------------
 *
 * Each completed activity event becomes one
 * immutable time segment.
 */
export interface ComplianceActivitySegment {
  id: string;

  activity: ComplianceActivityType;

  startedAt: string;

  endedAt: string;

  durationMilliseconds: number;

  source: string;
}

/**
 * --------------------------------------------------
 * ACTIVITY TYPE ADAPTER
 * --------------------------------------------------
 */
export function toComplianceActivityType(
  activity: DriverActivityType,
): ComplianceActivityType {
  switch (activity) {
    case "driving":
      return "driving";

    case "break":
      return "break";

    case "other-work":
      return "other-work";

    case "poa":
      return "poa";
  }
}

/**
 * --------------------------------------------------
 * SINGLE EVENT ADAPTER
 * --------------------------------------------------
 *
 * Active/open events are deliberately ignored
 * because their duration is still changing.
 *
 * Only completed events should be passed into
 * the compliance engine as immutable segments.
 */
export function activityHistoryEventToSegment(
  event: ActivityHistoryEvent,
): ComplianceActivitySegment | null {
  if (event.endedAt === null || event.durationMilliseconds === null) {
    return null;
  }

  return {
    id: event.id,

    activity: toComplianceActivityType(event.activity),

    startedAt: event.startedAt,

    endedAt: event.endedAt,

    durationMilliseconds: event.durationMilliseconds,

    source: event.source,
  };
}

/**
 * --------------------------------------------------
 * HISTORY → COMPLIANCE SEGMENTS
 * --------------------------------------------------
 *
 * Converts the full driver activity trace into
 * completed chronological segments suitable for
 * compliance calculations.
 */
export function activityHistoryToSegments(
  events: ActivityHistoryEvent[],
): ComplianceActivitySegment[] {
  return events
    .map(activityHistoryEventToSegment)
    .filter((segment): segment is ComplianceActivitySegment => segment !== null)
    .sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );
}

/**
 * --------------------------------------------------
 * TOTAL DURATION BY ACTIVITY
 * --------------------------------------------------
 *
 * Useful for quick validation before we connect
 * the segments to the deeper compliance engine.
 */
export function getTotalDurationForActivity(
  segments: ComplianceActivitySegment[],
  activity: ComplianceActivityType,
): number {
  return segments
    .filter((segment) => segment.activity === activity)
    .reduce((total, segment) => total + segment.durationMilliseconds, 0);
}
