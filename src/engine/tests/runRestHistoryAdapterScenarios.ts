import type { RestSession } from "../../data/restSession";

import { evaluateReducedDailyRestHistory } from "../reducedDailyRestHistory";

import {
    buildDailyRestHistoryFromSessions,
    buildReducedRestEvidenceHistoryFromSessions,
    buildSegmentedDailyRestHistoryFromSessions,
    buildVerifiedReducedDailyRestEvidence,
} from "../restHistoryAdapter";

function createRestSession(
  id: string,
  startedAt: string,
  endedAt: string,
  type: RestSession["type"] = "daily",
): RestSession {
  return {
    id,
    type,
    startedAt,
    endedAt,
    durationMilliseconds: Math.max(
      0,
      new Date(endedAt).getTime() - new Date(startedAt).getTime(),
    ),
    status: "completed",
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Rest history adapter scenario failed: ${message}`);
  }
}

/**
 * --------------------------------------------------
 * SCENARIO 1
 * 9H CONTINUOUS REST
 * --------------------------------------------------
 *
 * Expected:
 * reduced daily rest
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "rest-9h",
      "2026-08-28T18:00:00.000Z",
      "2026-08-29T03:00:00.000Z",
    ),
  ];

  const history = buildDailyRestHistoryFromSessions(
    sessions,
    "2026-08-28T06:00:00.000Z",
  );

  assert(
    history.length === 1,
    "A 9-hour daily rest should create one history entry.",
  );

  assert(
    history[0].type === "reduced-daily-rest",
    "A 9-hour continuous daily rest should be classified as reduced daily rest.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 2
 * 11H CONTINUOUS REST
 * --------------------------------------------------
 *
 * Expected:
 * regular daily rest
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "rest-11h",
      "2026-08-28T18:00:00.000Z",
      "2026-08-29T05:00:00.000Z",
    ),
  ];

  const history = buildDailyRestHistoryFromSessions(
    sessions,
    "2026-08-28T06:00:00.000Z",
  );

  assert(
    history.length === 1,
    "An 11-hour daily rest should create one history entry.",
  );

  assert(
    history[0].type === "regular-daily-rest",
    "An 11-hour continuous daily rest should be classified as regular daily rest.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 3
 * VALID 3H + 9H SPLIT
 * --------------------------------------------------
 *
 * Expected:
 * one split regular daily-rest entry
 *
 * Critically:
 * the 9-hour second part must NOT also be
 * counted as reduced daily rest.
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "split-first",
      "2026-08-28T09:00:00.000Z",
      "2026-08-28T12:00:00.000Z",
    ),

    createRestSession(
      "split-second",
      "2026-08-28T18:00:00.000Z",
      "2026-08-29T03:00:00.000Z",
    ),
  ];

  const history = buildDailyRestHistoryFromSessions(
    sessions,
    "2026-08-28T06:00:00.000Z",
  );

  assert(
    history.length === 1,
    "A valid 3h + 9h split should create one completed daily-rest history entry.",
  );

  assert(
    history[0].type === "split-regular-daily-rest",
    "A valid 3h + 9h sequence should be classified as split regular daily rest.",
  );

  const reducedEntries = history.filter(
    (entry) => entry.type === "reduced-daily-rest",
  );

  assert(
    reducedEntries.length === 0,
    "The 9-hour second part of a valid split regular rest must not consume a reduced daily rest.",
  );

  const reducedState = evaluateReducedDailyRestHistory(history);

  assert(
    reducedState.reducedRestsUsed === 0,
    "A valid split regular daily rest must leave the reduced-rest count unchanged.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 4
 * THREE REDUCED DAILY RESTS
 * --------------------------------------------------
 *
 * Expected:
 * all three allowances used
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "reduced-1",
      "2026-08-25T18:00:00.000Z",
      "2026-08-26T03:00:00.000Z",
    ),

    createRestSession(
      "reduced-2",
      "2026-08-26T18:00:00.000Z",
      "2026-08-27T03:00:00.000Z",
    ),

    createRestSession(
      "reduced-3",
      "2026-08-27T18:00:00.000Z",
      "2026-08-28T03:00:00.000Z",
    ),
  ];

  const history = buildDailyRestHistoryFromSessions(sessions, null);

  const reducedState = evaluateReducedDailyRestHistory(history);

  assert(
    reducedState.reducedRestsUsed === 3,
    "Three qualifying reduced daily rests should use all three reduced-rest allowances.",
  );

  assert(
    reducedState.reducedRestsRemaining === 0,
    "No reduced daily rests should remain after three have been used.",
  );

  assert(
    reducedState.canTakeAnotherReducedRest === false,
    "A fourth reduced daily rest must not be available before the weekly-rest reset.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 5
 * WEEKLY REST RESETS REDUCED COUNT
 * --------------------------------------------------
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "reduced-before-weekly-1",
      "2026-08-20T18:00:00.000Z",
      "2026-08-21T03:00:00.000Z",
    ),

    createRestSession(
      "reduced-before-weekly-2",
      "2026-08-21T18:00:00.000Z",
      "2026-08-22T03:00:00.000Z",
    ),

    createRestSession(
      "weekly-rest",
      "2026-08-22T12:00:00.000Z",
      "2026-08-24T09:00:00.000Z",
      "weekly",
    ),

    createRestSession(
      "reduced-after-weekly",
      "2026-08-24T18:00:00.000Z",
      "2026-08-25T03:00:00.000Z",
    ),
  ];

  const history = buildDailyRestHistoryFromSessions(sessions, null);

  const reducedState = evaluateReducedDailyRestHistory(history);

  assert(
    reducedState.reducedRestsUsed === 1,
    "Only reduced daily rests after the latest weekly rest should count.",
  );

  assert(
    reducedState.reducedRestsRemaining === 2,
    "Two reduced daily rests should remain after the weekly-rest reset and one new reduced rest.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 6
 * 3H REST ALONE
 * --------------------------------------------------
 *
 * Expected:
 * no completed daily-rest history entry
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "three-hour-only",
      "2026-08-28T09:00:00.000Z",
      "2026-08-28T12:00:00.000Z",
    ),
  ];

  const history = buildDailyRestHistoryFromSessions(
    sessions,
    "2026-08-28T06:00:00.000Z",
  );

  assert(
    history.length === 0,
    "A 3-hour first split part alone must not be recorded as a completed daily rest.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 7
 * REDUCED RESTS WITHOUT WEEKLY BASELINE
 * REMAIN UNVERIFIED
 * --------------------------------------------------
 *
 * TachoTrack has four 9-hour rest candidates,
 * but no qualifying weekly-rest baseline exists
 * in the available history.
 *
 * Expected:
 * all four candidates remain unverified.
 *
 * Duration alone must never establish legal
 * reduced-rest entitlement.
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "reduced-evidence-1",
      "2026-08-20T18:00:00.000Z",
      "2026-08-21T03:00:00.000Z",
    ),

    createRestSession(
      "reduced-evidence-2",
      "2026-08-21T18:00:00.000Z",
      "2026-08-22T03:00:00.000Z",
    ),

    createRestSession(
      "reduced-evidence-3",
      "2026-08-22T18:00:00.000Z",
      "2026-08-23T03:00:00.000Z",
    ),

    createRestSession(
      "reduced-evidence-4",
      "2026-08-23T18:00:00.000Z",
      "2026-08-24T03:00:00.000Z",
    ),
  ];

  const evidence = buildVerifiedReducedDailyRestEvidence(sessions);

  assert(
    evidence.length === 4,
    "All four reduced-rest candidates should produce verification evidence.",
  );

  assert(
    evidence.every((item) => item.verified === false),
    "Reduced daily rests must remain unverified when no qualifying weekly-rest baseline exists.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 8
 * WEEKLY REST RESETS REDUCED-REST VERIFICATION
 * --------------------------------------------------
 *
 * Three reduced daily rests use the available
 * allowance.
 *
 * A completed weekly rest then resets the counter,
 * allowing the next reduced daily rest to be
 * verified again.
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "before-reset-1",
      "2026-08-18T18:00:00.000Z",
      "2026-08-19T03:00:00.000Z",
    ),

    createRestSession(
      "before-reset-2",
      "2026-08-19T18:00:00.000Z",
      "2026-08-20T03:00:00.000Z",
    ),

    createRestSession(
      "before-reset-3",
      "2026-08-20T18:00:00.000Z",
      "2026-08-21T03:00:00.000Z",
    ),

    createRestSession(
      "weekly-reset",
      "2026-08-21T12:00:00.000Z",
      "2026-08-23T09:00:00.000Z",
      "weekly",
    ),

    createRestSession(
      "after-reset-1",
      "2026-08-23T18:00:00.000Z",
      "2026-08-24T03:00:00.000Z",
    ),
  ];

  const evidence = buildVerifiedReducedDailyRestEvidence(sessions);

  const afterResetEvidence = evidence.find(
    (item) => item.sessionId === "after-reset-1",
  );

  const beforeResetEvidence = evidence.filter((item) =>
    item.sessionId.startsWith("before-reset-"),
  );

  assert(
    beforeResetEvidence.every((item) => item.verified === false),
    "Reduced rests before the first known weekly-rest baseline must remain unverified.",
  );

  assert(
    afterResetEvidence?.verified === true,
    "The first reduced daily rest after a weekly-rest reset should be verified.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 9
 * SPLIT REST PRESERVES COMPLETION CHRONOLOGY
 * --------------------------------------------------
 *
 * A regular 45-hour weekly rest completes first.
 *
 * A valid 3h + 9h split regular daily rest then
 * completes later.
 *
 * Expected:
 * the weekly-rest entry must appear before the
 * split-rest entry even though split detection
 * happens before the normal classification loop.
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "weekly-before-split",
      "2026-08-26T08:00:00.000Z",
      "2026-08-28T05:00:00.000Z",
      "weekly",
    ),

    createRestSession(
      "chronology-split-first",
      "2026-08-28T09:00:00.000Z",
      "2026-08-28T12:00:00.000Z",
    ),

    createRestSession(
      "chronology-split-second",
      "2026-08-28T18:00:00.000Z",
      "2026-08-29T03:00:00.000Z",
    ),
  ];

  const history = buildDailyRestHistoryFromSessions(
    sessions,
    "2026-08-28T06:00:00.000Z",
  );

  assert(
    history.length === 2,
    "The weekly rest and completed split rest should produce two history entries.",
  );

  assert(
    history[0]?.type === "weekly-rest",
    "The weekly rest that completed first must appear first in chronological history.",
  );

  assert(
    history[1]?.type === "split-regular-daily-rest",
    "The split regular daily rest must appear when its 9-hour second part completes.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 10
 * 24H WEEKLY REST DOES NOT RESET REDUCED COUNT
 * --------------------------------------------------
 *
 * Three reduced daily rests are taken.
 *
 * A 24-hour weekly RestSession follows.
 *
 * Until reduced-weekly-rest compensation is
 * implemented and verified, that session must
 * not act as the safe 45-hour weekly reset used
 * by this history engine.
 *
 * Expected:
 * the three reduced rests remain counted.
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "short-weekly-reduced-1",
      "2026-08-18T18:00:00.000Z",
      "2026-08-19T03:00:00.000Z",
    ),

    createRestSession(
      "short-weekly-reduced-2",
      "2026-08-19T18:00:00.000Z",
      "2026-08-20T03:00:00.000Z",
    ),

    createRestSession(
      "short-weekly-reduced-3",
      "2026-08-20T18:00:00.000Z",
      "2026-08-21T03:00:00.000Z",
    ),

    createRestSession(
      "twenty-four-hour-weekly",
      "2026-08-21T12:00:00.000Z",
      "2026-08-22T12:00:00.000Z",
      "weekly",
    ),
  ];

  const history = buildDailyRestHistoryFromSessions(sessions, null);

  const weeklyEntries = history.filter((entry) => entry.type === "weekly-rest");

  assert(
    weeklyEntries.length === 0,
    "A 24-hour weekly rest must not be treated as the safe 45-hour weekly-rest reset.",
  );

  const reducedState = evaluateReducedDailyRestHistory(history);

  assert(
    reducedState.reducedRestsUsed === 3,
    "A 24-hour weekly rest must not reset the three reduced daily rests.",
  );

  assert(
    reducedState.canTakeAnotherReducedRest === false,
    "Another reduced daily rest must not become available merely because a 24-hour weekly RestSession was recorded.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 11
 * INTERRUPTED 11H REST MUST NOT QUALIFY
 * --------------------------------------------------
 *
 * A rest session has an 11-hour elapsed duration
 * and an end timestamp, but its status is
 * "interrupted".
 *
 * Expected:
 * it must NOT become a regular daily-rest entry.
 */
{
  const interruptedRest: RestSession = {
    id: "interrupted-11h",
    type: "daily",
    startedAt: "2026-08-28T18:00:00.000Z",
    endedAt: "2026-08-29T05:00:00.000Z",
    durationMilliseconds: 11 * 60 * 60 * 1000,
    status: "interrupted",
  };

  const history = buildDailyRestHistoryFromSessions(
    [interruptedRest],
    "2026-08-28T06:00:00.000Z",
  );

  assert(
    history.length === 0,
    "An interrupted 11-hour rest must not create a qualifying daily-rest history entry.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 12
 * THREE REDUCED RESTS AFTER KNOWN WEEKLY BASELINE
 * FOURTH MUST NOT VERIFY
 * --------------------------------------------------
 *
 * A qualifying 45-hour weekly rest establishes
 * a known baseline.
 *
 * Three reduced daily rests may then be verified.
 *
 * The fourth reduced daily rest before another
 * qualifying weekly-rest reset must remain
 * unverified.
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "known-baseline-weekly",
      "2026-08-18T06:00:00.000Z",
      "2026-08-20T03:00:00.000Z",
      "weekly",
    ),

    createRestSession(
      "after-baseline-reduced-1",
      "2026-08-20T18:00:00.000Z",
      "2026-08-21T03:00:00.000Z",
    ),

    createRestSession(
      "after-baseline-reduced-2",
      "2026-08-21T18:00:00.000Z",
      "2026-08-22T03:00:00.000Z",
    ),

    createRestSession(
      "after-baseline-reduced-3",
      "2026-08-22T18:00:00.000Z",
      "2026-08-23T03:00:00.000Z",
    ),

    createRestSession(
      "after-baseline-reduced-4",
      "2026-08-23T18:00:00.000Z",
      "2026-08-24T03:00:00.000Z",
    ),
  ];

  const evidence = buildVerifiedReducedDailyRestEvidence(sessions);

  const first = evidence.find(
    (item) => item.sessionId === "after-baseline-reduced-1",
  );

  const second = evidence.find(
    (item) => item.sessionId === "after-baseline-reduced-2",
  );

  const third = evidence.find(
    (item) => item.sessionId === "after-baseline-reduced-3",
  );

  const fourth = evidence.find(
    (item) => item.sessionId === "after-baseline-reduced-4",
  );

  assert(
    first?.verified === true,
    "The first reduced daily rest after a known weekly-rest baseline should be verified.",
  );

  assert(
    second?.verified === true,
    "The second reduced daily rest after a known weekly-rest baseline should be verified.",
  );

  assert(
    third?.verified === true,
    "The third reduced daily rest after a known weekly-rest baseline should be verified.",
  );

  assert(
    fourth?.verified === false,
    "The fourth reduced daily rest must not be verified before another qualifying weekly-rest reset.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 13
 * SAME-DAY REST COMPLETION ORDER
 * --------------------------------------------------
 *
 * Two qualifying rests complete on the same
 * calendar date.
 *
 * The input array is deliberately supplied in
 * reverse order.
 *
 * Expected:
 * history must follow exact completion time,
 * not input order or date-only sorting.
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "same-day-later",
      "2026-08-27T10:00:00.000Z",
      "2026-08-27T21:00:00.000Z",
    ),

    createRestSession(
      "same-day-earlier",
      "2026-08-26T23:00:00.000Z",
      "2026-08-27T10:00:00.000Z",
    ),
  ];

  const history = buildDailyRestHistoryFromSessions(sessions, null);

  assert(
    history.length === 2,
    "Both same-day regular daily rests should appear in history.",
  );

  assert(
    history[0]?.id === "regular-same-day-earlier",
    "The rest completing earlier must appear first even when the input sessions are reversed.",
  );

  assert(
    history[1]?.id === "regular-same-day-later",
    "The rest completing later must appear second.",
  );

  assert(
    history[0]?.date === history[1]?.date,
    "This scenario must compare two rests recorded on the same local calendar date.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 14
 * SEGMENTED HISTORY RECOGNISES 3H + 9H SPLIT
 * AFTER KNOWN WEEKLY BASELINE
 * --------------------------------------------------
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "segmented-weekly-baseline",
      "2026-08-25T06:00:00.000Z",
      "2026-08-27T03:00:00.000Z",
      "weekly",
    ),

    createRestSession(
      "segmented-split-first",
      "2026-08-27T09:00:00.000Z",
      "2026-08-27T12:00:00.000Z",
    ),

    createRestSession(
      "segmented-split-second",
      "2026-08-27T18:00:00.000Z",
      "2026-08-28T03:00:00.000Z",
    ),
  ];

  const history = buildSegmentedDailyRestHistoryFromSessions(sessions);

  assert(
    history.length === 2,
    "Segmented history should contain the weekly baseline and the completed split regular daily rest.",
  );

  assert(
    history[0]?.type === "weekly-rest",
    "The first segmented history entry should be the known 45-hour weekly-rest baseline.",
  );

  assert(
    history[1]?.type === "split-regular-daily-rest",
    "The 3h + 9h sequence after the weekly baseline should be recognised as split regular daily rest.",
  );

  const reducedEntries = history.filter(
    (entry) => entry.type === "reduced-daily-rest",
  );

  assert(
    reducedEntries.length === 0,
    "The 9-hour second part of the split regular daily rest must not be recorded as reduced daily rest.",
  );

  const reducedState = evaluateReducedDailyRestHistory(history);

  assert(
    reducedState.reducedRestsUsed === 0,
    "A segmented 3h + 9h split regular daily rest must not consume reduced-rest allowance.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 15
 * SEGMENTED HISTORY ADVANCES AFTER SPLIT REST
 * --------------------------------------------------
 *
 * A known 45-hour weekly rest establishes the
 * historical baseline.
 *
 * A valid 3h + 9h split regular daily rest
 * completes next.
 *
 * A later 9-hour continuous daily rest should
 * then be classified as one reduced daily rest.
 *
 * Expected history:
 *
 * weekly rest
 * -> split regular daily rest
 * -> reduced daily rest
 *
 * Critically:
 * the 9-hour second part of the split must not
 * consume reduced-rest allowance.
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "advance-weekly-baseline",
      "2026-08-24T06:00:00.000Z",
      "2026-08-26T03:00:00.000Z",
      "weekly",
    ),

    createRestSession(
      "advance-split-first",
      "2026-08-26T09:00:00.000Z",
      "2026-08-26T12:00:00.000Z",
    ),

    createRestSession(
      "advance-split-second",
      "2026-08-26T18:00:00.000Z",
      "2026-08-27T03:00:00.000Z",
    ),

    createRestSession(
      "advance-reduced-rest",
      "2026-08-27T18:00:00.000Z",
      "2026-08-28T03:00:00.000Z",
    ),
  ];

  const history = buildSegmentedDailyRestHistoryFromSessions(sessions);

  assert(
    history.length === 3,
    "Segmented history should contain the weekly baseline, split regular rest, and later reduced daily rest.",
  );

  assert(
    history[0]?.type === "weekly-rest",
    "The first entry should be the known weekly-rest baseline.",
  );

  assert(
    history[1]?.type === "split-regular-daily-rest",
    "The second entry should be the completed 3h + 9h split regular daily rest.",
  );

  assert(
    history[2]?.type === "reduced-daily-rest",
    "The later 9-hour continuous rest should be classified as reduced daily rest.",
  );

  const reducedState = evaluateReducedDailyRestHistory(history);

  assert(
    reducedState.reducedRestsUsed === 1,
    "Only the later 9-hour reduced daily rest should consume reduced-rest allowance.",
  );

  assert(
    reducedState.reducedRestsRemaining === 2,
    "Two reduced daily rests should remain after one reduced rest following the split regular rest.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 16
 * EVIDENCE HISTORY PRESERVES PRE-BASELINE RESTS
 * AND USES SEGMENTED HISTORY AFTER BASELINE
 * --------------------------------------------------
 *
 * Expected history:
 *
 * pre-baseline reduced candidate
 * pre-baseline reduced candidate
 * weekly-rest baseline
 * split regular daily rest
 * reduced daily rest
 *
 * The two pre-baseline 9-hour rests must remain
 * visible for later UNVERIFIED evidence.
 *
 * The 9-hour second part of the valid 3h + 9h
 * split must NOT become a reduced-rest entry.
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "evidence-pre-baseline-1",
      "2026-08-20T18:00:00.000Z",
      "2026-08-21T03:00:00.000Z",
    ),

    createRestSession(
      "evidence-pre-baseline-2",
      "2026-08-21T18:00:00.000Z",
      "2026-08-22T03:00:00.000Z",
    ),

    createRestSession(
      "evidence-weekly-baseline",
      "2026-08-22T06:00:00.000Z",
      "2026-08-24T03:00:00.000Z",
      "weekly",
    ),

    createRestSession(
      "evidence-split-first",
      "2026-08-24T09:00:00.000Z",
      "2026-08-24T12:00:00.000Z",
    ),

    createRestSession(
      "evidence-split-second",
      "2026-08-24T18:00:00.000Z",
      "2026-08-25T03:00:00.000Z",
    ),

    createRestSession(
      "evidence-post-baseline-reduced",
      "2026-08-25T18:00:00.000Z",
      "2026-08-26T03:00:00.000Z",
    ),
  ];

  const history = buildReducedRestEvidenceHistoryFromSessions(sessions);

  assert(
    history.length === 5,
    "Evidence history should contain two pre-baseline candidates, the weekly baseline, the split regular rest, and one later reduced rest.",
  );

  assert(
    history[0]?.id === "reduced-evidence-pre-baseline-1",
    "The first pre-baseline 9-hour rest must remain visible.",
  );

  assert(
    history[1]?.id === "reduced-evidence-pre-baseline-2",
    "The second pre-baseline 9-hour rest must remain visible.",
  );

  assert(
    history[2]?.type === "weekly-rest",
    "The known 45-hour weekly rest should establish the segmented baseline.",
  );

  assert(
    history[3]?.type === "split-regular-daily-rest",
    "The valid 3h + 9h rest after the baseline should be classified as split regular daily rest.",
  );

  assert(
    history[4]?.id === "reduced-evidence-post-baseline-reduced",
    "The later 9-hour continuous rest should remain a reduced-rest candidate.",
  );

  const reducedEntries = history.filter(
    (entry) => entry.type === "reduced-daily-rest",
  );

  assert(
    reducedEntries.length === 3,
    "Evidence history should contain exactly the two pre-baseline reduced candidates and one post-baseline reduced candidate.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 17
 * VERIFIED REDUCED-REST EVIDENCE USES RECONCILED
 * HISTORY
 * --------------------------------------------------
 *
 * Expected:
 *
 * - two 9h rests before a known weekly baseline
 *   remain unverified
 *
 * - 45h weekly rest establishes the trusted baseline
 *
 * - valid 3h + 9h split is regular daily rest and
 *   does NOT consume reduced-rest allowance
 *
 * - the following 9h reduced daily rest is verified
 */
{
  const sessions: RestSession[] = [
    createRestSession(
      "verified-pre-baseline-1",
      "2026-08-20T18:00:00.000Z",
      "2026-08-21T03:00:00.000Z",
    ),

    createRestSession(
      "verified-pre-baseline-2",
      "2026-08-21T18:00:00.000Z",
      "2026-08-22T03:00:00.000Z",
    ),

    createRestSession(
      "verified-weekly-baseline",
      "2026-08-22T06:00:00.000Z",
      "2026-08-24T03:00:00.000Z",
      "weekly",
    ),

    createRestSession(
      "verified-split-first",
      "2026-08-24T09:00:00.000Z",
      "2026-08-24T12:00:00.000Z",
    ),

    createRestSession(
      "verified-split-second",
      "2026-08-24T18:00:00.000Z",
      "2026-08-25T03:00:00.000Z",
    ),

    createRestSession(
      "verified-post-baseline-reduced",
      "2026-08-25T18:00:00.000Z",
      "2026-08-26T03:00:00.000Z",
    ),
  ];

  const evidence = buildVerifiedReducedDailyRestEvidence(sessions);

  assert(
    evidence.length === 3,
    "There should be exactly three reduced-rest evidence records.",
  );

  assert(
    evidence[0]?.sessionId === "verified-pre-baseline-1" &&
      evidence[0]?.verified === false,
    "The first pre-baseline 9-hour rest must remain unverified.",
  );

  assert(
    evidence[1]?.sessionId === "verified-pre-baseline-2" &&
      evidence[1]?.verified === false,
    "The second pre-baseline 9-hour rest must remain unverified.",
  );

  assert(
    evidence[2]?.sessionId === "verified-post-baseline-reduced" &&
      evidence[2]?.verified === true,
    "The first reduced daily rest after the known weekly baseline should be verified.",
  );

  assert(
    !evidence.some((item) => item.sessionId === "verified-split-second"),
    "The 9-hour second part of a valid 3h + 9h split must not produce reduced-rest evidence.",
  );
}
console.log("✓ Rest history adapter scenarios passed");
