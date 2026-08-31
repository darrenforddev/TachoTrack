import type { ComplianceNetworkEvidenceEvent } from "./complianceNetworkMap";
import type { ContinuousDrivingState } from "./continuousDrivingState";
import type { DailyDrivingState } from "./dailyDrivingState";
import type { LiveDailyRestState } from "./liveDailyRestState";
import type { LiveWtdState } from "./liveWtdState";

export interface BuildLiveDayRuleComplianceNetworkEvidenceOptions {
  occurredAt: string;
  sourceId: string;
  continuousDriving: ContinuousDrivingState;
  dailyDriving: DailyDrivingState;
  wtd: LiveWtdState;
  dailyRest: LiveDailyRestState;
}

function requireTimestamp(value: string): string {
  const milliseconds = new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error(`Invalid live rule-network timestamp: ${value}`);
  }

  return new Date(milliseconds).toISOString();
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}

function continuousSeverity(
  status: ContinuousDrivingState["status"],
): ComplianceNetworkEvidenceEvent["severity"] {
  switch (status) {
    case "good":
      return "good";

    case "warning":
      return "warning";

    case "limit":
      return "limit";

    case "breach":
      return "breach";
  }
}

function dailyDrivingSeverity(
  status: DailyDrivingState["status"],
): ComplianceNetworkEvidenceEvent["severity"] {
  switch (status) {
    case "good":
      return "good";

    case "warning":
    case "extended-warning":
      return "warning";

    case "standard-limit":
    case "extended-limit":
      return "limit";

    case "extended":
      return "info";

    case "breach":
      return "breach";
  }
}

function wtdSeverity(
  level: LiveWtdState["level"],
): ComplianceNetworkEvidenceEvent["severity"] {
  switch (level) {
    case "good":
      return "good";

    case "advisory":
      return "info";

    case "warning":
    case "due":
      return "warning";

    case "action":
      return "limit";

    case "breach":
      return "breach";
  }
}

function dailyRestSeverity(
  level: LiveDailyRestState["level"],
): ComplianceNetworkEvidenceEvent["severity"] {
  switch (level) {
    case "good":
      return "good";

    case "warning":
      return "warning";

    case "breach":
      return "breach";
  }
}

function dailyDrivingSummary(state: DailyDrivingState): string {
  if (state.status === "breach") {
    return (
      `${formatMinutes(state.drivingMinutesUsed)} driven today; ` +
      `${formatMinutes(state.excessMinutes)} beyond the 10-hour ceiling.`
    );
  }

  if (
    state.status === "extended" ||
    state.status === "extended-warning" ||
    state.status === "extended-limit"
  ) {
    return (
      `${formatMinutes(state.drivingMinutesUsed)} driven today; ` +
      `${formatMinutes(state.remainingToExtendedMinutes)} remains to the 10-hour ceiling.`
    );
  }

  return (
    `${formatMinutes(state.drivingMinutesUsed)} driven today; ` +
    `${formatMinutes(state.remainingToStandardMinutes)} remains to the 9-hour standard limit.`
  );
}

function wtdSummary(state: LiveWtdState): string {
  if (state.breakShortfallMinutes > 0) {
    return (
      `${formatMinutes(state.workingMinutes)} working time; ` +
      `${formatMinutes(state.breakShortfallMinutes)} qualifying break still required.`
    );
  }

  return (
    `${formatMinutes(state.workingMinutes)} working time with ` +
    `${formatMinutes(state.qualifyingBreakMinutes)} qualifying break recorded.`
  );
}

function dailyRestSummary(state: LiveDailyRestState): string {
  if (state.dailyRestDeadline === null) {
    return "Daily-rest deadline is not active because no work reference has started.";
  }

  if (state.minutesUntilDeadline === null) {
    return `Daily rest deadline: ${state.dailyRestDeadline}.`;
  }

  return state.minutesUntilDeadline >= 0
    ? `${formatMinutes(state.minutesUntilDeadline)} remains until daily rest is due.`
    : `${formatMinutes(Math.abs(state.minutesUntilDeadline))} beyond the daily-rest deadline.`;
}

export function buildLiveDayRuleComplianceNetworkEvidence(
  options: BuildLiveDayRuleComplianceNetworkEvidenceOptions,
): ComplianceNetworkEvidenceEvent[] {
  if (options.sourceId.trim().length === 0) {
    throw new Error("Live rule-network evidence requires a source id.");
  }

  const occurredAt = requireTimestamp(options.occurredAt);
  const sourceIds = [options.sourceId];

  return [
    {
      id: `live-rule-${options.sourceId}-continuous-driving`,
      occurredAt,
      title: "Continuous driving status",
      summary:
        `${formatMinutes(options.continuousDriving.drivingMinutesUsed)} driven since the last qualifying reset; ` +
        `${formatMinutes(options.continuousDriving.remainingMinutes)} remains.`,
      severity: continuousSeverity(options.continuousDriving.status),
      lineIds: ["continuous-driving"],
      sourceIds,
    },
    {
      id: `live-rule-${options.sourceId}-daily-driving`,
      occurredAt,
      title: "Daily driving status",
      summary: dailyDrivingSummary(options.dailyDriving),
      severity: dailyDrivingSeverity(options.dailyDriving.status),
      lineIds: ["daily-driving"],
      sourceIds,
    },
    {
      id: `live-rule-${options.sourceId}-wtd`,
      occurredAt,
      title: "Working-time status",
      summary: wtdSummary(options.wtd),
      severity: wtdSeverity(options.wtd.level),
      lineIds: ["wtd"],
      sourceIds,
    },
    {
      id: `live-rule-${options.sourceId}-daily-rest`,
      occurredAt,
      title: "Daily-rest deadline status",
      summary: dailyRestSummary(options.dailyRest),
      severity: dailyRestSeverity(options.dailyRest.level),
      lineIds: ["daily-rest"],
      sourceIds,
    },
  ];
}
