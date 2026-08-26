export type ActivityType = "driving" | "break" | "otherWork" | "poa" | "rest";

export type ComplianceLevel = "good" | "warning" | "breach";

export type DailyRestType = "regular" | "reduced" | "weekly" | "unknown";

export interface ActivityPeriod {
  id: string;

  type: ActivityType;

  /**
   * ISO date/time strings.
   * Example:
   * 2026-08-26T08:00:00
   */
  start: string;
  end: string;

  /**
   * Duration in minutes.
   */
  durationMinutes: number;
}

export interface DriverDay {
  id: string;

  /**
   * YYYY-MM-DD
   */
  date: string;

  activities: ActivityPeriod[];

  drivingMinutes: number;
  otherWorkMinutes: number;
  breakMinutes: number;
  poaMinutes: number;
  restMinutes: number;

  dailyRestType: DailyRestType;

  /**
   * True if this day contains one of the
   * permitted extended daily-driving periods.
   */
  extendedDrivingUsed?: boolean;

  notes?: string[];
}

export interface DailyComplianceIssue {
  id: string;

  date: string;

  rule:
    | "continuous-driving"
    | "daily-driving"
    | "daily-rest"
    | "working-time-break"
    | "daily-working-time"
    | "weekly-driving"
    | "fortnightly-driving"
    | "weekly-working-time"
    | "weekly-rest"
    | "unknown";

  level: ComplianceLevel;

  title: string;
  description: string;

  /**
   * Optional amount by which the rule
   * was approached or exceeded.
   */
  varianceMinutes?: number;
}

export interface DailyComplianceResult {
  date: string;

  level: ComplianceLevel;

  issues: DailyComplianceIssue[];

  drivingMinutes: number;
  workingMinutes: number;
  breakMinutes: number;
  poaMinutes: number;
  restMinutes: number;

  dailyRestType: DailyRestType;
}

export interface DriverWeek {
  id: string;

  /**
   * ISO week number where possible.
   */
  weekNumber: number;

  startDate: string;
  endDate: string;

  days: DriverDay[];
}

export interface WeeklyComplianceResult {
  weekNumber: number;

  level: ComplianceLevel;

  days: DailyComplianceResult[];

  totalDrivingMinutes: number;
  totalWorkingMinutes: number;
  totalBreakMinutes: number;
  totalPoaMinutes: number;
  totalRestMinutes: number;

  regularDailyRests: number;
  reducedDailyRests: number;

  extendedDrivingDays: number;

  issues: DailyComplianceIssue[];
}

export interface RollingWtdResult {
  /**
   * Average weekly working time
   * across the configured reference period.
   */
  averageWeeklyWorkingMinutes: number;

  /**
   * Total working minutes in the
   * reference period.
   */
  totalWorkingMinutes: number;

  /**
   * Number of weeks included.
   */
  numberOfWeeks: number;

  level: ComplianceLevel;
}

export interface ComplianceSummary {
  daily: DailyComplianceResult[];

  weekly: WeeklyComplianceResult[];

  rollingWtd?: RollingWtdResult;
}
