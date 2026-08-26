import type { ComplianceLevel, DailyComplianceIssue } from "./types";

export type DailyRestClassification = "regular" | "reduced" | "insufficient";

export interface DailyRestPeriod {
  /**
   * ISO date/time string when the rest began.
   */
  restStart: string;

  /**
   * ISO date/time string when the rest ended.
   */
  restEnd: string;

  /**
   * The reference point that starts the
   * relevant 24-hour period.
   *
   * Usually the end of the previous
   * daily or weekly rest period.
   */
  referenceStart: string;
}

export interface DailyRestEvaluation {
  level: ComplianceLevel;

  classification: DailyRestClassification;

  restMinutes: number;

  completedWithin24Hours: boolean;

  twentyFourHourDeadline: string;

  issues: DailyComplianceIssue[];
}

export const DAILY_REST_LIMITS = {
  regularDailyRestMinutes: 11 * 60,
  reducedDailyRestMinutes: 9 * 60,
  referencePeriodMinutes: 24 * 60,
} as const;

function toTimestamp(dateTime: string): number {
  return new Date(dateTime).getTime();
}

function addMinutes(dateTime: string, minutes: number): string {
  return new Date(toTimestamp(dateTime) + minutes * 60 * 1000).toISOString();
}

function differenceMinutes(start: string, end: string): number {
  return Math.max(
    0,
    Math.floor((toTimestamp(end) - toTimestamp(start)) / (60 * 1000)),
  );
}

/**
 * Returns the end of the relevant
 * 24-hour period.
 */
export function calculateDailyRestDeadline(referenceStart: string): string {
  return addMinutes(referenceStart, DAILY_REST_LIMITS.referencePeriodMinutes);
}

/**
 * Classifies the duration of the
 * daily rest itself.
 */
export function classifyDailyRest(
  restMinutes: number,
): DailyRestClassification {
  if (restMinutes >= DAILY_REST_LIMITS.regularDailyRestMinutes) {
    return "regular";
  }

  if (restMinutes >= DAILY_REST_LIMITS.reducedDailyRestMinutes) {
    return "reduced";
  }

  return "insufficient";
}

export function evaluateDailyRestPeriod(
  period: DailyRestPeriod,
): DailyRestEvaluation {
  const issues: DailyComplianceIssue[] = [];

  const restMinutes = differenceMinutes(period.restStart, period.restEnd);

  const classification = classifyDailyRest(restMinutes);

  const twentyFourHourDeadline = calculateDailyRestDeadline(
    period.referenceStart,
  );

  const completedWithin24Hours =
    toTimestamp(period.restEnd) <= toTimestamp(twentyFourHourDeadline);

  let level: ComplianceLevel = "good";

  /**
   * ------------------------------------------------
   * REST DURATION
   * ------------------------------------------------
   */

  if (classification === "insufficient") {
    const shortfall = DAILY_REST_LIMITS.reducedDailyRestMinutes - restMinutes;

    issues.push({
      id: `daily-rest-duration-breach-` + period.referenceStart,

      date: period.referenceStart.slice(0, 10),

      rule: "daily-rest",

      level: "breach",

      title: "Daily rest below minimum",

      description:
        `Daily rest was ${restMinutes} minutes. ` +
        `This is ${shortfall} minutes below the ` +
        `9-hour reduced daily-rest minimum.`,

      varianceMinutes: shortfall,
    });

    level = "breach";
  }

  if (classification === "reduced") {
    const reduction = DAILY_REST_LIMITS.regularDailyRestMinutes - restMinutes;

    issues.push({
      id: `daily-rest-reduced-` + period.referenceStart,

      date: period.referenceStart.slice(0, 10),

      rule: "daily-rest",

      /**
       * TachoTrack uses WARNING here
       * to show that reduced daily rest
       * has been used.
       *
       * This is not itself a breach.
       */
      level: "warning",

      title: "Reduced daily rest used",

      description:
        `Daily rest was ${restMinutes} minutes, ` +
        `${reduction} minutes below the normal ` +
        `11-hour daily rest.`,

      varianceMinutes: reduction,
    });

    if (level !== "breach") {
      level = "warning";
    }
  }

  /**
   * ------------------------------------------------
   * 24-HOUR COMPLETION REQUIREMENT
   * ------------------------------------------------
   */

  if (!completedWithin24Hours) {
    const minutesLate = differenceMinutes(
      twentyFourHourDeadline,
      period.restEnd,
    );

    issues.push({
      id: `daily-rest-24h-breach-` + period.referenceStart,

      date: period.referenceStart.slice(0, 10),

      rule: "daily-rest",

      level: "breach",

      title: "Daily rest completed too late",

      description:
        `The qualifying daily rest ended ${minutesLate} ` +
        `minutes after the 24-hour deadline.`,

      varianceMinutes: minutesLate,
    });

    level = "breach";
  }

  return {
    level,

    classification,

    restMinutes,

    completedWithin24Hours,

    twentyFourHourDeadline,

    issues,
  };
}
