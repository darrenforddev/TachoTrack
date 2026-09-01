import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, {
  Circle,
  G,
  Rect,
  Line as SvgLine,
  Text as SvgText,
} from "react-native-svg";

import {
  createInitialActivityHistory,
  getActiveActivityEvent,
  getActivityHistoryLabel,
  type ActivityHistoryEvent,
  type ActivityHistoryState,
} from "../../data/activityHistory";
import { loadActivityHistory } from "../../data/activityHistoryStorage";
import { buildLiveDriverDay } from "../../data/liveDriverDayAdapter";
import {
  createInitialRestSessionState,
  type RestSession,
  type RestSessionState,
} from "../../data/restSession";
import { loadRestSessionState } from "../../data/restSessionStorage";
import {
  createSampleComplianceNetworkActivityHistory,
  createSampleComplianceNetworkRestState,
  SAMPLE_COMPLIANCE_NETWORK_NOW,
} from "../../data/sampleComplianceNetworkDay";
import {
  type ComplianceNetworkLineId,
  type ComplianceNetworkSeverity,
  type ComplianceNetworkStation,
  type ComplianceNetworkTimer,
} from "../../engine/complianceNetworkMap";
import type { LiveDayComplianceNetworkStates } from "../../engine/liveDayComplianceNetworkMap";
import { buildLiveDayComplianceNetworkMap } from "../../engine/liveDayComplianceNetworkMap";
import {
  evaluateLongRunningActivityGuard,
  type LongRunningActivityConfirmation,
} from "../../engine/longRunningActivityGuard";
import type { DriverDay } from "../../engine/types";

const MINUTE_MILLISECONDS = 60 * 1000;
const DAY_MILLISECONDS = 24 * 60 * MINUTE_MILLISECONDS;
const STANDARD_DAILY_REST_MINUTES = 11 * 60;
const STANDARD_WEEKLY_REST_MINUTES = 45 * 60;

const LINE_COLOURS: Record<ComplianceNetworkLineId, string> = {
  activity: "#38bdf8",
  "continuous-driving": "#f97316",
  "daily-driving": "#ef4444",
  wtd: "#a855f7",
  "daily-rest": "#22c55e",
  "weekly-driving": "#eab308",
  "fortnightly-driving": "#f43f5e",
  "weekly-rest": "#14b8a6",
  compensation: "#f59e0b",
};

const SEVERITY_COLOURS: Record<ComplianceNetworkSeverity, string> = {
  good: "#22c55e",
  info: "#38bdf8",
  warning: "#f59e0b",
  limit: "#fb7185",
  breach: "#ef4444",
};

const ACTIVITY_COLOURS = {
  driving: "#ef4444",
  break: "#22c55e",
  otherWork: "#38bdf8",
  poa: "#a855f7",
  rest: "#14b8a6",
} as const;

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatClock(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function percentageDimension(value: number): `${number}%` {
  return `${clampPercentage(value)}%`;
}

function getActivityLabel(
  type: DriverDay["activities"][number]["type"],
): string {
  switch (type) {
    case "driving":
      return "Driving";
    case "break":
      return "Break";
    case "otherWork":
      return "Other Work";
    case "poa":
      return "POA";
    case "rest":
      return "Rest";
  }
}

function formatDateHeading(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getLocalDayBounds(nowMilliseconds: number) {
  const now = new Date(nowMilliseconds);
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();

  return {
    start,
    end: start + DAY_MILLISECONDS,
  };
}

function overlapsWindow(
  startedAt: string,
  endedAt: string | null,
  windowStart: number,
  windowEnd: number,
  nowMilliseconds: number,
): boolean {
  const start = new Date(startedAt).getTime();
  const end = endedAt === null ? nowMilliseconds : new Date(endedAt).getTime();

  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start < windowEnd &&
    end >= windowStart
  );
}

function getRestTargetMinutes(session: RestSession): number {
  return session.type === "daily"
    ? STANDARD_DAILY_REST_MINUTES
    : STANDARD_WEEKLY_REST_MINUTES;
}

function getTimerHeadline(timer: ComplianceNetworkTimer): string {
  switch (timer.state) {
    case "protected":
      return timer.display;
    case "safety-buffer":
      return `${timer.display} safety buffer`;
    case "cleared":
      return "Safe resume time reached";
    case "interrupted":
      return "Rest interrupted";
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to build the map.";
}

export default function ComplianceNetworkScreen() {
  const { width } = useWindowDimensions();
  const [history, setHistory] = useState<ActivityHistoryState>(() =>
    createInitialActivityHistory(),
  );
  const [restState, setRestState] = useState<RestSessionState>(() =>
    createInitialRestSessionState(),
  );
  const [nowMilliseconds, setNowMilliseconds] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [mapView, setMapView] = useState<"hybrid" | "network">("hybrid");
  const [activityConfirmation, setActivityConfirmation] =
    useState<LongRunningActivityConfirmation | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );

  const hydrate = useCallback(async () => {
    setLoadError(null);

    try {
      const [storedHistory, storedRestState] = await Promise.all([
        loadActivityHistory(),
        loadRestSessionState(),
      ]);

      setHistory(storedHistory ?? createInitialActivityHistory());
      setRestState(storedRestState);
      setNowMilliseconds(Date.now());
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrate();

    const interval = setInterval(() => {
      setNowMilliseconds(Date.now());
    }, 30_000);

    return () => clearInterval(interval);
  }, [hydrate]);

  const displayedHistory = useMemo(
    () => (demoMode ? createSampleComplianceNetworkActivityHistory() : history),
    [demoMode, history],
  );

  const displayedRestState = useMemo(
    () => (demoMode ? createSampleComplianceNetworkRestState() : restState),
    [demoMode, restState],
  );

  const displayedNowMilliseconds = demoMode
    ? new Date(SAMPLE_COMPLIANCE_NETWORK_NOW).getTime()
    : nowMilliseconds;

  const longRunningGuard = useMemo(() => {
    try {
      return evaluateLongRunningActivityGuard(
        displayedHistory,
        displayedRestState,
        displayedNowMilliseconds,
        {
          confirmation: demoMode ? null : activityConfirmation,
        },
      );
    } catch {
      return null;
    }
  }, [
    activityConfirmation,
    demoMode,
    displayedHistory,
    displayedNowMilliseconds,
    displayedRestState,
  ]);

  const calculation = useMemo(() => {
    try {
      const dayBounds = getLocalDayBounds(displayedNowMilliseconds);

      const dayEvents = displayedHistory.events.filter((event) =>
        overlapsWindow(
          event.startedAt,
          event.endedAt,
          dayBounds.start,
          dayBounds.end,
          displayedNowMilliseconds,
        ),
      );

      const dayRestSessions = displayedRestState.sessions.filter((session) =>
        overlapsWindow(
          session.startedAt,
          session.endedAt,
          dayBounds.start,
          dayBounds.end,
          displayedNowMilliseconds,
        ),
      );

      const startCandidates = [
        ...dayEvents.map((event) => new Date(event.startedAt).getTime()),
        ...dayRestSessions.map((session) =>
          new Date(session.startedAt).getTime(),
        ),
      ].filter(Number.isFinite);

      const mapStart =
        startCandidates.length > 0
          ? Math.min(...startCandidates)
          : dayBounds.start;

      const dailyRestCompletionCandidates = dayRestSessions
        .filter((session) => session.type === "daily")
        .map(
          (session) =>
            new Date(session.startedAt).getTime() +
            (STANDARD_DAILY_REST_MINUTES + 5) * MINUTE_MILLISECONDS,
        );

      const mapEnd = Math.max(
        mapStart + DAY_MILLISECONDS,
        displayedNowMilliseconds + 30 * MINUTE_MILLISECONDS,
        ...dailyRestCompletionCandidates,
      );

      const day = buildLiveDriverDay(dayEvents, displayedNowMilliseconds);

      const value = buildLiveDayComplianceNetworkMap({
        id: `live-day-network-${formatLocalDate(new Date(displayedNowMilliseconds))}`,
        startAt: new Date(mapStart).toISOString(),
        endAt: new Date(mapEnd).toISOString(),
        now: displayedNowMilliseconds,
        day,
        activityHistory: dayEvents,
        restSessions: displayedRestState.sessions,
        restRequirements: dayRestSessions.map((session) => ({
          session,
          baseRestMinutes: getRestTargetMinutes(session),
        })),
      });

      return {
        value,
        error: null,
        dayEvents,
        day,
      };
    } catch (error) {
      return {
        value: null,
        error: getErrorMessage(error),
        dayEvents: [] as ActivityHistoryEvent[],
        day: null,
      };
    }
  }, [
    displayedHistory.events,
    displayedNowMilliseconds,
    displayedRestState.sessions,
  ]);

  const map = calculation.value?.map ?? null;
  const activeActivity = getActiveActivityEvent(displayedHistory);

  const activeTimer = useMemo(() => {
    if (map === null) {
      return null;
    }

    const timers = map.stations.flatMap((station) => station.timers);

    return (
      timers.find(
        (timer) =>
          timer.state === "protected" || timer.state === "safety-buffer",
      ) ??
      timers[timers.length - 1] ??
      null
    );
  }, [map]);

  const selectedStation = useMemo(() => {
    if (map === null || map.stations.length === 0) {
      return null;
    }

    return (
      map.stations.find((station) => station.id === selectedStationId) ??
      map.stations[map.stations.length - 1]
    );
  }, [map, selectedStationId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color="#38bdf8" size="large" />
        <Text style={styles.loadingText}>Building today&apos;s network…</Text>
      </SafeAreaView>
    );
  }

  const error = loadError ?? calculation.error;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>TACHOTRACK LIVE</Text>
          <Text style={styles.title}>Compliance Network</Text>
          <Text style={styles.subtitle}>
            {formatDateHeading(displayedNowMilliseconds)} ·{" "}
            {demoMode ? "demo snapshot" : "updated"}{" "}
            {formatClock(new Date(displayedNowMilliseconds).toISOString())}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <View style={styles.modeSwitch}>
            <Pressable
              style={[styles.modeButton, !demoMode && styles.modeButtonActive]}
              onPress={() => setDemoMode(false)}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  !demoMode && styles.modeButtonTextActive,
                ]}
              >
                Live
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, demoMode && styles.modeButtonActive]}
              onPress={() => setDemoMode(true)}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  demoMode && styles.modeButtonTextActive,
                ]}
              >
                Demo Day
              </Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push("/diary/week-network")}
          >
            <Text style={styles.secondaryButtonText}>Week Journey</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void hydrate()}
          >
            <Text style={styles.secondaryButtonText}>Refresh</Text>
          </Pressable>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {!demoMode && longRunningGuard?.confirmationRequired ? (
          <View style={styles.activityGuardPanel}>
            <View style={styles.activityGuardCopy}>
              <Text style={styles.activityGuardEyebrow}>
                ACTIVITY CONFIRMATION
              </Text>
              <Text style={styles.activityGuardTitle}>
                Is this activity still correct?
              </Text>
              <Text style={styles.activityGuardText}>
                {longRunningGuard.message} TachoTrack will not close or alter
                the original record automatically.
              </Text>
            </View>

            <View style={styles.activityGuardActions}>
              <Pressable
                style={styles.activityGuardSecondaryButton}
                onPress={() => router.back()}
              >
                <Text style={styles.activityGuardSecondaryText}>
                  Review dashboard
                </Text>
              </Pressable>
              <Pressable
                style={styles.activityGuardConfirmButton}
                onPress={() => {
                  if (longRunningGuard.activeEventId === null) {
                    return;
                  }

                  setActivityConfirmation({
                    eventId: longRunningGuard.activeEventId,
                    confirmedAt: new Date(nowMilliseconds).toISOString(),
                  });
                }}
              >
                <Text style={styles.activityGuardConfirmText}>
                  Still correct
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {error !== null ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>Map unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {map !== null ? (
          <>
            <View style={styles.statusRow}>
              <StatusCard
                label="CURRENT ACTIVITY"
                value={
                  activeActivity === null
                    ? "No active activity"
                    : getActivityHistoryLabel(activeActivity.activity)
                }
                accent="#38bdf8"
              />
              <StatusCard
                label="OVERNIGHT REST"
                value={
                  activeTimer === null
                    ? "No active rest timer"
                    : getTimerHeadline(activeTimer)
                }
                accent={
                  activeTimer?.state === "safety-buffer" ? "#f59e0b" : "#22c55e"
                }
              />
              <StatusCard
                label="NETWORK"
                value={`${map.lines.length} lines · ${map.stations.length} stations`}
                accent="#a855f7"
              />
            </View>

            <View style={styles.mapPanel}>
              <View style={styles.mapPanelHeader}>
                <View>
                  <Text style={styles.panelTitle}>
                    {mapView === "hybrid"
                      ? "Today’s activity and compliance"
                      : "Today’s overhead network"}
                  </Text>
                  <Text style={styles.panelSubtitle}>
                    {mapView === "hybrid"
                      ? "Activity first, with live legal decision rails"
                      : "Tap any station to inspect its evidence"}
                  </Text>
                </View>
                <View style={styles.mapHeaderActions}>
                  <View style={styles.mapViewSwitch}>
                    <Pressable
                      style={[
                        styles.mapViewButton,
                        mapView === "hybrid" && styles.mapViewButtonActive,
                      ]}
                      onPress={() => setMapView("hybrid")}
                    >
                      <Text
                        style={[
                          styles.mapViewButtonText,
                          mapView === "hybrid" &&
                            styles.mapViewButtonTextActive,
                        ]}
                      >
                        Hybrid
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.mapViewButton,
                        mapView === "network" && styles.mapViewButtonActive,
                      ]}
                      onPress={() => setMapView("network")}
                    >
                      <Text
                        style={[
                          styles.mapViewButtonText,
                          mapView === "network" &&
                            styles.mapViewButtonTextActive,
                        ]}
                      >
                        Network
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveBadgeText}>YOU ARE HERE</Text>
                  </View>
                </View>
              </View>

              {mapView === "hybrid" &&
              calculation.day !== null &&
              calculation.value !== null ? (
                <HybridDayView
                  day={calculation.day}
                  states={calculation.value.states}
                  timer={activeTimer}
                  nowMilliseconds={displayedNowMilliseconds}
                />
              ) : (
                <NetworkDiagram
                  map={map}
                  availableWidth={width}
                  selectedStationId={selectedStation?.id ?? null}
                  onSelectStation={setSelectedStationId}
                />
              )}
            </View>

            {mapView === "network" ? (
              <StationInspector station={selectedStation} />
            ) : null}

            <Text style={styles.restTargetNote}>
              Timer targets currently show standard rest: 11h daily or 45h
              weekly, plus the configured safety margin. Reduced-rest selection
              will be connected when that choice is stored with each session.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={[styles.statusCard, { borderTopColor: accent }]}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function HybridDayView({
  day,
  states,
  timer,
  nowMilliseconds,
}: {
  day: DriverDay;
  states: LiveDayComplianceNetworkStates;
  timer: ComplianceNetworkTimer | null;
  nowMilliseconds: number;
}) {
  const totalActivityMinutes = Math.max(
    1,
    day.activities.reduce(
      (total, activity) => total + activity.durationMinutes,
      0,
    ),
  );
  const firstActivity = day.activities[0] ?? null;
  const wtdBreakPercentage =
    states.wtd.requiredBreakMinutes === 0
      ? 100
      : clampPercentage(
          (states.wtd.qualifyingBreakMinutes /
            states.wtd.requiredBreakMinutes) *
            100,
        );
  const dailyRestDeadlinePercentage =
    states.dailyRest.minutesUntilDeadline === null
      ? 0
      : clampPercentage(
          ((24 * 60 - states.dailyRest.minutesUntilDeadline) / (24 * 60)) * 100,
        );

  return (
    <View style={styles.hybridBody}>
      <View style={styles.activityLegend}>
        <ActivityLegendItem label="Driving" colour={ACTIVITY_COLOURS.driving} />
        <ActivityLegendItem label="Break" colour={ACTIVITY_COLOURS.break} />
        <ActivityLegendItem
          label="Other Work"
          colour={ACTIVITY_COLOURS.otherWork}
        />
        <ActivityLegendItem label="POA" colour={ACTIVITY_COLOURS.poa} />
      </View>

      {day.activities.length > 0 ? (
        <>
          <View style={styles.activityRibbon}>
            {day.activities.map((activity) => {
              const percentage =
                (activity.durationMinutes / totalActivityMinutes) * 100;

              return (
                <View
                  key={activity.id}
                  accessibilityLabel={`${getActivityLabel(activity.type)}, ${formatMinutes(activity.durationMinutes)}`}
                  style={[
                    styles.activityRibbonSegment,
                    {
                      backgroundColor: ACTIVITY_COLOURS[activity.type],
                      flexGrow: Math.max(activity.durationMinutes, 1),
                      flexBasis: percentageDimension(percentage),
                    },
                  ]}
                >
                  {activity.durationMinutes >= 30 ? (
                    <Text style={styles.activityRibbonText} numberOfLines={1}>
                      {getActivityLabel(activity.type)} ·{" "}
                      {formatMinutes(activity.durationMinutes)}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
          <View style={styles.activityTimeRow}>
            <Text style={styles.activityTimeText}>
              {firstActivity === null ? "—" : formatClock(firstActivity.start)}
            </Text>
            <View style={styles.activityNowMarker}>
              <View style={styles.activityNowDot} />
              <Text style={styles.activityNowText}>
                NOW {formatClock(new Date(nowMilliseconds).toISOString())}
              </Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.emptyRibbon}>
          <Text style={styles.emptyRibbonText}>
            No activity has been recorded for this day.
          </Text>
        </View>
      )}

      <View style={styles.hybridGrid}>
        <View style={styles.complianceRails}>
          <ComplianceRail
            label="Continuous driving"
            percentage={states.continuousDriving.percentageUsed}
            value={
              states.continuousDriving.status === "breach"
                ? `${formatMinutes(states.continuousDriving.excessMinutes)} over`
                : `${formatMinutes(states.continuousDriving.remainingMinutes)} left`
            }
            status={states.continuousDriving.status}
          />
          <ComplianceRail
            label="Daily driving"
            percentage={states.dailyDriving.percentageOfExtendedUsed}
            value={`${formatMinutes(states.dailyDriving.drivingMinutesUsed)} / ${formatMinutes(states.dailyDriving.extendedLimitMinutes)}`}
            status={states.dailyDriving.status}
          />
          <ComplianceRail
            label="WTD breaks"
            percentage={wtdBreakPercentage}
            value={
              states.wtd.breakShortfallMinutes === 0
                ? "Requirement satisfied"
                : `${formatMinutes(states.wtd.breakShortfallMinutes)} due`
            }
            status={states.wtd.level}
          />
          <ComplianceRail
            label="Daily-rest deadline"
            percentage={dailyRestDeadlinePercentage}
            value={
              states.dailyRest.minutesUntilDeadline === null
                ? "Not active"
                : `${formatMinutes(states.dailyRest.minutesUntilDeadline)} left`
            }
            status={states.dailyRest.level}
          />
        </View>

        <OvernightRestCard timer={timer} states={states} />
      </View>
    </View>
  );
}

function ActivityLegendItem({
  label,
  colour,
}: {
  label: string;
  colour: string;
}) {
  return (
    <View style={styles.activityLegendItem}>
      <View
        style={[styles.activityLegendSwatch, { backgroundColor: colour }]}
      />
      <Text style={styles.activityLegendText}>{label}</Text>
    </View>
  );
}

function ComplianceRail({
  label,
  percentage,
  value,
  status,
}: {
  label: string;
  percentage: number;
  value: string;
  status: string;
}) {
  const colour = getRailColour(status);

  return (
    <View style={styles.complianceRailRow}>
      <View style={styles.complianceRailHeading}>
        <Text style={styles.complianceRailLabel}>{label}</Text>
        <Text style={[styles.complianceRailValue, { color: colour }]}>
          {value}
        </Text>
      </View>
      <View style={styles.complianceRailTrack}>
        <View
          style={[
            styles.complianceRailFill,
            {
              backgroundColor: colour,
              width: percentageDimension(percentage),
            },
          ]}
        />
      </View>
    </View>
  );
}

function getRailColour(status: string): string {
  if (status.includes("breach") || status === "due") {
    return "#ef4444";
  }

  if (
    status.includes("warning") ||
    status === "action" ||
    status === "limit" ||
    status === "standard-limit" ||
    status === "extended-limit"
  ) {
    return "#f59e0b";
  }

  if (status === "advisory" || status === "extended") {
    return "#38bdf8";
  }

  return "#22c55e";
}

function OvernightRestCard({
  timer,
  states,
}: {
  timer: ComplianceNetworkTimer | null;
  states: LiveDayComplianceNetworkStates;
}) {
  const stateColour =
    timer?.state === "safety-buffer"
      ? "#f59e0b"
      : timer?.state === "interrupted"
        ? "#ef4444"
        : "#22c55e";

  return (
    <View style={[styles.overnightCard, { borderLeftColor: stateColour }]}>
      <Text style={[styles.overnightEyebrow, { color: stateColour }]}>
        OVERNIGHT REST
      </Text>
      {timer !== null ? (
        <>
          <Text style={styles.overnightTitle}>Rest in progress</Text>
          <Text style={styles.overnightCountdown}>
            {getTimerHeadline(timer)}
          </Text>
          <View style={styles.overnightDivider} />
          <View style={styles.overnightTimeRow}>
            <Text style={styles.overnightTimeLabel}>Legal completion</Text>
            <Text style={styles.overnightTimeValue}>
              {formatClock(timer.legalCompleteAt)}
            </Text>
          </View>
          <View style={styles.overnightTimeRow}>
            <Text style={styles.overnightTimeLabel}>Safe resume</Text>
            <Text style={styles.overnightTimeValue}>
              {formatClock(timer.recommendedResumeAt)}
            </Text>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.overnightTitle}>No rest timer running</Text>
          <Text style={styles.overnightEmptyText}>
            {states.dailyRest.dailyRestDeadline === null
              ? "The daily-rest reference period has not started."
              : `Daily rest is due by ${formatClock(states.dailyRest.dailyRestDeadline)}.`}
          </Text>
        </>
      )}
    </View>
  );
}

function NetworkDiagram({
  map,
  availableWidth,
  selectedStationId,
  onSelectStation,
}: {
  map: NonNullable<ReturnType<typeof buildLiveDayComplianceNetworkMap>["map"]>;
  availableWidth: number;
  selectedStationId: string | null;
  onSelectStation: (stationId: string) => void;
}) {
  const left = 178;
  const right = 58;
  const top = 70;
  const rowHeight = 58;
  const mapWidth = Math.max(920, availableWidth - 36);
  const mapHeight = top + map.lines.length * rowHeight + 52;
  const plotWidth = mapWidth - left - right;
  const lineIndex = new Map(
    map.lines.map((line, index) => [line.id, index] as const),
  );

  const xForPosition = (position: number) =>
    left + Math.max(0, Math.min(1, position)) * plotWidth;
  const yForLineIndex = (index: number) => top + index * rowHeight;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ width: mapWidth, height: mapHeight }}>
        <Svg width={mapWidth} height={mapHeight}>
          <Rect
            x={0}
            y={0}
            width={mapWidth}
            height={mapHeight}
            rx={20}
            fill="#07111f"
          />

          {map.lines.map((line, index) => {
            const y = yForLineIndex(index);
            const colour = LINE_COLOURS[line.id];

            return (
              <G key={line.id}>
                <SvgText
                  x={18}
                  y={y + 5}
                  fill="#cbd5e1"
                  fontSize={12}
                  fontWeight="700"
                >
                  {line.shortLabel}
                </SvgText>
                <SvgLine
                  x1={left}
                  y1={y}
                  x2={mapWidth - right}
                  y2={y}
                  stroke={colour}
                  strokeWidth={8}
                  strokeLinecap="round"
                  opacity={0.84}
                />
              </G>
            );
          })}

          {map.livePosition !== null ? (
            <G>
              <SvgLine
                x1={xForPosition(map.livePosition.position)}
                y1={34}
                x2={xForPosition(map.livePosition.position)}
                y2={mapHeight - 30}
                stroke="#67e8f9"
                strokeWidth={2}
                strokeDasharray="5 6"
                opacity={0.9}
              />
              <Rect
                x={xForPosition(map.livePosition.position) - 22}
                y={12}
                width={44}
                height={22}
                rx={11}
                fill="#083344"
                stroke="#67e8f9"
              />
              <SvgText
                x={xForPosition(map.livePosition.position)}
                y={27}
                fill="#cffafe"
                fontSize={9}
                fontWeight="800"
                textAnchor="middle"
              >
                NOW
              </SvgText>
            </G>
          ) : null}

          {map.stations.map((station, stationIndex) => {
            const stationLineIndexes = station.lineIds
              .map((lineId) => lineIndex.get(lineId))
              .filter((index): index is number => index !== undefined);

            if (stationLineIndexes.length === 0) {
              return null;
            }

            const x = xForPosition(station.position);
            const minimumLine = Math.min(...stationLineIndexes);
            const maximumLine = Math.max(...stationLineIndexes);
            const minimumY = yForLineIndex(minimumLine);
            const maximumY = yForLineIndex(maximumLine);
            const selected = station.id === selectedStationId;
            const stationColour = SEVERITY_COLOURS[station.severity];
            const labelAbove = stationIndex % 2 === 0;
            const labelY = labelAbove ? minimumY - 18 : maximumY + 27;

            return (
              <G key={station.id}>
                {station.isInterchange && maximumY > minimumY ? (
                  <SvgLine
                    x1={x}
                    y1={minimumY}
                    x2={x}
                    y2={maximumY}
                    stroke="#dbeafe"
                    strokeWidth={selected ? 5 : 3}
                    opacity={selected ? 1 : 0.68}
                  />
                ) : null}

                {stationLineIndexes.map((index) => (
                  <G key={`${station.id}-${index}`}>
                    {selected ? (
                      <Circle
                        cx={x}
                        cy={yForLineIndex(index)}
                        r={14}
                        fill={stationColour}
                        opacity={0.22}
                      />
                    ) : null}
                    <Circle
                      cx={x}
                      cy={yForLineIndex(index)}
                      r={station.isInterchange ? 8 : 6}
                      fill="#07111f"
                      stroke={stationColour}
                      strokeWidth={selected ? 5 : 3}
                    />
                  </G>
                ))}

                <SvgText
                  x={x}
                  y={labelY}
                  fill={selected ? "#ffffff" : "#94a3b8"}
                  fontSize={9}
                  fontWeight={selected ? "800" : "600"}
                  textAnchor="middle"
                >
                  {formatClock(station.occurredAt)}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        {map.stations.map((station) => {
          const stationLineIndexes = station.lineIds
            .map((lineId) => lineIndex.get(lineId))
            .filter((index): index is number => index !== undefined);

          if (stationLineIndexes.length === 0) {
            return null;
          }

          const x = xForPosition(station.position);
          const minimumY = yForLineIndex(Math.min(...stationLineIndexes));
          const maximumY = yForLineIndex(Math.max(...stationLineIndexes));

          return (
            <Pressable
              key={`touch-${station.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${formatClock(station.occurredAt)} ${station.title}`}
              onPress={() => onSelectStation(station.id)}
              style={{
                position: "absolute",
                left: x - 18,
                top: minimumY - 18,
                width: 36,
                height: maximumY - minimumY + 36,
              }}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

function StationInspector({
  station,
}: {
  station: ComplianceNetworkStation | null;
}) {
  if (station === null) {
    return (
      <View style={styles.inspector}>
        <Text style={styles.inspectorTitle}>No station evidence yet</Text>
        <Text style={styles.inspectorSummary}>
          Start an activity and the live journey will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.inspector}>
      <View style={styles.inspectorHeadingRow}>
        <View style={styles.inspectorHeadingCopy}>
          <Text style={styles.inspectorTime}>
            {formatClock(station.occurredAt)}
          </Text>
          <Text style={styles.inspectorTitle}>{station.title}</Text>
        </View>
        <View
          style={[
            styles.severityBadge,
            { borderColor: SEVERITY_COLOURS[station.severity] },
          ]}
        >
          <Text
            style={[
              styles.severityBadgeText,
              { color: SEVERITY_COLOURS[station.severity] },
            ]}
          >
            {station.severity.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.inspectorSummary}>{station.summary}</Text>

      <View style={styles.linePills}>
        {station.lineIds.map((lineId) => (
          <View
            key={lineId}
            style={[styles.linePill, { borderColor: LINE_COLOURS[lineId] }]}
          >
            <View
              style={[
                styles.linePillDot,
                { backgroundColor: LINE_COLOURS[lineId] },
              ]}
            />
            <Text style={styles.linePillText}>
              {lineId.replaceAll("-", " ")}
            </Text>
          </View>
        ))}
      </View>

      {station.timers.map((timer) => (
        <View key={timer.id} style={styles.timerPanel}>
          <View>
            <Text style={styles.timerLabel}>REST PROTECTION TIMER</Text>
            <Text style={styles.timerValue}>{getTimerHeadline(timer)}</Text>
          </View>
          <View style={styles.timerTimes}>
            <Text style={styles.timerTimeLabel}>
              Legal {formatClock(timer.legalCompleteAt)}
            </Text>
            <Text style={styles.timerTimeLabel}>
              Safe {formatClock(timer.recommendedResumeAt)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
  },
  loadingText: {
    marginTop: 14,
    color: "#cbd5e1",
    fontSize: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  content: {
    paddingBottom: 18,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.2,
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  subtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 9,
  },
  modeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e3a5f",
    backgroundColor: "#07111f",
    borderRadius: 12,
    padding: 3,
  },
  modeButton: {
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  modeButtonActive: {
    backgroundColor: "#0ea5e9",
  },
  modeButtonText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "900",
  },
  modeButtonTextActive: {
    color: "#f0f9ff",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#1e3a5f",
    backgroundColor: "#0b1728",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "#7dd3fc",
    fontWeight: "800",
    fontSize: 12,
  },
  closeButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 17,
    paddingVertical: 10,
  },
  closeButtonText: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 12,
  },
  errorPanel: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    backgroundColor: "#240a0a",
    marginBottom: 12,
  },
  activityGuardPanel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#92400e",
    backgroundColor: "#281407",
    marginBottom: 12,
  },
  activityGuardCopy: {
    flex: 1,
  },
  activityGuardEyebrow: {
    color: "#fbbf24",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  activityGuardTitle: {
    color: "#fffbeb",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 3,
  },
  activityGuardText: {
    color: "#fcd34d",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  activityGuardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activityGuardSecondaryButton: {
    borderWidth: 1,
    borderColor: "#a16207",
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  activityGuardSecondaryText: {
    color: "#fde68a",
    fontSize: 10,
    fontWeight: "800",
  },
  activityGuardConfirmButton: {
    borderRadius: 11,
    backgroundColor: "#f59e0b",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  activityGuardConfirmText: {
    color: "#1c1003",
    fontSize: 10,
    fontWeight: "900",
  },
  errorTitle: {
    color: "#fca5a5",
    fontWeight: "900",
    marginBottom: 4,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 12,
  },
  statusRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statusCard: {
    flex: 1,
    minHeight: 70,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#172338",
    borderTopWidth: 3,
    backgroundColor: "#08111f",
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  statusLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  statusValue: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 6,
  },
  mapPanel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#172338",
    backgroundColor: "#07111f",
    overflow: "hidden",
  },
  mapPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  mapHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  mapViewSwitch: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#1e3a5f",
    backgroundColor: "#050d18",
    borderRadius: 10,
    padding: 3,
  },
  mapViewButton: {
    borderRadius: 7,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  mapViewButtonActive: {
    backgroundColor: "#1d4ed8",
  },
  mapViewButtonText: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "900",
  },
  mapViewButtonTextActive: {
    color: "#eff6ff",
  },
  panelTitle: {
    color: "#f1f5f9",
    fontSize: 15,
    fontWeight: "900",
  },
  panelSubtitle: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#155e75",
    backgroundColor: "#083344",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#67e8f9",
  },
  liveBadgeText: {
    color: "#cffafe",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  hybridBody: {
    paddingHorizontal: 16,
    paddingTop: 17,
    paddingBottom: 18,
  },
  activityLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 10,
  },
  activityLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activityLegendSwatch: {
    width: 16,
    height: 7,
    borderRadius: 4,
  },
  activityLegendText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "700",
  },
  activityRibbon: {
    minHeight: 62,
    borderRadius: 13,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: "#111c2c",
  },
  activityRibbonSegment: {
    minWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  activityRibbonText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  activityTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  activityTimeText: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
  },
  activityNowMarker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activityNowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#67e8f9",
  },
  activityNowText: {
    color: "#67e8f9",
    fontSize: 10,
    fontWeight: "900",
  },
  emptyRibbon: {
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#0b1728",
  },
  emptyRibbonText: {
    color: "#64748b",
    fontSize: 11,
  },
  hybridGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 18,
    alignItems: "stretch",
  },
  complianceRails: {
    flex: 1,
    gap: 13,
    justifyContent: "center",
  },
  complianceRailRow: {
    gap: 6,
  },
  complianceRailHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  complianceRailLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "800",
  },
  complianceRailValue: {
    fontSize: 10,
    fontWeight: "900",
  },
  complianceRailTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#142033",
    overflow: "hidden",
  },
  complianceRailFill: {
    height: "100%",
    borderRadius: 4,
  },
  overnightCard: {
    width: 285,
    minHeight: 190,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#14532d",
    borderLeftWidth: 5,
    backgroundColor: "#06281a",
    padding: 15,
  },
  overnightEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  overnightTitle: {
    color: "#f0fdf4",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 5,
  },
  overnightCountdown: {
    color: "#dcfce7",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 8,
  },
  overnightDivider: {
    height: 1,
    backgroundColor: "#14532d",
    marginVertical: 12,
  },
  overnightTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
  },
  overnightTimeLabel: {
    color: "#86a995",
    fontSize: 10,
  },
  overnightTimeValue: {
    color: "#dcfce7",
    fontSize: 12,
    fontWeight: "900",
  },
  overnightEmptyText: {
    color: "#86a995",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 9,
  },
  inspector: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#172338",
    backgroundColor: "#08111f",
    padding: 15,
  },
  inspectorHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  inspectorHeadingCopy: {
    flex: 1,
    paddingRight: 12,
  },
  inspectorTime: {
    color: "#38bdf8",
    fontWeight: "900",
    fontSize: 11,
  },
  inspectorTitle: {
    color: "#f8fafc",
    fontWeight: "900",
    fontSize: 18,
    marginTop: 2,
  },
  inspectorSummary: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  severityBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  severityBadgeText: {
    fontWeight: "900",
    fontSize: 9,
    letterSpacing: 0.7,
  },
  linePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },
  linePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#0b1728",
  },
  linePillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  linePillText: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  timerPanel: {
    marginTop: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#14532d",
    backgroundColor: "#052e1a",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timerLabel: {
    color: "#86efac",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  timerValue: {
    color: "#dcfce7",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3,
  },
  timerTimes: {
    alignItems: "flex-end",
    gap: 4,
  },
  timerTimeLabel: {
    color: "#bbf7d0",
    fontSize: 10,
    fontWeight: "700",
  },
  restTargetNote: {
    color: "#475569",
    fontSize: 10,
    lineHeight: 15,
    marginVertical: 10,
    textAlign: "center",
  },
});
