import type { ComplianceLevel, DailyComplianceIssue } from "./types";

export interface SplitDailyRestPeriod {
  /**
   * Start of the relevant 24-hour period.
   */
  referenceStart: string;

  /**
   * First qualifying rest period.
   */
  firstRestStart: string;
  firstRestEnd: string;

  /**
   * Second qualifying rest period.
   */
  secondRestStart: string;
  secondRestEnd: string;
}

export interface SplitDailyRestEvaluation {
  level: ComplianceLevel;

  firstRestMinutes: number;
  secondRestMinutes: number;

  firstPartQualifies: boolean;
  secondPartQualifies: boolean;

  correctOrder: boolean;

  completedWithin24Hours: boolean;

  twentyFourHourDeadline: string;

  validSplitDailyRest: boolean;

  issues: DailyComplianceIssue[];
}

export const SPLIT_DAILY_REST_LIMITS = {
  firstPartMinimumMinutes: 3 * 60, // 3h
  secondPartMinimumMinutes: 9 * 60, // 9h
  referencePeriodMinutes: 24 * 60,
} as const;

function toTimestamp(dateTime: string): number {
  return new Date(dateTime).getTime();
}

function differenceMinutes(start: string, end: string): number {
  return Math.max(
    0,
    Math.floor((toTimestamp(end) - toTimestamp(start)) / (60 * 1000)),
  );
}

function addMinutes(dateTime: string, minutes: number): string {
  return new Date(toTimestamp(dateTime) + minutes * 60 * 1000).toISOString();
}

export function calculateSplitDailyRestDeadline(
  referenceStart: string,
): string {
  return addMinutes(
    referenceStart,
    SPLIT_DAILY_REST_LIMITS.referencePeriodMinutes,
  );
}

export function evaluateSplitDailyRest(
  period: SplitDailyRestPeriod,
): SplitDailyRestEvaluation {
  const issues: DailyComplianceIssue[] = [];

  const firstRestMinutes = differenceMinutes(
    period.firstRestStart,
    period.firstRestEnd,
  );

  const secondRestMinutes = differenceMinutes(
    period.secondRestStart,
    period.secondRestEnd,
  );

  const firstPartQualifies =
    firstRestMinutes >= SPLIT_DAILY_REST_LIMITS.firstPartMinimumMinutes;

  const secondPartQualifies =
    secondRestMinutes >= SPLIT_DAILY_REST_LIMITS.secondPartMinimumMinutes;

  const correctOrder =
    toTimestamp(period.firstRestStart) < toTimestamp(period.firstRestEnd) &&
    toTimestamp(period.firstRestEnd) <= toTimestamp(period.secondRestStart) &&
    toTimestamp(period.secondRestStart) < toTimestamp(period.secondRestEnd);

  const twentyFourHourDeadline = calculateSplitDailyRestDeadline(
    period.referenceStart,
  );

  const completedWithin24Hours =
    toTimestamp(period.secondRestEnd) <= toTimestamp(twentyFourHourDeadline);

  if (!firstPartQualifies) {
    const shortfall =
      SPLIT_DAILY_REST_LIMITS.firstPartMinimumMinutes - firstRestMinutes;

    issues.push({
      id: `split-daily-rest-first-part-` + period.referenceStart,

      date: period.referenceStart.slice(0, 10),

      rule: "daily-rest",

      level: "breach",

      title: "First split daily-rest period too short",

      description:
        `The first split daily-rest period was ` +
        `${firstRestMinutes} minutes. At least ` +
        `${SPLIT_DAILY_REST_LIMITS.firstPartMinimumMinutes} ` +
        `minutes are required.`,

      varianceMinutes: Math.max(0, shortfall),
    });
  }

  if (!secondPartQualifies) {
    const shortfall =
      SPLIT_DAILY_REST_LIMITS.secondPartMinimumMinutes - secondRestMinutes;

    issues.push({
      id: `split-daily-rest-second-part-` + period.referenceStart,

      date: period.referenceStart.slice(0, 10),

      rule: "daily-rest",

      level: "breach",

      title: "Second split daily-rest period too short",

      description:
        `The second split daily-rest period was ` +
        `${secondRestMinutes} minutes. At least ` +
        `${SPLIT_DAILY_REST_LIMITS.secondPartMinimumMinutes} ` +
        `minutes are required.`,

      varianceMinutes: Math.max(0, shortfall),
    });
  }

  if (!correctOrder) {
    issues.push({
      id: `split-daily-rest-order-` + period.referenceStart,

      date: period.referenceStart.slice(0, 10),

      rule: "daily-rest",

      level: "breach",

      title: "Split daily-rest periods are in the wrong order",

      description:
        "A split daily rest must consist of a qualifying first period followed by a qualifying second period.",

      varianceMinutes: 0,
    });
  }

  if (!completedWithin24Hours) {
    const minutesLate = differenceMinutes(
      twentyFourHourDeadline,
      period.secondRestEnd,
    );

    issues.push({
      id: `split-daily-rest-24h-` + period.referenceStart,

      date: period.referenceStart.slice(0, 10),

      rule: "daily-rest",

      level: "breach",

      title: "Split daily rest completed too late",

      description:
        `The second split daily-rest period ended ` +
        `${minutesLate} minutes after the 24-hour deadline.`,

      varianceMinutes: minutesLate,
    });
  }

  const validSplitDailyRest =
    firstPartQualifies &&
    secondPartQualifies &&
    correctOrder &&
    completedWithin24Hours;

  const level: ComplianceLevel = validSplitDailyRest ? "good" : "breach";

  return {
    level,

    firstRestMinutes,
    secondRestMinutes,

    firstPartQualifies,
    secondPartQualifies,

    correctOrder,

    completedWithin24Hours,

    twentyFourHourDeadline,

    validSplitDailyRest,

    issues,
  };
}
