import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import {
  createCurrentFortnightlyDriverHistory,
  rollFortnightlyDriverHistoryForward,
  type FortnightlyDriverHistory,
} from "../../data/fortnightlyDriverHistory";
import {
  SAMPLE_COMPLIANCE_JOURNEY_YEAR_LIVE_DATE,
  SAMPLE_COMPLIANCE_JOURNEY_YEAR_NOW,
  sampleComplianceJourneyYearDays,
} from "../../data/sampleComplianceJourneyYear";
import { loadFortnightlyDriverHistory } from "../../data/weeklyDriverHistoryStorage";
import {
  buildFortnightComplianceJourney,
  type FortnightComplianceJourneyResult,
  type FortnightJourneyLevel,
  type FortnightJourneyWeekSummary,
} from "../../engine/fortnightComplianceJourney";
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

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const FORTNIGHT_LIMIT_MINUTES = 90 * 60;
const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const COLOURS = {
  driving: "#f6404b",
  otherWork: "#38bdf8",
  break: "#22c55e",
  poa: "#a855f7",
  good: "#22c55e",
  warning: "#f5a400",
  limit: "#facc15",
  breach: "#fb5770",
  empty: "#506782",
};

function getSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
}

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
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

function shiftDate(value: string, days: number): string {
  const milliseconds = new Date(`${value}T00:00:00.000Z`).getTime();

  return new Date(milliseconds + days * DAY_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

function buildDemoHistory(): FortnightlyDriverHistory {
  const previousWeekStart = "2026-08-17";
  const currentWeekStart = "2026-08-24";

  return {
    previousWeek: {
      weekStartDate: previousWeekStart,
      weekEndDate: shiftDate(previousWeekStart, 6),
      days: sampleComplianceJourneyYearDays.filter(
        (day) => day.date >= previousWeekStart && day.date <= shiftDate(previousWeekStart, 6),
      ),
    },
    currentWeek: {
      weekStartDate: currentWeekStart,
      weekEndDate: shiftDate(currentWeekStart, 6),
      days: sampleComplianceJourneyYearDays.filter(
        (day) => day.date >= currentWeekStart && day.date <= shiftDate(currentWeekStart, 6),
      ),
    },
  };
}

function levelColour(level: FortnightJourneyLevel | null): string {
  return level === null ? COLOURS.empty : COLOURS[level];
}

function levelLabel(level: FortnightJourneyLevel | null): string {
  switch (level) {
    case "good":
      return "COMPLIANT";
    case "warning":
      return "WARNING";
    case "limit":
      return "AT LIMIT";
    case "breach":
      return "BREACH";
    default:
      return "NO RECORD";
  }
}

function dayColour(day: WeekComplianceDaySummary): string {
  if (!day.recorded || day.level === null) {
    return COLOURS.empty;
  }

  if (day.level === "breach") {
    return COLOURS.breach;
  }

  if (day.level === "warning") {
    return COLOURS.warning;
  }

  return COLOURS.good;
}

function dayLabel(day: WeekComplianceDaySummary): string {
  if (!day.recorded) {
    return "NO RECORD";
  }

  if (day.live) {
    return day.level === "breach" ? "LIVE BREACH" : "LIVE";
  }

  if (day.level === "breach") {
    return "BREACH";
  }

  if (day.level === "warning") {
    return "WARNING";
  }

  return "GOOD";
}

function ActivityRibbon({ day }: { day: WeekComplianceDaySummary }) {
  if (!day.recorded) {
    return <View style={[styles.activityRibbon, styles.activityRibbonEmpty]} />;
  }

  const segments = [
    { id: "driving", minutes: day.drivingMinutes, colour: COLOURS.driving },
    {
      id: "other-work",
      minutes: Math.max(0, day.workingMinutes - day.drivingMinutes),
      colour: COLOURS.otherWork,
    },
    { id: "break", minutes: day.breakMinutes, colour: COLOURS.break },
    { id: "poa", minutes: day.poaMinutes, colour: COLOURS.poa },
  ].filter((segment) => segment.minutes > 0);

  return (
    <View style={styles.activityRibbon}>
      {segments.map((segment) => (
        <View
          key={segment.id}
          style={{ backgroundColor: segment.colour, flex: segment.minutes }}
        />
      ))}
    </View>
  );
}

function JourneyDay({
  day,
  index,
  onOpen,
}: {
  day: WeekComplianceDaySummary;
  index: number;
  onOpen: (day: WeekComplianceDaySummary) => void;
}) {
  const colour = dayColour(day);

  return (
    <Pressable
      disabled={!day.recorded}
      onPress={() => onOpen(day)}
      style={({ pressed }) => [
        styles.dayStation,
        day.live && styles.liveDayStation,
        pressed && day.recorded && styles.pressed,
      ]}
    >
      <View style={styles.dayHeading}>
        <Text style={styles.dayName}>{DAY_NAMES[index]}</Text>
        <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
      </View>
      <Text style={[styles.dayStatus, { color: colour }]}>{dayLabel(day)}</Text>
      <ActivityRibbon day={day} />
      <Text style={[styles.dayTotal, !day.recorded && styles.mutedText]}>
        {day.recorded ? formatMinutes(day.drivingMinutes) : "—"}
      </Text>
    </Pressable>
  );
}

function WeekRoute({
  week,
  onOpenWeek,
  onOpenDay,
}: {
  week: FortnightJourneyWeekSummary;
  onOpenWeek: (week: FortnightJourneyWeekSummary) => void;
  onOpenDay: (day: WeekComplianceDaySummary) => void;
}) {
  const colour = levelColour(week.level);

  return (
    <View
      style={[
        styles.weekRoute,
        { borderLeftColor: colour },
        week.live && styles.liveWeekRoute,
      ]}
    >
      <View style={styles.weekSummary}>
        <View>
          <Text style={styles.weekPosition}>
            {week.position === "previous" ? "WEEK ONE" : "WEEK TWO"}
          </Text>
          <Text style={styles.weekDates}>
            {formatDate(week.weekStartDate)} – {formatDate(week.weekEndDate)}
          </Text>
        </View>
        <Text style={[styles.weekStatus, { color: colour }]}>
          {week.live ? `LIVE · ${levelLabel(week.level)}` : levelLabel(week.level)}
        </Text>
        <View>
          <Text style={styles.weekDriving}>{formatMinutes(week.drivingMinutes)}</Text>
          <Text style={styles.weekDrivingCaption}>driving</Text>
        </View>
        <Pressable onPress={() => onOpenWeek(week)} style={styles.openWeekButton}>
          <Text style={styles.openWeekText}>OPEN WEEK →</Text>
        </Pressable>
      </View>

      <View style={styles.dayRoute}>
        {week.days.map((day, index) => (
          <JourneyDay key={day.date} day={day} index={index} onOpen={onOpenDay} />
        ))}
      </View>
    </View>
  );
}

function ProgressBar({ result }: { result: FortnightComplianceJourneyResult }) {
  const previousPercentage = Math.min(
    100,
    (result.previousWeek.drivingMinutes / FORTNIGHT_LIMIT_MINUTES) * 100,
  );
  const currentPercentage = Math.min(
    100 - previousPercentage,
    (result.currentWeek.drivingMinutes / FORTNIGHT_LIMIT_MINUTES) * 100,
  );

  return (
    <View>
      <View style={styles.progressLabels}>
        <Text style={styles.progressTitle}>90h fortnight route</Text>
        <Text style={[styles.progressValue, { color: levelColour(result.level) }]}>
          {formatMinutes(result.drivingMinutes)} / 90h
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: "#38bdf8", width: `${previousPercentage}%` },
          ]}
        />
        <View
          style={[
            styles.progressFill,
            { backgroundColor: levelColour(result.level), width: `${currentPercentage}%` },
          ]}
        />
      </View>
      <View style={styles.progressLegend}>
        <Text style={styles.progressCaption}>
          Week one {formatMinutes(result.previousWeek.drivingMinutes)}
        </Text>
        <Text style={styles.progressCaption}>
          Week two {formatMinutes(result.currentWeek.drivingMinutes)}
        </Text>
        <Text style={styles.progressRemaining}>
          {result.state.status === "breach"
            ? `${formatMinutes(result.drivingMinutes - FORTNIGHT_LIMIT_MINUTES)} over limit`
            : `${formatMinutes(result.state.remainingMinutes)} legally available`}
        </Text>
      </View>
    </View>
  );
}

export default function FortnightJourneyScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const requestedMode = getSingleParam(params.mode);
  const [dataMode, setDataMode] = useState<DataMode>(() =>
    requestedMode === "demo" ? "demo" : "live",
  );
  const [history, setHistory] = useState(() =>
    createCurrentFortnightlyDriverHistory(Date.now()),
  );
  const [now, setNow] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function hydrate(): Promise<void> {
      const stored = await loadFortnightlyDriverHistory();

      if (cancelled) {
        return;
      }

      setHistory(
        stored === null
          ? createCurrentFortnightlyDriverHistory(Date.now())
          : rollFortnightlyDriverHistoryForward(stored, Date.now()),
      );
      setHydrated(true);
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [refreshVersion]);

  const prepared = useMemo<{
    result: FortnightComplianceJourneyResult | null;
    error: string | null;
  }>(() => {
    try {
      const selectedHistory = dataMode === "demo" ? buildDemoHistory() : history;
      const selectedNow =
        dataMode === "demo"
          ? new Date(SAMPLE_COMPLIANCE_JOURNEY_YEAR_NOW).getTime()
          : now;
      const candidateLiveDate =
        dataMode === "demo"
          ? SAMPLE_COMPLIANCE_JOURNEY_YEAR_LIVE_DATE
          : getLocalDate(selectedNow);
      const liveDate =
        candidateLiveDate >= selectedHistory.currentWeek.weekStartDate &&
        candidateLiveDate <= selectedHistory.currentWeek.weekEndDate
          ? candidateLiveDate
          : undefined;

      return {
        result: buildFortnightComplianceJourney({
          id: `fortnight-journey-${dataMode}`,
          previousWeek: selectedHistory.previousWeek,
          currentWeek: selectedHistory.currentWeek,
          now: selectedNow,
          ...(liveDate === undefined ? {} : { liveDate }),
        }),
        error: null,
      };
    } catch (error) {
      return {
        result: null,
        error:
          error instanceof Error
            ? error.message
            : "The Fortnight Journey could not be built.",
      };
    }
  }, [dataMode, history, now]);

  function refresh(): void {
    setNow(Date.now());
    setRefreshVersion((value) => value + 1);
  }

  function openWeek(week: FortnightJourneyWeekSummary): void {
    router.push({
      pathname: "/diary/week-network",
      params: {
        mode: dataMode,
        returnTo: "fortnight",
        weekStart: week.weekStartDate,
      },
    });
  }

  function openDay(day: WeekComplianceDaySummary): void {
    if (!day.recorded) {
      return;
    }

    router.push({ pathname: "/diary/day", params: { date: day.date } });
  }

  const result = prepared.result;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TACHOTRACK LIVE</Text>
            <Text style={styles.title}>Fortnight Journey</Text>
            <Text style={styles.subtitle}>
              {result === null
                ? "Two consecutive legal weeks"
                : `${formatDate(result.fortnightStartDate)} – ${formatDate(result.fortnightEndDate)}${dataMode === "demo" ? " · demo snapshot" : ""}`}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.modeSwitch}>
              <Pressable
                onPress={() => setDataMode("live")}
                style={[styles.modeButton, dataMode === "live" && styles.modeButtonActive]}
              >
                <Text style={[styles.modeText, dataMode === "live" && styles.modeTextActive]}>
                  Live
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDataMode("demo")}
                style={[styles.modeButton, dataMode === "demo" && styles.modeButtonActive]}
              >
                <Text style={[styles.modeText, dataMode === "demo" && styles.modeTextActive]}>
                  Demo Fortnight
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
          <View style={styles.messageCard}>
            <Text style={styles.messageTitle}>Loading fortnight history…</Text>
          </View>
        ) : prepared.error !== null || result === null ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Fortnight Journey unavailable</Text>
            <Text style={styles.errorText}>{prepared.error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, { borderTopColor: levelColour(result.level) }]}>
                <Text style={styles.summaryLabel}>90H FORTNIGHT</Text>
                <Text style={styles.summaryValue}>{formatMinutes(result.drivingMinutes)}</Text>
                <Text style={[styles.summaryCaption, { color: levelColour(result.level) }]}>
                  {result.state.status === "breach"
                    ? `${formatMinutes(result.drivingMinutes - FORTNIGHT_LIMIT_MINUTES)} over limit`
                    : `${formatMinutes(result.state.remainingMinutes)} legally available`}
                </Text>
              </View>
              <View style={[styles.summaryCard, { borderTopColor: "#38bdf8" }]}>
                <Text style={styles.summaryLabel}>WEEK ONE</Text>
                <Text style={styles.summaryValue}>
                  {formatMinutes(result.previousWeek.drivingMinutes)}
                </Text>
                <Text style={styles.summaryCaption}>
                  {result.previousWeek.recordedDayCount} recorded days
                </Text>
              </View>
              <View style={[styles.summaryCard, { borderTopColor: "#a855f7" }]}>
                <Text style={styles.summaryLabel}>WEEK TWO</Text>
                <Text style={styles.summaryValue}>
                  {formatMinutes(result.currentWeek.drivingMinutes)}
                </Text>
                <Text style={styles.summaryCaption}>
                  {result.currentWeek.live ? "Live week" : `${result.currentWeek.recordedDayCount} recorded days`}
                </Text>
              </View>
            </View>

            <View style={styles.journeyPanel}>
              <View style={styles.panelHeading}>
                <View>
                  <Text style={styles.panelTitle}>Two weeks as one legal journey</Text>
                  <Text style={styles.panelSubtitle}>
                    Tap a day for its diary or open either complete Week Journey
                  </Text>
                </View>
                <View style={styles.legend}>
                  <Text style={[styles.legendText, { color: COLOURS.driving }]}>● Driving</Text>
                  <Text style={[styles.legendText, { color: COLOURS.otherWork }]}>● Other Work</Text>
                  <Text style={[styles.legendText, { color: COLOURS.break }]}>● Break</Text>
                  <Text style={[styles.legendText, { color: COLOURS.poa }]}>● POA</Text>
                </View>
              </View>

              <View style={styles.connectionRail}>
                <View style={styles.connectionDot} />
                <View style={styles.connectionLine} />
                <View style={styles.connectionDot} />
                <Text style={styles.connectionLabel}>ONE CONTINUOUS 90H ROUTE</Text>
              </View>

              <WeekRoute
                week={result.previousWeek}
                onOpenWeek={openWeek}
                onOpenDay={openDay}
              />
              <WeekRoute
                week={result.currentWeek}
                onOpenWeek={openWeek}
                onOpenDay={openDay}
              />

              <View style={styles.limitPanel}>
                <ProgressBar result={result} />
              </View>

              {result.state.status === "warning" || result.state.status === "limit" ? (
                <View style={styles.warningCard}>
                  <View>
                    <Text style={styles.warningEyebrow}>FORTNIGHT PLANNING</Text>
                    <Text style={styles.warningTitle}>
                      {result.state.status === "limit"
                        ? "The 90-hour allowance is fully used"
                        : `${formatMinutes(result.state.remainingMinutes)} remains before 90 hours`}
                    </Text>
                  </View>
                  <Text style={styles.warningText}>
                    TachoTrack will carry this remaining allowance into route and rest-stop planning.
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020817" },
  page: { padding: 16, gap: 12 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  eyebrow: { color: "#38bdf8", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  title: { color: "#f8fafc", fontSize: 30, fontWeight: "900", marginTop: 4 },
  subtitle: { color: "#7891af", fontSize: 12, marginTop: 3 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  modeSwitch: {
    flexDirection: "row",
    padding: 3,
    borderWidth: 1,
    borderColor: "#244360",
    borderRadius: 12,
    backgroundColor: "#071425",
  },
  modeButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9 },
  modeButtonActive: { backgroundColor: "#0ea5e9" },
  modeText: { color: "#7891af", fontSize: 12, fontWeight: "800" },
  modeTextActive: { color: "#ffffff" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#244360",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: "#071425",
  },
  secondaryButtonText: { color: "#38bdf8", fontSize: 12, fontWeight: "900" },
  closeButton: {
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: "#f1f5f9",
  },
  closeButtonText: { color: "#071425", fontSize: 12, fontWeight: "900" },
  summaryGrid: { flexDirection: "row", gap: 10 },
  summaryCard: {
    flex: 1,
    minHeight: 104,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1d3853",
    borderTopWidth: 3,
    borderRadius: 14,
    backgroundColor: "#071425",
  },
  summaryLabel: { color: "#6f8ca9", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  summaryValue: { color: "#f8fafc", fontSize: 25, fontWeight: "900", marginTop: 10 },
  summaryCaption: { color: "#7ebbe5", fontSize: 11, marginTop: 5 },
  journeyPanel: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#1d3853",
    borderRadius: 16,
    backgroundColor: "#061222",
    gap: 12,
  },
  panelHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  panelTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "900" },
  panelSubtitle: { color: "#7891af", fontSize: 11, marginTop: 3 },
  legend: { flexDirection: "row", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" },
  legendText: { fontSize: 10, fontWeight: "800" },
  connectionRail: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  connectionDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#38bdf8" },
  connectionLine: { flex: 1, height: 2, backgroundColor: "#245170" },
  connectionLabel: { color: "#38bdf8", fontSize: 9, fontWeight: "900", marginLeft: 10, letterSpacing: 1 },
  weekRoute: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#16324c",
    borderLeftWidth: 4,
    borderRadius: 13,
    backgroundColor: "#08182a",
  },
  liveWeekRoute: { borderColor: "#38bdf8", backgroundColor: "#092139" },
  weekSummary: { width: 160, justifyContent: "space-between", gap: 6 },
  weekPosition: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  weekDates: { color: "#7891af", fontSize: 10, marginTop: 2 },
  weekStatus: { fontSize: 10, fontWeight: "900" },
  weekDriving: { color: "#f8fafc", fontSize: 18, fontWeight: "900" },
  weekDrivingCaption: { color: "#7891af", fontSize: 9 },
  openWeekButton: { paddingVertical: 5 },
  openWeekText: { color: "#38bdf8", fontSize: 10, fontWeight: "900" },
  dayRoute: { flex: 1, flexDirection: "row", gap: 6 },
  dayStation: {
    flex: 1,
    minWidth: 82,
    minHeight: 116,
    padding: 8,
    borderWidth: 1,
    borderColor: "#16324c",
    borderRadius: 10,
    backgroundColor: "#071425",
  },
  liveDayStation: { borderColor: "#38bdf8", backgroundColor: "#0a2540" },
  pressed: { opacity: 0.72 },
  dayHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayName: { color: "#f8fafc", fontSize: 10, fontWeight: "900" },
  dayDate: { color: "#7891af", fontSize: 8 },
  dayStatus: { fontSize: 8, fontWeight: "900", marginTop: 9 },
  activityRibbon: {
    flexDirection: "row",
    height: 22,
    overflow: "hidden",
    borderRadius: 5,
    marginTop: 8,
    backgroundColor: "#152b43",
  },
  activityRibbonEmpty: { backgroundColor: "#152b43" },
  dayTotal: { color: "#dbeafe", fontSize: 9, fontWeight: "800", marginTop: 9 },
  mutedText: { color: "#506782" },
  limitPanel: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#1d3853",
    borderRadius: 12,
    backgroundColor: "#071425",
  },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  progressTitle: { color: "#dbeafe", fontSize: 12, fontWeight: "900" },
  progressValue: { fontSize: 12, fontWeight: "900" },
  progressTrack: {
    flexDirection: "row",
    height: 10,
    overflow: "hidden",
    borderRadius: 5,
    marginTop: 9,
    backgroundColor: "#152b43",
  },
  progressFill: { height: "100%" },
  progressLegend: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
  progressCaption: { color: "#7891af", fontSize: 9 },
  progressRemaining: { color: "#dbeafe", fontSize: 9, fontWeight: "900" },
  warningCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#f5a400",
    borderRadius: 12,
    backgroundColor: "#332508",
  },
  warningEyebrow: { color: "#f5a400", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  warningTitle: { color: "#fff7d6", fontSize: 17, fontWeight: "900", marginTop: 4 },
  warningText: { flex: 1, color: "#e6d49b", fontSize: 10, textAlign: "right" },
  messageCard: { padding: 24, borderRadius: 14, backgroundColor: "#071425" },
  messageTitle: { color: "#dbeafe", fontSize: 16, fontWeight: "800" },
  errorCard: {
    padding: 20,
    borderWidth: 1,
    borderColor: "#fb5770",
    borderRadius: 14,
    backgroundColor: "#321321",
  },
  errorTitle: { color: "#fb8ba0", fontSize: 17, fontWeight: "900" },
  errorText: { color: "#fecdd3", fontSize: 12, marginTop: 6 },
});
