import type { RestSession } from "../../data/restSession";

import {
    calculateLiveSplitDailyRestState,
    SPLIT_DAILY_REST_LIMITS,
} from "../liveSplitDailyRestState";

function createRestSession(
  id: string,
  startedAt: string,
  endedAt: string | null,
  type: RestSession["type"] = "daily",
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
    type,
    startedAt,
    endedAt,
    durationMilliseconds,
    status: endedAt === null ? "active" : "completed",
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Live split daily rest scenario failed: ${message}`);
  }
}

/**
 * --------------------------------------------------
 * SCENARIO 1
 * NO QUALIFYING FIRST PART
 * --------------------------------------------------
 */
{
  const referenceStart = "2026-08-28T06:00:00.000Z";

  const sessions: RestSession[] = [
    createRestSession(
      "rest-1",
      "2026-08-28T09:00:00.000Z",
      "2026-08-28T11:00:00.000Z",
    ),
  ];

  const result = calculateLiveSplitDailyRestState(sessions, referenceStart);

  assert(
    result.firstPartAchieved === false,
    "A 2-hour daily-rest session must not qualify as the first split-rest part.",
  );

  assert(
    result.splitRestCompleted === false,
    "Split rest must not complete without a qualifying first part.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 2
 * QUALIFYING 3H FIRST PART
 * --------------------------------------------------
 */
{
  const referenceStart = "2026-08-28T06:00:00.000Z";

  const sessions: RestSession[] = [
    createRestSession(
      "rest-1",
      "2026-08-28T09:00:00.000Z",
      "2026-08-28T12:00:00.000Z",
    ),
  ];

  const result = calculateLiveSplitDailyRestState(sessions, referenceStart);

  assert(
    result.firstPartAchieved === true,
    "A completed 3-hour daily-rest session should qualify as the first split-rest part.",
  );

  assert(
    result.firstPartMinutes === SPLIT_DAILY_REST_LIMITS.firstPartMinutes,
    "The first qualifying part should record 180 minutes.",
  );

  assert(
    result.secondPartAchieved === false,
    "The split rest must remain incomplete until a later 9-hour daily-rest session exists.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 3
 * VALID 3H + 9H SPLIT
 * --------------------------------------------------
 */
{
  const referenceStart = "2026-08-28T06:00:00.000Z";

  const sessions: RestSession[] = [
    createRestSession(
      "rest-1",
      "2026-08-28T09:00:00.000Z",
      "2026-08-28T12:00:00.000Z",
    ),

    createRestSession(
      "rest-2",
      "2026-08-28T18:00:00.000Z",
      "2026-08-29T03:00:00.000Z",
    ),
  ];

  const result = calculateLiveSplitDailyRestState(sessions, referenceStart);

  assert(
    result.firstPartAchieved === true,
    "The 3-hour first rest should qualify.",
  );

  assert(
    result.secondPartAchieved === true,
    "The later 9-hour rest should qualify.",
  );

  assert(
    result.totalRestMinutes === SPLIT_DAILY_REST_LIMITS.totalMinimumMinutes,
    "3h + 9h should total 720 minutes.",
  );

  assert(
    result.splitRestCompleted === true,
    "A valid 3h + 9h sequence inside the 24-hour reference period should complete a split regular daily rest.",
  );

  assert(
    result.completedSplitRest !== null,
    "Completed split-rest details should be available.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 4
 * SECOND PART TOO SHORT
 * --------------------------------------------------
 */
{
  const referenceStart = "2026-08-28T06:00:00.000Z";

  const sessions: RestSession[] = [
    createRestSession(
      "rest-1",
      "2026-08-28T09:00:00.000Z",
      "2026-08-28T12:30:00.000Z",
    ),

    createRestSession(
      "rest-2",
      "2026-08-28T18:00:00.000Z",
      "2026-08-29T02:30:00.000Z",
    ),
  ];

  const result = calculateLiveSplitDailyRestState(sessions, referenceStart);

  assert(
    result.firstPartAchieved === true,
    "The 3.5-hour first rest should qualify.",
  );

  assert(
    result.secondPartAchieved === false,
    "An 8.5-hour second rest must not qualify.",
  );

  assert(
    result.splitRestCompleted === false,
    "Split regular daily rest must remain incomplete.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 5
 * FIRST REST ACTIVE
 * --------------------------------------------------
 *
 * An active session must not become the first
 * completed split-rest part.
 */
{
  const referenceStart = "2026-08-28T06:00:00.000Z";

  const sessions: RestSession[] = [
    createRestSession("rest-1", "2026-08-28T09:00:00.000Z", null),
  ];

  const now = new Date("2026-08-28T12:30:00.000Z").getTime();

  const result = calculateLiveSplitDailyRestState(
    sessions,
    referenceStart,
    now,
  );

  assert(
    result.firstPartAchieved === false,
    "An active rest session must not be accepted as the completed first split-rest part.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 6
 * ACTIVE SECOND REST REACHES 9H
 * --------------------------------------------------
 *
 * This is important for the live dashboard.
 * TachoTrack should recognise the exact moment
 * the second rest reaches 9 hours.
 */
{
  const referenceStart = "2026-08-28T06:00:00.000Z";

  const sessions: RestSession[] = [
    createRestSession(
      "rest-1",
      "2026-08-28T09:00:00.000Z",
      "2026-08-28T12:00:00.000Z",
    ),

    createRestSession("rest-2", "2026-08-28T18:00:00.000Z", null),
  ];

  const now = new Date("2026-08-29T03:00:00.000Z").getTime();

  const result = calculateLiveSplitDailyRestState(
    sessions,
    referenceStart,
    now,
  );

  assert(
    result.secondPartAchieved === true,
    "The active second rest should qualify when it reaches 9 hours.",
  );

  assert(
    result.splitRestCompleted === true,
    "The split regular daily rest should complete at the live 9-hour milestone.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 7
 * ACTIVE SECOND REST AT 8H59
 * --------------------------------------------------
 */
{
  const referenceStart = "2026-08-28T06:00:00.000Z";

  const sessions: RestSession[] = [
    createRestSession(
      "rest-1",
      "2026-08-28T09:00:00.000Z",
      "2026-08-28T12:00:00.000Z",
    ),

    createRestSession("rest-2", "2026-08-28T18:00:00.000Z", null),
  ];

  const now = new Date("2026-08-29T02:59:00.000Z").getTime();

  const result = calculateLiveSplitDailyRestState(
    sessions,
    referenceStart,
    now,
  );

  assert(
    result.secondPartAchieved === false,
    "The active second rest must not qualify at 8h59.",
  );

  assert(
    result.splitRestCompleted === false,
    "The split rest must remain incomplete before the full 9-hour second part.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 8
 * COMPLETION AFTER 24H DEADLINE
 * --------------------------------------------------
 */
{
  const referenceStart = "2026-08-28T06:00:00.000Z";

  const sessions: RestSession[] = [
    createRestSession(
      "rest-1",
      "2026-08-28T08:00:00.000Z",
      "2026-08-28T11:00:00.000Z",
    ),

    createRestSession(
      "rest-2",
      "2026-08-28T22:00:00.000Z",
      "2026-08-29T07:00:00.000Z",
    ),
  ];

  const result = calculateLiveSplitDailyRestState(sessions, referenceStart);

  assert(
    result.firstPartAchieved === true,
    "The first 3-hour rest should still be detected.",
  );

  assert(
    result.secondPartAchieved === true,
    "The later 9-hour rest should still be detected.",
  );

  assert(
    result.splitRestCompleted === false,
    "The split rest must not be accepted when the second part completes after the 24-hour reference deadline.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 9
 * WEEKLY REST MUST NOT BE USED AS SPLIT FIRST PART
 * --------------------------------------------------
 */
{
  const referenceStart = "2026-08-28T06:00:00.000Z";

  const sessions: RestSession[] = [
    createRestSession(
      "weekly-rest",
      "2026-08-28T08:00:00.000Z",
      "2026-08-28T12:00:00.000Z",
      "weekly",
    ),
  ];

  const result = calculateLiveSplitDailyRestState(sessions, referenceStart);

  assert(
    result.firstPartAchieved === false,
    "A weekly-rest session must not be reused as the first part of a split daily rest.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 10
 * INTERRUPTED FIRST PART MUST NOT QUALIFY
 * --------------------------------------------------
 *
 * A 3-hour daily RestSession exists, but its
 * status is "interrupted".
 *
 * Expected:
 * it must not become the qualifying first part
 * of a split regular daily rest.
 */
{
  const referenceStart = "2026-08-28T06:00:00.000Z";

  const interruptedFirstPart: RestSession = {
    id: "interrupted-first-part",
    type: "daily",
    startedAt: "2026-08-28T09:00:00.000Z",
    endedAt: "2026-08-28T12:00:00.000Z",
    durationMilliseconds: 3 * 60 * 60 * 1000,
    status: "interrupted",
  };

  const sessions: RestSession[] = [
    interruptedFirstPart,

    createRestSession(
      "later-nine-hour-rest",
      "2026-08-28T18:00:00.000Z",
      "2026-08-29T03:00:00.000Z",
    ),
  ];

  const result = calculateLiveSplitDailyRestState(sessions, referenceStart);

  assert(
    result.firstPartAchieved === false,
    "An interrupted 3-hour rest must not qualify as the first part of a split regular daily rest.",
  );

  assert(
    result.splitRestCompleted === false,
    "A split regular daily rest must not complete when its proposed first part was interrupted.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 11
 * INTERRUPTED SECOND PART MUST NOT QUALIFY
 * --------------------------------------------------
 *
 * The first 3-hour part is valid and completed.
 *
 * A later 9-hour RestSession exists, but its
 * status is "interrupted".
 *
 * Expected:
 * the first part remains recognised, but the
 * interrupted second part must not complete the
 * split regular daily rest.
 */
{
  const referenceStart = "2026-08-28T06:00:00.000Z";

  const validFirstPart = createRestSession(
    "valid-first-part",
    "2026-08-28T09:00:00.000Z",
    "2026-08-28T12:00:00.000Z",
  );

  const interruptedSecondPart: RestSession = {
    id: "interrupted-second-part",
    type: "daily",
    startedAt: "2026-08-28T18:00:00.000Z",
    endedAt: "2026-08-29T03:00:00.000Z",
    durationMilliseconds: 9 * 60 * 60 * 1000,
    status: "interrupted",
  };

  const sessions: RestSession[] = [validFirstPart, interruptedSecondPart];

  const result = calculateLiveSplitDailyRestState(sessions, referenceStart);

  assert(
    result.firstPartAchieved === true,
    "The valid completed 3-hour first part should still be recognised.",
  );

  assert(
    result.secondPartAchieved === false,
    "An interrupted 9-hour rest must not qualify as the second part of a split regular daily rest.",
  );

  assert(
    result.splitRestCompleted === false,
    "An interrupted second part must not complete a split regular daily rest.",
  );
}
/**
 * --------------------------------------------------
 * SCENARIO 16
 * 11H REGULAR REST MUST NOT BECOME SPLIT FIRST PART
 * --------------------------------------------------
 *
 * A completed 11-hour daily rest is already a
 * regular daily rest in its own right.
 *
 * It must not later be reused as the first
 * 3-hour component of a split regular daily rest.
 */
{
  const referenceStart = "2026-08-28T06:00:00.000Z";

  const sessions: RestSession[] = [
    createRestSession(
      "regular-eleven-hour-rest",
      "2026-08-28T07:00:00.000Z",
      "2026-08-28T18:00:00.000Z",
    ),

    createRestSession(
      "later-nine-hour-rest",
      "2026-08-28T20:00:00.000Z",
      "2026-08-29T05:00:00.000Z",
    ),
  ];

  const result = calculateLiveSplitDailyRestState(sessions, referenceStart);

  assert(
    result.firstPartAchieved === false,
    "An 11-hour regular daily rest must not be reused as the first part of a split regular daily rest.",
  );

  assert(
    result.splitRestCompleted === false,
    "A later 9-hour rest must not combine with an already complete 11-hour regular daily rest to create a split rest.",
  );
}

console.log("✓ Live split daily-rest RestSession scenarios passed");
