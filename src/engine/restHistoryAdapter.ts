import type { RestSession } from "../data/restSession";

import type { VerifiedReducedDailyRestEvidence } from "./dailyRestReferencePeriod";

import type {
    DailyRestHistoryEntry,
    DailyRestHistoryEntryType,
} from "./reducedDailyRestHistory";

import { evaluateReducedDailyRestHistory } from "./reducedDailyRestHistory";

import { DAILY_REST_LIMITS } from "./dailyRestRules";

import { calculateLiveSplitDailyRestState } from "./liveSplitDailyRestState";

const MINUTES_PER_HOUR = 60;

const REGULAR_WEEKLY_REST_MINUTES = 45 * MINUTES_PER_HOUR;

function formatLocalDate(timestamp: string): string {
  const date = new Date(timestamp);

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDurationMinutes(session: RestSession): number {
  if (session.endedAt === null) {
    return 0;
  }

  const start = new Date(session.startedAt).getTime();

  const end = new Date(session.endedAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }

  return Math.floor((end - start) / (60 * 1000));
}

function createHistoryEntry(
  id: string,
  date: string,
  type: DailyRestHistoryEntryType,
): DailyRestHistoryEntry {
  return {
    id,
    date,
    type,
  };
}

/**
 * Converts completed RestSession records into
 * daily/weekly rest-history entries.
 *
 * Important:
 *
 * Only sessions explicitly marked "completed"
 * can enter qualifying rest history.
 *
 * Split regular daily rest is identified before
 * individual 9-hour sessions are considered for
 * reduced-rest classification.
 *
 * This prevents the 9-hour second part of a valid
 * 3+9 split regular daily rest from incorrectly
 * consuming one of the driver's reduced rests.
 *
 * The returned history is ordered by the exact
 * time each qualifying rest completed.
 */
export function buildDailyRestHistoryFromSessions(
  sessions: RestSession[],
  referenceStart: string | null,
): DailyRestHistoryEntry[] {
  const completedSessions = sessions
    .filter(
      (session) => session.status === "completed" && session.endedAt !== null,
    )
    .sort(
      (a, b) =>
        new Date(a.endedAt as string).getTime() -
        new Date(b.endedAt as string).getTime(),
    );

  const entries: DailyRestHistoryEntry[] = [];

  /**
   * DailyRestHistoryEntry intentionally remains
   * small and public-facing.
   *
   * Exact completion timestamps are therefore
   * retained internally for chronological
   * ordering.
   */
  const entryCompletionTimes = new Map<string, number>();

  const consumedSessionIds = new Set<string>();

  /**
   * First identify a valid 3h + 9h split
   * regular daily rest.
   */
  if (referenceStart !== null) {
    const splitState = calculateLiveSplitDailyRestState(
      completedSessions,
      referenceStart,
    );

    if (
      splitState.splitRestCompleted &&
      splitState.completedSplitRest !== null
    ) {
      const { firstPart, secondPart } = splitState.completedSplitRest;

      consumedSessionIds.add(firstPart.id);

      consumedSessionIds.add(secondPart.id);

      const splitEntry = createHistoryEntry(
        `split-regular-${firstPart.id}-${secondPart.id}`,
        formatLocalDate(secondPart.endedAt),
        "split-regular-daily-rest",
      );

      entries.push(splitEntry);

      entryCompletionTimes.set(
        splitEntry.id,
        new Date(secondPart.endedAt).getTime(),
      );
    }
  }

  /**
   * Classify all remaining completed sessions.
   */
  for (const session of completedSessions) {
    if (consumedSessionIds.has(session.id)) {
      continue;
    }

    const durationMinutes = getDurationMinutes(session);

    /**
     * WEEKLY REST
     *
     * For this safe first version, only a
     * regular weekly rest of at least 45 hours
     * establishes the weekly-rest reset used
     * by the reduced-daily-rest history engine.
     *
     * Reduced weekly rest and compensation
     * require their own verified engine and
     * must not be guessed here.
     */
    if (session.type === "weekly") {
      if (durationMinutes < REGULAR_WEEKLY_REST_MINUTES) {
        continue;
      }

      const weeklyEntry = createHistoryEntry(
        `weekly-${session.id}`,
        formatLocalDate(session.endedAt as string),
        "weekly-rest",
      );

      entries.push(weeklyEntry);

      entryCompletionTimes.set(
        weeklyEntry.id,
        new Date(session.endedAt as string).getTime(),
      );

      continue;
    }

    if (session.type !== "daily") {
      continue;
    }

    /**
     * 11h+ continuous daily rest:
     * regular daily rest.
     */
    if (durationMinutes >= DAILY_REST_LIMITS.regularDailyRestMinutes) {
      const regularEntry = createHistoryEntry(
        `regular-${session.id}`,
        formatLocalDate(session.endedAt as string),
        "regular-daily-rest",
      );

      entries.push(regularEntry);

      entryCompletionTimes.set(
        regularEntry.id,
        new Date(session.endedAt as string).getTime(),
      );

      continue;
    }

    /**
     * 9h to <11h continuous daily rest:
     * reduced daily rest candidate.
     *
     * If this session was the 9-hour second
     * part of a valid split rest, it was
     * already consumed above and cannot
     * reach this branch.
     */
    if (durationMinutes >= DAILY_REST_LIMITS.reducedDailyRestMinutes) {
      const reducedEntry = createHistoryEntry(
        `reduced-${session.id}`,
        formatLocalDate(session.endedAt as string),
        "reduced-daily-rest",
      );

      entries.push(reducedEntry);

      entryCompletionTimes.set(
        reducedEntry.id,
        new Date(session.endedAt as string).getTime(),
      );
    }

    /**
     * Less than 9 hours:
     *
     * No completed daily-rest history entry
     * is created.
     *
     * A completed 3h+ session may still
     * participate as the first part of a
     * valid split regular daily rest.
     */
  }

  /**
   * Split detection happens before ordinary
   * classification, so insertion order cannot
   * be trusted.
   *
   * Sort by the exact time each rest actually
   * completed.
   */
  return entries.sort((a, b) => {
    const aCompletionTime = entryCompletionTimes.get(a.id) ?? 0;

    const bCompletionTime = entryCompletionTimes.get(b.id) ?? 0;

    return aCompletionTime - bCompletionTime;
  });
}

/**
 * Builds rest history across successive verified
 * reference periods.
 *
 * This is deliberately separate from
 * buildDailyRestHistoryFromSessions().
 *
 * The existing builder evaluates one supplied
 * reference period. Historical evidence needs to
 * advance the reference boundary each time a
 * qualifying daily or weekly rest completes.
 */
export function buildSegmentedDailyRestHistoryFromSessions(
  sessions: RestSession[],
): DailyRestHistoryEntry[] {
  const completedSessions = sessions
    .filter(
      (session) => session.status === "completed" && session.endedAt !== null,
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(a.endedAt as string).getTime() -
        new Date(b.endedAt as string).getTime(),
    );

  if (completedSessions.length === 0) {
    return [];
  }

  /**
   * Historical segmentation cannot safely begin
   * from an arbitrary daily-rest session because
   * its legal context may pre-date the available
   * data.
   *
   * For now, establish history only from the first
   * recorded regular weekly rest of at least 45h.
   */
  const baselineIndex = completedSessions.findIndex(
    (session) =>
      session.type === "weekly" &&
      getDurationMinutes(session) >= REGULAR_WEEKLY_REST_MINUTES,
  );

  if (baselineIndex === -1) {
    return [];
  }

  const baselineSession = completedSessions[baselineIndex];

  if (baselineSession.endedAt === null) {
    return [];
  }

  const history: DailyRestHistoryEntry[] = [
    createHistoryEntry(
      `weekly-${baselineSession.id}`,
      formatLocalDate(baselineSession.endedAt),
      "weekly-rest",
    ),
  ];

  let referenceStart = baselineSession.endedAt;

  const remainingSessions = completedSessions.slice(baselineIndex + 1);

  /**
   * We deliberately process one reference period
   * at a time.
   *
   * A later implementation can preserve richer
   * provenance, but this gives us a safe baseline
   * for testing historical 3+9 recognition without
   * pretending that pre-baseline history is known.
   */
  while (remainingSessions.length > 0) {
    const referenceTimestamp = new Date(referenceStart).getTime();

    const referenceDeadline = referenceTimestamp + 24 * 60 * 60 * 1000;

    const sessionsInsideReferencePeriod = remainingSessions.filter(
      (session) => {
        const startedAt = new Date(session.startedAt).getTime();

        return (
          Number.isFinite(startedAt) &&
          startedAt >= referenceTimestamp &&
          startedAt <= referenceDeadline
        );
      },
    );

    if (sessionsInsideReferencePeriod.length === 0) {
      break;
    }

    const periodHistory = buildDailyRestHistoryFromSessions(
      sessionsInsideReferencePeriod,
      referenceStart,
    );

    if (periodHistory.length === 0) {
      break;
    }

    const nextEntry = periodHistory[0];

    history.push(nextEntry);

    const matchingSession = sessionsInsideReferencePeriod.find((session) => {
      if (nextEntry.type === "weekly-rest") {
        return nextEntry.id === `weekly-${session.id}`;
      }

      if (nextEntry.type === "regular-daily-rest") {
        return nextEntry.id === `regular-${session.id}`;
      }

      if (nextEntry.type === "reduced-daily-rest") {
        return nextEntry.id === `reduced-${session.id}`;
      }

      return false;
    });

    if (nextEntry.type === "split-regular-daily-rest") {
      const splitState = calculateLiveSplitDailyRestState(
        sessionsInsideReferencePeriod,
        referenceStart,
      );

      if (
        !splitState.splitRestCompleted ||
        splitState.completedSplitRest === null
      ) {
        break;
      }

      referenceStart = splitState.completedSplitRest.secondPart.endedAt;
    } else {
      if (matchingSession === undefined || matchingSession.endedAt === null) {
        break;
      }

      referenceStart = matchingSession.endedAt;
    }

    const nextReferenceTimestamp = new Date(referenceStart).getTime();

    for (let index = remainingSessions.length - 1; index >= 0; index -= 1) {
      const endedAt = remainingSessions[index].endedAt;

      if (
        endedAt !== null &&
        new Date(endedAt).getTime() <= nextReferenceTimestamp
      ) {
        remainingSessions.splice(index, 1);
      }
    }
  }

  return history;
}

/**
 * Builds the chronological history used when
 * verifying reduced daily-rest entitlement.
 *
 * Before the first known qualifying 45-hour
 * weekly-rest baseline, reduced-rest candidates
 * are retained from raw history so they can
 * remain explicitly UNVERIFIED.
 *
 * From that known weekly-rest baseline onward,
 * segmented legal history is used so valid
 * 3h + 9h split regular daily rests are not
 * misclassified as reduced daily rests.
 */
export function buildReducedRestEvidenceHistoryFromSessions(
  sessions: RestSession[],
): DailyRestHistoryEntry[] {
  const completedSessions = sessions
    .filter(
      (session) => session.status === "completed" && session.endedAt !== null,
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(a.endedAt as string).getTime() -
        new Date(b.endedAt as string).getTime(),
    );

  /**
   * First preserve the existing raw view.
   *
   * This is important when no trustworthy
   * weekly-rest baseline exists.
   */
  const rawHistory = buildDailyRestHistoryFromSessions(completedSessions, null);

  const baselineSession = completedSessions.find(
    (session) =>
      session.type === "weekly" &&
      getDurationMinutes(session) >= REGULAR_WEEKLY_REST_MINUTES,
  );

  /**
   * No known weekly baseline:
   *
   * retain raw history exactly as before.
   * Reduced candidates can therefore still
   * produce explicit unverified evidence.
   */
  if (baselineSession === undefined || baselineSession.endedAt === null) {
    return rawHistory;
  }

  const baselineCompletionTimestamp = new Date(
    baselineSession.endedAt,
  ).getTime();

  /**
   * Preserve only history that completed BEFORE
   * the first known weekly baseline.
   *
   * We identify the underlying RestSession from
   * the history-entry id.
   */
  const preBaselineHistory = rawHistory.filter((entry) => {
    const matchingSession = completedSessions.find((session) => {
      return (
        entry.id === `weekly-${session.id}` ||
        entry.id === `regular-${session.id}` ||
        entry.id === `reduced-${session.id}`
      );
    });

    if (matchingSession === undefined || matchingSession.endedAt === null) {
      return false;
    }

    return (
      new Date(matchingSession.endedAt).getTime() < baselineCompletionTimestamp
    );
  });

  /**
   * From the first known weekly baseline onward,
   * use legally segmented history.
   */
  const segmentedHistory =
    buildSegmentedDailyRestHistoryFromSessions(completedSessions);

  return [...preBaselineHistory, ...segmentedHistory];
}

/**
 * Builds explicit verification evidence for
 * reduced daily-rest sessions.
 *
 * Conservative rule:
 *
 * A reduced daily rest cannot be verified
 * merely because its duration was at least
 * 9 hours.
 *
 * TachoTrack must first have a known qualifying
 * weekly-rest baseline in the available history.
 *
 * This prevents incomplete historical data from
 * silently creating reduced-rest entitlement.
 */
export function buildVerifiedReducedDailyRestEvidence(
  sessions: RestSession[],
): VerifiedReducedDailyRestEvidence[] {
  const chronologicalHistory =
    buildReducedRestEvidenceHistoryFromSessions(sessions);

  const evidence: VerifiedReducedDailyRestEvidence[] = [];

  const acceptedHistory: DailyRestHistoryEntry[] = [];

  let weeklyRestBaselineEstablished = false;

  for (const entry of chronologicalHistory) {
    /**
     * A qualifying 45h+ weekly-rest entry
     * establishes a known baseline and also
     * resets reduced-rest counting through
     * evaluateReducedDailyRestHistory().
     */
    if (entry.type === "weekly-rest") {
      weeklyRestBaselineEstablished = true;

      acceptedHistory.push(entry);

      continue;
    }

    /**
     * Regular and split-regular daily rests
     * remain part of chronological history
     * but do not consume reduced-rest
     * allowance.
     */
    if (entry.type !== "reduced-daily-rest") {
      acceptedHistory.push(entry);

      continue;
    }

    const sessionId = entry.id.replace("reduced-", "");

    /**
     * Without a known weekly-rest baseline,
     * TachoTrack cannot know how many reduced
     * daily rests may have occurred before the
     * available history began.
     *
     * Therefore this candidate remains
     * explicitly unverified.
     */
    if (!weeklyRestBaselineEstablished) {
      evidence.push({
        sessionId,
        verified: false,
      });

      acceptedHistory.push(entry);

      continue;
    }

    /**
     * Evaluate entitlement BEFORE adding the
     * proposed reduced rest to accepted history.
     */
    const reducedHistoryState =
      evaluateReducedDailyRestHistory(acceptedHistory);

    if (reducedHistoryState.canTakeAnotherReducedRest) {
      evidence.push({
        sessionId,
        verified: true,
      });

      acceptedHistory.push(entry);

      continue;
    }

    /**
     * The reduced-rest allowance has already
     * been exhausted since the latest known
     * weekly-rest reset.
     */
    evidence.push({
      sessionId,
      verified: false,
    });

    acceptedHistory.push(entry);
  }

  return evidence;
}
