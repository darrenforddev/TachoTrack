import type { RestSession } from "../data/restSession";

export const SPLIT_DAILY_REST_LIMITS = {
  firstPartMinutes: 3 * 60,
  secondPartMinutes: 9 * 60,
  totalMinimumMinutes: 12 * 60,
  referencePeriodMinutes: 24 * 60,
} as const;

export interface SplitDailyRestBlock {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
}

export interface CompletedSplitDailyRest {
  firstPart: SplitDailyRestBlock;
  secondPart: SplitDailyRestBlock;
  totalRestMinutes: number;
  completedAt: string;
  completedWithinReferencePeriod: boolean;
}

export interface LiveSplitDailyRestState {
  qualifyingFirstPart: SplitDailyRestBlock | null;
  qualifyingSecondPart: SplitDailyRestBlock | null;
  completedSplitRest: CompletedSplitDailyRest | null;

  firstPartAchieved: boolean;
  secondPartAchieved: boolean;
  splitRestCompleted: boolean;

  firstPartMinutes: number;
  secondPartMinutes: number;
  totalRestMinutes: number;

  secondPartMinutesRequired: number;

  referenceDeadline: string | null;

  message: string;
}

function getSessionEndTimestamp(session: RestSession, now: number): number {
  if (session.endedAt !== null) {
    return new Date(session.endedAt).getTime();
  }

  return now;
}

function getSessionDurationMinutes(session: RestSession, now: number): number {
  const startedAt = new Date(session.startedAt).getTime();

  const endedAt = getSessionEndTimestamp(session, now);

  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(endedAt) ||
    endedAt <= startedAt
  ) {
    return 0;
  }

  return Math.floor((endedAt - startedAt) / (60 * 1000));
}

function createBlock(
  session: RestSession,
  now: number,
): SplitDailyRestBlock | null {
  const endedAt = session.endedAt ?? new Date(now).toISOString();

  const durationMinutes = getSessionDurationMinutes(session, now);

  if (durationMinutes <= 0) {
    return null;
  }

  return {
    id: session.id,
    startedAt: session.startedAt,
    endedAt,
    durationMinutes,
  };
}

function calculateReferenceDeadline(referenceStart: string): string {
  const referenceTimestamp = new Date(referenceStart).getTime();

  return new Date(
    referenceTimestamp +
      SPLIT_DAILY_REST_LIMITS.referencePeriodMinutes * 60 * 1000,
  ).toISOString();
}

/**
 * Finds the first completed DAILY rest session
 * of at least three hours inside the current
 * daily-rest reference period.
 *
 * Weekly-rest sessions are deliberately excluded.
 *
 * An active rest session is also deliberately
 * excluded from becoming the first part because
 * the driver has not yet resumed duty from it.
 */
export function findQualifyingSplitFirstPart(
  sessions: RestSession[],
  referenceStart: string,
  now: number = Date.now(),
): SplitDailyRestBlock | null {
  const referenceTimestamp = new Date(referenceStart).getTime();

  const candidates = sessions
    .filter((session) => {
      if (
        session.type !== "daily" ||
        session.status !== "completed" ||
        session.endedAt === null
      ) {
        return false;
      }

      const sessionStartedAt = new Date(session.startedAt).getTime();

      const durationMinutes = getSessionDurationMinutes(session, now);

      return (
        sessionStartedAt >= referenceTimestamp &&
        durationMinutes >= SPLIT_DAILY_REST_LIMITS.firstPartMinutes &&
        durationMinutes < SPLIT_DAILY_REST_LIMITS.secondPartMinutes
      );
    })
    .map((session) => createBlock(session, now))
    .filter((block): block is SplitDailyRestBlock => block !== null)
    .sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );

  return candidates[0] ?? null;
}

/**
 * Finds a later DAILY rest session that can
 * become the second part of the split.
 *
 * Unlike the first part, this session may still
 * be active. That allows TachoTrack to recognise
 * the exact moment the second part reaches 9h.
 */
export function findQualifyingSplitSecondPart(
  sessions: RestSession[],
  firstPart: SplitDailyRestBlock,
  now: number = Date.now(),
): SplitDailyRestBlock | null {
  const firstPartEndTimestamp = new Date(firstPart.endedAt).getTime();

  const candidates = sessions
    .filter((session) => {
      if (
        session.type !== "daily" ||
        session.id === firstPart.id ||
        session.status === "interrupted"
      ) {
        return false;
      }

      const sessionStartedAt = new Date(session.startedAt).getTime();

      return (
        sessionStartedAt >= firstPartEndTimestamp &&
        getSessionDurationMinutes(session, now) >=
          SPLIT_DAILY_REST_LIMITS.secondPartMinutes
      );
    })
    .map((session) => createBlock(session, now))
    .filter((block): block is SplitDailyRestBlock => block !== null)
    .sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );

  return candidates[0] ?? null;
}

export function calculateLiveSplitDailyRestState(
  sessions: RestSession[],
  referenceStart: string | null,
  now: number = Date.now(),
): LiveSplitDailyRestState {
  if (referenceStart === null) {
    return {
      qualifyingFirstPart: null,
      qualifyingSecondPart: null,
      completedSplitRest: null,

      firstPartAchieved: false,
      secondPartAchieved: false,
      splitRestCompleted: false,

      firstPartMinutes: 0,
      secondPartMinutes: 0,
      totalRestMinutes: 0,

      secondPartMinutesRequired: SPLIT_DAILY_REST_LIMITS.secondPartMinutes,

      referenceDeadline: null,

      message: "No active daily-rest reference period has been established.",
    };
  }

  const referenceDeadline = calculateReferenceDeadline(referenceStart);

  const referenceDeadlineTimestamp = new Date(referenceDeadline).getTime();

  const firstPart = findQualifyingSplitFirstPart(sessions, referenceStart, now);

  if (firstPart === null) {
    return {
      qualifyingFirstPart: null,
      qualifyingSecondPart: null,
      completedSplitRest: null,

      firstPartAchieved: false,
      secondPartAchieved: false,
      splitRestCompleted: false,

      firstPartMinutes: 0,
      secondPartMinutes: 0,
      totalRestMinutes: 0,

      secondPartMinutesRequired: SPLIT_DAILY_REST_LIMITS.secondPartMinutes,

      referenceDeadline,

      message:
        "No completed qualifying first part of a split regular daily rest has been detected.",
    };
  }

  const secondPart = findQualifyingSplitSecondPart(sessions, firstPart, now);

  if (secondPart === null) {
    return {
      qualifyingFirstPart: firstPart,

      qualifyingSecondPart: null,

      completedSplitRest: null,

      firstPartAchieved: true,
      secondPartAchieved: false,
      splitRestCompleted: false,

      firstPartMinutes: firstPart.durationMinutes,

      secondPartMinutes: 0,

      totalRestMinutes: firstPart.durationMinutes,

      secondPartMinutesRequired: SPLIT_DAILY_REST_LIMITS.secondPartMinutes,

      referenceDeadline,

      message:
        "A qualifying first split-rest period has been recorded. A later daily-rest session of at least 9 hours is required.",
    };
  }

  const totalRestMinutes =
    firstPart.durationMinutes + secondPart.durationMinutes;

  const secondPartEndTimestamp = new Date(secondPart.endedAt).getTime();

  const completedWithinReferencePeriod =
    secondPartEndTimestamp <= referenceDeadlineTimestamp;

  const hasMinimumCombinedRest =
    totalRestMinutes >= SPLIT_DAILY_REST_LIMITS.totalMinimumMinutes;

  const splitRestCompleted =
    completedWithinReferencePeriod && hasMinimumCombinedRest;

  const completedSplitRest: CompletedSplitDailyRest | null = splitRestCompleted
    ? {
        firstPart,
        secondPart,
        totalRestMinutes,
        completedAt: secondPart.endedAt,
        completedWithinReferencePeriod,
      }
    : null;

  let message: string;

  if (!completedWithinReferencePeriod) {
    message =
      "The qualifying 3-hour and 9-hour rest periods were detected, but the second part completed after the current 24-hour reference deadline.";
  } else if (!hasMinimumCombinedRest) {
    message =
      "Both split-rest periods were detected, but their combined qualifying rest is below 12 hours.";
  } else {
    message =
      "Split regular daily rest achieved. The reduced daily-rest allowance is preserved.";
  }

  return {
    qualifyingFirstPart: firstPart,

    qualifyingSecondPart: secondPart,

    completedSplitRest,

    firstPartAchieved: true,
    secondPartAchieved: true,
    splitRestCompleted,

    firstPartMinutes: firstPart.durationMinutes,

    secondPartMinutes: secondPart.durationMinutes,

    totalRestMinutes,

    secondPartMinutesRequired: SPLIT_DAILY_REST_LIMITS.secondPartMinutes,

    referenceDeadline,

    message,
  };
}
