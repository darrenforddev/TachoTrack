import type { RestSession } from "../../data/restSession";

import { calculateLegalRestRestartState } from "../legalRestRestartState";

import {
  evaluateReducedDailyRestHistory,
  type DailyRestHistoryEntry,
} from "../reducedDailyRestHistory";

function createRestSession(
  id: string,
  startedAt: string,
  endedAt: string | null,
): RestSession {
  const durationMilliseconds =
    endedAt === null
      ? null
      : Math.max(
          0,
          new Date(endedAt).getTime() - new Date(startedAt).getTime(),
        );

  return {
    id,
    type: "daily",
    startedAt,
    endedAt,
    durationMilliseconds,
    status: endedAt === null ? "active" : "completed",
  };
}

function createReducedHistory(reducedRestsUsed: number) {
  const history: DailyRestHistoryEntry[] = Array.from(
    { length: reducedRestsUsed },
    (_, index) => ({
      id: `reduced-${index + 1}`,
      date: `2026-08-${String(20 + index).padStart(2, "0")}`,
      type: "reduced-daily-rest",
    }),
  );

  return evaluateReducedDailyRestHistory(history);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Legal rest restart scenario failed: ${message}`);
  }
}

/**
 * --------------------------------------------------
 * SCENARIO 1
 * REDUCED AVAILABLE — 8H59
 * --------------------------------------------------
 */
{
  const currentRest = createRestSession(
    "current-rest",
    "2026-08-28T18:00:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T02:59:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [currentRest],
    createReducedHistory(0),
    "2026-08-28T06:00:00.000Z",
    now,
  );

  assert(
    result.route === "reduced-daily-rest",
    "Reduced rest should be the earliest route when allowance remains.",
  );

  assert(result.mayResumeWork === false, "Work must not resume at 8h59.");

  assert(
    result.remainingRestMinutes === 1,
    "Exactly one minute should remain at 8h59.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 2
 * REDUCED AVAILABLE — 9H00
 * --------------------------------------------------
 */
{
  const currentRest = createRestSession(
    "current-rest",
    "2026-08-28T18:00:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T03:00:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [currentRest],
    createReducedHistory(0),
    "2026-08-28T06:00:00.000Z",
    now,
  );

  assert(
    result.route === "reduced-daily-rest",
    "The 9-hour route should be reduced daily rest when no split first part exists.",
  );

  assert(
    result.mayResumeWork === true,
    "Work may resume once the valid 9-hour reduced rest has been achieved.",
  );

  assert(
    result.reducedRestWillBeUsed === true,
    "The 9-hour reduced route must indicate that a reduced-rest allowance will be used.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 3
 * ALL THREE REDUCED RESTS USED — 9H
 * --------------------------------------------------
 */
{
  const currentRest = createRestSession(
    "current-rest",
    "2026-08-28T18:00:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T03:00:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [currentRest],
    createReducedHistory(3),
    "2026-08-28T06:00:00.000Z",
    now,
  );

  assert(
    result.route === "regular-daily-rest",
    "Regular 11-hour rest should be required when the reduced allowance is exhausted.",
  );

  assert(
    result.mayResumeWork === false,
    "Nine hours must not permit restart when an 11-hour regular rest is required.",
  );

  assert(
    result.remainingRestMinutes === 120,
    "Two hours should remain after 9 hours when 11 hours are required.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 4
 * REGULAR REQUIRED — 10H59
 * --------------------------------------------------
 */
{
  const currentRest = createRestSession(
    "current-rest",
    "2026-08-28T18:00:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T04:59:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [currentRest],
    createReducedHistory(3),
    "2026-08-28T06:00:00.000Z",
    now,
  );

  assert(
    result.mayResumeWork === false,
    "Work must not resume at 10h59 when regular daily rest is required.",
  );

  assert(
    result.remainingRestMinutes === 1,
    "Exactly one minute should remain at 10h59.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 5
 * REGULAR REQUIRED — 11H00
 * --------------------------------------------------
 */
{
  const currentRest = createRestSession(
    "current-rest",
    "2026-08-28T18:00:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T05:00:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [currentRest],
    createReducedHistory(3),
    "2026-08-28T06:00:00.000Z",
    now,
  );

  assert(
    result.route === "regular-daily-rest",
    "The route should remain regular daily rest.",
  );

  assert(
    result.mayResumeWork === true,
    "Work may resume once the required 11-hour regular rest is complete.",
  );

  assert(
    result.reducedRestWillBeUsed === false,
    "Regular daily rest must not consume a reduced-rest allowance.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 6
 * VALID 3H FIRST PART + ACTIVE SECOND REST AT 9H
 * --------------------------------------------------
 */
{
  const firstRest = createRestSession(
    "split-first",
    "2026-08-28T09:00:00.000Z",
    "2026-08-28T12:00:00.000Z",
  );

  const currentRest = createRestSession(
    "split-second",
    "2026-08-28T18:00:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T03:00:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [firstRest, currentRest],
    createReducedHistory(0),
    "2026-08-28T06:00:00.000Z",
    now,
  );

  assert(
    result.route === "split-regular-daily-rest",
    "An earlier qualifying 3-hour rest should make the later 9-hour rest a split-regular route.",
  );

  assert(
    result.splitFirstPartAvailable === true,
    "The earlier qualifying split first part should be recognised.",
  );

  assert(
    result.mayResumeWork === true,
    "The 3h + 9h split should permit restart once the second part reaches 9 hours.",
  );

  assert(
    result.reducedRestWillBeUsed === false,
    "A valid split regular daily rest must preserve the reduced-rest allowance.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 7
 * SPLIT ROUTE WITH ALL REDUCED RESTS USED
 * --------------------------------------------------
 *
 * This is a particularly important scenario.
 *
 * The driver has no reduced daily rests remaining,
 * but has already completed a qualifying 3-hour
 * first split-rest part.
 *
 * The later 9-hour part can therefore complete
 * a SPLIT REGULAR daily rest.
 */
{
  const firstRest = createRestSession(
    "split-first",
    "2026-08-28T09:00:00.000Z",
    "2026-08-28T12:00:00.000Z",
  );

  const currentRest = createRestSession(
    "split-second",
    "2026-08-28T18:00:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T03:00:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [firstRest, currentRest],
    createReducedHistory(3),
    "2026-08-28T06:00:00.000Z",
    now,
  );

  assert(
    result.reducedRestAvailable === false,
    "The reduced-rest allowance should be exhausted.",
  );

  assert(
    result.route === "split-regular-daily-rest",
    "A qualifying split route should still be available even when reduced daily rests are exhausted.",
  );

  assert(
    result.mayResumeWork === true,
    "The valid 3h + 9h regular split should permit restart.",
  );

  assert(
    result.reducedRestWillBeUsed === false,
    "The split regular rest must not consume a reduced-rest allowance.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 8
 * SPLIT SECOND PART AT 8H59
 * --------------------------------------------------
 */
{
  const firstRest = createRestSession(
    "split-first",
    "2026-08-28T09:00:00.000Z",
    "2026-08-28T12:00:00.000Z",
  );

  const currentRest = createRestSession(
    "split-second",
    "2026-08-28T18:00:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T02:59:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [firstRest, currentRest],
    createReducedHistory(3),
    "2026-08-28T06:00:00.000Z",
    now,
  );

  assert(
    result.route === "split-regular-daily-rest",
    "The engine should recognise the split route before the second part has fully completed.",
  );

  assert(
    result.mayResumeWork === false,
    "Work must not resume at 8h59 of the second split-rest part.",
  );

  assert(
    result.remainingRestMinutes === 1,
    "One minute should remain before split regular daily rest completes.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 9
 * MILESTONE AFTER 24H REFERENCE DEADLINE
 * --------------------------------------------------
 */
{
  const currentRest = createRestSession(
    "late-rest",
    "2026-08-28T22:00:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T07:00:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [currentRest],
    createReducedHistory(0),
    "2026-08-28T06:00:00.000Z",
    now,
  );

  assert(
    result.earliestLegalRestartTime === "2026-08-29T07:00:00.000Z",
    "The reduced-rest milestone should calculate to 07:00.",
  );

  assert(
    result.restartWithinReferencePeriod === false,
    "A 07:00 completion must fail when the 24-hour reference deadline was 06:00.",
  );

  assert(
    result.mayResumeWork === false,
    "The engine must not present a restart after the reference deadline as compliant.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 10
 * 9H REACHED BUT REFERENCE UNVERIFIED
 * --------------------------------------------------
 *
 * Critical fail-safe:
 *
 * Reaching the duration milestone must NOT be enough
 * to authorise a restart when TachoTrack cannot
 * verify the 24-hour reference period.
 */
{
  const currentRest = createRestSession(
    "unverified-reduced-rest",
    "2026-08-28T18:00:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T03:00:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [currentRest],
    createReducedHistory(0),
    null,
    now,
  );

  assert(
    result.referenceStatus === "unverified",
    "A null reference start must produce an unverified reference status.",
  );

  assert(
    result.remainingRestMinutes === 0,
    "The 9-hour duration milestone should still be recognised.",
  );

  assert(
    result.mayResumeWork === false,
    "TachoTrack must not authorise restart at 9 hours when the reference period is unverified.",
  );

  assert(
    result.restartWithinReferencePeriod === false,
    "An unverified reference period must not silently pass the deadline check.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 11
 * 11H REACHED BUT REFERENCE UNVERIFIED
 * --------------------------------------------------
 */
{
  const currentRest = createRestSession(
    "unverified-regular-rest",
    "2026-08-28T18:00:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T05:00:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [currentRest],
    createReducedHistory(3),
    null,
    now,
  );

  assert(
    result.route === "regular-daily-rest",
    "Regular daily rest should still be the required route when reduced rests are exhausted.",
  );

  assert(
    result.remainingRestMinutes === 0,
    "The 11-hour duration milestone should be recognised.",
  );

  assert(
    result.referenceStatus === "unverified",
    "The reference period must remain unverified.",
  );

  assert(
    result.mayResumeWork === false,
    "Even 11 hours must not produce a verified restart when the legal reference boundary is unknown.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 12
 * VERIFIED REFERENCE + MILESTONE INSIDE 24H
 * --------------------------------------------------
 */
{
  const currentRest = createRestSession(
    "verified-rest",
    "2026-08-28T18:00:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T03:00:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [currentRest],
    createReducedHistory(0),
    "2026-08-28T06:00:00.000Z",
    now,
  );

  assert(
    result.referenceStatus === "verified",
    "A supplied verified reference start should produce verified status.",
  );

  assert(
    result.referenceStart === "2026-08-28T06:00:00.000Z",
    "The verified reference start should be retained for auditability.",
  );

  assert(
    result.restartWithinReferencePeriod === true,
    "The 9-hour milestone at 03:00 should fall inside the 06:00 reference deadline.",
  );

  assert(
    result.mayResumeWork === true,
    "A completed rest milestone inside a verified reference period may permit restart.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 13
 * EXACTLY ON VERIFIED 24H DEADLINE
 * --------------------------------------------------
 *
 * Boundary condition:
 *
 * completion == deadline
 *
 * is still inside the reference period.
 */
{
  const currentRest = createRestSession(
    "exact-deadline-rest",
    "2026-08-28T21:00:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T06:00:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [currentRest],
    createReducedHistory(0),
    "2026-08-28T06:00:00.000Z",
    now,
  );

  assert(
    result.earliestLegalRestartTime === "2026-08-29T06:00:00.000Z",
    "The 9-hour milestone should land exactly on the 24-hour deadline.",
  );

  assert(
    result.restartWithinReferencePeriod === true,
    "A rest completed exactly at the verified deadline must remain inside the reference period.",
  );

  assert(
    result.mayResumeWork === true,
    "Restart may be permitted when the required rest completes exactly at the verified deadline.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 14
 * ONE MINUTE BEYOND VERIFIED 24H DEADLINE
 * --------------------------------------------------
 */
{
  const currentRest = createRestSession(
    "one-minute-late-rest",
    "2026-08-28T21:01:00.000Z",
    null,
  );

  const now = new Date("2026-08-29T06:01:00.000Z").getTime();

  const result = calculateLegalRestRestartState(
    currentRest,
    [currentRest],
    createReducedHistory(0),
    "2026-08-28T06:00:00.000Z",
    now,
  );

  assert(
    result.earliestLegalRestartTime === "2026-08-29T06:01:00.000Z",
    "The 9-hour milestone should occur one minute beyond the reference deadline.",
  );

  assert(
    result.restartWithinReferencePeriod === false,
    "One minute beyond the verified deadline must fail the reference-period check.",
  );

  assert(
    result.mayResumeWork === false,
    "TachoTrack must not authorise a restart one minute beyond the verified deadline.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 15
 * REDUCED ALLOWANCE UNVERIFIED
 * --------------------------------------------------
 *
 * Even with a verified 24-hour reference period,
 * an unverified reduced-rest allowance must force
 * the conservative 11-hour regular-rest route.
 */
{
  const currentRest = createRestSession(
    "unverified-allowance-rest",
    "2026-08-28T18:00:00.000Z",
    null,
  );

  const unverifiedAllowance = {
    status: "unverified" as const,

    canTakeAnotherReducedRest: false,

    reducedRestsUsed: null,

    reducedRestsRemaining: null,
  };

  const atNineHours = calculateLegalRestRestartState(
    currentRest,
    [currentRest],
    unverifiedAllowance,
    "2026-08-28T06:00:00.000Z",
    new Date("2026-08-29T03:00:00.000Z").getTime(),
  );

  assert(
    atNineHours.allowanceStatus === "unverified",
    "The reduced-rest allowance must remain explicitly unverified.",
  );

  assert(
    atNineHours.route === "regular-daily-rest",
    "An unverified allowance must require the 11-hour regular route.",
  );

  assert(
    atNineHours.remainingRestMinutes === 120,
    "Two hours must remain after nine hours when the allowance is unverified.",
  );

  assert(
    atNineHours.mayResumeWork === false,
    "Work must not resume at nine hours when reduced-rest entitlement is unverified.",
  );

  const atElevenHours = calculateLegalRestRestartState(
    currentRest,
    [currentRest],
    unverifiedAllowance,
    "2026-08-28T06:00:00.000Z",
    new Date("2026-08-29T05:00:00.000Z").getTime(),
  );

  assert(
    atElevenHours.mayResumeWork === true,
    "Work may resume after the conservative 11-hour regular rest completes within the verified reference period.",
  );

  assert(
    atElevenHours.reducedRestWillBeUsed === false,
    "The 11-hour route must not consume reduced-rest allowance.",
  );
}

console.log("✓ Legal rest restart scenarios passed");
