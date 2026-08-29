import type { RestSession } from "../../data/restSession";

import { buildVerifiedReducedDailyRestEvidence } from "../restHistoryAdapter";

import {
    calculateDailyRestReferencePeriod,
    findPreviousQualifyingRestSession,
} from "../dailyRestReferencePeriod";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Daily rest reference-period scenario failed: ${message}`);
  }
}

function createCompletedRest(
  id: string,
  type: "daily" | "weekly",
  startedAt: string,
  endedAt: string,
): RestSession {
  const durationMilliseconds = Math.max(
    0,
    new Date(endedAt).getTime() - new Date(startedAt).getTime(),
  );

  return {
    id,
    type,
    startedAt,
    endedAt,
    durationMilliseconds,
    status: "completed",
  };
}

function createActiveRest(
  id: string,
  type: "daily" | "weekly",
  startedAt: string,
): RestSession {
  return {
    id,
    type,
    startedAt,
    endedAt: null,
    durationMilliseconds: null,
    status: "active",
  };
}

/**
 * --------------------------------------------------
 * SCENARIO 1
 * NO PREVIOUS QUALIFYING REST
 * --------------------------------------------------
 */
{
  const result = calculateDailyRestReferencePeriod(
    [],
    "2026-08-29T08:00:00.000Z",
    new Date("2026-08-29T08:00:00.000Z").getTime(),
  );

  assert(
    result.status === "unverified",
    "No previous qualifying rest must produce an unverified reference period.",
  );

  assert(
    result.referenceStart === null,
    "An unverified reference period must not invent a reference start.",
  );

  assert(
    result.referenceDeadline === null,
    "An unverified reference period must not invent a deadline.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 2
 * PREVIOUS 11H DAILY REST
 * --------------------------------------------------
 */
{
  const previousRest = createCompletedRest(
    "daily-11h",
    "daily",
    "2026-08-28T18:00:00.000Z",
    "2026-08-29T05:00:00.000Z",
  );

  const result = calculateDailyRestReferencePeriod(
    [previousRest],
    "2026-08-29T18:00:00.000Z",
    new Date("2026-08-29T18:00:00.000Z").getTime(),
  );

  assert(
    result.status === "verified",
    "An 11-hour completed daily rest should establish a verified reference period.",
  );

  assert(
    result.referenceStart === "2026-08-29T05:00:00.000Z",
    "The reference period must start at the END of the previous daily rest.",
  );

  assert(
    result.referenceDeadline === "2026-08-30T05:00:00.000Z",
    "The reference deadline must be exactly 24 hours after the previous rest ended.",
  );

  assert(
    result.source === "regular-daily-rest",
    "An 11-hour daily rest should be identified as regular daily rest.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 3
 * PREVIOUS 9H DAILY REST
 * --------------------------------------------------
 *
 * A recorded 9-hour daily rest is not enough,
 * by itself, to prove that the driver was legally
 * entitled to use a reduced daily rest.
 *
 * Until reduced-rest entitlement is independently
 * verified, the reference period must remain
 * unverified.
 */
{
  const previousRest = createCompletedRest(
    "daily-9h",
    "daily",
    "2026-08-28T20:00:00.000Z",
    "2026-08-29T05:00:00.000Z",
  );

  const result = calculateDailyRestReferencePeriod(
    [previousRest],
    "2026-08-29T18:00:00.000Z",
    new Date("2026-08-29T18:00:00.000Z").getTime(),
  );

  assert(
    result.status === "unverified",
    "A 9-hour daily rest must not establish a verified reference boundary without reduced-rest entitlement evidence.",
  );

  assert(
    result.referenceStart === null,
    "An unverified 9-hour daily rest must not produce a reference start.",
  );

  assert(
    result.source === "unknown",
    "An unverified 9-hour daily rest must not be presented as a verified reference source.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 4
 * PREVIOUS 45H REGULAR WEEKLY REST
 * --------------------------------------------------
 */
{
  const previousRest = createCompletedRest(
    "weekly-45h",
    "weekly",
    "2026-08-27T08:00:00.000Z",
    "2026-08-29T05:00:00.000Z",
  );

  const result = calculateDailyRestReferencePeriod(
    [previousRest],
    "2026-08-29T18:00:00.000Z",
    new Date("2026-08-29T18:00:00.000Z").getTime(),
  );

  assert(
    result.status === "verified",
    "A completed 45-hour weekly rest should establish a verified reference period.",
  );

  assert(
    result.source === "regular-weekly-rest",
    "The source should be regular weekly rest.",
  );

  assert(
    result.referenceStart === "2026-08-29T05:00:00.000Z",
    "The reference must begin when the weekly rest ends.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 5
 * ACTIVE REST MUST NOT BECOME THE PREVIOUS REST
 * --------------------------------------------------
 */
{
  const activeRest = createActiveRest(
    "active-daily",
    "daily",
    "2026-08-29T18:00:00.000Z",
  );

  const result = calculateDailyRestReferencePeriod(
    [activeRest],
    "2026-08-29T18:00:00.000Z",
    new Date("2026-08-29T19:00:00.000Z").getTime(),
  );

  assert(
    result.status === "unverified",
    "An active rest session must not establish the preceding reference boundary.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 6
 * SHORT COMPLETED REST IS NOT QUALIFYING
 * --------------------------------------------------
 */
{
  const shortRest = createCompletedRest(
    "daily-8h59",
    "daily",
    "2026-08-28T20:01:00.000Z",
    "2026-08-29T05:00:00.000Z",
  );

  const result = calculateDailyRestReferencePeriod(
    [shortRest],
    "2026-08-29T18:00:00.000Z",
    new Date("2026-08-29T18:00:00.000Z").getTime(),
  );

  assert(
    result.status === "unverified",
    "A daily rest shorter than 9 hours must not establish a reference boundary.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 7
 * MOST RECENT QUALIFYING REST WINS
 * --------------------------------------------------
 */
{
  const olderRest = createCompletedRest(
    "older-rest",
    "daily",
    "2026-08-27T18:00:00.000Z",
    "2026-08-28T05:00:00.000Z",
  );

  const newerRest = createCompletedRest(
    "newer-rest",
    "daily",
    "2026-08-28T18:00:00.000Z",
    "2026-08-29T05:00:00.000Z",
  );

  const found = findPreviousQualifyingRestSession(
    [olderRest, newerRest],
    "2026-08-29T18:00:00.000Z",
  );

  assert(
    found?.id === "newer-rest",
    "The most recent qualifying completed rest must establish the reference boundary.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 8
 * EXACTLY AT THE 24H DEADLINE
 * --------------------------------------------------
 */
{
  const previousRest = createCompletedRest(
    "deadline-rest",
    "daily",
    "2026-08-28T18:00:00.000Z",
    "2026-08-29T05:00:00.000Z",
  );

  const exactDeadline = new Date("2026-08-30T05:00:00.000Z").getTime();

  const result = calculateDailyRestReferencePeriod(
    [previousRest],
    "2026-08-29T18:00:00.000Z",
    exactDeadline,
  );

  assert(
    result.status === "verified",
    "The reference period should remain verified at the exact deadline.",
  );

  assert(
    result.deadlinePassed === false,
    "The exact 24-hour deadline must not be treated as already passed.",
  );

  assert(
    result.minutesUntilDeadline === 0,
    "Zero minutes should remain at the exact deadline.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 9
 * ONE MINUTE AFTER THE 24H DEADLINE
 * --------------------------------------------------
 */
{
  const previousRest = createCompletedRest(
    "passed-deadline-rest",
    "daily",
    "2026-08-28T18:00:00.000Z",
    "2026-08-29T05:00:00.000Z",
  );

  const afterDeadline = new Date("2026-08-30T05:01:00.000Z").getTime();

  const result = calculateDailyRestReferencePeriod(
    [previousRest],
    "2026-08-29T18:00:00.000Z",
    afterDeadline,
  );

  assert(
    result.deadlinePassed === true,
    "One minute after the deadline must be identified as passed.",
  );

  assert(
    result.minutesUntilDeadline === 0,
    "No time should remain after the deadline.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 10
 * 24H WEEKLY REST IS NOT YET ACCEPTED
 * --------------------------------------------------
 *
 * Reduced weekly-rest compensation is not yet
 * integrated into this reference engine.
 */
{
  const reducedWeeklyCandidate = createCompletedRest(
    "weekly-24h",
    "weekly",
    "2026-08-28T05:00:00.000Z",
    "2026-08-29T05:00:00.000Z",
  );

  const result = calculateDailyRestReferencePeriod(
    [reducedWeeklyCandidate],
    "2026-08-29T18:00:00.000Z",
    new Date("2026-08-29T18:00:00.000Z").getTime(),
  );

  assert(
    result.status === "unverified",
    "A 24-hour weekly rest must not yet be accepted until reduced-weekly-rest compensation is integrated.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 11
 * 9H DAILY REST WITH VERIFIED REDUCED-REST EVIDENCE
 * --------------------------------------------------
 *
 * A 9-hour daily rest may establish the reference
 * boundary only when matching reduced-rest
 * verification evidence is supplied.
 */
{
  const reducedDailyRest = createCompletedRest(
    "daily-9h-verified",
    "daily",
    "2026-08-28T20:00:00.000Z",
    "2026-08-29T05:00:00.000Z",
  );

  const result = calculateDailyRestReferencePeriod(
    [reducedDailyRest],
    "2026-08-29T18:00:00.000Z",
    new Date("2026-08-29T18:00:00.000Z").getTime(),
    [
      {
        sessionId: "daily-9h-verified",
        verified: true,
      },
    ],
  );

  assert(
    result.status === "verified",
    "A 9-hour daily rest with matching verified reduced-rest evidence should establish the reference boundary.",
  );

  assert(
    result.referenceStart === "2026-08-29T05:00:00.000Z",
    "The verified reduced daily-rest boundary should begin at the end of the 9-hour rest.",
  );

  assert(
    result.source === "verified-reduced-daily-rest",
    "The reference source should identify verified reduced daily rest.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 12
 * 9H DAILY REST WITH EVIDENCE FOR WRONG SESSION
 * --------------------------------------------------
 *
 * Reduced-rest verification evidence must match
 * the exact RestSession being considered.
 *
 * Evidence for another session must never verify
 * this 9-hour rest.
 */
{
  const reducedDailyRest = createCompletedRest(
    "daily-9h-target",
    "daily",
    "2026-08-28T20:00:00.000Z",
    "2026-08-29T05:00:00.000Z",
  );

  const result = calculateDailyRestReferencePeriod(
    [reducedDailyRest],
    "2026-08-29T18:00:00.000Z",
    new Date("2026-08-29T18:00:00.000Z").getTime(),
    [
      {
        sessionId: "some-other-rest-session",
        verified: true,
      },
    ],
  );

  assert(
    result.status === "unverified",
    "Reduced-rest evidence for another session must not verify this 9-hour daily rest.",
  );

  assert(
    result.referenceStart === null,
    "Wrong-session evidence must not establish a reference start.",
  );

  assert(
    result.source === "unknown",
    "Wrong-session evidence must not produce a verified reference source.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 13
 * REST HISTORY -> VERIFIED REDUCED-REST EVIDENCE
 * -> NEW DAILY-REST REFERENCE PERIOD
 * --------------------------------------------------
 *
 * A known 45h weekly-rest baseline is followed by
 * a 9h reduced daily rest.
 *
 * The reduced-rest evidence generator should
 * verify that 9h rest, and the reference-period
 * engine should then accept its completion time
 * as the next legal reference boundary.
 */
{
  const weeklyBaseline = createCompletedRest(
    "integration-weekly-baseline",
    "weekly",
    "2026-08-26T06:00:00.000Z",
    "2026-08-28T03:00:00.000Z",
  );

  const reducedDailyRest = createCompletedRest(
    "integration-reduced-daily",
    "daily",
    "2026-08-28T18:00:00.000Z",
    "2026-08-29T03:00:00.000Z",
  );

  const sessions: RestSession[] = [weeklyBaseline, reducedDailyRest];

  const evidence = buildVerifiedReducedDailyRestEvidence(sessions);

  const result = calculateDailyRestReferencePeriod(
    sessions,
    "2026-08-29T18:00:00.000Z",
    new Date("2026-08-29T18:00:00.000Z").getTime(),
    evidence,
  );

  assert(
    evidence.length === 1,
    "The 9-hour rest after the known weekly baseline should produce one reduced-rest evidence record.",
  );

  assert(
    evidence[0]?.sessionId === "integration-reduced-daily" &&
      evidence[0]?.verified === true,
    "The post-baseline 9-hour daily rest should be verified by the evidence generator.",
  );

  assert(
    result.status === "verified",
    "The verified reduced daily rest should establish the next reference period.",
  );

  assert(
    result.source === "verified-reduced-daily-rest",
    "The new reference source should be verified reduced daily rest.",
  );

  assert(
    result.referenceStart === "2026-08-29T03:00:00.000Z",
    "The new reference period must begin when the verified 9-hour reduced daily rest ends.",
  );

  assert(
    result.referenceDeadline === "2026-08-30T03:00:00.000Z",
    "The new reference deadline must be exactly 24 hours after the verified reduced daily rest ends.",
  );
}
console.log("✓ Daily rest reference-period scenarios passed");
