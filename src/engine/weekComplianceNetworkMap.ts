import type { WeeklyDriverHistory } from "../data/weeklyDriverHistory";

import { evaluateDriverDay } from "./complianceEngine";
import {
  buildComplianceNetworkMap,
  type ComplianceNetworkEvidenceEvent,
  type ComplianceNetworkLineId,
  type ComplianceNetworkMap,
  type ComplianceNetworkSeverity,
} from "./complianceNetworkMap";
import {
  calculateExtendedDrivingAllowanceState,
  type ExtendedDrivingAllowanceState,
} from "./extendedDrivingAllowanceState";
import {
  calculateFortnightlyDrivingState,
  type FortnightlyDrivingState,
} from "./fortnightlyDrivingState";
import type { DriverDay } from "./types";
import {
  calculateWeeklyDrivingState,
  type WeeklyDrivingState,
} from "./weeklyDrivingState";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

export type WeekComplianceDayLevel = ReturnType<
  typeof evaluateDriverDay
>["level"];

export interface WeekComplianceDaySummary {
  date: string;
  recorded: boolean;
  live: boolean;
  level: WeekComplianceDayLevel | null;
  issueCount: number;
  activityCount: number;
  drivingMinutes: number;
  workingMinutes: number;
  breakMinutes: number;
  poaMinutes: number;
  restMinutes: number;
  dailyRestType: DriverDay["dailyRestType"] | null;
  sourceDayId: string | null;
  lineSeverities: Partial<
    Record<ComplianceNetworkLineId, ComplianceNetworkSeverity>
  >;
}

export interface WeekComplianceNetworkStates {
  weeklyDriving: WeeklyDrivingState;
  fortnightlyDriving: FortnightlyDrivingState;
  extendedDriving: ExtendedDrivingAllowanceState;
}

export interface BuildWeekComplianceNetworkMapOptions {
  id: string;
  currentWeek: WeeklyDriverHistory;
  previousWeekDays?: DriverDay[];
  liveDate?: string;
  now: string | number | Date;
}

export interface WeekComplianceNetworkMapResult {
  map: ComplianceNetworkMap;
  evidence: ComplianceNetworkEvidenceEvent[];
  days: WeekComplianceDaySummary[];
  states: WeekComplianceNetworkStates;
}

function parseDateOnly(value: string, fieldName: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  const milliseconds = new Date(`${value}T00:00:00.000Z`).getTime();

  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  return milliseconds;
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
    throw new Error("Invalid week compliance-network current time.");
  }

  return {
    milliseconds,
    iso: new Date(milliseconds).toISOString(),
  };
}

function toDateOnly(milliseconds: number): string {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

function severityFromDayLevel(
  level: WeekComplianceDayLevel,
): ComplianceNetworkSeverity {
  switch (level) {
    case "good":
      return "good";
    case "warning":
      return "warning";
    case "breach":
      return "breach";
  }
}

function severityFromLimitStatus(
  status: "good" | "warning" | "limit" | "breach",
): ComplianceNetworkSeverity {
  return status;
}

function severityFromExtensionState(
  state: ExtendedDrivingAllowanceState,
): ComplianceNetworkSeverity {
  switch (state.status) {
    case "available":
      return "good";
    case "one-used":
      return "info";
    case "exhausted":
      return "warning";
    case "breach":
      return "breach";
  }
}

const SEVERITY_PRIORITY: Record<ComplianceNetworkSeverity, number> = {
  good: 0,
  info: 1,
  limit: 2,
  warning: 3,
  breach: 4,
};

function worstSeverity(
  severities: ComplianceNetworkSeverity[],
): ComplianceNetworkSeverity {
  return severities.reduce<ComplianceNetworkSeverity>(
    (worst, severity) =>
      SEVERITY_PRIORITY[severity] > SEVERITY_PRIORITY[worst]
        ? severity
        : worst,
    "good",
  );
}

function severityForRule(
  issues: ReturnType<typeof evaluateDriverDay>["issues"],
  rule: string,
): ComplianceNetworkSeverity {
  return worstSeverity(
    issues
      .filter((issue) => issue.rule === rule)
      .map((issue) => severityFromDayLevel(issue.level)),
  );
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}

function validateCurrentWeek(history: WeeklyDriverHistory): {
  startMilliseconds: number;
  endExclusiveMilliseconds: number;
} {
  const startMilliseconds = parseDateOnly(
    history.weekStartDate,
    "week start date",
  );
  const endMilliseconds = parseDateOnly(history.weekEndDate, "week end date");

  if (endMilliseconds - startMilliseconds !== 6 * DAY_MILLISECONDS) {
    throw new Error(
      "Week compliance network requires consecutive Monday-Sunday boundaries.",
    );
  }

  const seenDates = new Set<string>();

  for (const day of history.days) {
    parseDateOnly(day.date, `driver day date for ${day.id}`);

    if (day.date < history.weekStartDate || day.date > history.weekEndDate) {
      throw new Error(`Driver day ${day.id} falls outside the current week.`);
    }

    if (seenDates.has(day.date)) {
      throw new Error(`Duplicate DriverDay date in current week: ${day.date}`);
    }

    seenDates.add(day.date);
  }

  return {
    startMilliseconds,
    endExclusiveMilliseconds: endMilliseconds + DAY_MILLISECONDS,
  };
}

function buildDaySummaries(
  currentWeek: WeeklyDriverHistory,
  previousWeekDays: DriverDay[],
  startMilliseconds: number,
  liveDate: string | undefined,
): WeekComplianceDaySummary[] {
  const dayByDate = new Map(
    currentWeek.days.map((day) => [day.date, day] as const),
  );

  return Array.from({ length: 7 }, (_, index): WeekComplianceDaySummary => {
    const date = toDateOnly(startMilliseconds + index * DAY_MILLISECONDS);
    const day = dayByDate.get(date);
    const live = liveDate === date;

    if (day === undefined) {
      return {
        date,
        recorded: false,
        live,
        level: null,
        issueCount: 0,
        activityCount: 0,
        drivingMinutes: 0,
        workingMinutes: 0,
        breakMinutes: 0,
        poaMinutes: 0,
        restMinutes: 0,
        dailyRestType: null,
        sourceDayId: null,
        lineSeverities: {},
      };
    }

    const compliance = evaluateDriverDay(day, {
      isLiveDay: live,
    });
    const cumulativeDays = currentWeek.days
      .filter((candidate) => candidate.date <= date)
      .sort((left, right) => left.date.localeCompare(right.date));
    const earlierDays = cumulativeDays.filter(
      (candidate) => candidate.date < date,
    );
    const cumulativeExtensionState =
      calculateExtendedDrivingAllowanceState(cumulativeDays);
    const earlierExtensionState =
      calculateExtendedDrivingAllowanceState(earlierDays);
    const createsExtensionBreach =
      cumulativeExtensionState.excessExtensionDays >
      earlierExtensionState.excessExtensionDays;
    const dailyDrivingSeverity = worstSeverity([
      severityForRule(compliance.issues, "daily-driving"),
      createsExtensionBreach ? "breach" : "good",
    ]);

    return {
      date,
      recorded: true,
      live,
      level: compliance.level,
      issueCount: compliance.issues.length,
      activityCount: day.activities.length,
      drivingMinutes: day.drivingMinutes,
      workingMinutes: day.drivingMinutes + day.otherWorkMinutes,
      breakMinutes: day.breakMinutes,
      poaMinutes: day.poaMinutes,
      restMinutes: day.restMinutes,
      dailyRestType: day.dailyRestType,
      sourceDayId: day.id,
      lineSeverities: {
        activity: "info",
        "daily-driving": dailyDrivingSeverity,
        wtd: severityForRule(compliance.issues, "working-time-break"),
        "daily-rest": severityForRule(compliance.issues, "daily-rest"),
        "weekly-driving": severityFromLimitStatus(
          calculateWeeklyDrivingState(cumulativeDays).status,
        ),
        "fortnightly-driving": severityFromLimitStatus(
          calculateFortnightlyDrivingState(
            previousWeekDays,
            cumulativeDays,
          ).status,
        ),
      },
    };
  });
}

function buildDayEvidence(
  summaries: WeekComplianceDaySummary[],
  nowIso: string,
): ComplianceNetworkEvidenceEvent[] {
  return summaries
    .filter(
      (
        summary,
      ): summary is WeekComplianceDaySummary & {
        level: WeekComplianceDayLevel;
      } => summary.recorded && summary.level !== null,
    )
    .map((summary): ComplianceNetworkEvidenceEvent => {
      const occurredAt = summary.live
        ? nowIso
        : `${summary.date}T12:00:00.000Z`;

      return {
        id: `week-network-day-${summary.date}`,
        occurredAt,
        title: `${summary.date}${summary.live ? " live" : " completed"}`,
        summary: `${formatMinutes(summary.drivingMinutes)} driving, ${formatMinutes(summary.workingMinutes)} working, ${formatMinutes(summary.breakMinutes)} break.`,
        severity: severityFromDayLevel(summary.level),
        lineIds: [
          "activity",
          "daily-driving",
          "wtd",
          "daily-rest",
          "weekly-driving",
          "fortnightly-driving",
        ],
        sourceIds:
          summary.sourceDayId === null ? [] : [summary.sourceDayId],
      };
    });
}

export function buildWeekComplianceNetworkMap(
  options: BuildWeekComplianceNetworkMapOptions,
): WeekComplianceNetworkMapResult {
  if (options.id.trim().length === 0) {
    throw new Error("Week compliance network requires an id.");
  }

  const bounds = validateCurrentWeek(options.currentWeek);
  const now = parseNow(options.now);

  if (
    now.milliseconds < bounds.startMilliseconds ||
    now.milliseconds >= bounds.endExclusiveMilliseconds
  ) {
    throw new Error("Week compliance-network current time is outside the week.");
  }

  if (
    options.liveDate !== undefined &&
    (options.liveDate < options.currentWeek.weekStartDate ||
      options.liveDate > options.currentWeek.weekEndDate)
  ) {
    throw new Error("Week compliance-network live date is outside the week.");
  }

  const previousWeekDays = options.previousWeekDays ?? [];
  const currentDays = [...options.currentWeek.days].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const states: WeekComplianceNetworkStates = {
    weeklyDriving: calculateWeeklyDrivingState(currentDays),
    fortnightlyDriving: calculateFortnightlyDrivingState(
      previousWeekDays,
      currentDays,
    ),
    extendedDriving: calculateExtendedDrivingAllowanceState(currentDays),
  };
  const days = buildDaySummaries(
    options.currentWeek,
    previousWeekDays,
    bounds.startMilliseconds,
    options.liveDate,
  );
  const dayEvidence = buildDayEvidence(days, now.iso);
  const aggregateEvidence: ComplianceNetworkEvidenceEvent[] = [
    {
      id: `${options.id}-weekly-driving-state`,
      occurredAt: now.iso,
      title: "Weekly driving state",
      summary: `${formatMinutes(states.weeklyDriving.drivingMinutesUsed)} used, ${formatMinutes(states.weeklyDriving.remainingMinutes)} remaining.`,
      severity: severityFromLimitStatus(states.weeklyDriving.status),
      lineIds: ["weekly-driving"],
      sourceIds: currentDays.map((day) => day.id),
    },
    {
      id: `${options.id}-fortnightly-driving-state`,
      occurredAt: now.iso,
      title: "Fortnightly driving state",
      summary: `${formatMinutes(states.fortnightlyDriving.drivingMinutesUsed)} used, ${formatMinutes(states.fortnightlyDriving.remainingMinutes)} remaining.`,
      severity: severityFromLimitStatus(states.fortnightlyDriving.status),
      lineIds: ["fortnightly-driving"],
      sourceIds: [
        ...previousWeekDays.map((day) => day.id),
        ...currentDays.map((day) => day.id),
      ],
    },
    {
      id: `${options.id}-extended-driving-state`,
      occurredAt: now.iso,
      title: "Extended-driving allowance",
      summary: `${states.extendedDriving.extensionsUsed} used, ${states.extendedDriving.extensionsRemaining} remaining this week.`,
      severity: severityFromExtensionState(states.extendedDriving),
      lineIds: ["daily-driving", "weekly-driving"],
      sourceIds: currentDays.map((day) => day.id),
    },
  ];
  const evidence = [...dayEvidence, ...aggregateEvidence];
  const map = buildComplianceNetworkMap({
    id: options.id,
    scale: "week",
    startAt: new Date(bounds.startMilliseconds).toISOString(),
    endAt: new Date(bounds.endExclusiveMilliseconds).toISOString(),
    events: evidence,
    now: now.iso,
  });

  return {
    map,
    evidence,
    days,
    states,
  };
}
