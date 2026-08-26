import type { WeeklyRestCompensationObligation } from "./weeklyRestCompensation";

import { calculateCompensationDueDate } from "./weeklyRestCompensation";

export type WeeklyRestType = "regular" | "reduced";

export interface WeeklyRestRecord {
  id: string;

  /**
   * Start/end of the weekly rest.
   */
  restStart: string;

  restEnd: string;

  /**
   * Duration derived from the timestamps.
   */
  restMinutes: number;

  type: WeeklyRestType;

  /**
   * If this was a reduced weekly rest,
   * this records how many minutes of
   * compensation were created.
   */
  compensationCreatedMinutes: number;
}

/**
 * --------------------------------------------------
 * HISTORY OBLIGATION
 * --------------------------------------------------
 *
 * WeeklyRestCompensationObligation from
 * weeklyRestCompensation.ts is now the
 * canonical compensation model.
 *
 * These additional fields preserve the
 * provenance used by the weekly-rest
 * history layer.
 */
export interface WeeklyRestHistoryObligation extends WeeklyRestCompensationObligation {
  /**
   * Weekly-rest record that created
   * this obligation.
   */
  sourceWeeklyRestId: string;

  /**
   * Exact end timestamp of the weekly
   * rest that created the obligation.
   */
  sourceRestEnd: string;
}

export interface WeeklyRestHistoryState {
  weeklyRests: WeeklyRestRecord[];

  obligations: WeeklyRestHistoryObligation[];

  totalOutstandingCompensationMinutes: number;

  hasOutstandingCompensation: boolean;
}

export const WEEKLY_REST_HISTORY_LIMITS = {
  regularWeeklyRestMinutes: 45 * 60,

  minimumReducedWeeklyRestMinutes: 24 * 60,
} as const;

/**
 * --------------------------------------------------
 * DATE / TIME HELPERS
 * --------------------------------------------------
 */

function timestamp(dateTime: string): number {
  return new Date(dateTime).getTime();
}

function differenceMinutes(start: string, end: string): number {
  const difference = timestamp(end) - timestamp(start);

  if (difference <= 0) {
    return 0;
  }

  return Math.floor(difference / (60 * 1000));
}

/**
 * --------------------------------------------------
 * DATE-ONLY VALUE
 * --------------------------------------------------
 *
 * Compensation obligations use YYYY-MM-DD
 * while weekly-rest history retains the
 * original timestamps.
 */
function dateOnly(dateTime: string): string {
  return dateTime.slice(0, 10);
}

/**
 * --------------------------------------------------
 * CLASSIFICATION
 * --------------------------------------------------
 */

export function classifyWeeklyRest(restMinutes: number): WeeklyRestType | null {
  if (restMinutes >= WEEKLY_REST_HISTORY_LIMITS.regularWeeklyRestMinutes) {
    return "regular";
  }

  if (
    restMinutes >= WEEKLY_REST_HISTORY_LIMITS.minimumReducedWeeklyRestMinutes
  ) {
    return "reduced";
  }

  return null;
}

/**
 * --------------------------------------------------
 * CREATE WEEKLY REST RECORD
 * --------------------------------------------------
 */

export function createWeeklyRestRecord(
  id: string,
  restStart: string,
  restEnd: string,
): WeeklyRestRecord | null {
  const restMinutes = differenceMinutes(restStart, restEnd);

  const type = classifyWeeklyRest(restMinutes);

  /**
   * Under 24 hours cannot be accepted
   * by this module as a qualifying
   * weekly rest.
   */
  if (!type) {
    return null;
  }

  const compensationCreatedMinutes =
    type === "reduced"
      ? WEEKLY_REST_HISTORY_LIMITS.regularWeeklyRestMinutes - restMinutes
      : 0;

  return {
    id,

    restStart,

    restEnd,

    restMinutes,

    type,

    compensationCreatedMinutes,
  };
}

/**
 * --------------------------------------------------
 * CREATE COMPENSATION OBLIGATION
 * --------------------------------------------------
 *
 * This now creates the canonical
 * WeeklyRestCompensationObligation shape
 * directly.
 */
export function createCompensationObligation(
  weeklyRest: WeeklyRestRecord,
): WeeklyRestHistoryObligation | null {
  if (
    weeklyRest.type !== "reduced" ||
    weeklyRest.compensationCreatedMinutes <= 0
  ) {
    return null;
  }

  const sourceDate = dateOnly(weeklyRest.restEnd);

  const requiredCompensationMinutes = weeklyRest.compensationCreatedMinutes;

  const dueDate = calculateCompensationDueDate(sourceDate);

  return {
    /**
     * Canonical compensation fields.
     */
    id: `weekly-rest-comp-history-` + `${weeklyRest.id}`,

    /**
     * History does not itself know the
     * ISO source-week number.
     *
     * The coordinator supplies the real
     * week number when promoting this
     * record into the coordinated layer.
     */
    sourceWeekNumber: 0,

    sourceDate,

    weeklyRestMinutesTaken: weeklyRest.restMinutes,

    requiredCompensationMinutes,

    compensatedMinutes: 0,

    remainingMinutes: requiredCompensationMinutes,

    dueDate,

    status: "outstanding",

    /**
     * Weekly-rest provenance.
     */
    sourceWeeklyRestId: weeklyRest.id,

    sourceRestEnd: weeklyRest.restEnd,
  };
}

/**
 * --------------------------------------------------
 * BUILD INITIAL HISTORY
 * --------------------------------------------------
 */

export function buildWeeklyRestHistory(
  weeklyRests: WeeklyRestRecord[],
): WeeklyRestHistoryState {
  const obligations = weeklyRests
    .map(createCompensationObligation)
    .filter(
      (obligation): obligation is WeeklyRestHistoryObligation =>
        obligation !== null,
    );

  const totalOutstandingCompensationMinutes = obligations.reduce(
    (total, obligation) => total + obligation.remainingMinutes,
    0,
  );

  return {
    weeklyRests,

    obligations,

    totalOutstandingCompensationMinutes,

    hasOutstandingCompensation: totalOutstandingCompensationMinutes > 0,
  };
}
