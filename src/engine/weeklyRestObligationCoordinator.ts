import {
  createCompensationObligation,
  type WeeklyRestRecord,
} from "./weeklyRestHistory";

import {
  calculateCompensationDueDate,
  type WeeklyRestCompensationObligation,
} from "./weeklyRestCompensation";

/**
 * --------------------------------------------------
 * COORDINATOR INPUT
 * --------------------------------------------------
 */
export interface CoordinateWeeklyRestObligationInput {
  /**
   * Already-classified weekly-rest record.
   */
  weeklyRest: WeeklyRestRecord;

  /**
   * ISO week number that produced the
   * compensation obligation.
   */
  sourceWeekNumber: number;

  /**
   * Reference date for the source week.
   *
   * YYYY-MM-DD
   */
  sourceWeekReferenceDate: string;

  /**
   * Date used to determine whether the
   * obligation is currently overdue.
   *
   * YYYY-MM-DD
   */
  currentDate: string;

  /**
   * @deprecated Compatibility input only.
   *
   * This value is deliberately ignored because
   * compensation must be verified from one
   * qualifying continuous rest allocation.
   */
  satisfiedMinutes?: number;
}

/**
 * --------------------------------------------------
 * COORDINATED OBLIGATION
 * --------------------------------------------------
 *
 * The canonical fields come from
 * WeeklyRestCompensationObligation.
 *
 * The compatibility fields below are
 * temporarily retained so our existing
 * coordinator tests and older engine
 * consumers continue to work while we
 * migrate everything to one vocabulary.
 */
export interface CoordinatedWeeklyRestObligation extends WeeklyRestCompensationObligation {
  /**
   * Original weekly-rest record.
   */
  sourceWeeklyRestId: string;

  /**
   * Original end timestamp of the
   * reduced weekly rest.
   */
  sourceRestEnd: string;

  /**
   * ------------------------------------------------
   * TEMPORARY COMPATIBILITY ALIASES
   * ------------------------------------------------
   */

  requiredMinutes: number;

  satisfiedMinutes: number;

  deadline: string;

  overdue: boolean;

  calendarVisible: boolean;

  hasOutstandingCompensation: boolean;
}

export interface CoordinateWeeklyRestObligationResult {
  hasObligation: boolean;

  obligation: CoordinatedWeeklyRestObligation | null;
}
export function synchroniseCoordinatedWeeklyRestObligation(
  obligation: CoordinatedWeeklyRestObligation,
): CoordinatedWeeklyRestObligation {
  const hasOutstandingCompensation = obligation.remainingMinutes > 0;

  return {
    ...obligation,

    requiredMinutes: obligation.requiredCompensationMinutes,

    satisfiedMinutes: obligation.compensatedMinutes,

    deadline: obligation.dueDate,

    overdue: obligation.status === "overdue",

    calendarVisible: hasOutstandingCompensation,

    hasOutstandingCompensation,
  };
}

/**
 * --------------------------------------------------
 * DATE COMPARISON
 * --------------------------------------------------
 */
function timestampAtStartOfDay(date: string): number {
  return new Date(`${date}T00:00:00`).getTime();
}

function timestampAtEndOfDay(date: string): number {
  return new Date(`${date}T23:59:59`).getTime();
}

function isAfterDeadline(currentDate: string, deadline: string): boolean {
  return timestampAtStartOfDay(currentDate) > timestampAtEndOfDay(deadline);
}

/**
 * --------------------------------------------------
 * COORDINATOR
 * --------------------------------------------------
 *
 * Responsibilities:
 *
 * 1. Accept an already-classified weekly rest.
 *
 * 2. Confirm that the rest genuinely creates
 *    a compensation obligation.
 *
 * 3. Use the canonical weekly-rest
 *    compensation model.
 *
 * 4. Use the canonical compensation
 *    deadline calculator.
 *
 * 5. Apply/cap compensation already made.
 *
 * 6. Determine remaining compensation.
 *
 * 7. Determine current status.
 *
 * 8. Expose compatibility fields while
 *    older consumers are migrated.
 */
export function coordinateWeeklyRestObligation(
  input: CoordinateWeeklyRestObligationInput,
): CoordinateWeeklyRestObligationResult {
  /**
   * ------------------------------------------------
   * VALIDATE THROUGH WEEKLY-REST HISTORY
   * ------------------------------------------------
   *
   * We deliberately retain this call for now.
   *
   * weeklyRestHistory remains responsible for
   * deciding whether this particular classified
   * weekly rest creates a legitimate obligation.
   */
  const historyObligation = createCompensationObligation(input.weeklyRest);

  /**
   * Regular 45h+ weekly rest:
   *
   * no compensation obligation.
   */
  if (!historyObligation) {
    return {
      hasObligation: false,

      obligation: null,
    };
  }

  /**
   * ------------------------------------------------
   * CANONICAL REQUIRED COMPENSATION
   * ------------------------------------------------
   */
  const requiredCompensationMinutes =
    input.weeklyRest.compensationCreatedMinutes;

  /**
   * ------------------------------------------------
   * CANONICAL DEADLINE
   * ------------------------------------------------
   *
   * We now use the existing tested deadline
   * implementation from weeklyRestCompensation
   * instead of maintaining another deadline
   * calculation inside this coordinator.
   */
  const dueDate = calculateCompensationDueDate(input.sourceWeekReferenceDate);

  /**
   * ------------------------------------------------
   * COMPENSATION ALREADY MADE
   * ------------------------------------------------
   */
  /**
   * The coordinator creates obligations only.
   *
   * It must never manufacture legal compensation
   * from an unsupported numeric input. Verified
   * compensation is applied by the allocation engine.
   */
  const compensatedMinutes = 0;

  const remainingMinutes = requiredCompensationMinutes;

  /**
   * ------------------------------------------------
   * OVERDUE
   * ------------------------------------------------
   *
   * The deadline day itself remains valid.
   *
   * The obligation becomes overdue only
   * after that day has ended.
   */
  const overdue =
    remainingMinutes > 0 && isAfterDeadline(input.currentDate, dueDate);

  /**
   * ------------------------------------------------
   * CANONICAL STATUS
   * ------------------------------------------------
   */
  const status: WeeklyRestCompensationObligation["status"] = overdue
    ? "overdue"
    : "outstanding";

  const hasOutstandingCompensation = remainingMinutes > 0;

  /**
   * Active calendar warnings remain visible
   * while compensation is outstanding.
   *
   * Completed obligations remain available
   * to history/audit views but disappear
   * from active warning state.
   */
  const calendarVisible = hasOutstandingCompensation;

  /**
   * ------------------------------------------------
   * CANONICAL OBLIGATION
   * ------------------------------------------------
   */
  const obligation: CoordinatedWeeklyRestObligation = {
    /**
     * Canonical compensation fields.
     */
    id:
      `weekly-rest-comp-` +
      `${input.sourceWeekNumber}-` +
      `${input.sourceWeekReferenceDate}`,

    sourceWeekNumber: input.sourceWeekNumber,

    sourceDate: input.sourceWeekReferenceDate,

    weeklyRestMinutesTaken: input.weeklyRest.restMinutes,

    requiredCompensationMinutes,

    compensatedMinutes,

    remainingMinutes,

    dueDate,

    status,

    /**
     * Original weekly-rest provenance.
     */
    sourceWeeklyRestId: input.weeklyRest.id,

    sourceRestEnd: input.weeklyRest.restEnd,

    /**
     * ----------------------------------------------
     * TEMPORARY COMPATIBILITY ALIASES
     * ----------------------------------------------
     *
     * These deliberately mirror the canonical
     * values above.
     */
    requiredMinutes: requiredCompensationMinutes,

    satisfiedMinutes: compensatedMinutes,

    deadline: dueDate,

    overdue,

    calendarVisible,

    hasOutstandingCompensation,
  };

  return {
    hasObligation: true,

    obligation,
  };
}
