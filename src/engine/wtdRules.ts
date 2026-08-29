import type {
    ComplianceLevel,
    DailyComplianceIssue,
    DriverDay,
    RollingWtdResult,
} from "./types";

export const WTD_LIMITS = {
  /**
   * Maximum working time in any single week.
   */
  maxWeeklyWorkingMinutes: 60 * 60, // 60h

  /**
   * Maximum average weekly working time
   * over the applicable reference period.
   */
  maxAverageWeeklyWorkingMinutes: 48 * 60, // 48h

  /**
   * Default reference period.
   *
   * We keep this configurable because some
   * arrangements can use a different reference period.
   */
  defaultReferencePeriodWeeks: 17,

  /**
   * Working-time break rules.
   *
   * More than 6 hours, up to and including 9 hours:
   * minimum total break = 30 minutes.
   *
   * More than 9 hours:
   * minimum total break = 45 minutes.
   */
  sixHourThresholdMinutes: 6 * 60,
  nineHourThresholdMinutes: 9 * 60,

  minimumBreakOverSixHoursMinutes: 30,
  minimumBreakOverNineHoursMinutes: 45,

  /**
   * A qualifying WTD break segment must
   * normally be at least 15 minutes.
   */
  minimumBreakSegmentMinutes: 15,

  /**
   * Night work default limit.
   *
   * Night-work handling will be developed
   * separately because agreements can modify this.
   */
  nightWorkMaximumMinutes: 10 * 60,
} as const;

export interface WtdRuleResult {
  level: ComplianceLevel;
  issues: DailyComplianceIssue[];
}

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

/**
 * Working time for road-transport WTD purposes.
 *
 * Driving + Other Work count as working time.
 *
 * POA, breaks and rest are not included in this
 * working-time total.
 */
export function getDailyWorkingMinutes(day: DriverDay): number {
  return day.drivingMinutes + day.otherWorkMinutes;
}

/**
 * Return qualifying WTD break minutes.
 *
 * Only break periods of at least 15 minutes
 * are counted.
 *
 * The activity timeline is deliberately used
 * instead of day.breakMinutes so that invalid
 * short break segments are excluded.
 */
export function getQualifyingWtdBreakMinutes(day: DriverDay): number {
  return day.activities
    .filter(
      (activity) =>
        activity.type === "break" &&
        activity.durationMinutes >= WTD_LIMITS.minimumBreakSegmentMinutes,
    )
    .reduce((total, activity) => total + activity.durationMinutes, 0);
}

/**
 * Determine the total WTD break requirement from
 * the amount of working time performed.
 */
export function getRequiredWtdBreakMinutes(workingMinutes: number): number {
  if (workingMinutes > WTD_LIMITS.nineHourThresholdMinutes) {
    return WTD_LIMITS.minimumBreakOverNineHoursMinutes;
  }

  if (workingMinutes > WTD_LIMITS.sixHourThresholdMinutes) {
    return WTD_LIMITS.minimumBreakOverSixHoursMinutes;
  }

  return 0;
}

/**
 * Check whether the activity timeline contains
 * more than six consecutive hours of working time.
 *
 * Driving and Other Work increase the working-time
 * counter.
 *
 * A qualifying break of at least 15 minutes resets
 * the counter.
 *
 * Rest also resets the counter.
 *
 * POA does not increase the working-time counter,
 * but is deliberately not treated here as a
 * qualifying WTD break.
 */
export function checkConsecutiveWtdWorkingTime(day: DriverDay): WtdRuleResult {
  const issues: DailyComplianceIssue[] = [];

  const activities = [...day.activities].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  let consecutiveWorkingMinutes = 0;

  for (const activity of activities) {
    const isWorkingActivity =
      activity.type === "driving" || activity.type === "otherWork";

    if (isWorkingActivity) {
      consecutiveWorkingMinutes += activity.durationMinutes;

      if (consecutiveWorkingMinutes > WTD_LIMITS.sixHourThresholdMinutes) {
        const excess =
          consecutiveWorkingMinutes - WTD_LIMITS.sixHourThresholdMinutes;

        issues.push({
          id: `${day.id}-wtd-consecutive-working-breach`,
          date: day.date,
          rule: "working-time-break",
          level: "breach",
          title: "Six-hour working-time limit exceeded",
          description:
            `More than six consecutive hours of working time ` +
            `were recorded without a qualifying break. ` +
            `The consecutive working period exceeded six hours ` +
            `by ${excess} minutes.`,
          varianceMinutes: excess,
        });

        return {
          level: "breach",
          issues,
        };
      }

      continue;
    }

    if (
      activity.type === "break" &&
      activity.durationMinutes >= WTD_LIMITS.minimumBreakSegmentMinutes
    ) {
      consecutiveWorkingMinutes = 0;
      continue;
    }

    if (activity.type === "rest") {
      consecutiveWorkingMinutes = 0;
    }
  }

  return {
    level: "good",
    issues,
  };
}

/**
 * Evaluate the daily WTD break requirements.
 *
 * Two separate protections are combined:
 *
 * 1. No more than six consecutive hours of
 *    working time without a qualifying break.
 *
 * 2. Required total qualifying break time based
 *    on the day's total working time.
 */
export function checkDailyWtdBreaks(day: DriverDay): WtdRuleResult {
  const issues: DailyComplianceIssue[] = [];
  let level: ComplianceLevel = "good";

  const consecutiveResult = checkConsecutiveWtdWorkingTime(day);

  issues.push(...consecutiveResult.issues);

  level = getWorstLevel(level, consecutiveResult.level);

  const workingMinutes = getDailyWorkingMinutes(day);

  const requiredBreakMinutes = getRequiredWtdBreakMinutes(workingMinutes);

  if (requiredBreakMinutes === 0) {
    return {
      level,
      issues,
    };
  }

  const qualifyingBreakMinutes = getQualifyingWtdBreakMinutes(day);

  if (qualifyingBreakMinutes < requiredBreakMinutes) {
    const shortfall = requiredBreakMinutes - qualifyingBreakMinutes;

    issues.push({
      id: `${day.id}-wtd-break-breach`,
      date: day.date,
      rule: "working-time-break",
      level: "breach",
      title: "Insufficient working-time break",
      description:
        `Working time was ${workingMinutes} minutes. ` +
        `At least ${requiredBreakMinutes} minutes of qualifying ` +
        `break was required, but only ${qualifyingBreakMinutes} ` +
        `minutes was recorded.`,
      varianceMinutes: shortfall,
    });

    level = getWorstLevel(level, "breach");
  }

  return {
    level,
    issues,
  };
}

/**
 * Check the maximum working time in a single week.
 */
export function checkWeeklyWorkingTime(days: DriverDay[]): WtdRuleResult {
  const issues: DailyComplianceIssue[] = [];
  let level: ComplianceLevel = "good";

  const totalWorkingMinutes = days.reduce(
    (total, day) => total + getDailyWorkingMinutes(day),
    0,
  );

  if (totalWorkingMinutes > WTD_LIMITS.maxWeeklyWorkingMinutes) {
    const excess = totalWorkingMinutes - WTD_LIMITS.maxWeeklyWorkingMinutes;

    issues.push({
      id: "weekly-working-time-breach",
      date: days[days.length - 1]?.date ?? "",
      rule: "weekly-working-time",
      level: "breach",
      title: "Weekly working-time limit exceeded",
      description:
        `Working time exceeded the 60-hour weekly maximum ` +
        `by ${excess} minutes.`,
      varianceMinutes: excess,
    });

    level = "breach";
  }

  return {
    level,
    issues,
  };
}

/**
 * Calculate rolling average weekly working time.
 *
 * Each array element represents one week's
 * total working minutes.
 */
export function calculateRollingWtdAverage(
  weeklyWorkingMinutes: number[],
  referencePeriodWeeks: number = WTD_LIMITS.defaultReferencePeriodWeeks,
): RollingWtdResult {
  const weeks = weeklyWorkingMinutes.slice(-referencePeriodWeeks);

  const totalWorkingMinutes = weeks.reduce(
    (total, minutes) => total + minutes,
    0,
  );

  const numberOfWeeks = weeks.length;

  const averageWeeklyWorkingMinutes =
    numberOfWeeks > 0 ? totalWorkingMinutes / numberOfWeeks : 0;

  let level: ComplianceLevel = "good";

  if (averageWeeklyWorkingMinutes > WTD_LIMITS.maxAverageWeeklyWorkingMinutes) {
    level = "breach";
  } else if (averageWeeklyWorkingMinutes >= 45 * 60) {
    /**
     * TachoTrack warning band.
     *
     * This is not itself a legal breach.
     * It provides an early warning that
     * the rolling average is approaching 48h.
     */
    level = "warning";
  }

  return {
    averageWeeklyWorkingMinutes,
    totalWorkingMinutes,
    numberOfWeeks,
    level,
  };
}

export function checkRollingWtdAverage(
  weeklyWorkingMinutes: number[],
  referencePeriodWeeks: number = WTD_LIMITS.defaultReferencePeriodWeeks,
): WtdRuleResult {
  const issues: DailyComplianceIssue[] = [];
  let level: ComplianceLevel = "good";

  const result = calculateRollingWtdAverage(
    weeklyWorkingMinutes,
    referencePeriodWeeks,
  );

  if (result.level === "breach") {
    const excess =
      result.averageWeeklyWorkingMinutes -
      WTD_LIMITS.maxAverageWeeklyWorkingMinutes;

    issues.push({
      id: "rolling-wtd-average-breach",
      date: "",
      rule: "weekly-working-time",
      level: "breach",
      title: "Average weekly working time exceeded",
      description:
        `Average weekly working time exceeded 48 hours ` +
        `over the reference period by approximately ` +
        `${Math.round(excess)} minutes per week.`,
      varianceMinutes: Math.round(excess),
    });

    level = "breach";
  }

  if (result.level === "warning") {
    issues.push({
      id: "rolling-wtd-average-warning",
      date: "",
      rule: "weekly-working-time",
      level: "warning",
      title: "Average working time approaching limit",
      description:
        `Average weekly working time is approaching ` + `the 48-hour limit.`,
      varianceMinutes: Math.round(result.averageWeeklyWorkingMinutes - 45 * 60),
    });

    level = getWorstLevel(level, "warning");
  }

  return {
    level,
    issues,
  };
}

export function evaluateDailyWtdRules(day: DriverDay): WtdRuleResult {
  const breakResult = checkDailyWtdBreaks(day);

  let level: ComplianceLevel = "good";

  level = getWorstLevel(level, breakResult.level);

  return {
    level,
    issues: [...breakResult.issues],
  };
}

export function evaluateWeeklyWtdRules(days: DriverDay[]): WtdRuleResult {
  const weeklyWorking = checkWeeklyWorkingTime(days);

  let level: ComplianceLevel = "good";

  level = getWorstLevel(level, weeklyWorking.level);

  return {
    level,
    issues: [...weeklyWorking.issues],
  };
}
