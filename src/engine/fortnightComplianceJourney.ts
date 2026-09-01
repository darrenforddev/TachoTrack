import type { WeeklyDriverHistory } from "../data/weeklyDriverHistory";

import type { ComplianceNetworkSeverity } from "./complianceNetworkMap";
import type { FortnightlyDrivingState } from "./fortnightlyDrivingState";
import {
  buildWeekComplianceNetworkMap,
  type WeekComplianceDayLevel,
  type WeekComplianceDaySummary,
  type WeekComplianceNetworkMapResult,
} from "./weekComplianceNetworkMap";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

export type FortnightJourneyLevel =
  | "good"
  | "warning"
  | "limit"
  | "breach";

export interface FortnightJourneyWeekSummary {
  id: string;
  position: "previous" | "current";
  weekStartDate: string;
  weekEndDate: string;
  days: WeekComplianceDaySummary[];
  recordedDayCount: number;
  drivingMinutes: number;
  workingMinutes: number;
  breakMinutes: number;
  poaMinutes: number;
  restMinutes: number;
  level: FortnightJourneyLevel | null;
  live: boolean;
  result: WeekComplianceNetworkMapResult;
}

export interface FortnightComplianceJourneyResult {
  id: string;
  fortnightStartDate: string;
  fortnightEndDate: string;
  previousWeek: FortnightJourneyWeekSummary;
  currentWeek: FortnightJourneyWeekSummary;
  days: WeekComplianceDaySummary[];
  state: FortnightlyDrivingState;
  level: FortnightJourneyLevel;
  recordedDayCount: number;
  drivingMinutes: number;
  workingMinutes: number;
  breakMinutes: number;
  poaMinutes: number;
  restMinutes: number;
}

export interface BuildFortnightComplianceJourneyOptions {
  id: string;
  previousWeek: WeeklyDriverHistory;
  currentWeek: WeeklyDriverHistory;
  now: string | number | Date;
  liveDate?: string;
}

function parseDateOnly(value: string, fieldName: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  const milliseconds = new Date(`${value}T00:00:00.000Z`).getTime();

  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  return milliseconds;
}

function parseNow(value: string | number | Date): number {
  const milliseconds =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error("Invalid Fortnight Journey current time.");
  }

  return milliseconds;
}

function snapshotInsideWeek(
  week: WeeklyDriverHistory,
  preferredMilliseconds: number,
): number {
  const startMilliseconds = parseDateOnly(
    week.weekStartDate,
    "Fortnight Journey week start",
  );
  const endExclusiveMilliseconds =
    parseDateOnly(week.weekEndDate, "Fortnight Journey week end") +
    DAY_MILLISECONDS;

  if (
    preferredMilliseconds >= startMilliseconds &&
    preferredMilliseconds < endExclusiveMilliseconds
  ) {
    return preferredMilliseconds;
  }

  return endExclusiveMilliseconds - 12 * 60 * 60 * 1000;
}

function severityLevel(
  severity: ComplianceNetworkSeverity,
): FortnightJourneyLevel {
  if (severity === "breach") {
    return "breach";
  }

  if (severity === "warning") {
    return "warning";
  }

  if (severity === "limit") {
    return "limit";
  }

  return "good";
}

function worstLevel(
  levels: Array<FortnightJourneyLevel | WeekComplianceDayLevel | null>,
): FortnightJourneyLevel | null {
  if (levels.includes("breach")) {
    return "breach";
  }

  if (levels.includes("warning")) {
    return "warning";
  }

  if (levels.includes("limit")) {
    return "limit";
  }

  if (levels.includes("good")) {
    return "good";
  }

  return null;
}

function summariseWeek(
  id: string,
  position: "previous" | "current",
  result: WeekComplianceNetworkMapResult,
): FortnightJourneyWeekSummary {
  const recordedDays = result.days.filter((day) => day.recorded);
  const finalRecordedDay = recordedDays[recordedDays.length - 1];
  const dailyLevel = worstLevel(recordedDays.map((day) => day.level));
  const weeklyLineLevel = severityLevel(
    finalRecordedDay?.lineSeverities["weekly-driving"] ??
      result.states.weeklyDriving.status,
  );

  return {
    id,
    position,
    weekStartDate: result.days[0].date,
    weekEndDate: result.days[6].date,
    days: result.days,
    recordedDayCount: recordedDays.length,
    drivingMinutes: recordedDays.reduce(
      (total, day) => total + day.drivingMinutes,
      0,
    ),
    workingMinutes: recordedDays.reduce(
      (total, day) => total + day.workingMinutes,
      0,
    ),
    breakMinutes: recordedDays.reduce(
      (total, day) => total + day.breakMinutes,
      0,
    ),
    poaMinutes: recordedDays.reduce(
      (total, day) => total + day.poaMinutes,
      0,
    ),
    restMinutes: recordedDays.reduce(
      (total, day) => total + day.restMinutes,
      0,
    ),
    level:
      recordedDays.length === 0
        ? null
        : worstLevel([dailyLevel, weeklyLineLevel]),
    live: result.days.some((day) => day.live),
    result,
  };
}

export function buildFortnightComplianceJourney(
  options: BuildFortnightComplianceJourneyOptions,
): FortnightComplianceJourneyResult {
  if (options.id.trim().length === 0) {
    throw new Error("Fortnight Journey requires an id.");
  }

  const nowMilliseconds = parseNow(options.now);
  const previousStartMilliseconds = parseDateOnly(
    options.previousWeek.weekStartDate,
    "previous-week start",
  );
  const previousEndMilliseconds = parseDateOnly(
    options.previousWeek.weekEndDate,
    "previous-week end",
  );
  const currentStartMilliseconds = parseDateOnly(
    options.currentWeek.weekStartDate,
    "current-week start",
  );
  const currentEndMilliseconds = parseDateOnly(
    options.currentWeek.weekEndDate,
    "current-week end",
  );

  if (
    previousEndMilliseconds - previousStartMilliseconds !==
      6 * DAY_MILLISECONDS ||
    currentEndMilliseconds - currentStartMilliseconds !==
      6 * DAY_MILLISECONDS ||
    currentStartMilliseconds - previousStartMilliseconds !==
      7 * DAY_MILLISECONDS
  ) {
    throw new Error(
      "Fortnight Journey requires two consecutive Monday-Sunday weeks.",
    );
  }

  if (
    options.liveDate !== undefined &&
    (options.liveDate < options.currentWeek.weekStartDate ||
      options.liveDate > options.currentWeek.weekEndDate)
  ) {
    throw new Error(
      "Fortnight Journey live date must fall inside the current week.",
    );
  }

  const previousResult = buildWeekComplianceNetworkMap({
    id: `${options.id}-previous-week`,
    currentWeek: options.previousWeek,
    now: snapshotInsideWeek(options.previousWeek, nowMilliseconds),
  });
  const currentResult = buildWeekComplianceNetworkMap({
    id: `${options.id}-current-week`,
    currentWeek: options.currentWeek,
    previousWeekDays: options.previousWeek.days,
    ...(options.liveDate === undefined ? {} : { liveDate: options.liveDate }),
    now: snapshotInsideWeek(options.currentWeek, nowMilliseconds),
  });
  const previousWeek = summariseWeek(
    `${options.id}-previous-week`,
    "previous",
    previousResult,
  );
  const currentWeek = summariseWeek(
    `${options.id}-current-week`,
    "current",
    currentResult,
  );
  const days = [...previousWeek.days, ...currentWeek.days];
  const state = currentResult.states.fortnightlyDriving;
  const aggregateLevel = severityLevel(state.status);
  const level =
    worstLevel([previousWeek.level, currentWeek.level, aggregateLevel]) ??
    aggregateLevel;

  return {
    id: options.id,
    fortnightStartDate: options.previousWeek.weekStartDate,
    fortnightEndDate: options.currentWeek.weekEndDate,
    previousWeek,
    currentWeek,
    days,
    state,
    level,
    recordedDayCount: days.filter((day) => day.recorded).length,
    drivingMinutes: state.drivingMinutesUsed,
    workingMinutes:
      previousWeek.workingMinutes + currentWeek.workingMinutes,
    breakMinutes: previousWeek.breakMinutes + currentWeek.breakMinutes,
    poaMinutes: previousWeek.poaMinutes + currentWeek.poaMinutes,
    restMinutes: previousWeek.restMinutes + currentWeek.restMinutes,
  };
}
