import type { DriverDay } from "./types";
import {
  buildMonthComplianceJourney,
  type MonthComplianceJourneyResult,
  type MonthJourneyTotals,
} from "./monthComplianceJourney";
import type { WeekComplianceDayLevel } from "./weekComplianceNetworkMap";

export interface YearJourneyMonthSummary {
  id: string;
  month: number;
  result: MonthComplianceJourneyResult;
  level: WeekComplianceDayLevel | null;
  recordedWeeks: number;
  live: boolean;
}

export interface YearJourneyTotals extends MonthJourneyTotals {
  recordedWeeks: number;
  recordedMonths: number;
  goodMonths: number;
  warningMonths: number;
  breachMonths: number;
  emptyMonths: number;
}

export interface YearComplianceJourneyResult {
  id: string;
  year: number;
  yearStartDate: string;
  yearEndDate: string;
  months: YearJourneyMonthSummary[];
  totals: YearJourneyTotals;
}

export interface BuildYearComplianceJourneyOptions {
  id: string;
  year: number;
  days: DriverDay[];
  now: string | number | Date;
  liveDate?: string;
}

function validateYear(year: number): void {
  if (!Number.isInteger(year) || year < 1970 || year > 9999) {
    throw new Error(`Invalid Year Journey year: ${year}`);
  }
}

function worstLevel(
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

function getMonthLevel(
  result: MonthComplianceJourneyResult,
): WeekComplianceDayLevel | null {
  return worstLevel(
    result.weeks
      .filter((week) => week.inMonthRecordedDayCount > 0)
      .map((week) => week.level),
  );
}

export function buildYearComplianceJourney(
  options: BuildYearComplianceJourneyOptions,
): YearComplianceJourneyResult {
  if (options.id.trim().length === 0) {
    throw new Error("Year Journey requires an id.");
  }

  validateYear(options.year);

  const yearStartDate = `${options.year}-01-01`;
  const yearEndDate = `${options.year}-12-31`;

  if (
    options.liveDate !== undefined &&
    (options.liveDate < yearStartDate || options.liveDate > yearEndDate)
  ) {
    throw new Error("Year Journey live date is outside the selected year.");
  }

  const months = Array.from(
    { length: 12 },
    (_, month): YearJourneyMonthSummary => {
      const monthPrefix = `${options.year}-${String(month + 1).padStart(2, "0")}`;
      const liveDate =
        options.liveDate?.startsWith(`${monthPrefix}-`) === true
          ? options.liveDate
          : undefined;
      const result = buildMonthComplianceJourney({
        id: `${options.id}-month-${String(month + 1).padStart(2, "0")}`,
        year: options.year,
        month,
        days: options.days,
        now: options.now,
        ...(liveDate === undefined ? {} : { liveDate }),
      });

      return {
        id: `${options.id}-month-${String(month + 1).padStart(2, "0")}`,
        month,
        result,
        level: getMonthLevel(result),
        recordedWeeks: result.weeks.filter(
          (week) => week.inMonthRecordedDayCount > 0,
        ).length,
        live: result.weeks.some((week) => week.live),
      };
    },
  );

  const recordedWeekStarts = new Set<string>();

  for (const month of months) {
    for (const week of month.result.weeks) {
      if (week.inMonthRecordedDayCount > 0) {
        recordedWeekStarts.add(week.weekStartDate);
      }
    }
  }

  const recordedMonths = months.filter(
    (month) => month.result.totals.recordedDays > 0,
  );
  const recordedDays = months.reduce(
    (total, month) => total + month.result.totals.recordedDays,
    0,
  );
  const goodDays = months.reduce(
    (total, month) => total + month.result.totals.goodDays,
    0,
  );
  const warningDays = months.reduce(
    (total, month) => total + month.result.totals.warningDays,
    0,
  );
  const breachDays = months.reduce(
    (total, month) => total + month.result.totals.breachDays,
    0,
  );

  return {
    id: options.id,
    year: options.year,
    yearStartDate,
    yearEndDate,
    months,
    totals: {
      recordedDays,
      goodDays,
      warningDays,
      breachDays,
      compliancePercentage:
        recordedDays === 0
          ? 100
          : Math.round((goodDays / recordedDays) * 100),
      drivingMinutes: months.reduce(
        (total, month) => total + month.result.totals.drivingMinutes,
        0,
      ),
      workingMinutes: months.reduce(
        (total, month) => total + month.result.totals.workingMinutes,
        0,
      ),
      breakMinutes: months.reduce(
        (total, month) => total + month.result.totals.breakMinutes,
        0,
      ),
      poaMinutes: months.reduce(
        (total, month) => total + month.result.totals.poaMinutes,
        0,
      ),
      restMinutes: months.reduce(
        (total, month) => total + month.result.totals.restMinutes,
        0,
      ),
      regularRestCount: months.reduce(
        (total, month) => total + month.result.totals.regularRestCount,
        0,
      ),
      reducedRestCount: months.reduce(
        (total, month) => total + month.result.totals.reducedRestCount,
        0,
      ),
      unknownRestCount: months.reduce(
        (total, month) => total + month.result.totals.unknownRestCount,
        0,
      ),
      level: worstLevel(recordedMonths.map((month) => month.level)) ?? "good",
      recordedWeeks: recordedWeekStarts.size,
      recordedMonths: recordedMonths.length,
      goodMonths: recordedMonths.filter((month) => month.level === "good")
        .length,
      warningMonths: recordedMonths.filter(
        (month) => month.level === "warning",
      ).length,
      breachMonths: recordedMonths.filter(
        (month) => month.level === "breach",
      ).length,
      emptyMonths: months.length - recordedMonths.length,
    },
  };
}
