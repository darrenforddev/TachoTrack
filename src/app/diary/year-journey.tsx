import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import {
  createDriverHistoryArchive,
  type DriverHistoryArchive,
} from "../../data/driverHistoryArchive";
import { loadDriverHistoryArchive } from "../../data/driverHistoryArchiveStorage";
import {
  SAMPLE_COMPLIANCE_JOURNEY_YEAR,
  SAMPLE_COMPLIANCE_JOURNEY_YEAR_LIVE_DATE,
  SAMPLE_COMPLIANCE_JOURNEY_YEAR_NOW,
  sampleComplianceJourneyYearDays,
} from "../../data/sampleComplianceJourneyYear";
import {
  buildYearComplianceJourney,
  type YearComplianceJourneyResult,
  type YearJourneyMonthSummary,
} from "../../engine/yearComplianceJourney";

import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type DataMode = "live" | "demo";

function getSingleParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours.toLocaleString("en-GB")}h ${String(remainingMinutes).padStart(2, "0")}m`;
}

function formatClock(value: number): string {
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
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

function getMonthName(month: number): string {
  return new Date(Date.UTC(2026, month, 1)).toLocaleDateString("en-GB", {
    month: "long",
    timeZone: "UTC",
  });
}

function getLevelColour(month: YearJourneyMonthSummary): string {
  if (month.result.totals.recordedDays === 0) {
    return "#506782";
  }

  if (month.level === "breach") {
    return "#fb5770";
  }

  if (month.level === "warning") {
    return "#f5a400";
  }

  return "#22c55e";
}

function getMonthStatus(month: YearJourneyMonthSummary): string {
  if (month.result.totals.recordedDays === 0) {
    return "NO RECORD";
  }

  if (month.live) {
    if (month.level === "breach") {
      return "LIVE · BREACH";
    }

    if (month.level === "warning") {
      return "LIVE · WARNING";
    }

    return "LIVE";
  }

  if (month.level === "breach") {
    const monthDays = month.result.weeks.flatMap((week) =>
      week.days.filter(
        (day) =>
          day.recorded &&
          day.date >= month.result.monthStartDate &&
          day.date <= month.result.monthEndDate,
      ),
    );

    if (
      monthDays.some(
        (day) => day.lineSeverities["daily-rest"] === "breach",
      )
    ) {
      return "REST BREACH";
    }

    if (monthDays.some((day) => day.lineSeverities.wtd === "breach")) {
      return "WTD BREACH";
    }

    if (
      month.result.weeks.some(
        (week) => week.states.fortnightlyDriving.status === "breach",
      )
    ) {
      return "90H BREACH";
    }

    if (
      month.result.weeks.some(
        (week) => week.states.weeklyDriving.status === "breach",
      )
    ) {
      return "56H BREACH";
    }

    return `${month.result.totals.breachDays} ${month.result.totals.breachDays === 1 ? "BREACH" : "BREACHES"}`;
  }

  if (month.level === "warning") {
    const relevantWeeks = month.result.weeks.filter(
      (week) => week.inMonthRecordedDayCount > 0,
    );

    if (
      relevantWeeks.some(
        (week) =>
          week.states.fortnightlyDriving.status === "warning" ||
          week.states.fortnightlyDriving.status === "limit",
      )
    ) {
      return "90H WARNING";
    }

    if (
      relevantWeeks.some(
        (week) =>
          week.states.weeklyDriving.status === "warning" ||
          week.states.weeklyDriving.status === "limit",
      )
    ) {
      return "56H WARNING";
    }

    if (month.result.totals.reducedRestCount > 0) {
      return "REDUCED REST";
    }

    if (
      relevantWeeks.some(
        (week) => week.states.extendedDriving.status === "exhausted",
      )
    ) {
      return "2 EXTENSIONS USED";
    }

    const warningCount = Math.max(1, month.result.totals.warningDays);

    return `${warningCount} ${warningCount === 1 ? "WARNING" : "WARNINGS"}`;
  }

  return "COMPLIANT";
}

function getWeekColour(
  week: YearJourneyMonthSummary["result"]["weeks"][number],
): string {
  if (week.inMonthRecordedDayCount === 0) {
    return "#263b54";
  }

  if (week.level === "breach") {
    return "#fb5770";
  }

  if (week.level === "warning") {
    return "#f5a400";
  }

  return "#22c55e";
}

function MonthRouteCard({
  dataMode,
  month,
  year,
}: {
  dataMode: DataMode;
  month: YearJourneyMonthSummary;
  year: number;
}) {
  const levelColour = getLevelColour(month);

  function openMonth(): void {
    router.push({
      pathname: "/diary/month-journey",
      params: {
        mode: dataMode,
        month: String(month.month + 1),
        returnTo: "year",
        year: String(year),
      },
    });
  }

  function openWeek(weekStartDate: string): void {
    router.push({
      pathname: "/diary/week-network",
      params: {
        mode: dataMode,
        returnTo: "year",
        returnYear: String(year),
        weekStart: weekStartDate,
      },
    });
  }

  return (
    <View
      style={[
        styles.monthCard,
        { borderLeftColor: levelColour },
        month.live && styles.monthCardLive,
      ]}
    >
      <View style={styles.monthCardHeading}>
        <View>
          <View style={styles.monthNameRow}>
            <Text style={styles.monthName}>{getMonthName(month.month)}</Text>
            {month.live ? <Text style={styles.nowBadge}>NOW</Text> : null}
          </View>
          <Text style={[styles.monthStatus, { color: levelColour }]}>
            {getMonthStatus(month)}
          </Text>
        </View>

        <View style={styles.monthCompliance}>
          <Text style={[styles.monthPercentage, { color: levelColour }]}>
            {month.result.totals.compliancePercentage}%
          </Text>
          <Text style={styles.monthPercentageLabel}>fully compliant days</Text>
        </View>
      </View>

      <View style={styles.weekBlocks}>
        {month.result.weeks.map((week) => {
          const colour = getWeekColour(week);
          const recorded = week.inMonthRecordedDayCount > 0;
          const coverage = Math.max(
            12,
            Math.min(100, (week.inMonthRecordedDayCount / 7) * 100),
          );

          return (
            <Pressable
              disabled={!recorded}
              key={week.id}
              onPress={() => openWeek(week.weekStartDate)}
              style={({ pressed }) => [
                  styles.weekBlock,
                  { backgroundColor: colour },
                  !recorded && styles.weekBlockEmpty,
                  week.live && styles.weekBlockLive,
                  pressed && recorded && styles.weekBlockPressed,
                ]}
            >
              <Text style={styles.weekBlockLabel}>W{week.isoWeekNumber}</Text>
              <View style={styles.weekBlockRoute}>
                <View
                  style={[styles.weekBlockRouteFill, { flex: coverage }]}
                />
                <View style={{ flex: Math.max(0.001, 100 - coverage) }} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.monthCardFooter}>
        <View>
          <Text style={styles.monthDriving}>
            {formatMinutes(month.result.totals.drivingMinutes)} driving
          </Text>
          <Text style={styles.monthDetail}>
            {month.recordedWeeks} week sections · {month.result.totals.recordedDays} days
          </Text>
        </View>
        <Pressable
          disabled={month.result.totals.recordedDays === 0}
          onPress={openMonth}
          style={({ pressed }) => pressed && styles.openMonthPressed}
        >
          <Text style={styles.openMonth}>OPEN MONTH →</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProgressRoute({
  colour,
  detail,
  label,
  percentage,
  value,
}: {
  colour: string;
  detail: string;
  label: string;
  percentage: number;
  value: string;
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

export default function YearJourneyScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
    year?: string;
  }>();
  const requestedMode = getSingleParam(params.mode);
  const requestedYear = Number(getSingleParam(params.year));
  const currentYear = new Date().getFullYear();
  const [dataMode, setDataMode] = useState<DataMode>(() =>
    requestedMode === "demo" ? "demo" : "live",
  );
  const [displayYear, setDisplayYear] = useState(() =>
    Number.isInteger(requestedYear) ? requestedYear : currentYear,
  );
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
            : "Stored year history could not be loaded.",
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
    dataMode === "demo" ? SAMPLE_COMPLIANCE_JOURNEY_YEAR : displayYear;
  const todayDate = getLocalDate(now);
  const liveDate =
    dataMode === "demo"
      ? SAMPLE_COMPLIANCE_JOURNEY_YEAR_LIVE_DATE
      : todayDate.startsWith(`${selectedYear}-`)
        ? todayDate
        : undefined;

  const prepared = useMemo<{
    result: YearComplianceJourneyResult | null;
    error: string | null;
  }>(() => {
    try {
      return {
        result: buildYearComplianceJourney({
          id: `year-journey-${selectedYear}`,
          year: selectedYear,
          days:
            dataMode === "demo"
              ? sampleComplianceJourneyYearDays
              : archive.days,
          ...(liveDate === undefined ? {} : { liveDate }),
          now:
            dataMode === "demo" ? SAMPLE_COMPLIANCE_JOURNEY_YEAR_NOW : now,
        }),
        error: null,
      };
    } catch (error) {
      return {
        result: null,
        error:
          error instanceof Error
            ? error.message
            : "The Year Journey could not be built.",
      };
    }
  }, [archive.days, dataMode, liveDate, now, selectedYear]);

  const result = prepared.result;
  const displayNow =
    dataMode === "demo"
      ? new Date(SAMPLE_COMPLIANCE_JOURNEY_YEAR_NOW).getTime()
      : now;
  const resolvedRestCount =
    result === null
      ? 0
      : result.totals.regularRestCount + result.totals.reducedRestCount;
  const restEvidencePercentage =
    result === null || result.totals.recordedDays === 0
      ? 100
      : Math.round((resolvedRestCount / result.totals.recordedDays) * 100);

  function changeYear(offset: number): void {
    setDataMode("live");
    setDisplayYear((year) => year + offset);
  }

  function refresh(): void {
    setNow(Date.now());
    setRefreshVersion((version) => version + 1);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>TACHOTRACK LIVE</Text>
            <Text style={styles.screenTitle}>Year Journey</Text>
            <Text style={styles.screenSubtitle}>
              {selectedYear} · {dataMode === "demo" ? "demo snapshot" : "updated"} {formatClock(displayNow)}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.yearNavigation}>
              <Pressable onPress={() => changeYear(-1)} style={styles.yearButton}>
                <Text style={styles.yearButtonText}>‹</Text>
              </Pressable>
              <Text style={styles.yearNavigationLabel}>{selectedYear}</Text>
              <Pressable onPress={() => changeYear(1)} style={styles.yearButton}>
                <Text style={styles.yearButtonText}>›</Text>
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
                  Demo Year
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={refresh} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Refresh</Text>
            </Pressable>
            <Pressable onPress={() => router.replace("/")} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>

        {!hydrated && dataMode === "live" ? (
          <View style={styles.messagePanel}>
            <Text style={styles.messageTitle}>Loading stored year…</Text>
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
            <Text style={styles.errorTitle}>Year Journey unavailable</Text>
            <Text style={styles.errorText}>{prepared.error}</Text>
          </View>
        ) : null}

        {result !== null ? (
          <>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, styles.drivingSummaryCard]}>
                <Text style={styles.summaryLabel}>YEAR DRIVING</Text>
                <Text style={styles.summaryValue}>
                  {formatMinutes(result.totals.drivingMinutes)}
                </Text>
                <Text style={styles.summaryDetail}>
                  Across {result.totals.recordedWeeks} recorded ISO weeks
                </Text>
              </View>
              <View style={[styles.summaryCard, styles.complianceSummaryCard]}>
                <Text style={styles.summaryLabel}>FULLY COMPLIANT DAYS</Text>
                <Text style={styles.summaryValue}>
                  {result.totals.compliancePercentage}%
                </Text>
                <Text style={styles.summaryDetail}>
                  {result.totals.goodDays} good · {result.totals.warningDays} warning · {result.totals.breachDays} breach
                </Text>
              </View>
              <View style={[styles.summaryCard, styles.restSummaryCard]}>
                <Text style={styles.summaryLabel}>REST EVIDENCE</Text>
                <Text style={styles.summaryValue}>{restEvidencePercentage}% classified</Text>
                <Text style={styles.summaryDetail}>
                  {result.totals.reducedRestCount} reduced · {result.totals.unknownRestCount} live or unresolved
                </Text>
              </View>
            </View>

            <View style={styles.mainPanel}>
              <View style={styles.sectionHeadingRow}>
                <View>
                  <Text style={styles.sectionTitle}>
                    The year as twelve connected Month Journeys
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Each block is one ISO week; open any recorded month for its full route
                  </Text>
                </View>
                <View style={styles.statusLegend}>
                  <Text style={[styles.legendItem, { color: "#22c55e" }]}>● Good</Text>
                  <Text style={[styles.legendItem, { color: "#f5a400" }]}>● Warning</Text>
                  <Text style={[styles.legendItem, { color: "#fb5770" }]}>● Breach</Text>
                  <Text style={[styles.legendItem, { color: "#506782" }]}>● No record</Text>
                </View>
              </View>

              <View style={styles.monthGrid}>
                {result.months.map((month) => (
                  <MonthRouteCard
                    key={month.id}
                    dataMode={dataMode}
                    month={month}
                    year={selectedYear}
                  />
                ))}
              </View>

              <View style={styles.yearRoutesFooter}>
                <ProgressRoute
                  colour={
                    result.totals.level === "breach"
                      ? "#fb5770"
                      : result.totals.level === "warning"
                        ? "#f5a400"
                        : "#22c55e"
                  }
                  detail={`${result.totals.recordedDays} recorded days across ${result.totals.recordedMonths} months`}
                  label="Yearly compliant-day route"
                  percentage={result.totals.compliancePercentage}
                  value={`${result.totals.compliancePercentage}%`}
                />
                <ProgressRoute
                  colour="#a855f7"
                  detail={`${resolvedRestCount} classified · ${result.totals.unknownRestCount} live or unresolved`}
                  label="Yearly overnight-rest evidence"
                  percentage={restEvidencePercentage}
                  value={`${restEvidencePercentage}%`}
                />
              </View>

              <View style={styles.drilldownRoute}>
                <Text style={styles.drilldownTitle}>One visual language at every scale</Text>
                <Text style={styles.drilldownText}>
                  Year Journey → Month Journey → Week Journey → Daily Diary
                </Text>
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
  yearNavigation: {
    alignItems: "center",
    backgroundColor: "#071426",
    borderColor: "#234463",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 43,
  },
  yearButton: { paddingHorizontal: 13, paddingVertical: 8 },
  yearButtonText: { color: "#43c6ff", fontSize: 20, fontWeight: "900" },
  yearNavigationLabel: {
    color: "#dce9f8",
    fontSize: 12,
    fontWeight: "900",
    minWidth: 52,
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
  statusLegend: { flexDirection: "row", flexWrap: "wrap", gap: 13 },
  legendItem: { fontSize: 10, fontWeight: "800" },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 13,
  },
  monthCard: {
    backgroundColor: "#08172a",
    borderColor: "#1b3552",
    borderLeftWidth: 5,
    borderRadius: 11,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 148,
    minWidth: 420,
    padding: 12,
  },
  monthCardLive: { backgroundColor: "#092039", borderColor: "#38bdf8" },
  monthCardHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  monthNameRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  monthName: { color: "#f8fafc", fontSize: 15, fontWeight: "900" },
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
  monthStatus: { fontSize: 9, fontWeight: "900", letterSpacing: 0.4, marginTop: 5 },
  monthCompliance: { alignItems: "flex-end" },
  monthPercentage: { fontSize: 18, fontWeight: "900" },
  monthPercentageLabel: { color: "#6f89aa", fontSize: 8, marginTop: 2 },
  weekBlocks: { flexDirection: "row", gap: 6, marginTop: 12 },
  weekBlock: {
    borderRadius: 6,
    flex: 1,
    height: 34,
    minWidth: 42,
    overflow: "hidden",
    padding: 5,
  },
  weekBlockEmpty: { opacity: 0.45 },
  weekBlockLive: { borderColor: "#7ce8ff", borderWidth: 2 },
  weekBlockPressed: { opacity: 0.65 },
  weekBlockLabel: { color: "#ffffff", fontSize: 7, fontWeight: "900" },
  weekBlockRoute: {
    backgroundColor: "rgba(2,7,24,0.45)",
    borderRadius: 2,
    flexDirection: "row",
    height: 5,
    marginTop: 6,
    overflow: "hidden",
  },
  weekBlockRouteFill: { backgroundColor: "rgba(255,255,255,0.65)", height: 5 },
  monthCardFooter: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  monthDriving: { color: "#dce9f8", fontSize: 11, fontWeight: "800" },
  monthDetail: { color: "#6f89aa", fontSize: 9, marginTop: 3 },
  openMonth: { color: "#38bdf8", fontSize: 10, fontWeight: "900" },
  openMonthPressed: { opacity: 0.65 },
  yearRoutesFooter: {
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
  drilldownRoute: {
    backgroundColor: "#063522",
    borderLeftColor: "#22c55e",
    borderLeftWidth: 5,
    borderRadius: 11,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    marginTop: 11,
    padding: 12,
  },
  drilldownTitle: { color: "#f4fff7", fontSize: 11, fontWeight: "900" },
  drilldownText: { color: "#9bcbae", fontSize: 11 },
});
