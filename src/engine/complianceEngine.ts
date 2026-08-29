import type {
    ComplianceLevel,
    DailyComplianceIssue,
    DailyComplianceResult,
    DriverDay,
    DriverWeek,
    WeeklyComplianceResult,
} from "./types";

import {
    checkExtendedDrivingUsage,
    checkWeeklyDrivingLimit,
    evaluateDailyDrivingRules,
} from "./drivingRules";

import { evaluateDailyRestRules } from "./restRules";

import {
    evaluateDailyWtdRules,
    evaluateWeeklyWtdRules,
    getDailyWorkingMinutes,
} from "./wtdRules";

function getWorstLevel(
  current: ComplianceLevel,
  next: ComplianceLevel,
): ComplianceLevel {
  const rank: Record<ComplianceLevel, number> = {
    good: 0,
    warning: 1,
    breach: 2,
  };

  return rank[next] > rank[current] ? next : current;
}

function getDayLevel(issues: DailyComplianceIssue[]): ComplianceLevel {
  let level: ComplianceLevel = "good";

  for (const issue of issues) {
    level = getWorstLevel(level, issue.level);
  }

  return level;
}

export function evaluateDriverDay(
  day: DriverDay,
  options?: {
    isLiveDay?: boolean;
  },
): DailyComplianceResult {
  const driving = evaluateDailyDrivingRules(day);

  const rest =
    options?.isLiveDay === true
      ? {
          level: "good" as ComplianceLevel,
          issues: [] as DailyComplianceIssue[],
        }
      : evaluateDailyRestRules(day);

  const wtd = evaluateDailyWtdRules(day);

  const issues: DailyComplianceIssue[] = [
    ...driving.issues,
    ...rest.issues,
    ...wtd.issues,
  ];

  const level = getDayLevel(issues);

  return {
    date: day.date,

    level,

    issues,

    drivingMinutes: day.drivingMinutes,

    workingMinutes: getDailyWorkingMinutes(day),

    breakMinutes: day.breakMinutes,

    poaMinutes: day.poaMinutes,

    restMinutes: day.restMinutes,

    dailyRestType: day.dailyRestType,
  };
}

export function evaluateDriverWeek(
  week: DriverWeek,
  options?: {
    liveDate?: string;
  },
): WeeklyComplianceResult {
  const dailyResults = week.days.map((day) =>
    evaluateDriverDay(day, {
      isLiveDay:
        options?.liveDate !== undefined && day.date === options.liveDate,
    }),
  );

  const weeklyDriving = checkWeeklyDrivingLimit(week.days);

  const extendedDriving = checkExtendedDrivingUsage(week.days);

  const weeklyWtd = evaluateWeeklyWtdRules(week.days);

  const weeklyIssues: DailyComplianceIssue[] = [
    ...weeklyDriving.issues,
    ...extendedDriving.issues,
    ...weeklyWtd.issues,
  ];

  const dailyIssues = dailyResults.flatMap((day) => day.issues);

  const allIssues = [...dailyIssues, ...weeklyIssues];

  let level: ComplianceLevel = "good";

  for (const day of dailyResults) {
    level = getWorstLevel(level, day.level);
  }

  level = getWorstLevel(level, weeklyDriving.level);

  level = getWorstLevel(level, extendedDriving.level);

  level = getWorstLevel(level, weeklyWtd.level);

  const totalDrivingMinutes = week.days.reduce(
    (total, day) => total + day.drivingMinutes,
    0,
  );

  const totalWorkingMinutes = week.days.reduce(
    (total, day) => total + getDailyWorkingMinutes(day),
    0,
  );

  const totalBreakMinutes = week.days.reduce(
    (total, day) => total + day.breakMinutes,
    0,
  );

  const totalPoaMinutes = week.days.reduce(
    (total, day) => total + day.poaMinutes,
    0,
  );

  const totalRestMinutes = week.days.reduce(
    (total, day) => total + day.restMinutes,
    0,
  );

  const regularDailyRests = week.days.filter(
    (day) => day.dailyRestType === "regular",
  ).length;

  const reducedDailyRests = week.days.filter(
    (day) => day.dailyRestType === "reduced",
  ).length;

  const extendedDrivingDays = week.days.filter(
    (day) => day.drivingMinutes > 9 * 60,
  ).length;

  return {
    weekNumber: week.weekNumber,

    level,

    days: dailyResults,

    totalDrivingMinutes,

    totalWorkingMinutes,

    totalBreakMinutes,

    totalPoaMinutes,

    totalRestMinutes,

    regularDailyRests,

    reducedDailyRests,

    extendedDrivingDays,

    issues: allIssues,
  };
}
