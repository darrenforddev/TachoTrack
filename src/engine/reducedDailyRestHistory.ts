import type { ComplianceLevel, DailyComplianceIssue } from "./types";

export type DailyRestHistoryEntryType =
  | "regular-daily-rest"
  | "reduced-daily-rest"
  | "split-regular-daily-rest"
  | "weekly-rest";

export interface DailyRestHistoryEntry {
  id: string;

  date: string;

  type: DailyRestHistoryEntryType;
}

export interface ReducedDailyRestHistoryState {
  reducedRestsUsed: number;

  reducedRestsRemaining: number;

  canTakeAnotherReducedRest: boolean;

  level: ComplianceLevel;

  issues: DailyComplianceIssue[];

  historySinceLastWeeklyRest: DailyRestHistoryEntry[];
}

export const REDUCED_DAILY_REST_HISTORY_LIMITS = {
  maxReducedDailyRestsBetweenWeeklyRests: 3,
} as const;

function findLastWeeklyRestIndex(history: DailyRestHistoryEntry[]): number {
  for (let index = history.length - 1; index >= 0; index--) {
    if (history[index].type === "weekly-rest") {
      return index;
    }
  }

  return -1;
}

/**
 * Returns only the entries after the
 * most recent weekly rest.
 *
 * A weekly rest resets the reduced
 * daily-rest counter.
 */
export function getHistorySinceLastWeeklyRest(
  history: DailyRestHistoryEntry[],
): DailyRestHistoryEntry[] {
  const lastWeeklyRestIndex = findLastWeeklyRestIndex(history);

  if (lastWeeklyRestIndex === -1) {
    return [...history];
  }

  return history.slice(lastWeeklyRestIndex + 1);
}

export function countReducedDailyRests(
  history: DailyRestHistoryEntry[],
): number {
  return getHistorySinceLastWeeklyRest(history).filter(
    (entry) => entry.type === "reduced-daily-rest",
  ).length;
}

export function evaluateReducedDailyRestHistory(
  history: DailyRestHistoryEntry[],
): ReducedDailyRestHistoryState {
  const historySinceLastWeeklyRest = getHistorySinceLastWeeklyRest(history);

  const reducedRestsUsed = historySinceLastWeeklyRest.filter(
    (entry) => entry.type === "reduced-daily-rest",
  ).length;

  const maximum =
    REDUCED_DAILY_REST_HISTORY_LIMITS.maxReducedDailyRestsBetweenWeeklyRests;

  const reducedRestsRemaining = Math.max(0, maximum - reducedRestsUsed);

  const issues: DailyComplianceIssue[] = [];

  let level: ComplianceLevel = "good";

  if (reducedRestsUsed > maximum) {
    const excess = reducedRestsUsed - maximum;

    const latestReduced = [...historySinceLastWeeklyRest]
      .reverse()
      .find((entry) => entry.type === "reduced-daily-rest");

    issues.push({
      id: "reduced-daily-rest-count-breach",

      date: latestReduced?.date ?? "",

      rule: "daily-rest",

      level: "breach",

      title: "Too many reduced daily rests",

      description:
        `Reduced daily rest has been used ` +
        `${reducedRestsUsed} times since the ` +
        `last weekly rest. The maximum is ${maximum}.`,

      varianceMinutes: excess,
    });

    level = "breach";
  } else if (reducedRestsUsed === maximum) {
    /**
     * This is not itself a breach.
     *
     * TachoTrack marks it as WARNING
     * because no further reduced daily
     * rest is available before the next
     * weekly rest.
     */
    issues.push({
      id: "reduced-daily-rest-limit-reached",

      date:
        historySinceLastWeeklyRest[historySinceLastWeeklyRest.length - 1]
          ?.date ?? "",

      rule: "daily-rest",

      level: "warning",

      title: "Reduced daily-rest allowance used",

      description:
        `All ${maximum} reduced daily rests ` +
        `have been used since the last weekly rest.`,

      varianceMinutes: 0,
    });

    level = "warning";
  }

  return {
    reducedRestsUsed,

    reducedRestsRemaining,

    canTakeAnotherReducedRest: reducedRestsUsed < maximum,

    level,

    issues,

    historySinceLastWeeklyRest,
  };
}

/**
 * Convenience helper for a proposed
 * additional reduced daily rest.
 *
 * This lets the dashboard/Jess warn the
 * driver BEFORE the next reduction occurs.
 */
export function evaluateProposedReducedDailyRest(
  history: DailyRestHistoryEntry[],
  proposedDate: string,
): ReducedDailyRestHistoryState {
  const proposedEntry: DailyRestHistoryEntry = {
    id: `proposed-reduced-rest-` + proposedDate,

    date: proposedDate,

    type: "reduced-daily-rest",
  };

  return evaluateReducedDailyRestHistory([...history, proposedEntry]);
}
