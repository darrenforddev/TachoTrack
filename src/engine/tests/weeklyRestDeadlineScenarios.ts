import { calculateCompensationDueDate } from "../weeklyRestCompensation";

type DeadlineScenario = {
  name: string;
  sourceDate: string;
  expectedDueDate: string;
  actualDueDate: string;
  passed: boolean;
};

function scenario(
  name: string,
  sourceDate: string,
  expectedDueDate: string,
): DeadlineScenario {
  const actualDueDate = calculateCompensationDueDate(sourceDate);

  return {
    name,
    sourceDate,
    expectedDueDate,
    actualDueDate,
    passed: actualDueDate === expectedDueDate,
  };
}

/**
 * Compensation deadline logic:
 *
 * 1. Find the Sunday at the end of the
 *    week containing the reduced weekly rest.
 *
 * 2. Move forward three complete weeks.
 *
 * 3. That Sunday is the final calendar date
 *    represented by this engine deadline.
 */

export const weeklyRestDeadlineScenarios: DeadlineScenario[] = [
  /**
   * Monday 24 Aug 2026
   *
   * Source week ends:
   * Sunday 30 Aug
   *
   * Third following week ends:
   * Sunday 20 Sep
   */
  scenario("Monday source date", "2026-08-24", "2026-09-20"),

  /**
   * Saturday within the same week.
   *
   * Must produce the same deadline
   * as Monday above.
   */
  scenario("Saturday source date", "2026-08-29", "2026-09-20"),

  /**
   * Sunday at the end of the source week.
   */
  scenario("Sunday source date", "2026-08-30", "2026-09-20"),

  /**
   * Month boundary.
   *
   * Monday 31 Aug 2026
   * Source week ends Sun 6 Sep.
   * Three following weeks end Sun 27 Sep.
   */
  scenario("Month boundary", "2026-08-31", "2026-09-27"),

  /**
   * End-of-year boundary.
   *
   * Monday 28 Dec 2026
   * Source week ends Sun 3 Jan 2027.
   *
   * Three weeks later:
   * Sun 24 Jan 2027.
   */
  scenario("December to January boundary", "2026-12-28", "2027-01-24"),

  /**
   * New Year's Eve in the same
   * source week as the scenario above.
   */
  scenario("New Year's Eve", "2026-12-31", "2027-01-24"),

  /**
   * Leap-year scenario.
   *
   * Thursday 29 Feb 2024
   * Source week ends Sun 3 Mar.
   *
   * Three weeks later:
   * Sun 24 Mar.
   */
  scenario("Leap year February", "2024-02-29", "2024-03-24"),

  /**
   * Source date itself is Sunday
   * immediately before a month changes.
   */
  scenario("Sunday month-end source", "2026-05-31", "2026-06-21"),

  /**
   * First day of a month.
   */
  scenario("First day of month", "2026-06-01", "2026-06-28"),

  /**
   * Christmas period / year crossover.
   */
  scenario("Christmas week", "2025-12-27", "2026-01-18"),
];

export const weeklyRestDeadlineSummary = {
  total: weeklyRestDeadlineScenarios.length,

  passed: weeklyRestDeadlineScenarios.filter((item) => item.passed).length,

  failed: weeklyRestDeadlineScenarios.filter((item) => !item.passed).length,

  allPassed: weeklyRestDeadlineScenarios.every((item) => item.passed),
};
