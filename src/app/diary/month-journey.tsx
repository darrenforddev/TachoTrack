import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import {
  createDriverHistoryArchive,
  type DriverHistoryArchive,
} from "../../data/driverHistoryArchive";
import { loadDriverHistoryArchive } from "../../data/driverHistoryArchiveStorage";
import {
  SAMPLE_COMPLIANCE_JOURNEY_MONTH_INDEX,
  SAMPLE_COMPLIANCE_JOURNEY_MONTH_LIVE_DATE,
  SAMPLE_COMPLIANCE_JOURNEY_MONTH_NOW,
  SAMPLE_COMPLIANCE_JOURNEY_MONTH_YEAR,
  sampleComplianceJourneyMonthDays,
} from "../../data/sampleComplianceJourneyMonth";
import {
  buildMonthComplianceJourney,
  type MonthComplianceJourneyResult,
  type MonthJourneyWeekSummary,
} from "../../engine/monthComplianceJourney";
import type { WeekComplianceDaySummary } from "../../engine/weekComplianceNetworkMap";

import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type DataMode = "live" | "demo";

const DAY_NAMES = ["M", "T", "W", "T", "F", "S", "S"];

const ACTIVITY_COLOURS = {
  driving: "#f6404b",
  otherWork: "#38bdf8",
  break: "#22c55e",
  poa: "#a855f7",
};

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}

function formatClock(value: number): string {
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateString: string): string {
  return new Date(`${dateString}T12:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getLocalDate(milliseconds: number): string {
  const date = new Date(milliseconds);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseInitialMonth(
  yearParam: string | string[] | undefined,
  monthParam: string | string[] | undefined,
): { year: number; month: number } {
  const now = new Date();
  const yearValue = typeof yearParam === "string" ? Number(yearParam) : NaN;
  const monthValue = typeof monthParam === "string" ? Number(monthParam) : NaN;

  return {
    year: Number.isInteger(yearValue) ? yearValue : now.getFullYear(),
    month:
      Number.isInteger(monthValue) && monthValue >= 1 && monthValue <= 12
        ? monthValue - 1
        : now.getMonth(),
  };
}

function getWeekColour(week: MonthJourneyWeekSummary): string {
  if (week.recordedDayCount === 0) {
    return "#506782";
  }

  if (week.level === "breach") {
    return "#fb5770";
  }

  if (week.level === "warning") {
    return "#f5a400";
  }

  return "#22c55e";
}

function getWeekStatus(week: MonthJourneyWeekSummary): string {
  if (week.recordedDayCount === 0) {
    return "NO RECORD";
  }

  const breachDays = week.days.filter((day) => day.level === "breach").length;
  const warningDays = week.days.filter(
    (day) => day.level === "warning",
  ).length;
  const hasRestBreach = week.days.some(
    (day) => day.lineSeverities["daily-rest"] === "breach",
  );
  const hasWtdBreach = week.days.some(
    (day) => day.lineSeverities.wtd === "breach",
  );
  const hasDrivingWarning = week.days.some(
    (day) => day.lineSeverities["daily-driving"] === "warning",
  );
  const hasReducedRest = week.days.some(
    (day) => day.lineSeverities["daily-rest"] === "warning",
  );

  if (week.states.fortnightlyDriving.status === "breach") {
    return "90H BREACH";
  }

  if (week.states.weeklyDriving.status === "breach") {
    return "56H BREACH";
  }

  if (week.states.extendedDriving.status === "breach") {
    return "EXTENSION BREACH";
  }

  if (hasRestBreach) {
    return "REST BREACH";
  }

  if (hasWtdBreach) {
    return "WTD BREACH";
  }

  if (week.live) {
    if (
      week.states.fortnightlyDriving.status === "warning" ||
      week.states.fortnightlyDriving.status === "limit"
    ) {
      return `LIVE · 90H ${week.states.fortnightlyDriving.status.toUpperCase()}`;
    }

    if (
      week.states.weeklyDriving.status === "warning" ||
      week.states.weeklyDriving.status === "limit"
    ) {
      return `LIVE · 56H ${week.states.weeklyDriving.status.toUpperCase()}`;
    }

    return "LIVE";
  }

  if (breachDays > 0) {
    return `${breachDays} ${breachDays === 1 ? "BREACH" : "BREACHES"}`;
  }

  if (
    week.states.fortnightlyDriving.status === "warning" ||
    week.states.fortnightlyDriving.status === "limit"
  ) {
    return `90H ${week.states.fortnightlyDriving.status.toUpperCase()}`;
  }

  if (
    week.states.weeklyDriving.status === "warning" ||
    week.states.weeklyDriving.status === "limit"
  ) {
    return `56H ${week.states.weeklyDriving.status.toUpperCase()}`;
  }

  if (hasDrivingWarning && hasReducedRest) {
    return "10H + REDUCED REST";
  }

  if (week.states.extendedDriving.status === "exhausted") {
    return "2 EXTENSIONS USED";
  }

  if (hasReducedRest) {
    return "REDUCED REST";
  }

  if (hasDrivingWarning) {
    return "10H EXTENSION";
  }

  if (warningDays > 0 || week.level === "warning") {
    const warningCount = Math.max(1, warningDays);

    return `${warningCount} ${warningCount === 1 ? "WARNING" : "WARNINGS"}`;
  }

  return "COMPLIANT";
}

function CompactActivityRibbon({ day }: { day: WeekComplianceDaySummary }) {
  const segments = [
    {
      id: "driving",
      minutes: day.drivingMinutes,
      colour: ACTIVITY_COLOURS.driving,
    },
    {
      id: "other-work",
      minutes: Math.max(0, day.workingMinutes - day.drivingMinutes),
      colour: ACTIVITY_COLOURS.otherWork,
    },
    {
      id: "break",
      minutes: day.breakMinutes,
      colour: ACTIVITY_COLOURS.break,
    },
    {
      id: "poa",
      minutes: day.poaMinutes,
      colour: ACTIVITY_COLOURS.poa,
    },
  ].filter((segment) => segment.minutes > 0);

  return (
    <View style={[styles.routeDay, !day.recorded && styles.routeDayEmpty]}>
      <Text style={styles.routeDayName}>{DAY_NAMES[new Date(`${day.date}T12:00:00.000Z`).getUTCDay() === 0 ? 6 : new Date(`${day.date}T12:00:00.000Z`).getUTCDay() - 1]}</Text>
      {day.recorded
        ? segments.map((segment) => (
            <View
              key={segment.id}
              style={{ backgroundColor: segment.colour, flex: segment.minutes }}
            />
          ))
        : null}
      {day.live ? <View style={styles.liveDayMarker} /> : null}
    </View>
  );
}

function getRestMarker(day: WeekComplianceDaySummary): {
  label: string;
  colour: string;
} {
  if (!day.recorded) {
    return { label: "—", colour: "#314861" };
  }

  if (day.live && day.restMinutes === 0) {
    return { label: "LIVE", colour: "#38bdf8" };
  }

  if (day.dailyRestType === "reduced") {
    return { label: formatMinutes(day.restMinutes), colour: "#f5a400" };
  }

  if (day.dailyRestType === "regular" || day.dailyRestType === "weekly") {
    return { label: formatMinutes(day.restMinutes), colour: "#22c55e" };
  }

  return { label: formatMinutes(day.restMinutes), colour: "#fb5770" };
}

function openWeek(week: MonthJourneyWeekSummary, dataMode: DataMode): void {
  router.push({
    pathname: "/diary/week-network",
    params: { mode: dataMode, weekStart: week.weekStartDate },
  });
}

function MonthWeekRoute({
  dataMode,
  week,
}: {
  dataMode: DataMode;
  week: MonthJourneyWeekSummary;
}) {
  const weekColour = getWeekColour(week);

  return (
    <Pressable
      disabled={week.recordedDayCount === 0}
      onPress={() => openWeek(week, dataMode)}
      style={({ pressed }) => [
        styles.weekRoute,
        { borderLeftColor: weekColour },
        week.live && styles.weekRouteLive,
        pressed && week.recordedDayCount > 0 && styles.weekRoutePressed,
      ]}
    >
      <View style={styles.weekIdentity}>
        <View style={styles.weekTitleRow}>
          <Text style={styles.weekNumber}>W{week.isoWeekNumber}</Text>
          {week.live ? <Text style={styles.nowBadge}>NOW</Text> : null}
        </View>
        <Text style={styles.weekDates}>
          {formatDate(week.weekStartDate)} – {formatDate(week.weekEndDate)}
        </Text>
        <Text style={[styles.weekStatus, { color: weekColour }]}>
          {getWeekStatus(week)}
        </Text>
      </View>

      <View style={styles.weekJourneyBody}>
        <View style={styles.routeDays}>
          {week.days.map((day) => (
            <CompactActivityRibbon key={day.date} day={day} />
          ))}
        </View>

        <View style={styles.nightStops}>
          {week.days.slice(0, 6).map((day) => {
            const marker = getRestMarker(day);

            return (
              <View key={`night-${day.date}`} style={styles.nightStop}>
                <View
                  style={[styles.nightStopLine, { backgroundColor: marker.colour }]}
                />
                <Text style={[styles.nightStopText, { color: marker.colour }]}>
                  {marker.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.weekSummary}>
        <Text style={styles.weekDriving}>{formatMinutes(week.drivingMinutes)}</Text>
        <Text style={styles.weekSummaryLabel}>driving in month</Text>
        <Text
          style={[
            styles.fortnightPosition,
            week.states.fortnightlyDriving.status === "breach" &&
              styles.fortnightPositionBreach,
            (week.states.fortnightlyDriving.status === "warning" ||
              week.states.fortnightlyDriving.status === "limit") &&
              styles.fortnightPositionWarning,
          ]}
        >
          {formatMinutes(week.states.fortnightlyDriving.drivingMinutesUsed)} fortnight
        </Text>
        <Text style={styles.openWeek}>OPEN WEEK →</Text>
      </View>
    </Pressable>
  );
}

function ProgressRoute({
  label,
  value,
  detail,
  percentage,
  colour,
}: {
  label: string;
  value: string;
  detail: string;
  percentage: number;
  colour: string;
}) {
  const used = Math.max(0, Math.min(100, percentage));
  const remaining = Math.max(0.001, 100 - used);

  return (
    <View style={styles.progressRoute}>
      <View style={styles.progressHeading}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={[styles.progressValue, { color: colour }]}>{value}</Text>
      </View>
      <View style={styles.progressTrack}>
        {used > 0 ? (
          <View style={{ backgroundColor: colour, flex: used }} />
        ) : null}
        <View style={{ flex: remaining }} />
      </View>
      <Text style={styles.progressDetail}>{detail}</Text>
    </View>
  );
}

export default function MonthJourneyScreen() {
  const params = useLocalSearchParams<{
    year?: string;
    month?: string;
  }>();
  const initialMonth = useMemo(
    () => parseInitialMonth(params.year, params.month),
    [params.month, params.year],
  );
  const [dataMode, setDataMode] = useState<DataMode>("live");
  const [displayYear, setDisplayYear] = useState(initialMonth.year);
  const [displayMonth, setDisplayMonth] = useState(initialMonth.month);
  const [now, setNow] = useState(() => Date.now());
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [archive, setArchive] = useState<DriverHistoryArchive>(() =>
    createDriverHistoryArchive(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateArchive(): Promise<void> {
      try {
        const storedArchive = await loadDriverHistoryArchive();

        if (cancelled) {
          return;
        }

        setArchive(storedArchive);
        setLoadError(null);
        setHydrated(true);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Stored month history could not be loaded.",
        );
        setHydrated(true);
      }
    }

    void hydrateArchive();

    return () => {
      cancelled = true;
    };
  }, [refreshVersion]);

  const selectedYear =
    dataMode === "demo" ? SAMPLE_COMPLIANCE_JOURNEY_MONTH_YEAR : displayYear;
  const selectedMonth =
    dataMode === "demo"
      ? SAMPLE_COMPLIANCE_JOURNEY_MONTH_INDEX
      : displayMonth;
  const selectedMonthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const todayDate = getLocalDate(now);
  const liveDate =
    dataMode === "demo"
      ? SAMPLE_COMPLIANCE_JOURNEY_MONTH_LIVE_DATE
      : todayDate.startsWith(`${selectedMonthPrefix}-`)
        ? todayDate
        : undefined;

  const prepared = useMemo<{
    result: MonthComplianceJourneyResult | null;
    error: string | null;
  }>(() => {
    try {
      return {
        result: buildMonthComplianceJourney({
          id: `month-journey-${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`,
          year: selectedYear,
          month: selectedMonth,
          days:
            dataMode === "demo"
              ? sampleComplianceJourneyMonthDays
              : archive.days,
          ...(liveDate === undefined ? {} : { liveDate }),
          now:
            dataMode === "demo" ? SAMPLE_COMPLIANCE_JOURNEY_MONTH_NOW : now,
        }),
        error: null,
      };
    } catch (error) {
      return {
        result: null,
        error:
          error instanceof Error
            ? error.message
            : "The Month Journey could not be built.",
      };
    }
  }, [archive.days, dataMode, liveDate, now, selectedMonth, selectedYear]);

  const result = prepared.result;
  const displayNow =
    dataMode === "demo"
      ? new Date(SAMPLE_COMPLIANCE_JOURNEY_MONTH_NOW).getTime()
      : now;

  function changeMonth(offset: number): void {
    const nextDate = new Date(Date.UTC(displayYear, displayMonth + offset, 1));

    setDataMode("live");
    setDisplayYear(nextDate.getUTCFullYear());
    setDisplayMonth(nextDate.getUTCMonth());
  }

  function refresh(): void {
    setNow(Date.now());
    setRefreshVersion((version) => version + 1);
  }

  const resolvedRestCount =
    result === null
      ? 0
      : result.totals.regularRestCount + result.totals.reducedRestCount;
  const restEvidencePercentage =
    result === null || result.totals.recordedDays === 0
      ? 100
      : Math.round((resolvedRestCount / result.totals.recordedDays) * 100);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>TACHOTRACK LIVE</Text>
            <Text style={styles.screenTitle}>Month Journey</Text>
            <Text style={styles.screenSubtitle}>
              {formatMonth(selectedYear, selectedMonth)} · {dataMode === "demo" ? "demo snapshot" : "updated"} {formatClock(displayNow)}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.monthNavigation}>
              <Pressable onPress={() => changeMonth(-1)} style={styles.monthButton}>
                <Text style={styles.monthButtonText}>‹</Text>
              </Pressable>
              <Text style={styles.monthNavigationLabel}>
                {formatMonth(selectedYear, selectedMonth)}
              </Text>
              <Pressable onPress={() => changeMonth(1)} style={styles.monthButton}>
                <Text style={styles.monthButtonText}>›</Text>
              </Pressable>
            </View>

            <View style={styles.segmentedControl}>
              <Pressable
                onPress={() => setDataMode("live")}
                style={[
                  styles.segmentButton,
                  dataMode === "live" && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    dataMode === "live" && styles.segmentTextActive,
                  ]}
                >
                  Live
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDataMode("demo")}
                style={[
                  styles.segmentButton,
                  dataMode === "demo" && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    dataMode === "demo" && styles.segmentTextActive,
                  ]}
                >
                  Demo Month
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={refresh} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Refresh</Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace("/")}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>

        {!hydrated && dataMode === "live" ? (
          <View style={styles.messagePanel}>
            <Text style={styles.messageTitle}>Loading stored month…</Text>
          </View>
        ) : null}

        {loadError !== null && dataMode === "live" ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>Stored history unavailable</Text>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : null}

        {prepared.error !== null ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>Month Journey unavailable</Text>
            <Text style={styles.errorText}>{prepared.error}</Text>
          </View>
        ) : null}

        {result !== null ? (
          <>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, styles.drivingSummaryCard]}>
                <Text style={styles.summaryLabel}>MONTHLY DRIVING</Text>
                <Text style={styles.summaryValue}>
                  {formatMinutes(result.totals.drivingMinutes)}
                </Text>
                <Text style={styles.summaryDetail}>
                  Across {result.weeks.filter((week) => week.inMonthRecordedDayCount > 0).length} week sections
                </Text>
              </View>
              <View style={[styles.summaryCard, styles.complianceSummaryCard]}>
                <Text style={styles.summaryLabel}>COMPLIANT DAYS</Text>
                <Text style={styles.summaryValue}>
                  {result.totals.compliancePercentage}%
                </Text>
                <Text style={styles.summaryDetail}>
                  {result.totals.goodDays} good · {result.totals.warningDays} warning · {result.totals.breachDays} breach
                </Text>
              </View>
              <View style={[styles.summaryCard, styles.restSummaryCard]}>
                <Text style={styles.summaryLabel}>OVERNIGHT RESTS</Text>
                <Text style={styles.summaryValue}>
                  {result.totals.regularRestCount} regular · {result.totals.reducedRestCount} reduced
                </Text>
                <Text style={styles.summaryDetail}>
                  {result.totals.unknownRestCount === 0
                    ? "All recorded rests classified"
                    : `${result.totals.unknownRestCount} live or unresolved`}
                </Text>
              </View>
            </View>

            <View style={styles.mainPanel}>
              <View style={styles.sectionHeadingRow}>
                <View>
                  <Text style={styles.sectionTitle}>
                    The month as connected Week Journeys
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Every row preserves seven days, six overnight stops and its legal position
                  </Text>
                </View>
                <View style={styles.activityLegend}>
                  <Text style={[styles.legendItem, { color: ACTIVITY_COLOURS.driving }]}>● Driving</Text>
                  <Text style={[styles.legendItem, { color: ACTIVITY_COLOURS.otherWork }]}>● Other Work</Text>
                  <Text style={[styles.legendItem, { color: ACTIVITY_COLOURS.break }]}>● Break</Text>
                  <Text style={[styles.legendItem, { color: ACTIVITY_COLOURS.poa }]}>● POA</Text>
                </View>
              </View>

              <View style={styles.weekRoutes}>
                {result.weeks.map((week) => (
                  <MonthWeekRoute
                    key={week.id}
                    dataMode={dataMode}
                    week={week}
                  />
                ))}
              </View>

              <View style={styles.monthRoutesFooter}>
                <ProgressRoute
                  label="Monthly compliant-day route"
                  value={`${result.totals.compliancePercentage}%`}
                  detail={`${result.totals.recordedDays} recorded driver days`}
                  percentage={result.totals.compliancePercentage}
                  colour={
                    result.totals.level === "breach"
                      ? "#fb5770"
                      : result.totals.level === "warning"
                        ? "#f5a400"
                        : "#22c55e"
                  }
                />
                <ProgressRoute
                  label="Classified overnight-rest route"
                  value={`${restEvidencePercentage}%`}
                  detail={`${resolvedRestCount} classified · ${result.totals.unknownRestCount} live or unresolved`}
                  percentage={restEvidencePercentage}
                  colour="#a855f7"
                />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#020718", flex: 1 },
  screenContent: { gap: 12, padding: 16 },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
  screenTitle: { color: "#f8fafc", fontSize: 28, fontWeight: "900" },
  screenSubtitle: { color: "#6580a6", fontSize: 12, marginTop: 3 },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  monthNavigation: {
    alignItems: "center",
    backgroundColor: "#071426",
    borderColor: "#234463",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 43,
  },
  monthButton: { paddingHorizontal: 12, paddingVertical: 8 },
  monthButtonText: { color: "#43c6ff", fontSize: 20, fontWeight: "900" },
  monthNavigationLabel: {
    color: "#dce9f8",
    fontSize: 11,
    fontWeight: "900",
    minWidth: 112,
    textAlign: "center",
  },
  segmentedControl: {
    backgroundColor: "#071426",
    borderColor: "#234463",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    padding: 3,
  },
  segmentButton: { borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9 },
  segmentButtonActive: { backgroundColor: "#169ee8" },
  segmentText: { color: "#7187a7", fontSize: 11, fontWeight: "800" },
  segmentTextActive: { color: "#ffffff" },
  secondaryButton: {
    backgroundColor: "#071426",
    borderColor: "#234463",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  secondaryButtonText: { color: "#43c6ff", fontSize: 11, fontWeight: "900" },
  closeButton: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  closeButtonText: { color: "#071426", fontSize: 11, fontWeight: "900" },
  messagePanel: {
    backgroundColor: "#071426",
    borderColor: "#1a314d",
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  messageTitle: { color: "#dce9f8", fontSize: 14, fontWeight: "800" },
  errorPanel: {
    backgroundColor: "#2b1019",
    borderColor: "#7f253c",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  errorTitle: { color: "#ff91a3", fontSize: 14, fontWeight: "900" },
  errorText: { color: "#ffc2cc", fontSize: 12, marginTop: 5 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: {
    backgroundColor: "#071426",
    borderColor: "#1d354f",
    borderRadius: 14,
    borderTopWidth: 3,
    borderWidth: 1,
    flex: 1,
    minWidth: 240,
    padding: 14,
  },
  drivingSummaryCard: { borderTopColor: "#38bdf8" },
  complianceSummaryCard: { borderTopColor: "#22c55e" },
  restSummaryCard: { borderTopColor: "#a855f7" },
  summaryLabel: {
    color: "#607da3",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  summaryValue: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 7,
  },
  summaryDetail: { color: "#91a5c0", fontSize: 11, marginTop: 4 },
  mainPanel: {
    backgroundColor: "#061121",
    borderColor: "#1a304b",
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
  },
  sectionHeadingRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  sectionTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "900" },
  sectionSubtitle: { color: "#6480a3", fontSize: 11, marginTop: 3 },
  activityLegend: { flexDirection: "row", flexWrap: "wrap", gap: 13 },
  legendItem: { fontSize: 10, fontWeight: "800" },
  weekRoutes: { gap: 9, marginTop: 13 },
  weekRoute: {
    alignItems: "center",
    backgroundColor: "#08172a",
    borderLeftWidth: 5,
    borderRadius: 11,
    flexDirection: "row",
    gap: 12,
    minHeight: 104,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  weekRouteLive: {
    backgroundColor: "#092039",
    borderColor: "#38bdf8",
    borderWidth: 1,
    borderLeftWidth: 5,
  },
  weekRoutePressed: { opacity: 0.72 },
  weekIdentity: { width: 150 },
  weekTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekNumber: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  nowBadge: {
    backgroundColor: "#0b4b62",
    borderRadius: 7,
    color: "#72e3ff",
    fontSize: 8,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  weekDates: { color: "#6e87a8", fontSize: 10, marginTop: 4 },
  weekStatus: { fontSize: 9, fontWeight: "900", letterSpacing: 0.4, marginTop: 7 },
  weekJourneyBody: { flex: 1, minWidth: 420 },
  routeDays: { flexDirection: "row", gap: 4 },
  routeDay: {
    backgroundColor: "#13273e",
    borderRadius: 5,
    flex: 1,
    flexDirection: "row",
    height: 34,
    minWidth: 44,
    overflow: "hidden",
    position: "relative",
  },
  routeDayEmpty: { opacity: 0.35 },
  routeDayName: {
    color: "#ffffff",
    fontSize: 7,
    fontWeight: "900",
    left: 4,
    position: "absolute",
    top: 3,
    zIndex: 2,
  },
  liveDayMarker: {
    borderColor: "#7ce8ff",
    borderRadius: 5,
    borderWidth: 2,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  nightStops: { flexDirection: "row", gap: 4, marginHorizontal: "7%", marginTop: 5 },
  nightStop: { flex: 1 },
  nightStopLine: { borderRadius: 2, height: 3 },
  nightStopText: { fontSize: 8, fontWeight: "800", marginTop: 3, textAlign: "center" },
  weekSummary: { width: 185 },
  weekDriving: { color: "#f8fafc", fontSize: 15, fontWeight: "900" },
  weekSummaryLabel: { color: "#6f89aa", fontSize: 9, marginTop: 2 },
  fortnightPosition: { color: "#8ba1bd", fontSize: 10, marginTop: 7 },
  fortnightPositionWarning: { color: "#f5a400" },
  fortnightPositionBreach: { color: "#fb5770" },
  openWeek: { color: "#38bdf8", fontSize: 10, fontWeight: "900", marginTop: 8 },
  monthRoutesFooter: {
    backgroundColor: "#071426",
    borderRadius: 11,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    marginTop: 12,
    padding: 13,
  },
  progressRoute: { flex: 1, minWidth: 300 },
  progressHeading: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: "#dce9f8", fontSize: 11, fontWeight: "800" },
  progressValue: { fontSize: 11, fontWeight: "900" },
  progressTrack: {
    backgroundColor: "#15283e",
    borderRadius: 4,
    flexDirection: "row",
    height: 7,
    marginTop: 6,
    overflow: "hidden",
  },
  progressDetail: { color: "#617b9e", fontSize: 9, marginTop: 5 },
});
