import type { ComplianceLevel, DailyComplianceIssue, DriverDay } from "./types";

export const REST_LIMITS = {
  regularDailyRestMinutes: 11 * 60, // 11h
  reducedDailyRestMinutes: 9 * 60, // 9h
  regularWeeklyRestMinutes: 45 * 60, // 45h
  reducedWeeklyRestMinutes: 24 * 60, // 24h
} as const;

export interface RestRuleResult {
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

export function checkDailyRest(day: DriverDay): RestRuleResult {
  const issues: DailyComplianceIssue[] = [];
  let level: ComplianceLevel = "good";

  const restMinutes = day.restMinutes;

  if (restMinutes < REST_LIMITS.reducedDailyRestMinutes) {
    const shortfall = REST_LIMITS.reducedDailyRestMinutes - restMinutes;

    issues.push({
      id: `${day.id}-daily-rest-breach`,
      date: day.date,
      rule: "daily-rest",
      level: "breach",
      title: "Daily rest too short",
      description: `Daily rest was below the 9-hour minimum by ${shortfall} minutes.`,
      varianceMinutes: shortfall,
    });

    return {
      level: "breach",
      issues,
    };
  }

  if (restMinutes < REST_LIMITS.regularDailyRestMinutes) {
    const reduction = REST_LIMITS.regularDailyRestMinutes - restMinutes;

    issues.push({
      id: `${day.id}-daily-rest-reduced`,
      date: day.date,
      rule: "daily-rest",
      level: "warning",
      title: "Reduced daily rest used",
      description: `Daily rest was ${restMinutes} minutes, which is below 11 hours but not below 9 hours.`,
      varianceMinutes: reduction,
    });

    level = getWorstLevel(level, "warning");
  }

  return {
    level,
    issues,
  };
}

export function checkWeeklyRestDuration(
  restMinutes: number,
  referenceDate: string,
): RestRuleResult {
  const issues: DailyComplianceIssue[] = [];
  let level: ComplianceLevel = "good";

  if (restMinutes < REST_LIMITS.reducedWeeklyRestMinutes) {
    const shortfall = REST_LIMITS.reducedWeeklyRestMinutes - restMinutes;

    issues.push({
      id: `weekly-rest-breach-${referenceDate}`,
      date: referenceDate,
      rule: "weekly-rest",
      level: "breach",
      title: "Weekly rest too short",
      description: `Weekly rest was below the 24-hour reduced weekly-rest minimum by ${shortfall} minutes.`,
      varianceMinutes: shortfall,
    });

    return {
      level: "breach",
      issues,
    };
  }

  if (restMinutes < REST_LIMITS.regularWeeklyRestMinutes) {
    const reduction = REST_LIMITS.regularWeeklyRestMinutes - restMinutes;

    issues.push({
      id: `weekly-rest-reduced-${referenceDate}`,
      date: referenceDate,
      rule: "weekly-rest",
      level: "warning",
      title: "Reduced weekly rest used",
      description: `Weekly rest was below 45 hours by ${reduction} minutes. Compensation will need to be tracked.`,
      varianceMinutes: reduction,
    });

    level = getWorstLevel(level, "warning");
  }

  return {
    level,
    issues,
  };
}

export function evaluateDailyRestRules(day: DriverDay): RestRuleResult {
  return checkDailyRest(day);
}
