import type { RestSession } from "../data/restSession";

import type {
    ComplianceNetworkEvidenceEvent,
    ComplianceNetworkLineId,
    ComplianceNetworkSeverity,
    ComplianceNetworkTimer,
    ComplianceNetworkTimerState,
} from "./complianceNetworkMap";
import {
    evaluateRestResumption,
    formatRemainingRest,
    type RestResumptionRequirement,
} from "./restResumptionGuard";
import {
    calculateRestSafetyTimes,
    DEFAULT_SAFETY_MARGIN_SETTINGS,
    evaluateRestSafetyStatus,
    formatSafetyMinutes,
    type SafetyMarginSettings,
} from "./safetyMargin";

export interface BuildRestComplianceNetworkEvidenceOptions {
  session: RestSession;
  baseRestMinutes: number;
  compensationMinutes?: number;
  currentDateTime: string;
  safetySettings?: SafetyMarginSettings;
}

function requireMinuteAmount(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number of minutes.`);
  }

  return Math.floor(value);
}

function requireTimestamp(value: string, fieldName: string): string {
  const milliseconds = new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  return new Date(milliseconds).toISOString();
}

function getEffectiveCurrentDateTime(
  session: RestSession,
  currentDateTime: string,
): string {
  if (session.status === "active") {
    return requireTimestamp(currentDateTime, "rest timer current date");
  }

  if (session.endedAt !== null) {
    return requireTimestamp(session.endedAt, "rest session end");
  }

  return requireTimestamp(currentDateTime, "rest timer current date");
}

function getLineIds(
  session: RestSession,
  compensationMinutes: number,
): ComplianceNetworkLineId[] {
  if (session.type === "daily") {
    return ["daily-rest"];
  }

  return compensationMinutes > 0
    ? ["weekly-rest", "compensation"]
    : ["weekly-rest"];
}

function getTimerState(
  session: RestSession,
  legallyComplete: boolean,
  recommendedResumeReached: boolean,
): ComplianceNetworkTimerState {
  if (session.status !== "active" && !legallyComplete) {
    return "interrupted";
  }

  if (!legallyComplete) {
    return "protected";
  }

  if (!recommendedResumeReached) {
    return "safety-buffer";
  }

  return "cleared";
}

function getSeverity(
  state: ComplianceNetworkTimerState,
  guardLevel: "good" | "warning" | "breach-risk",
): ComplianceNetworkSeverity {
  switch (state) {
    case "interrupted":
      return "breach";

    case "safety-buffer":
      return "warning";

    case "cleared":
      return "good";

    case "protected":
      return guardLevel === "breach-risk" ? "warning" : "info";
  }
}

function getDisplay(
  state: ComplianceNetworkTimerState,
  remainingToLegalMinutes: number,
  remainingToRecommendedMinutes: number,
): string {
  switch (state) {
    case "interrupted":
      return `${formatRemainingRest(remainingToLegalMinutes)} rest missing`;

    case "protected":
      return `${formatRemainingRest(remainingToLegalMinutes)} to legal rest`;

    case "safety-buffer":
      return `${formatSafetyMinutes(remainingToRecommendedMinutes)} safety buffer`;

    case "cleared":
      return "Safe to resume";
  }
}

function getTitle(
  session: RestSession,
  state: ComplianceNetworkTimerState,
): string {
  const restLabel = session.type === "weekly" ? "Weekly rest" : "Daily rest";

  switch (state) {
    case "protected":
      return `${restLabel} in progress`;

    case "safety-buffer":
      return `${restLabel} legally complete`;

    case "cleared":
      return `${restLabel} cleared`;

    case "interrupted":
      return `${restLabel} interrupted`;
  }
}

export function buildRestComplianceNetworkEvidence(
  options: BuildRestComplianceNetworkEvidenceOptions,
): ComplianceNetworkEvidenceEvent {
  const baseRestMinutes = requireMinuteAmount(
    options.baseRestMinutes,
    "Base rest",
  );
  const compensationMinutes = requireMinuteAmount(
    options.compensationMinutes ?? 0,
    "Rest compensation",
  );
  const restStart = requireTimestamp(
    options.session.startedAt,
    "rest session start",
  );
  const effectiveCurrentDateTime = getEffectiveCurrentDateTime(
    options.session,
    options.currentDateTime,
  );

  const requirement: RestResumptionRequirement = {
    restStart,
    baseRestMinutes,
    compensationMinutes,
  };

  const resumption = evaluateRestResumption(
    requirement,
    effectiveCurrentDateTime,
  );
  const safetyTimes = calculateRestSafetyTimes(
    resumption.restMustContinueUntil,
    options.safetySettings ?? DEFAULT_SAFETY_MARGIN_SETTINGS,
  );
  const safetyStatus = evaluateRestSafetyStatus(
    effectiveCurrentDateTime,
    safetyTimes,
  );
  const timerState = getTimerState(
    options.session,
    resumption.restComplete,
    safetyStatus.recommendedTimeReached,
  );
  const timer: ComplianceNetworkTimer = {
    id: `rest-timer-${options.session.id}`,
    kind: "rest",
    state: timerState,
    startedAt: restStart,
    legalCompleteAt: safetyTimes.legalRestCompleteTime,
    recommendedResumeAt: safetyTimes.recommendedResumeTime,
    totalRequiredMinutes: resumption.totalRequiredRestMinutes,
    elapsedMinutes: resumption.elapsedRestMinutes,
    remainingToLegalMinutes: resumption.remainingMinutes,
    remainingToRecommendedMinutes: safetyStatus.remainingToRecommendedMinutes,
    legallyComplete: resumption.restComplete,
    recommendedResumeReached: safetyStatus.recommendedTimeReached,
    display: getDisplay(
      timerState,
      resumption.remainingMinutes,
      safetyStatus.remainingToRecommendedMinutes,
    ),
  };

  return {
    id: `rest-network-${options.session.id}`,
    occurredAt: restStart,
    title: getTitle(options.session, timerState),
    summary:
      `${timer.display}. Legal completion: ${timer.legalCompleteAt}. ` +
      `Recommended resume: ${timer.recommendedResumeAt}.`,
    severity: getSeverity(timerState, resumption.level),
    lineIds: getLineIds(options.session, compensationMinutes),
    sourceIds: [options.session.id],
    timers: [timer],
  };
}
