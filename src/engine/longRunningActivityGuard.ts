import {
  getActiveActivityEvent,
  type ActivityHistoryState,
} from "../data/activityHistory";
import type {
  RestSessionState,
  RestSessionType,
} from "../data/restSession";

const MINUTE_MILLISECONDS = 60 * 1000;

export type LongRunningActivityGuardStatus =
  | "inactive"
  | "within-threshold"
  | "confirmation-required"
  | "confirmed";

export interface LongRunningActivityConfirmation {
  eventId: string;
  confirmedAt: string;
}

export interface LongRunningActivityGuardOptions {
  ordinaryThresholdMinutes?: number;
  weeklyRestThresholdMinutes?: number;
  reconfirmAfterMinutes?: number;
  confirmation?: LongRunningActivityConfirmation | null;
}

export interface LongRunningActivityGuardState {
  status: LongRunningActivityGuardStatus;
  activeEventId: string | null;
  elapsedMinutes: number;
  thresholdMinutes: number | null;
  matchedRestType: RestSessionType | null;
  confirmationRequired: boolean;
  confirmedAt: string | null;
  message: string;
}

const DEFAULT_ORDINARY_THRESHOLD_MINUTES = 24 * 60;
const DEFAULT_WEEKLY_REST_THRESHOLD_MINUTES = 72 * 60;
const DEFAULT_RECONFIRM_AFTER_MINUTES = 12 * 60;

function requireTimestamp(value: string, fieldName: string): number {
  const milliseconds = new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  return milliseconds;
}

function requireNonNegativeMinutes(
  value: number,
  fieldName: string,
): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }

  return value;
}

function findMatchedRestType(
  history: ActivityHistoryState,
  restState: RestSessionState,
): RestSessionType | null {
  const activeEvent = getActiveActivityEvent(history);

  if (activeEvent?.activity !== "break" || restState.activeSessionId === null) {
    return null;
  }

  const activeRest = restState.sessions.find(
    (session) =>
      session.id === restState.activeSessionId && session.status === "active",
  );

  if (activeRest === undefined) {
    return null;
  }

  const activityStartedAt = requireTimestamp(
    activeEvent.startedAt,
    `activity start for ${activeEvent.id}`,
  );
  const restStartedAt = requireTimestamp(
    activeRest.startedAt,
    `rest start for ${activeRest.id}`,
  );

  return restStartedAt >= activityStartedAt ? activeRest.type : null;
}

function formatElapsedMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}

export function evaluateLongRunningActivityGuard(
  history: ActivityHistoryState,
  restState: RestSessionState,
  now: string | number | Date = Date.now(),
  options: LongRunningActivityGuardOptions = {},
): LongRunningActivityGuardState {
  const nowMilliseconds =
    now instanceof Date
      ? now.getTime()
      : typeof now === "number"
        ? now
        : requireTimestamp(now, "current time");

  if (!Number.isFinite(nowMilliseconds)) {
    throw new Error("Invalid current time.");
  }

  const ordinaryThresholdMinutes = requireNonNegativeMinutes(
    options.ordinaryThresholdMinutes ?? DEFAULT_ORDINARY_THRESHOLD_MINUTES,
    "ordinaryThresholdMinutes",
  );
  const weeklyRestThresholdMinutes = requireNonNegativeMinutes(
    options.weeklyRestThresholdMinutes ??
      DEFAULT_WEEKLY_REST_THRESHOLD_MINUTES,
    "weeklyRestThresholdMinutes",
  );
  const reconfirmAfterMinutes = requireNonNegativeMinutes(
    options.reconfirmAfterMinutes ?? DEFAULT_RECONFIRM_AFTER_MINUTES,
    "reconfirmAfterMinutes",
  );

  const activeEvent = getActiveActivityEvent(history);

  if (activeEvent === null) {
    return {
      status: "inactive",
      activeEventId: null,
      elapsedMinutes: 0,
      thresholdMinutes: null,
      matchedRestType: null,
      confirmationRequired: false,
      confirmedAt: null,
      message: "No activity is currently open.",
    };
  }

  const startedAtMilliseconds = requireTimestamp(
    activeEvent.startedAt,
    `activity start for ${activeEvent.id}`,
  );
  const elapsedMinutes = Math.max(
    0,
    Math.floor((nowMilliseconds - startedAtMilliseconds) / MINUTE_MILLISECONDS),
  );
  const matchedRestType = findMatchedRestType(history, restState);
  const thresholdMinutes =
    matchedRestType === "weekly"
      ? weeklyRestThresholdMinutes
      : ordinaryThresholdMinutes;

  if (elapsedMinutes < thresholdMinutes) {
    return {
      status: "within-threshold",
      activeEventId: activeEvent.id,
      elapsedMinutes,
      thresholdMinutes,
      matchedRestType,
      confirmationRequired: false,
      confirmedAt: null,
      message: `The current activity has been open for ${formatElapsedMinutes(elapsedMinutes)}.`,
    };
  }

  const confirmation = options.confirmation;
  const confirmationMatches = confirmation?.eventId === activeEvent.id;
  const confirmedAtMilliseconds =
    confirmationMatches && confirmation !== null && confirmation !== undefined
      ? requireTimestamp(confirmation.confirmedAt, "confirmation time")
      : null;
  const confirmationIsValid =
    confirmedAtMilliseconds !== null &&
    confirmedAtMilliseconds >= startedAtMilliseconds &&
    confirmedAtMilliseconds <= nowMilliseconds &&
    nowMilliseconds - confirmedAtMilliseconds <
      reconfirmAfterMinutes * MINUTE_MILLISECONDS;

  if (confirmationIsValid) {
    return {
      status: "confirmed",
      activeEventId: activeEvent.id,
      elapsedMinutes,
      thresholdMinutes,
      matchedRestType,
      confirmationRequired: false,
      confirmedAt: confirmation?.confirmedAt ?? null,
      message: `The current activity was confirmed and remains open after ${formatElapsedMinutes(elapsedMinutes)}.`,
    };
  }

  return {
    status: "confirmation-required",
    activeEventId: activeEvent.id,
    elapsedMinutes,
    thresholdMinutes,
    matchedRestType,
    confirmationRequired: true,
    confirmedAt: null,
    message: `${activeEvent.activity} has been active for ${formatElapsedMinutes(elapsedMinutes)}. Confirm that this is still correct before relying on the live record.`,
  };
}
