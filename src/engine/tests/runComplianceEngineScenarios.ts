import type { DriverDay } from "../types";

import { evaluateDriverDay, evaluateDriverWeek } from "../complianceEngine";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Compliance-engine scenario failed: ${message}`);
  }
}

function createDriverDay(overrides: Partial<DriverDay> = {}): DriverDay {
  return {
    id: "compliance-test-day",
    date: "2026-08-29",
    activities: [],

    drivingMinutes: 0,
    otherWorkMinutes: 0,
    breakMinutes: 0,
    poaMinutes: 0,
    restMinutes: 0,

    dailyRestType: "unknown",

    ...overrides,
  };
}

/**
 * --------------------------------------------------
 * SCENARIO 1
 * LIVE UNFINISHED DAY MUST NOT CREATE
 * A FALSE DAILY-REST BREACH
 * --------------------------------------------------
 *
 * The live dashboard builds today's DriverDay while
 * the shift is still in progress.
 *
 * restMinutes = 0 must therefore NOT be interpreted
 * as proof that the driver completed a day without
 * the required daily rest.
 *
 * Driving and WTD rules remain active.
 */
{
  const liveDay = createDriverDay({
    id: "live-unfinished-day",
    restMinutes: 0,
  });

  const result = evaluateDriverDay(liveDay, {
    isLiveDay: true,
  });

  const dailyRestIssues = result.issues.filter(
    (issue) => issue.rule === "daily-rest",
  );

  assert(
    dailyRestIssues.length === 0,
    "A live unfinished day with zero recorded rest must not manufacture a daily-rest breach.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 2
 * HISTORICAL COMPLETED DAY MUST STILL ENFORCE
 * THE DAILY-REST RULE
 * --------------------------------------------------
 *
 * Calling evaluateDriverDay without live mode keeps
 * the existing historical behaviour.
 *
 * A completed historical record with zero rest must
 * still produce a genuine daily-rest breach.
 */
{
  const historicalDay = createDriverDay({
    id: "historical-zero-rest-day",
    date: "2026-08-28",
    restMinutes: 0,
  });

  const result = evaluateDriverDay(historicalDay);

  const dailyRestIssues = result.issues.filter(
    (issue) => issue.rule === "daily-rest",
  );

  assert(
    dailyRestIssues.length > 0,
    "A historical day with zero recorded rest must still produce a daily-rest issue.",
  );

  assert(
    dailyRestIssues.some((issue) => issue.level === "breach"),
    "The historical zero-rest daily-rest issue must remain a breach.",
  );

  assert(
    result.level === "breach",
    "The historical day should retain breach-level compliance.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 3
 * WEEKLY EVALUATION CURRENTLY EXPOSES
 * THE LIVE-DAY REST PROBLEM
 * --------------------------------------------------
 *
 * A week can contain completed historical days plus
 * today's unfinished live day.
 *
 * Historical days must retain normal daily-rest
 * enforcement, while today's live day must eventually
 * be evaluated using live semantics.
 *
 * This scenario documents the behaviour we need
 * before changing evaluateDriverWeek().
 */
{
  const historicalDay = createDriverDay({
    id: "weekly-historical-day",
    date: "2026-08-28",
    restMinutes: 11 * 60,
    dailyRestType: "regular",
  });

  const liveDay = createDriverDay({
    id: "weekly-live-day",
    date: "2026-08-29",
    restMinutes: 0,
    dailyRestType: "unknown",
  });

  const week = {
    id: "live-week-test",
    weekNumber: 35,
    startDate: "2026-08-24",
    endDate: "2026-08-30",
    days: [historicalDay, liveDay],
  };

  const result = evaluateDriverWeek(week, {
    liveDate: "2026-08-29",
  });

  const liveDayResult = result.days.find((day) => day.date === "2026-08-29");

  assert(
    liveDayResult !== undefined,
    "The weekly result must contain today's live day.",
  );

  const liveDailyRestIssues =
    liveDayResult?.issues.filter((issue) => issue.rule === "daily-rest") ?? [];

  assert(
    liveDailyRestIssues.length === 0,
    "Today's unfinished live day must not create a daily-rest breach inside weekly compliance.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 4
 * LIVE-DAY MODE MUST NOT WEAKEN HISTORICAL DAYS
 * --------------------------------------------------
 *
 * Only the date explicitly identified as live may
 * bypass historical daily-rest evaluation.
 *
 * Earlier completed days in the same week must
 * continue to enforce the normal daily-rest rules.
 */
{
  const historicalBreachDay = createDriverDay({
    id: "weekly-historical-rest-breach",
    date: "2026-08-28",
    restMinutes: 0,
    dailyRestType: "unknown",
  });

  const liveDay = createDriverDay({
    id: "weekly-current-live-day",
    date: "2026-08-29",
    restMinutes: 0,
    dailyRestType: "unknown",
  });

  const week = {
    id: "historical-protection-test",
    weekNumber: 35,
    startDate: "2026-08-24",
    endDate: "2026-08-30",
    days: [historicalBreachDay, liveDay],
  };

  const result = evaluateDriverWeek(week, {
    liveDate: "2026-08-29",
  });

  const historicalResult = result.days.find((day) => day.date === "2026-08-28");

  const liveResult = result.days.find((day) => day.date === "2026-08-29");

  assert(
    historicalResult !== undefined,
    "The weekly result must contain the historical day.",
  );

  assert(
    liveResult !== undefined,
    "The weekly result must contain the live day.",
  );

  assert(
    historicalResult?.issues.some(
      (issue) => issue.rule === "daily-rest" && issue.level === "breach",
    ) === true,
    "The historical day must retain its genuine daily-rest breach.",
  );

  assert(
    liveResult?.issues.some((issue) => issue.rule === "daily-rest") === false,
    "The live unfinished day must not receive a premature daily-rest issue.",
  );
}

console.log("✓ Compliance-engine scenarios passed");
