import type { ActivityHistoryEvent } from "../data/activityHistory";
import type { RestSession } from "../data/restSession";

import { buildActivityComplianceNetworkEvidence } from "./activityComplianceNetworkEvidence";
import {
    buildComplianceNetworkMap,
    type ComplianceNetworkEvidenceEvent,
    type ComplianceNetworkMap,
} from "./complianceNetworkMap";
import {
    calculateContinuousDrivingState,
    type ContinuousDrivingState,
} from "./continuousDrivingState";
import {
    calculateDailyDrivingState,
    type DailyDrivingState,
} from "./dailyDrivingState";
import {
    calculateLiveDailyRestState,
    type LiveDailyRestState,
} from "./liveDailyRestState";
import { buildLiveDayRuleComplianceNetworkEvidence } from "./liveDayRuleComplianceNetworkEvidence";
import { evaluateLiveWtdState, type LiveWtdState } from "./liveWtdState";
import { buildRestComplianceNetworkEvidence } from "./restComplianceNetworkEvidence";
import type { SafetyMarginSettings } from "./safetyMargin";
import type { DriverDay } from "./types";

export interface LiveDayRestNetworkRequirement {
  session: RestSession;
  baseRestMinutes: number;
  compensationMinutes?: number;
  safetySettings?: SafetyMarginSettings;
}

export interface BuildLiveDayComplianceNetworkMapOptions {
  id: string;
  startAt: string;
  endAt: string;
  now: string | number | Date;
  day: DriverDay;
  activityHistory: ActivityHistoryEvent[];
  restSessions?: RestSession[];
  restRequirements?: LiveDayRestNetworkRequirement[];
}

export interface LiveDayComplianceNetworkStates {
  continuousDriving: ContinuousDrivingState;
  dailyDriving: DailyDrivingState;
  wtd: LiveWtdState;
  dailyRest: LiveDailyRestState;
}

export interface LiveDayComplianceNetworkMapResult {
  map: ComplianceNetworkMap;
  evidence: ComplianceNetworkEvidenceEvent[];
  states: LiveDayComplianceNetworkStates;
}

function parseNow(value: string | number | Date): {
  milliseconds: number;
  iso: string;
} {
  const milliseconds =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error("Invalid live day compliance-network current time.");
  }

  return {
    milliseconds,
    iso: new Date(milliseconds).toISOString(),
  };
}

export function buildLiveDayComplianceNetworkMap(
  options: BuildLiveDayComplianceNetworkMapOptions,
): LiveDayComplianceNetworkMapResult {
  if (options.id.trim().length === 0) {
    throw new Error("Live day compliance-network map requires an id.");
  }

  const now = parseNow(options.now);
  const restSessions =
    options.restSessions ??
    (options.restRequirements ?? []).map((requirement) => requirement.session);
  const states: LiveDayComplianceNetworkStates = {
    continuousDriving: calculateContinuousDrivingState(options.day),
    dailyDriving: calculateDailyDrivingState(options.day),
    wtd: evaluateLiveWtdState(
      options.day,
      options.activityHistory,
      now.milliseconds,
      {
        activityHistory: options.activityHistory,
        restSessions,
        nowMilliseconds: now.milliseconds,
      },
    ),
    dailyRest: calculateLiveDailyRestState(
      options.activityHistory,
      now.milliseconds,
    ),
  };

  const activityEvidence = buildActivityComplianceNetworkEvidence({
    events: options.activityHistory,
    now: now.milliseconds,
  });
  const ruleEvidence = buildLiveDayRuleComplianceNetworkEvidence({
    occurredAt: now.iso,
    sourceId: options.day.id,
    continuousDriving: states.continuousDriving,
    dailyDriving: states.dailyDriving,
    wtd: states.wtd,
    dailyRest: states.dailyRest,
  });
  const restEvidence = (options.restRequirements ?? []).map(
    (requirement): ComplianceNetworkEvidenceEvent =>
      buildRestComplianceNetworkEvidence({
        session: requirement.session,
        baseRestMinutes: requirement.baseRestMinutes,
        currentDateTime: now.iso,
        ...(requirement.compensationMinutes === undefined
          ? {}
          : { compensationMinutes: requirement.compensationMinutes }),
        ...(requirement.safetySettings === undefined
          ? {}
          : { safetySettings: requirement.safetySettings }),
      }),
  );
  const evidence = [...activityEvidence, ...ruleEvidence, ...restEvidence];
  const map = buildComplianceNetworkMap({
    id: options.id,
    scale: "day",
    startAt: options.startAt,
    endAt: options.endAt,
    events: evidence,
    now: now.iso,
  });

  return {
    map,
    evidence,
    states,
  };
}
