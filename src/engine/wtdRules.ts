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
   * 6–9 hours working:
   * minimum total break = 30 minutes.
   *
   * More than 9 hours working:
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
   * We will later make night-work handling
   * configurable because agreements can modify this.
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
 * Working time for road transport WTD purposes.
 *
 * Driving + Other Work count as working time.
 *
 * POA, qualifying breaks and rest are not included
 * in this simple working-time total.
 */
export function getDailyWorkingMinutes(day: DriverDay): number {
  return day.drivingMinutes + day.otherWorkMinutes;
}

/**
 * Returns qualifying WTD break minutes.
 *
 * Only break periods of at least 15 minutes
 * are counted here.
 *
 * We deliberately use the activity timeline
 * rather than day.breakMinutes so that later
 * we can distinguish valid and invalid breaks.
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
 * Determine how much WTD break is required
 * from the amount of working time performed.
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

export function checkDailyWtdBreaks(day: DriverDay): WtdRuleResult {
  const issues: DailyComplianceIssue[] = [];
  let level: ComplianceLevel = "good";

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

    level = "breach";
  }

  return {
    level,
    issues,
  };
}

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
  referencePeriodWeeks = WTD_LIMITS.defaultReferencePeriodWeeks,
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
     * It gives the driver an early warning
     * that the rolling average is approaching 48h.
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
  referencePeriodWeeks = WTD_LIMITS.defaultReferencePeriodWeeks,
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
