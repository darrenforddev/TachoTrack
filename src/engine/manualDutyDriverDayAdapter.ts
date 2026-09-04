import {
  buildManualDutyBoundarySnapshot,
  type EffectiveManualDutyBoundaryEntry,
  type ManualDutyBoundary,
  type ManualDutyBoundaryActivity,
  type ManualDutyBoundaryReason,
  type ManualDutyBoundaryState,
  type ManualDutyEvidenceSource,
} from "./manualDutyBoundary";
import type {
  ActivityPeriod,
  ActivityType,
  DriverDay,
} from "./types";

interface Interval {
  start: number;
  end: number;
}

export interface ManualDutyDriverDayEntrySummary {
  evidenceId: string;
  boundary: ManualDutyBoundary;
  activity: ManualDutyBoundaryActivity;
  reason: ManualDutyBoundaryReason;
  source: ManualDutyEvidenceSource;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  appliedMinutes: number;
  alreadyPresentMinutes: number;
  conflictingMinutes: number;
}

export interface ManualDutyDriverDaySummary {
  dutyDate: string;
  entryCount: number;
  totalMinutes: number;
  appliedMinutes: number;
  alreadyPresentMinutes: number;
  conflictingMinutes: number;
  entries: ManualDutyDriverDayEntrySummary[];
}

export interface ManualDutyDriverDayProjection {
  day: DriverDay;
  summary: ManualDutyDriverDaySummary;
}

function timestamp(value: string): number {
  const result = new Date(value).getTime();

  if (!Number.isFinite(result)) {
    throw new Error(`Invalid activity timestamp: ${value}`);
  }

  return result;
}

function durationMinutes(intervals: readonly Interval[]): number {
  return intervals.reduce(
    (total, interval) => total + Math.floor((interval.end - interval.start) / 60_000),
    0,
  );
}

function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .map((interval) => ({ ...interval }))
    .sort((first, second) => first.start - second.start);
  const merged: Interval[] = [];

  for (const interval of sorted) {
    const previous = merged[merged.length - 1];

    if (previous === undefined || interval.start > previous.end) {
      merged.push(interval);
      continue;
    }

    previous.end = Math.max(previous.end, interval.end);
  }

  return merged;
}

function clippedIntervals(
  activities: readonly ActivityPeriod[],
  start: number,
  end: number,
  type?: ActivityType,
): Interval[] {
  return mergeIntervals(
    activities
      .filter((activity) => type === undefined || activity.type === type)
      .map((activity) => ({
        start: Math.max(start, timestamp(activity.start)),
        end: Math.min(end, timestamp(activity.end)),
      })),
  );
}

function subtractIntervals(
  source: Interval,
  occupied: readonly Interval[],
): Interval[] {
  let remaining: Interval[] = [{ ...source }];

  for (const blocker of occupied) {
    remaining = remaining.flatMap((interval) => {
      if (blocker.end <= interval.start || blocker.start >= interval.end) {
        return [interval];
      }

      const fragments: Interval[] = [];

      if (blocker.start > interval.start) {
        fragments.push({ start: interval.start, end: blocker.start });
      }

      if (blocker.end < interval.end) {
        fragments.push({ start: blocker.end, end: interval.end });
      }

      return fragments;
    });
  }

  return remaining;
}

function activityType(activity: ManualDutyBoundaryActivity): ActivityType {
  return activity === "other-work" ? "otherWork" : activity;
}

function effectiveEntries(
  state: ManualDutyBoundaryState,
  dutyDate: string,
): EffectiveManualDutyBoundaryEntry[] {
  const snapshot = buildManualDutyBoundarySnapshot(state, dutyDate);

  return [snapshot.beforeCardInsertion, snapshot.afterCardEjection].filter(
    (entry): entry is EffectiveManualDutyBoundaryEntry => entry !== null,
  );
}

function emptySummary(dutyDate: string): ManualDutyDriverDaySummary {
  return {
    dutyDate,
    entryCount: 0,
    totalMinutes: 0,
    appliedMinutes: 0,
    alreadyPresentMinutes: 0,
    conflictingMinutes: 0,
    entries: [],
  };
}

/**
 * Applies the effective manual duty boundaries for the DriverDay's duty date.
 *
 * Existing activity always wins. This makes the projection idempotent and
 * prevents a stale archive snapshot from being double-counted. Any part that
 * is already represented by the same activity is reported as present; an
 * overlap with a different activity is reported as a conflict for review.
 */
export function projectManualDutyBoundariesOntoDriverDay(
  day: DriverDay,
  state: ManualDutyBoundaryState,
): ManualDutyDriverDayProjection {
  const entries = effectiveEntries(state, day.date);

  if (entries.length === 0) {
    return { day, summary: emptySummary(day.date) };
  }

  const activities = [...day.activities];
  const entrySummaries: ManualDutyDriverDayEntrySummary[] = [];
  let addedOtherWorkMinutes = 0;
  let addedBreakMinutes = 0;
  let addedPoaMinutes = 0;

  for (const entry of entries) {
    const evidence = entry.evidence;
    const start = timestamp(evidence.startedAt);
    const end = timestamp(evidence.endedAt);
    const type = activityType(evidence.activity);
    const occupied = clippedIntervals(activities, start, end);
    const sameActivity = clippedIntervals(activities, start, end, type);
    const uncovered = subtractIntervals({ start, end }, occupied).filter(
      (interval) => interval.end - interval.start >= 60_000,
    );
    const appliedMinutes = durationMinutes(uncovered);
    const alreadyPresentMinutes = durationMinutes(sameActivity);
    const conflictingMinutes = Math.max(
      0,
      entry.durationMinutes - appliedMinutes - alreadyPresentMinutes,
    );

    uncovered.forEach((interval, index) => {
      activities.push({
        id: `manual-duty-driver-day-${evidence.id}-${index + 1}`,
        type,
        start: new Date(interval.start).toISOString(),
        end: new Date(interval.end).toISOString(),
        durationMinutes: Math.floor((interval.end - interval.start) / 60_000),
      });
    });

    if (type === "otherWork") {
      addedOtherWorkMinutes += appliedMinutes;
    } else if (type === "break") {
      addedBreakMinutes += appliedMinutes;
    } else if (type === "poa") {
      addedPoaMinutes += appliedMinutes;
    }

    entrySummaries.push({
      evidenceId: evidence.id,
      boundary: evidence.boundary,
      activity: evidence.activity,
      reason: evidence.reason,
      source: evidence.source,
      startedAt: evidence.startedAt,
      endedAt: evidence.endedAt,
      durationMinutes: entry.durationMinutes,
      appliedMinutes,
      alreadyPresentMinutes,
      conflictingMinutes,
    });
  }

  activities.sort(
    (first, second) => timestamp(first.start) - timestamp(second.start),
  );

  const appliedMinutes = entrySummaries.reduce(
    (total, entry) => total + entry.appliedMinutes,
    0,
  );
  const alreadyPresentMinutes = entrySummaries.reduce(
    (total, entry) => total + entry.alreadyPresentMinutes,
    0,
  );
  const conflictingMinutes = entrySummaries.reduce(
    (total, entry) => total + entry.conflictingMinutes,
    0,
  );

  return {
    day: {
      ...day,
      activities,
      otherWorkMinutes: day.otherWorkMinutes + addedOtherWorkMinutes,
      breakMinutes: day.breakMinutes + addedBreakMinutes,
      poaMinutes: day.poaMinutes + addedPoaMinutes,
    },
    summary: {
      dutyDate: day.date,
      entryCount: entrySummaries.length,
      totalMinutes: entrySummaries.reduce(
        (total, entry) => total + entry.durationMinutes,
        0,
      ),
      appliedMinutes,
      alreadyPresentMinutes,
      conflictingMinutes,
      entries: entrySummaries,
    },
  };
}

export function projectManualDutyBoundariesOntoDriverDays(
  days: readonly DriverDay[],
  state: ManualDutyBoundaryState,
): {
  days: DriverDay[];
  summariesByDate: ReadonlyMap<string, ManualDutyDriverDaySummary>;
} {
  const projections = days.map((day) =>
    projectManualDutyBoundariesOntoDriverDay(day, state),
  );

  return {
    days: projections.map((projection) => projection.day),
    summariesByDate: new Map(
      projections.map((projection) => [
        projection.day.date,
        projection.summary,
      ]),
    ),
  };
}

export function isManualDutyActivityPeriod(activity: ActivityPeriod): boolean {
  return (
    activity.id.startsWith("manual-duty-driver-day-") ||
    activity.id.startsWith("manual-duty-")
  );
}
