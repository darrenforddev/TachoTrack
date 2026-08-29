import type { RestSession } from "../data/restSession";

import type {
    DailyRestHistoryEntry,
    ReducedDailyRestHistoryState,
} from "./reducedDailyRestHistory";

import {
    evaluateReducedDailyRestHistory,
    REDUCED_DAILY_REST_HISTORY_LIMITS,
} from "./reducedDailyRestHistory";

import {
    buildReducedRestEvidenceHistoryFromSessions,
    buildVerifiedReducedDailyRestEvidence,
} from "./restHistoryAdapter";

export type ReducedDailyRestAllowanceStatus = "verified" | "unverified";

export interface ReducedDailyRestAllowanceState {
  status: ReducedDailyRestAllowanceStatus;

  maximumReducedDailyRests: number;

  reducedRestsUsed: number | null;

  reducedRestsRemaining: number | null;

  canTakeAnotherReducedRest: boolean;

  level: ReducedDailyRestHistoryState["level"] | null;

  issues: ReducedDailyRestHistoryState["issues"];

  referenceWeeklyRestSessionId: string | null;

  referenceWeeklyRestEnd: string | null;

  historySinceLastWeeklyRest: DailyRestHistoryEntry[];

  acceptedReducedRestSessionIds: string[];

  rejectedReducedRestSessionIds: string[];

  unverifiedReducedRestSessionIds: string[];

  explanation: string;
}

function findLatestWeeklyRestEntry(
  history: DailyRestHistoryEntry[],
): DailyRestHistoryEntry | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].type === "weekly-rest") {
      return history[index];
    }
  }

  return null;
}

function getSessionIdFromHistoryEntry(entry: DailyRestHistoryEntry): string {
  if (entry.type === "weekly-rest") {
    return entry.id.replace("weekly-", "");
  }

  if (entry.type === "reduced-daily-rest") {
    return entry.id.replace("reduced-", "");
  }

  return entry.id;
}

function buildVerifiedExplanation(state: ReducedDailyRestHistoryState): string {
  const maximum =
    REDUCED_DAILY_REST_HISTORY_LIMITS.maxReducedDailyRestsBetweenWeeklyRests;

  if (state.level === "breach") {
    return (
      state.issues[0]?.description ??
      "The reduced daily-rest allowance has been exceeded."
    );
  }

  if (state.reducedRestsRemaining === 0) {
    return (
      `All ${maximum} reduced daily rests have been used ` +
      `since the latest qualifying weekly rest.`
    );
  }

  if (state.reducedRestsUsed === 0) {
    return (
      `No reduced daily rests have been used since the ` +
      `latest qualifying weekly rest. All ${maximum} remain available.`
    );
  }

  const restWord = state.reducedRestsRemaining === 1 ? "rest" : "rests";

  return (
    `${state.reducedRestsUsed} reduced daily ` +
    `${state.reducedRestsUsed === 1 ? "rest has" : "rests have"} ` +
    `been used since the latest qualifying weekly rest. ` +
    `${state.reducedRestsRemaining} reduced ${restWord} remain available.`
  );
}

/**
 * Calculates the driver's current reduced
 * daily-rest allowance.
 *
 * Conservative rule:
 *
 * The allowance is not shown as available
 * until TachoTrack has a known completed
 * regular weekly rest of at least 45 hours.
 */
export function calculateReducedDailyRestAllowance(
  sessions: RestSession[],
): ReducedDailyRestAllowanceState {
  const maximum =
    REDUCED_DAILY_REST_HISTORY_LIMITS.maxReducedDailyRestsBetweenWeeklyRests;

  const history = buildReducedRestEvidenceHistoryFromSessions(sessions);

  const evidence = buildVerifiedReducedDailyRestEvidence(sessions);

  const latestWeeklyRestEntry = findLatestWeeklyRestEntry(history);

  /**
   * Without a known weekly-rest baseline,
   * TachoTrack cannot safely calculate how
   * many reductions remain.
   */
  if (latestWeeklyRestEntry === null) {
    return {
      status: "unverified",

      maximumReducedDailyRests: maximum,

      reducedRestsUsed: null,

      reducedRestsRemaining: null,

      canTakeAnotherReducedRest: false,

      level: null,

      issues: [],

      referenceWeeklyRestSessionId: null,

      referenceWeeklyRestEnd: null,

      historySinceLastWeeklyRest: [],

      acceptedReducedRestSessionIds: [],

      rejectedReducedRestSessionIds: [],

      unverifiedReducedRestSessionIds: evidence
        .filter((item) => !item.verified)
        .map((item) => item.sessionId),

      explanation:
        "Reduced daily-rest allowance cannot be verified because " +
        "the available history does not contain a completed regular " +
        "weekly rest of at least 45 hours.",
    };
  }

  const referenceWeeklyRestSessionId = getSessionIdFromHistoryEntry(
    latestWeeklyRestEntry,
  );

  const referenceWeeklyRestSession = sessions.find(
    (session) =>
      session.id === referenceWeeklyRestSessionId &&
      session.type === "weekly" &&
      session.status === "completed",
  );

  const evaluatedState = evaluateReducedDailyRestHistory(history);

  const currentReducedRestSessionIds = new Set(
    evaluatedState.historySinceLastWeeklyRest
      .filter((entry) => entry.type === "reduced-daily-rest")
      .map((entry) => getSessionIdFromHistoryEntry(entry)),
  );

  const currentEvidence = evidence.filter((item) =>
    currentReducedRestSessionIds.has(item.sessionId),
  );

  const acceptedReducedRestSessionIds = currentEvidence
    .filter((item) => item.verified)
    .map((item) => item.sessionId);

  /**
   * Once a weekly baseline is established,
   * a false evidence result in the current
   * period means the allowance had already
   * been exhausted.
   */
  const rejectedReducedRestSessionIds = currentEvidence
    .filter((item) => !item.verified)
    .map((item) => item.sessionId);

  return {
    status: "verified",

    maximumReducedDailyRests: maximum,

    reducedRestsUsed: evaluatedState.reducedRestsUsed,

    reducedRestsRemaining: evaluatedState.reducedRestsRemaining,

    canTakeAnotherReducedRest: evaluatedState.canTakeAnotherReducedRest,

    level: evaluatedState.level,

    issues: evaluatedState.issues,

    referenceWeeklyRestSessionId,

    referenceWeeklyRestEnd: referenceWeeklyRestSession?.endedAt ?? null,

    historySinceLastWeeklyRest: evaluatedState.historySinceLastWeeklyRest,

    acceptedReducedRestSessionIds,

    rejectedReducedRestSessionIds,

    unverifiedReducedRestSessionIds: [],

    explanation: buildVerifiedExplanation(evaluatedState),
  };
}
