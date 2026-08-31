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
import { buildLiveDayComplianceNetworkMap } from "../../engine/liveDayComplianceNetworkMap";

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
      };
    } catch (error) {
      return {
        value: null,
        error: getErrorMessage(error),
        dayEvents: [] as ActivityHistoryEvent[],
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

    return (
      map.stations
        .flatMap((station) => station.timers)
        .find(
          (timer) =>
            timer.state === "protected" || timer.state === "safety-buffer",
        ) ?? null
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
                    Today&apos;s overhead view
                  </Text>
                  <Text style={styles.panelSubtitle}>
                    Tap any station to inspect its evidence
                  </Text>
                </View>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>YOU ARE HERE</Text>
                </View>
              </View>

              <NetworkDiagram
                map={map}
                availableWidth={width}
                selectedStationId={selectedStation?.id ?? null}
                onSelectStation={setSelectedStationId}
              />
            </View>

            <StationInspector station={selectedStation} />

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
