import type { ComplianceLevel, DailyComplianceIssue, DriverDay } from "./types";

export const DRIVING_LIMITS = {
  continuousDrivingMinutes: 4 * 60 + 30, // 4h 30m
  requiredBreakMinutes: 45,

  standardDailyDrivingMinutes: 9 * 60, // 9h
  extendedDailyDrivingMinutes: 10 * 60, // 10h
  maxExtendedDrivingDaysPerWeek: 2,

  weeklyDrivingMinutes: 56 * 60, // 56h
  fortnightlyDrivingMinutes: 90 * 60, // 90h
} as const;

export interface DrivingRuleResult {
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

export function checkDailyDrivingLimit(day: DriverDay): DrivingRuleResult {
  const issues: DailyComplianceIssue[] = [];
  let level: ComplianceLevel = "good";

  const driving = day.drivingMinutes;

  if (driving > DRIVING_LIMITS.extendedDailyDrivingMinutes) {
    const excess = driving - DRIVING_LIMITS.extendedDailyDrivingMinutes;

    issues.push({
      id: `${day.id}-daily-driving-breach`,
      date: day.date,
      rule: "daily-driving",
      level: "breach",
      title: "Daily driving limit exceeded",
      description: `Daily driving exceeded the 10-hour maximum by ${excess} minutes.`,
      varianceMinutes: excess,
    });

    level = "breach";

    return {
      level,
      issues,
    };
  }

  if (driving > DRIVING_LIMITS.standardDailyDrivingMinutes) {
    const extension = driving - DRIVING_LIMITS.standardDailyDrivingMinutes;

    issues.push({
      id: `${day.id}-daily-driving-extension`,
      date: day.date,
      rule: "daily-driving",
      level: "warning",
      title: "Extended daily driving used",
      description:
        `Daily driving exceeded 9 hours by ${extension} minutes. ` +
        "This counts as one extended daily-driving day.",
      varianceMinutes: extension,
    });

    level = getWorstLevel(level, "warning");
  }

  return {
    level,
    issues,
  };
}

export function checkContinuousDriving(day: DriverDay): DrivingRuleResult {
  const issues: DailyComplianceIssue[] = [];
  let level: ComplianceLevel = "good";

  let drivingSinceReset = 0;

  /**
   * Tracks whether the first part of a valid
   * 15 + 30 split break has been completed.
   */
  let firstSplitBreakTaken = false;

  const sortedActivities = [...day.activities].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  for (const activity of sortedActivities) {
    if (activity.type === "driving") {
      drivingSinceReset += activity.durationMinutes;

      if (drivingSinceReset > DRIVING_LIMITS.continuousDrivingMinutes) {
        const excess =
          drivingSinceReset - DRIVING_LIMITS.continuousDrivingMinutes;

        issues.push({
          id: `${day.id}-continuous-driving-` + `${activity.id}`,

          date: day.date,

          rule: "continuous-driving",

          level: "breach",

          title: "Continuous driving limit exceeded",

          description:
            `Continuous driving exceeded ` + `4h 30m by ${excess} minutes.`,

          varianceMinutes: excess,
        });

        level = "breach";

        break;
      }

      continue;
    }

    if (activity.type !== "break") {
      continue;
    }

    const breakMinutes = activity.durationMinutes;

    /**
     * A single uninterrupted break of
     * at least 45 minutes resets the
     * continuous-driving clock.
     */
    if (breakMinutes >= DRIVING_LIMITS.requiredBreakMinutes) {
      drivingSinceReset = 0;
      firstSplitBreakTaken = false;

      continue;
    }

    /**
     * First part of a split break:
     *
     * at least 15 minutes.
     *
     * A 15-minute first part DOES NOT
     * reset the driving clock.
     */
    if (!firstSplitBreakTaken && breakMinutes >= 15) {
      firstSplitBreakTaken = true;

      continue;
    }

    /**
     * Second part of a split break:
     *
     * at least 30 minutes and taken
     * after the qualifying first part.
     *
     * Once this has been completed,
     * the 4h30 driving period resets.
     */
    if (firstSplitBreakTaken && breakMinutes >= 30) {
      drivingSinceReset = 0;
      firstSplitBreakTaken = false;

      continue;
    }
  }

  return {
    level,
    issues,
  };
}

export function checkExtendedDrivingUsage(
  days: DriverDay[],
): DrivingRuleResult {
  const issues: DailyComplianceIssue[] = [];
  let level: ComplianceLevel = "good";

  const extendedDays = days.filter(
    (day) =>
      day.drivingMinutes > DRIVING_LIMITS.standardDailyDrivingMinutes &&
      day.drivingMinutes <= DRIVING_LIMITS.extendedDailyDrivingMinutes,
  );

  if (extendedDays.length > DRIVING_LIMITS.maxExtendedDrivingDaysPerWeek) {
    const excessDays =
      extendedDays.length - DRIVING_LIMITS.maxExtendedDrivingDaysPerWeek;

    const lastExtendedDay = extendedDays[extendedDays.length - 1];

    issues.push({
      id: `week-extended-driving-breach`,
      date: lastExtendedDay?.date ?? "",
      rule: "daily-driving",
      level: "breach",
      title: "Too many extended driving days",
      description:
        `The 10-hour daily driving extension was used ` +
        `${extendedDays.length} times this week. ` +
        `The weekly maximum is ` +
        `${DRIVING_LIMITS.maxExtendedDrivingDaysPerWeek}.`,
      varianceMinutes: excessDays,
    });

    level = "breach";
  }

  return {
    level,
    issues,
  };
}

export function checkWeeklyDrivingLimit(days: DriverDay[]): DrivingRuleResult {
  const issues: DailyComplianceIssue[] = [];
  let level: ComplianceLevel = "good";

  const totalDriving = days.reduce(
    (total, day) => total + day.drivingMinutes,
    0,
  );

  if (totalDriving > DRIVING_LIMITS.weeklyDrivingMinutes) {
    const excess = totalDriving - DRIVING_LIMITS.weeklyDrivingMinutes;

    issues.push({
      id: "weekly-driving-breach",
      date: days[days.length - 1]?.date ?? "",
      rule: "weekly-driving",
      level: "breach",
      title: "Weekly driving limit exceeded",
      description: `Weekly driving exceeded 56 hours by ${excess} minutes.`,
      varianceMinutes: excess,
    });

    level = "breach";
  }

  return {
    level,
    issues,
  };
}

export function checkFortnightlyDrivingLimit(
  currentWeek: DriverDay[],
  previousWeek: DriverDay[],
): DrivingRuleResult {
  const issues: DailyComplianceIssue[] = [];
  let level: ComplianceLevel = "good";

  const currentDriving = currentWeek.reduce(
    (total, day) => total + day.drivingMinutes,
    0,
  );

  const previousDriving = previousWeek.reduce(
    (total, day) => total + day.drivingMinutes,
    0,
  );

  const fortnightTotal = currentDriving + previousDriving;

  if (fortnightTotal > DRIVING_LIMITS.fortnightlyDrivingMinutes) {
    const excess = fortnightTotal - DRIVING_LIMITS.fortnightlyDrivingMinutes;

    issues.push({
      id: "fortnightly-driving-breach",
      date: currentWeek[currentWeek.length - 1]?.date ?? "",
      rule: "fortnightly-driving",
      level: "breach",
      title: "Fortnightly driving limit exceeded",
      description:
        `Driving over the two consecutive weeks exceeded ` +
        `90 hours by ${excess} minutes.`,
      varianceMinutes: excess,
    });

    level = "breach";
  }

  return {
    level,
    issues,
  };
}

export function evaluateDailyDrivingRules(day: DriverDay): DrivingRuleResult {
  const dailyLimit = checkDailyDrivingLimit(day);

  const continuousDriving = checkContinuousDriving(day);

  const issues = [...dailyLimit.issues, ...continuousDriving.issues];

  let level: ComplianceLevel = "good";

  level = getWorstLevel(level, dailyLimit.level);

  level = getWorstLevel(level, continuousDriving.level);

  return {
    level,
    issues,
  };
}
