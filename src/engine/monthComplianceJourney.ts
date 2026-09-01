import type { WeeklyDriverHistory } from "../data/weeklyDriverHistory";

import type { ComplianceNetworkSeverity } from "./complianceNetworkMap";
import type { DriverDay } from "./types";
import {
  buildWeekComplianceNetworkMap,
  type WeekComplianceDayLevel,
  type WeekComplianceDaySummary,
  type WeekComplianceNetworkStates,
} from "./weekComplianceNetworkMap";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

export interface MonthJourneyWeekSummary {
  id: string;
  isoYear: number;
  isoWeekNumber: number;
  weekStartDate: string;
  weekEndDate: string;
  days: WeekComplianceDaySummary[];
  states: WeekComplianceNetworkStates;
  level: WeekComplianceDayLevel | null;
  recordedDayCount: number;
  inMonthRecordedDayCount: number;
  drivingMinutes: number;
  workingMinutes: number;
  breakMinutes: number;
  poaMinutes: number;
  restMinutes: number;
  regularRestCount: number;
  reducedRestCount: number;
  unknownRestCount: number;
  live: boolean;
}

export interface MonthJourneyTotals {
  recordedDays: number;
  goodDays: number;
  warningDays: number;
  breachDays: number;
  compliancePercentage: number;
  drivingMinutes: number;
  workingMinutes: number;
  breakMinutes: number;
  poaMinutes: number;
  restMinutes: number;
  regularRestCount: number;
  reducedRestCount: number;
  unknownRestCount: number;
  level: WeekComplianceDayLevel;
}

export interface MonthComplianceJourneyResult {
  id: string;
  year: number;
  month: number;
  monthStartDate: string;
  monthEndDate: string;
  calendarStartDate: string;
  calendarEndDate: string;
  weeks: MonthJourneyWeekSummary[];
  totals: MonthJourneyTotals;
}

export interface BuildMonthComplianceJourneyOptions {
  id: string;
  year: number;
  month: number;
  days: DriverDay[];
  now: string | number | Date;
  liveDate?: string;
}

function parseNow(value: string | number | Date): number {
  const milliseconds =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error("Invalid Month Journey current time.");
  }

  return milliseconds;
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

function toDateOnly(milliseconds: number): string {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

function getMonthBounds(year: number, month: number): {
  startMilliseconds: number;
  endExclusiveMilliseconds: number;
} {
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    throw new Error(`Invalid Month Journey year: ${year}`);
  }

  if (!Number.isInteger(month) || month < 0 || month > 11) {
    throw new Error(`Invalid Month Journey month: ${month}`);
  }

  return {
    startMilliseconds: Date.UTC(year, month, 1),
    endExclusiveMilliseconds: Date.UTC(year, month + 1, 1),
  };
}

function startOfIsoWeek(milliseconds: number): number {
  const date = new Date(milliseconds);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;

  return milliseconds - daysSinceMonday * DAY_MILLISECONDS;
}

function endExclusiveOfIsoWeek(milliseconds: number): number {
  return startOfIsoWeek(milliseconds) + 7 * DAY_MILLISECONDS;
}

function getIsoWeekReference(milliseconds: number): {
  isoYear: number;
  isoWeekNumber: number;
} {
  const date = new Date(milliseconds);
  const day = date.getUTCDay() || 7;

  date.setUTCDate(date.getUTCDate() + 4 - day);

  const isoYear = date.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const isoWeekNumber = Math.ceil(
    ((date.getTime() - yearStart) / DAY_MILLISECONDS + 1) / 7,
  );

  return { isoYear, isoWeekNumber };
}

function validateDays(days: DriverDay[]): void {
  const seenDates = new Set<string>();

  for (const day of days) {
    parseDateOnly(day.date, `DriverDay date for ${day.id}`);

    if (seenDates.has(day.date)) {
      throw new Error(`Duplicate DriverDay date in Month Journey: ${day.date}`);
    }

    seenDates.add(day.date);
  }
}

function worstDayLevel(
  levels: Array<WeekComplianceDayLevel | null>,
): WeekComplianceDayLevel | null {
  if (levels.includes("breach")) {
    return "breach";
  }

  if (levels.includes("warning")) {
    return "warning";
  }

  if (levels.includes("good")) {
    return "good";
  }

  return null;
}

function severityToDayLevel(
  severity: ComplianceNetworkSeverity,
): WeekComplianceDayLevel {
  if (severity === "breach") {
    return "breach";
  }

  if (severity === "warning" || severity === "limit") {
    return "warning";
  }

  return "good";
}

function getWeekDays(
  allDays: DriverDay[],
  weekStartDate: string,
  weekEndDate: string,
): DriverDay[] {
  return allDays.filter(
    (day) => day.date >= weekStartDate && day.date <= weekEndDate,
  );
}

function summariseWeek(
  id: string,
  history: WeeklyDriverHistory,
  previousWeekDays: DriverDay[],
  monthStartDate: string,
  monthEndDate: string,
  nowMilliseconds: number,
  liveDate: string | undefined,
): MonthJourneyWeekSummary {
  const weekStartMilliseconds = parseDateOnly(
    history.weekStartDate,
    "Month Journey week start",
  );
  const weekEndExclusiveMilliseconds =
    parseDateOnly(history.weekEndDate, "Month Journey week end") +
    DAY_MILLISECONDS;
  const nowInsideWeek =
    nowMilliseconds >= weekStartMilliseconds &&
    nowMilliseconds < weekEndExclusiveMilliseconds;
  const weekNow = nowInsideWeek
    ? nowMilliseconds
    : weekEndExclusiveMilliseconds - 12 * 60 * 60 * 1000;
  const liveDateForWeek =
    liveDate !== undefined &&
    liveDate >= history.weekStartDate &&
    liveDate <= history.weekEndDate
      ? liveDate
      : undefined;
  const weekResult = buildWeekComplianceNetworkMap({
    id,
    currentWeek: history,
    previousWeekDays,
    ...(liveDateForWeek === undefined ? {} : { liveDate: liveDateForWeek }),
    now: weekNow,
  });
  const recordedDays = weekResult.days.filter((day) => day.recorded);
  const inMonthDays = recordedDays.filter(
    (day) => day.date >= monthStartDate && day.date <= monthEndDate,
  );
  const finalRecordedDay = recordedDays[recordedDays.length - 1];
  const level = worstDayLevel(recordedDays.map((day) => day.level));
  const aggregateLevel = worstDayLevel([
    level,
    severityToDayLevel(
      finalRecordedDay?.lineSeverities["weekly-driving"] ?? "good",
    ),
    severityToDayLevel(
      finalRecordedDay?.lineSeverities["fortnightly-driving"] ?? "good",
    ),
  ]);

  return {
    id,
    ...getIsoWeekReference(weekStartMilliseconds),
    weekStartDate: history.weekStartDate,
    weekEndDate: history.weekEndDate,
    days: weekResult.days,
    states: weekResult.states,
    level: aggregateLevel,
    recordedDayCount: recordedDays.length,
    inMonthRecordedDayCount: inMonthDays.length,
    drivingMinutes: inMonthDays.reduce(
      (total, day) => total + day.drivingMinutes,
      0,
    ),
    workingMinutes: inMonthDays.reduce(
      (total, day) => total + day.workingMinutes,
      0,
    ),
    breakMinutes: inMonthDays.reduce(
      (total, day) => total + day.breakMinutes,
      0,
    ),
    poaMinutes: inMonthDays.reduce(
      (total, day) => total + day.poaMinutes,
      0,
    ),
    restMinutes: inMonthDays.reduce(
      (total, day) => total + day.restMinutes,
      0,
    ),
    regularRestCount: inMonthDays.filter(
      (day) => day.dailyRestType === "regular",
    ).length,
    reducedRestCount: inMonthDays.filter(
      (day) => day.dailyRestType === "reduced",
    ).length,
    unknownRestCount: inMonthDays.filter(
      (day) => day.dailyRestType === "unknown",
    ).length,
    live: weekResult.days.some((day) => day.live),
  };
}

export function buildMonthComplianceJourney(
  options: BuildMonthComplianceJourneyOptions,
): MonthComplianceJourneyResult {
  if (options.id.trim().length === 0) {
    throw new Error("Month Journey requires an id.");
  }

  const bounds = getMonthBounds(options.year, options.month);
  const nowMilliseconds = parseNow(options.now);
  validateDays(options.days);

  const monthStartDate = toDateOnly(bounds.startMilliseconds);
  const monthEndDate = toDateOnly(
    bounds.endExclusiveMilliseconds - DAY_MILLISECONDS,
  );

  if (
    options.liveDate !== undefined &&
    (options.liveDate < monthStartDate || options.liveDate > monthEndDate)
  ) {
    throw new Error("Month Journey live date is outside the selected month.");
  }

  const calendarStartMilliseconds = startOfIsoWeek(bounds.startMilliseconds);
  const calendarEndExclusiveMilliseconds = endExclusiveOfIsoWeek(
    bounds.endExclusiveMilliseconds - DAY_MILLISECONDS,
  );
  const weeks: MonthJourneyWeekSummary[] = [];

  for (
    let weekStartMilliseconds = calendarStartMilliseconds;
    weekStartMilliseconds < calendarEndExclusiveMilliseconds;
    weekStartMilliseconds += 7 * DAY_MILLISECONDS
  ) {
    const weekEndMilliseconds =
      weekStartMilliseconds + 6 * DAY_MILLISECONDS;
    const weekStartDate = toDateOnly(weekStartMilliseconds);
    const weekEndDate = toDateOnly(weekEndMilliseconds);
    const previousWeekStartDate = toDateOnly(
      weekStartMilliseconds - 7 * DAY_MILLISECONDS,
    );
    const previousWeekEndDate = toDateOnly(
      weekStartMilliseconds - DAY_MILLISECONDS,
    );
    const currentWeekDays = getWeekDays(
      options.days,
      weekStartDate,
      weekEndDate,
    );
    const previousWeekDays = getWeekDays(
      options.days,
      previousWeekStartDate,
      previousWeekEndDate,
    );

    weeks.push(
      summariseWeek(
        `${options.id}-week-${weekStartDate}`,
        {
          weekStartDate,
          weekEndDate,
          days: currentWeekDays,
        },
        previousWeekDays,
        monthStartDate,
        monthEndDate,
        nowMilliseconds,
        options.liveDate,
      ),
    );
  }

  const inMonthDaySummaries = weeks.flatMap((week) =>
    week.days.filter(
      (day) =>
        day.recorded &&
        day.date >= monthStartDate &&
        day.date <= monthEndDate,
    ),
  );
  const goodDays = inMonthDaySummaries.filter(
    (day) => day.level === "good",
  ).length;
  const warningDays = inMonthDaySummaries.filter(
    (day) => day.level === "warning",
  ).length;
  const breachDays = inMonthDaySummaries.filter(
    (day) => day.level === "breach",
  ).length;
  const recordedDays = inMonthDaySummaries.length;

  return {
    id: options.id,
    year: options.year,
    month: options.month,
    monthStartDate,
    monthEndDate,
    calendarStartDate: toDateOnly(calendarStartMilliseconds),
    calendarEndDate: toDateOnly(
      calendarEndExclusiveMilliseconds - DAY_MILLISECONDS,
    ),
    weeks,
    totals: {
      recordedDays,
      goodDays,
      warningDays,
      breachDays,
      compliancePercentage:
        recordedDays === 0
          ? 100
          : Math.round((goodDays / recordedDays) * 100),
      drivingMinutes: inMonthDaySummaries.reduce(
        (total, day) => total + day.drivingMinutes,
        0,
      ),
      workingMinutes: inMonthDaySummaries.reduce(
        (total, day) => total + day.workingMinutes,
        0,
      ),
      breakMinutes: inMonthDaySummaries.reduce(
        (total, day) => total + day.breakMinutes,
        0,
      ),
      poaMinutes: inMonthDaySummaries.reduce(
        (total, day) => total + day.poaMinutes,
        0,
      ),
      restMinutes: inMonthDaySummaries.reduce(
        (total, day) => total + day.restMinutes,
        0,
      ),
      regularRestCount: inMonthDaySummaries.filter(
        (day) => day.dailyRestType === "regular",
      ).length,
      reducedRestCount: inMonthDaySummaries.filter(
        (day) => day.dailyRestType === "reduced",
      ).length,
      unknownRestCount: inMonthDaySummaries.filter(
        (day) => day.dailyRestType === "unknown",
      ).length,
      level:
        worstDayLevel(inMonthDaySummaries.map((day) => day.level)) ?? "good",
    },
  };
}
