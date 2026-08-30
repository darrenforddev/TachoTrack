import type { ComplianceLevel, DailyComplianceIssue } from "./types";

export type WeeklyRestCompensationStatus =
  | "outstanding"
  | "partially-compensated"
  | "completed"
  | "overdue";

export interface WeeklyRestCompensationObligation {
  id: string;

  /**
   * Week in which the reduced weekly rest occurred.
   */
  sourceWeekNumber: number;

  /**
   * Reference date for the reduced weekly rest.
   * YYYY-MM-DD
   */
  sourceDate: string;

  /**
   * Weekly rest actually taken.
   */
  weeklyRestMinutesTaken: number;

  /**
   * Amount missing from the normal 45h weekly rest.
   */
  requiredCompensationMinutes: number;

  /**
   * Amount already compensated.
   */
  compensatedMinutes: number;

  /**
   * Amount still outstanding.
   */
  remainingMinutes: number;

  /**
   * Deadline by which compensation must be completed.
   * YYYY-MM-DD
   */
  dueDate: string;

  status: WeeklyRestCompensationStatus;
}

export interface WeeklyRestCompensationResult {
  level: ComplianceLevel;

  obligation?: WeeklyRestCompensationObligation;

  issues: DailyComplianceIssue[];
}

export const WEEKLY_REST_COMPENSATION_LIMITS = {
  regularWeeklyRestMinutes: 45 * 60,

  reducedWeeklyRestMinimumMinutes: 24 * 60,

  /**
   * Compensation must be made up
   * before the end of the third week
   * following the week in question.
   */
  compensationDeadlineWeeks: 3,
} as const;

/**
 * Calculates the compensation deadline.
 *
 * For now we use the source date + 21 days
 * as the engine representation of
 * "before the end of the third week following".
 *
 * Later we can refine this around ISO-week
 * boundaries once the multi-week history
 * engine is in place.
 */
export function calculateCompensationDueDate(sourceDate: string): string {
  const source = new Date(`${sourceDate}T12:00:00`);

  /**
   * JavaScript:
   * Sunday = 0
   * Monday = 1
   * ...
   * Saturday = 6
   *
   * Find the Sunday at the end of the
   * calendar week containing sourceDate.
   */
  const dayOfWeek = source.getDay();

  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

  const endOfSourceWeek = new Date(source);

  endOfSourceWeek.setDate(source.getDate() + daysUntilSunday);

  /**
   * Compensation must be taken before
   * the end of the third week following
   * the week in question.
   *
   * Therefore:
   *
   * source week's Sunday
   *       +
   * 3 complete weeks
   */
  endOfSourceWeek.setDate(
    endOfSourceWeek.getDate() +
      WEEKLY_REST_COMPENSATION_LIMITS.compensationDeadlineWeeks * 7,
  );

  const year = endOfSourceWeek.getFullYear();

  const month = String(endOfSourceWeek.getMonth() + 1).padStart(2, "0");

  const day = String(endOfSourceWeek.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function createWeeklyRestCompensationObligation(
  sourceWeekNumber: number,
  sourceDate: string,
  weeklyRestMinutesTaken: number,
): WeeklyRestCompensationResult {
  const issues: DailyComplianceIssue[] = [];

  /**
   * If at least 45h was taken,
   * no compensation obligation exists.
   */
  if (
    weeklyRestMinutesTaken >=
    WEEKLY_REST_COMPENSATION_LIMITS.regularWeeklyRestMinutes
  ) {
    return {
      level: "good",
      issues,
    };
  }

  /**
   * If below 24h, this is not merely
   * a reduced weekly rest.
   * It is already a breach.
   */
  if (
    weeklyRestMinutesTaken <
    WEEKLY_REST_COMPENSATION_LIMITS.reducedWeeklyRestMinimumMinutes
  ) {
    const shortfall =
      WEEKLY_REST_COMPENSATION_LIMITS.reducedWeeklyRestMinimumMinutes -
      weeklyRestMinutesTaken;

    issues.push({
      id: `weekly-rest-below-minimum-` + `${sourceWeekNumber}-${sourceDate}`,

      date: sourceDate,

      rule: "weekly-rest",

      level: "breach",

      title: "Weekly rest below reduced minimum",

      description:
        `Weekly rest was below the 24-hour reduced ` +
        `weekly-rest minimum by ${shortfall} minutes.`,

      varianceMinutes: shortfall,
    });

    return {
      level: "breach",
      issues,
    };
  }

  const requiredCompensationMinutes =
    WEEKLY_REST_COMPENSATION_LIMITS.regularWeeklyRestMinutes -
    weeklyRestMinutesTaken;

  const dueDate = calculateCompensationDueDate(sourceDate);

  const obligation: WeeklyRestCompensationObligation = {
    id: `weekly-rest-comp-` + `${sourceWeekNumber}-${sourceDate}`,

    sourceWeekNumber,

    sourceDate,

    weeklyRestMinutesTaken,

    requiredCompensationMinutes,

    compensatedMinutes: 0,

    remainingMinutes: requiredCompensationMinutes,

    dueDate,

    status: "outstanding",
  };

  issues.push({
    id:
      `weekly-rest-compensation-required-` +
      `${sourceWeekNumber}-${sourceDate}`,

    date: sourceDate,

    rule: "weekly-rest",

    level: "warning",

    title: "Weekly rest compensation required",

    description:
      `Reduced weekly rest created ` +
      `${requiredCompensationMinutes} minutes ` +
      `of compensation due by ${dueDate}.`,

    varianceMinutes: requiredCompensationMinutes,
  });

  return {
    level: "warning",
    obligation,
    issues,
  };
}

export function getWeeklyRestCompensationStatus(
  obligation: WeeklyRestCompensationObligation,
  currentDate: string,
): WeeklyRestCompensationObligation {
  if (obligation.status === "completed") {
    return obligation;
  }

  const current = new Date(`${currentDate}T00:00:00`).getTime();

  const due = new Date(`${obligation.dueDate}T23:59:59`).getTime();

  if (current > due && obligation.remainingMinutes > 0) {
    return {
      ...obligation,
      status: "overdue",
    };
  }

  return obligation;
}

export function evaluateWeeklyRestCompensation(
  obligation: WeeklyRestCompensationObligation,
  currentDate: string,
): WeeklyRestCompensationResult {
  const updated = getWeeklyRestCompensationStatus(obligation, currentDate);

  const issues: DailyComplianceIssue[] = [];

  if (updated.status === "overdue") {
    issues.push({
      id: `${updated.id}-overdue`,

      date: currentDate,

      rule: "weekly-rest",

      level: "breach",

      title: "Weekly rest compensation overdue",

      description:
        `${updated.remainingMinutes} minutes of ` +
        `weekly-rest compensation remained outstanding ` +
        `after the due date of ${updated.dueDate}.`,

      varianceMinutes: updated.remainingMinutes,
    });

    return {
      level: "breach",
      obligation: updated,
      issues,
    };
  }

  if (
    updated.status === "outstanding" ||
    updated.status === "partially-compensated"
  ) {
    issues.push({
      id: `${updated.id}-outstanding`,

      date: currentDate,

      rule: "weekly-rest",

      level: "warning",

      title: "Weekly rest compensation outstanding",

      description:
        `${updated.remainingMinutes} minutes remain ` +
        `to be compensated by ${updated.dueDate}.`,

      varianceMinutes: updated.remainingMinutes,
    });

    return {
      level: "warning",
      obligation: updated,
      issues,
    };
  }

  return {
    level: "good",
    obligation: updated,
    issues,
  };
}
