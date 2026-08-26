import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import "../engine/tests/runActivityHistoryAdapterScenarios";

import "../engine/tests/runCalendarComplianceEventsScenarios";
import "../engine/tests/runDailyRestScenarios";
import "../engine/tests/runDrivingScenarios";

import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  changeDriverActivity,
  createInitialActivityState,
  type DriverActivityType,
} from "../data/activityState";

import {
  changeTimedActivity,
  createInitialActivityTimerState,
  formatActivityDuration,
  getActivityElapsedMilliseconds,
} from "../data/activityTimer";

import {
  changeActivityHistory,
  formatActivityHistoryDuration,
  getActivityHistoryLabel,
  startActivityHistory,
} from "../data/activityHistory";

import "../engine/tests/runCalendarComplianceEventsScenarios";
import "../engine/tests/runDailyRestScenarios";
import "../engine/tests/runDrivingScenarios";
import "../engine/tests/runReducedDailyRestHistoryScenarios";
import "../engine/tests/runRestCompensationScenarios";
import "../engine/tests/runRestResumptionScenarios";
import "../engine/tests/runSafetyMarginScenarios";
import "../engine/tests/runSplitDailyRestScenarios";
import "../engine/tests/runWeeklyRestCompensationAllocationScenarios";
import "../engine/tests/runWeeklyRestDeadlineScenarios";
import "../engine/tests/runWeeklyRestHistoryScenarios";
import "../engine/tests/runWeeklyRestMultiObligationAllocationScenarios";
import "../engine/tests/runWeeklyRestObligationCoordinatorScenarios";

interface DashboardAction {
  label: string;
  activity: DriverActivityType;
}

const actions: DashboardAction[] = [
  {
    label: "Driving",
    activity: "driving",
  },
  {
    label: "Break",
    activity: "break",
  },
  {
    label: "Other Work",
    activity: "other-work",
  },
  {
    label: "POA",
    activity: "poa",
  },
];

const diaryItems = [
  {
    label: "Weekly Diary",
    subtitle: "View this week's driving record",
  },
  {
    label: "Monthly Compliance",
    subtitle: "Heat-map view by day and week",
  },
  {
    label: "Yearly Compliance",
    subtitle: "52-week compliance heat map",
  },
];

function formatClockTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function HomeScreen() {
  const initialStartedAt = new Date().toISOString();

  const [activityState, setActivityState] = useState(() =>
    createInitialActivityState(initialStartedAt),
  );

  const [timerState, setTimerState] = useState(() =>
    createInitialActivityTimerState(
      "other-work",
      new Date(initialStartedAt).getTime(),
    ),
  );

  const [activityHistory, setActivityHistory] = useState(() =>
    startActivityHistory("other-work", initialStartedAt, "manual"),
  );

  /**
   * Forces the dashboard to refresh once per second.
   *
   * The actual activity timing is calculated from
   * timestamps rather than incrementing stored
   * counters every second.
   */
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  function handleActivityPress(activity: DriverActivityType) {
    const changedAt = Date.now();
    const changedAtIso = new Date(changedAt).toISOString();

    setActivityState((currentState) =>
      changeDriverActivity(currentState, activity, changedAtIso),
    );

    setTimerState((currentState) =>
      changeTimedActivity(currentState, activity, changedAt),
    );

    setActivityHistory((currentHistory) =>
      changeActivityHistory(currentHistory, activity, changedAtIso, "manual"),
    );

    setNow(changedAt);
  }

  function getDisplayedActivityTime(activity: DriverActivityType): string {
    const milliseconds = getActivityElapsedMilliseconds(
      timerState,
      activity,
      now,
    );

    return formatActivityDuration(milliseconds);
  }

  function getHistoryDuration(
    startedAt: string,
    endedAt: string | null,
    storedDuration: number | null,
  ): string {
    if (storedDuration !== null) {
      return formatActivityHistoryDuration(storedDuration);
    }

    if (endedAt !== null) {
      return formatActivityHistoryDuration(
        new Date(endedAt).getTime() - new Date(startedAt).getTime(),
      );
    }

    return formatActivityHistoryDuration(
      Math.max(0, now - new Date(startedAt).getTime()),
    );
  }

  const currentActivityLabel =
    activityState.currentActivity === "driving"
      ? "Driving"
      : activityState.currentActivity === "break"
        ? "Break"
        : activityState.currentActivity === "other-work"
          ? "Other Work"
          : "POA";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>TachoTrack</Text>

            <Text style={styles.subtitle}>Driver Dashboard</Text>
          </View>

          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>COMPLIANT</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Continuous Driving</Text>

          <View style={styles.timerCircle}>
            <Text style={styles.timerValue}>
              {getDisplayedActivityTime("driving")}
            </Text>

            <Text style={styles.timerRemaining}>Live driving activity</Text>
          </View>

          <Text style={styles.heroHint}>4h 30m continuous driving limit</Text>
        </View>

        <View style={styles.currentActivityPanel}>
          <Text style={styles.currentActivityLabel}>Current Activity</Text>

          <Text style={styles.currentActivityValue}>
            {currentActivityLabel}
          </Text>
        </View>

        <View style={styles.actionGrid}>
          {actions.map((action) => {
            const isActive = activityState.currentActivity === action.activity;

            return (
              <Pressable
                key={action.label}
                onPress={() => handleActivityPress(action.activity)}
                style={[styles.actionCard, isActive && styles.actionCardActive]}
              >
                <Text
                  style={[
                    styles.actionLabel,
                    isActive && styles.actionLabelActive,
                  ]}
                >
                  {action.label}
                </Text>

                <Text
                  style={[
                    styles.actionValue,
                    isActive && styles.actionValueActive,
                  ]}
                >
                  {getDisplayedActivityTime(action.activity)}
                </Text>

                {isActive && <Text style={styles.activeIndicator}>ACTIVE</Text>}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.traceSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Activity Trace</Text>

            <Text style={styles.sectionText}>
              Chronological driver activity record
            </Text>
          </View>

          <View style={styles.traceCard}>
            <View style={styles.traceHeader}>
              <Text style={[styles.traceHeaderText, styles.traceTimeColumn]}>
                Start
              </Text>

              <Text
                style={[styles.traceHeaderText, styles.traceActivityColumn]}
              >
                Activity
              </Text>

              <Text
                style={[styles.traceHeaderText, styles.traceDurationColumn]}
              >
                Duration
              </Text>

              <Text style={[styles.traceHeaderText, styles.traceSourceColumn]}>
                Source
              </Text>
            </View>

            {activityHistory.events
              .slice()
              .reverse()
              .map((event) => {
                const isActive = event.id === activityHistory.activeEventId;

                return (
                  <View
                    key={event.id}
                    style={[styles.traceRow, isActive && styles.traceRowActive]}
                  >
                    <Text style={[styles.traceText, styles.traceTimeColumn]}>
                      {formatClockTime(event.startedAt)}
                    </Text>

                    <Text
                      style={[
                        styles.traceActivityText,
                        styles.traceActivityColumn,
                      ]}
                    >
                      {getActivityHistoryLabel(event.activity)}
                    </Text>

                    <Text
                      style={[styles.traceText, styles.traceDurationColumn]}
                    >
                      {getHistoryDuration(
                        event.startedAt,
                        event.endedAt,
                        event.durationMilliseconds,
                      )}
                    </Text>

                    <Text
                      style={[styles.traceSourceText, styles.traceSourceColumn]}
                    >
                      {event.source}
                    </Text>
                  </View>
                );
              })}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Diary & Compliance</Text>

          <Text style={styles.sectionText}>
            Review your recorded activity and WTD status.
          </Text>
        </View>

        <View style={styles.diaryGrid}>
          {diaryItems.map((item) => (
            <Pressable
              key={item.label}
              style={styles.diaryCard}
              onPress={() => {
                if (item.label === "Weekly Diary") {
                  router.push("/diary/week");
                }

                if (item.label === "Monthly Compliance") {
                  router.push("/diary/month");
                }
              }}
            >
              <Text style={styles.diaryTitle}>{item.label}</Text>

              <Text style={styles.diarySubtitle}>{item.subtitle}</Text>

              <Text style={styles.openText}>Open →</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryLabel}>Weekly Driving</Text>

            <Text style={styles.summaryValue}>43h 12m</Text>
          </View>

          <View>
            <Text style={styles.summaryLabel}>Working Time</Text>

            <Text style={styles.summaryValue}>51h 05m</Text>
          </View>

          <View>
            <Text style={styles.summaryLabel}>Compliance</Text>

            <Text style={styles.summaryGood}>95%</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#06111f",
  },

  page: {
    flexGrow: 1,
    padding: 28,
    gap: 24,
    backgroundColor: "#06111f",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  brand: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
  },

  subtitle: {
    color: "#8293a8",
    fontSize: 16,
    marginTop: 4,
  },

  statusBadge: {
    backgroundColor: "#123924",
    borderColor: "#36d274",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },

  statusText: {
    color: "#55e68e",
    fontSize: 12,
    fontWeight: "800",
  },

  hero: {
    alignItems: "center",
    backgroundColor: "#0b1929",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "#183049",
  },

  heroLabel: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },

  timerCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 16,
    borderColor: "#258cff",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
    backgroundColor: "#081523",
  },

  timerValue: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: "900",
  },

  timerRemaining: {
    color: "#72b7ff",
    fontSize: 14,
    marginTop: 4,
  },

  heroHint: {
    color: "#8293a8",
    fontSize: 13,
  },

  currentActivityPanel: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 18,
    padding: 16,
  },

  currentActivityLabel: {
    color: "#8293a8",
    fontSize: 12,
    fontWeight: "700",
  },

  currentActivityValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  actionCard: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: 150,
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 20,
    padding: 18,
  },

  actionCardActive: {
    backgroundColor: "#0d3159",
    borderColor: "#258cff",
  },

  actionLabel: {
    color: "#95a8bc",
    fontSize: 14,
    fontWeight: "700",
  },

  actionLabelActive: {
    color: "#ffffff",
  },

  actionValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 10,
  },

  actionValueActive: {
    color: "#67b8ff",
  },

  activeIndicator: {
    color: "#55e68e",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 8,
    letterSpacing: 1,
  },

  traceSection: {
    gap: 12,
  },

  sectionHeader: {
    gap: 4,
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },

  sectionText: {
    color: "#8293a8",
    fontSize: 14,
  },

  traceCard: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 20,
    overflow: "hidden",
  },

  traceHeader: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#081523",
    borderBottomWidth: 1,
    borderBottomColor: "#183049",
  },

  traceHeaderText: {
    color: "#8293a8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  traceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#13263a",
  },

  traceRowActive: {
    backgroundColor: "#0d3159",
  },

  traceText: {
    color: "#dce8f5",
    fontSize: 13,
    fontWeight: "700",
  },

  traceActivityText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  traceSourceText: {
    color: "#55e68e",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  traceTimeColumn: {
    flex: 1.2,
  },

  traceActivityColumn: {
    flex: 1.4,
  },

  traceDurationColumn: {
    flex: 1.2,
  },

  traceSourceColumn: {
    flex: 1,
  },

  diaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  diaryCard: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 220,
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 20,
    padding: 20,
  },

  diaryTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },

  diarySubtitle: {
    color: "#8293a8",
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },

  openText: {
    color: "#4ba6ff",
    marginTop: 18,
    fontWeight: "800",
  },

  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    backgroundColor: "#0b1929",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#183049",
    padding: 20,
  },

  summaryLabel: {
    color: "#8293a8",
    fontSize: 13,
    fontWeight: "700",
  },

  summaryValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5,
  },

  summaryGood: {
    color: "#55e68e",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5,
  },
});
