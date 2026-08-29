import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import {
  createCurrentFortnightlyDriverHistory,
  rollFortnightlyDriverHistoryForward,
} from "../../data/fortnightlyDriverHistory";

import { loadFortnightlyDriverHistory } from "../../data/weeklyDriverHistoryStorage";

import { calculateFortnightlyDrivingState } from "../../engine/fortnightlyDrivingState";

import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { sampleWeek } from "../../data/sampleWeek";
import { sampleComplianceResult } from "../../data/testCompliance";

import { sampleWeeklyRestCompensationEvents } from "../../data/sampleWeeklyRestCompensation";

import {
  getCalendarEventBadge,
  getCalendarEventsForDate,
  toCalendarComplianceEvents,
  type CalendarComplianceEvent,
} from "../../engine/calendarComplianceEvents";

import { buildRestCompensationAuditHistory } from "../../engine/restCompensationAuditHistory";

import { buildRestCompensationCurrentState } from "../../engine/restCompensationCurrentState";

/**
 * --------------------------------------------------
 * FORMAT MINUTES
 * --------------------------------------------------
 */
function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
}

/**
 * --------------------------------------------------
 * FRIENDLY DATE
 * --------------------------------------------------
 */
function formatDisplayDate(dateString?: string) {
  if (!dateString) {
    return "";
  }

  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * --------------------------------------------------
 * ENGINE-GENERATED COMPENSATION EVENTS
 * --------------------------------------------------
 *
 * These events are produced by the real
 * weekly-rest compensation allocation engine
 * in sampleWeeklyRestCompensation.ts.
 */
const weeklyCalendarEvents = toCalendarComplianceEvents(
  sampleWeeklyRestCompensationEvents,
);

/**
 * --------------------------------------------------
 * BUILD WEEK DISPLAY DATA
 * --------------------------------------------------
 */
const week = sampleWeek.days.map((day, index) => {
  const compliance = sampleComplianceResult.days[index];

  const date = new Date(day.date);

  const dateLabel = `${date.getDate()} ${date.toLocaleString("en-GB", {
    month: "short",
  })}`;

  let status = "Compliant";

  let statusType = "good";

  if (compliance.level === "warning") {
    status = "Warning";

    statusType = "warning";
  }

  if (compliance.level === "breach") {
    status = "Breach";

    statusType = "breach";
  }

  if (day.dailyRestType === "weekly") {
    status = "Rest Day";

    statusType = "rest";
  }

  return {
    day: dayNames[index],

    date: dateLabel,

    isoDate: day.date,

    status,

    statusType,

    driving: formatMinutes(day.drivingMinutes),

    otherWork: formatMinutes(day.otherWorkMinutes),

    breakRest: formatMinutes(day.breakMinutes + day.restMinutes),

    poa: formatMinutes(day.poaMinutes),

    restType:
      day.dailyRestType === "regular"
        ? "Regular"
        : day.dailyRestType === "reduced"
          ? "Reduced"
          : day.dailyRestType === "weekly"
            ? "Weekly Rest"
            : "Unknown",
  };
});

/**
 * --------------------------------------------------
 * WEEK STATUS
 * --------------------------------------------------
 */
function getWeekStatusText() {
  if (sampleComplianceResult.level === "good") {
    return "Compliant";
  }

  if (sampleComplianceResult.level === "warning") {
    return "Warning";
  }

  return "Breach";
}

/**
 * --------------------------------------------------
 * CALENDAR EVENT STATUS
 * --------------------------------------------------
 */
function getEventStatusText(event: CalendarComplianceEvent) {
  if (event.severity === "good") {
    return "Completed";
  }

  if (event.severity === "breach") {
    return "Missed";
  }

  if (event.severity === "warning") {
    return "Outstanding";
  }

  return "Applied";
}

/**
 * --------------------------------------------------
 * CURRENT STATE LABEL
 * --------------------------------------------------
 */
function getCurrentStateLabel(
  status:
    | "outstanding"
    | "partially-applied"
    | "cleared"
    | "overdue"
    | undefined,
) {
  switch (status) {
    case "cleared":
      return "Cleared";

    case "overdue":
      return "Missed";

    case "partially-applied":
      return "Partially Applied";

    default:
      return "Outstanding";
  }
}

export default function WeeklyDiaryScreen() {
  const [fortnightlyHistory, setFortnightlyHistory] = useState(() =>
    createCurrentFortnightlyDriverHistory(Date.now()),
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrateFortnightlyHistory() {
      const stored = await loadFortnightlyDriverHistory();

      if (cancelled) {
        return;
      }

      if (stored !== null) {
        setFortnightlyHistory(
          rollFortnightlyDriverHistoryForward(stored, Date.now()),
        );
      }
    }

    void hydrateFortnightlyHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const fortnightlyDrivingState = useMemo(
    () =>
      calculateFortnightlyDrivingState(
        fortnightlyHistory.previousWeek.days,
        fortnightlyHistory.currentWeek.days,
      ),
    [fortnightlyHistory.previousWeek.days, fortnightlyHistory.currentWeek.days],
  );
  const [selectedCompensationEvent, setSelectedCompensationEvent] =
    useState<CalendarComplianceEvent | null>(null);

  /**
   * ------------------------------------------------
   * DYNAMIC AUDIT HISTORY
   * ------------------------------------------------
   */
  const selectedAuditHistory = selectedCompensationEvent
    ? buildRestCompensationAuditHistory(
        sampleWeeklyRestCompensationEvents,
        selectedCompensationEvent.sourceObligationId,
      )
    : [];

  /**
   * ------------------------------------------------
   * CURRENT OBLIGATION STATE
   * ------------------------------------------------
   *
   * This is the latest truth across all
   * events belonging to the obligation.
   */
  const selectedCurrentState = selectedCompensationEvent
    ? buildRestCompensationCurrentState(
        sampleWeeklyRestCompensationEvents,
        selectedCompensationEvent.sourceObligationId,
      )
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        {/* HEADER */}

        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>TachoTrack</Text>

            <Text style={styles.title}>Weekly Diary</Text>
          </View>

          <View style={styles.headerRight}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backText}>← Dashboard</Text>
            </Pressable>

            <View style={styles.weekBadge}>
              <Text style={styles.weekBadgeText}>
                WEEK {sampleComplianceResult.weekNumber}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.diaryTabs}>
          <View style={[styles.diaryTab, styles.diaryTabActive]}>
            <Text style={styles.diaryTabTextActive}>Week</Text>
          </View>

          <Pressable
            style={styles.diaryTab}
            onPress={() => router.push("/diary/fortnight")}
          >
            <Text style={styles.diaryTabText}>Fortnight</Text>
          </Pressable>

          <Pressable
            style={styles.diaryTab}
            onPress={() => router.push("/diary/month")}
          >
            <Text style={styles.diaryTabText}>Month</Text>
          </Pressable>
        </View>

        {/* WEEK NAVIGATION */}

        <View style={styles.fortnightStatus}>
          <View style={styles.fortnightStatusHeader}>
            <View>
              <Text style={styles.fortnightStatusLabel}>FORTNIGHT DRIVING</Text>

              <Text style={styles.fortnightDateRange}>
                {formatDisplayDate(
                  fortnightlyHistory.previousWeek.weekStartDate,
                )}
                {" – "}
                {formatDisplayDate(fortnightlyHistory.currentWeek.weekEndDate)}
              </Text>

              <Text style={styles.fortnightStatusValue}>
                {formatMinutes(fortnightlyDrivingState.drivingMinutesUsed)}
                {" / "}
                {formatMinutes(fortnightlyDrivingState.limitMinutes)}
              </Text>
            </View>

            <View style={styles.fortnightRemaining}>
              <Text style={styles.fortnightRemainingLabel}>REMAINING</Text>

              <Text style={styles.fortnightRemainingValue}>
                {formatMinutes(fortnightlyDrivingState.remainingMinutes)}
              </Text>
            </View>
          </View>

          <View style={styles.fortnightProgressTrack}>
            <View
              style={[
                styles.fortnightProgressFill,
                {
                  width: `${Math.min(
                    100,
                    fortnightlyDrivingState.percentageUsed,
                  )}%`,
                },
              ]}
            />
          </View>

          <Text style={styles.fortnightPercentage}>
            {fortnightlyDrivingState.percentageUsed.toFixed(1)}% of 90h used
          </Text>
        </View>

        <View style={styles.weekNavigation}>
          <Pressable style={styles.navButton}>
            <Text style={styles.navButtonText}>‹ Previous Week</Text>
          </Pressable>

          <Text style={styles.thisWeek}>
            {sampleWeek.startDate}
            {" — "}
            {sampleWeek.endDate}
          </Text>

          <Pressable style={styles.navButton}>
            <Text style={styles.navButtonText}>Next Week ›</Text>
          </Pressable>
        </View>

        {/* DAILY CARDS */}

        <View style={styles.daysGrid}>
          {week.map((item) => {
            const dayEvents = getCalendarEventsForDate(
              weeklyCalendarEvents,
              item.isoDate,
            );

            return (
              <View key={item.day} style={styles.dayColumn}>
                {/* DAY HEADER */}

                <View style={styles.dayHeader}>
                  <View style={styles.dayHeaderTop}>
                    <View>
                      <Text style={styles.dayName}>{item.day}</Text>

                      <Text style={styles.date}>{item.date}</Text>
                    </View>

                    {dayEvents.length > 0 && (
                      <View style={styles.eventBadgeRow}>
                        {dayEvents.map((event) => (
                          <Pressable
                            key={event.id}
                            onPress={() => setSelectedCompensationEvent(event)}
                            style={[
                              styles.eventBadge,

                              event.severity === "good" &&
                                styles.eventBadgeGood,

                              event.severity === "warning" &&
                                styles.eventBadgeWarning,

                              event.severity === "breach" &&
                                styles.eventBadgeBreach,

                              event.severity === "info" &&
                                styles.eventBadgeInfo,
                            ]}
                          >
                            <Text style={styles.eventBadgeText}>
                              {getCalendarEventBadge(event)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* DAY STATUS */}

                <View
                  style={[
                    styles.statusBadge,

                    item.statusType === "good" && styles.statusGood,

                    item.statusType === "warning" && styles.statusWarning,

                    item.statusType === "breach" && styles.statusBreach,

                    item.statusType === "rest" && styles.statusRest,
                  ]}
                >
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>

                {/* DRIVING */}

                <View style={styles.metricBlock}>
                  <Text style={styles.metricLabel}>Driving</Text>

                  <Text style={styles.drivingValue}>{item.driving}</Text>
                </View>

                <View style={styles.separator} />

                {/* OTHER WORK */}

                <View style={styles.metricRow}>
                  <Text style={styles.smallLabel}>Other Work</Text>

                  <Text style={styles.smallValue}>{item.otherWork}</Text>
                </View>

                {/* BREAK / REST */}

                <View style={styles.metricRow}>
                  <Text style={styles.smallLabel}>Break / Rest</Text>

                  <Text style={styles.smallValue}>{item.breakRest}</Text>
                </View>

                {/* POA */}

                <View style={styles.metricRow}>
                  <Text style={styles.smallLabel}>POA</Text>

                  <Text style={styles.smallValue}>{item.poa}</Text>
                </View>

                {/* ACTIVITY TRACK */}

                <View style={styles.activityTrack}>
                  <View
                    style={[styles.activitySegment, styles.drivingSegment]}
                  />

                  <View style={[styles.activitySegment, styles.workSegment]} />

                  <View style={[styles.activitySegment, styles.breakSegment]} />
                </View>

                {/* REST TYPE */}

                <View style={styles.restBox}>
                  <Text style={styles.restLabel}>Daily Rest</Text>

                  <Text style={styles.restValue}>{item.restType}</Text>
                </View>

                {/* COMPACT COMPENSATION CARD */}

                {dayEvents.length > 0 && (
                  <View style={styles.compensationSection}>
                    {dayEvents.map((event) => (
                      <Pressable
                        key={event.id}
                        onPress={() => setSelectedCompensationEvent(event)}
                        style={[
                          styles.compensationCard,

                          event.severity === "warning" &&
                            styles.compensationWarning,

                          event.severity === "good" && styles.compensationGood,

                          event.severity === "breach" &&
                            styles.compensationBreach,

                          event.severity === "info" && styles.compensationInfo,
                        ]}
                      >
                        <View style={styles.compensationTitleRow}>
                          <Text style={styles.compensationBadge}>
                            {getCalendarEventBadge(event)}
                          </Text>

                          <Text style={styles.compensationTitle}>
                            {event.title}
                          </Text>
                        </View>

                        <Text style={styles.compensationAmount}>
                          {formatMinutes(event.minutes)}
                        </Text>

                        <Text style={styles.compensationSmall}>
                          From Week {event.sourceWeekNumber}
                        </Text>

                        {event.deadline && (
                          <Text style={styles.compensationDeadline}>
                            Due {formatDisplayDate(event.deadline)}
                          </Text>
                        )}

                        <View style={styles.compensationDivider} />

                        <View style={styles.compensationRow}>
                          <Text style={styles.compensationLabel}>
                            Remaining
                          </Text>

                          <Text
                            style={[
                              styles.compensationValue,

                              event.remainingMinutes === 0 &&
                                styles.compensationValueGood,

                              event.severity === "breach" &&
                                styles.compensationValueBreach,
                            ]}
                          >
                            {formatMinutes(event.remainingMinutes)}
                          </Text>
                        </View>

                        <View style={styles.compensationRow}>
                          <Text style={styles.compensationLabel}>Status</Text>

                          <Text
                            style={[
                              styles.compensationValue,

                              event.severity === "warning" &&
                                styles.compensationValueWarning,

                              event.severity === "good" &&
                                styles.compensationValueGood,

                              event.severity === "breach" &&
                                styles.compensationValueBreach,
                            ]}
                          >
                            {getEventStatusText(event)}
                          </Text>
                        </View>

                        <Text style={styles.tapForDetails}>
                          Tap for details →
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* CURRENT COMPENSATION DETAIL */}

        {selectedCompensationEvent && selectedCurrentState && (
          <View
            style={[
              styles.detailPanel,

              (selectedCurrentState.status === "outstanding" ||
                selectedCurrentState.status === "partially-applied") &&
                styles.detailPanelWarning,

              selectedCurrentState.status === "cleared" &&
                styles.detailPanelGood,

              selectedCurrentState.status === "overdue" &&
                styles.detailPanelBreach,
            ]}
          >
            {/* HEADER */}

            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailEyebrow}>WEEKLY REST</Text>

                <Text style={styles.detailTitle}>Rest Compensation</Text>

                <Text
                  style={[
                    styles.detailStatus,

                    (selectedCurrentState.status === "outstanding" ||
                      selectedCurrentState.status === "partially-applied") &&
                      styles.detailStatusWarning,

                    selectedCurrentState.status === "cleared" &&
                      styles.detailStatusGood,

                    selectedCurrentState.status === "overdue" &&
                      styles.detailStatusBreach,
                  ]}
                >
                  {getCurrentStateLabel(selectedCurrentState.status)}
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={() => setSelectedCompensationEvent(null)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>

            {/* METRICS */}

            <View style={styles.detailMetrics}>
              <View style={styles.detailMetric}>
                <Text style={styles.detailMetricLabel}>Compensation Owed</Text>

                <Text style={styles.detailMetricValue}>
                  {formatMinutes(selectedCurrentState.originalRequiredMinutes)}
                </Text>
              </View>

              <View style={styles.detailMetric}>
                <Text style={styles.detailMetricLabel}>Made Up</Text>

                <Text style={styles.detailMetricValue}>
                  {formatMinutes(selectedCurrentState.totalAppliedMinutes)}
                </Text>
              </View>

              <View style={styles.detailMetric}>
                <Text style={styles.detailMetricLabel}>Still Required</Text>

                <Text
                  style={[
                    styles.detailMetricValue,

                    selectedCurrentState.remainingMinutes > 0 &&
                      styles.detailMetricWarning,

                    selectedCurrentState.remainingMinutes === 0 &&
                      styles.detailMetricGood,
                  ]}
                >
                  {formatMinutes(selectedCurrentState.remainingMinutes)}
                </Text>
              </View>

              <View style={styles.detailMetric}>
                <Text style={styles.detailMetricLabel}>Deadline</Text>

                <Text style={styles.detailMetricValue}>
                  {selectedCurrentState.deadline
                    ? formatDisplayDate(selectedCurrentState.deadline)
                    : "—"}
                </Text>
              </View>
            </View>

            {/* SOURCE */}

            <View style={styles.detailInformation}>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoLabel}>Created from</Text>

                <Text style={styles.detailInfoValue}>
                  Week {selectedCurrentState.sourceWeekNumber}
                </Text>
              </View>

              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoLabel}>Obligation ID</Text>

                <Text style={styles.detailInfoValueSmall}>
                  {selectedCurrentState.obligationId}
                </Text>
              </View>

              {selectedCurrentState.clearedDate && (
                <View style={styles.detailInfoRow}>
                  <Text style={styles.detailInfoLabel}>Cleared</Text>

                  <Text style={[styles.detailInfoValue, styles.detailInfoGood]}>
                    {formatDisplayDate(selectedCurrentState.clearedDate)}
                  </Text>
                </View>
              )}
            </View>

            {/* EXPLANATION */}

            <View
              style={[
                styles.explanationBox,

                selectedCurrentState.status === "cleared" &&
                  styles.explanationBoxGood,

                selectedCurrentState.status === "overdue" &&
                  styles.explanationBoxBreach,
              ]}
            >
              <Text style={styles.explanationHeading}>
                Why am I seeing this?
              </Text>

              <Text style={styles.explanationText}>
                A reduced weekly rest created a compensation obligation.
                TachoTrack is retaining the complete history so you can see
                exactly what happened.
              </Text>

              <Text
                style={[
                  styles.explanationImportant,

                  selectedCurrentState.status === "cleared" &&
                    styles.explanationImportantGood,

                  selectedCurrentState.status === "overdue" &&
                    styles.explanationImportantBreach,
                ]}
              >
                {selectedCurrentState.status === "cleared"
                  ? `This weekly-rest compensation was fully completed${
                      selectedCurrentState.clearedDate
                        ? ` on ${formatDisplayDate(
                            selectedCurrentState.clearedDate,
                          )}`
                        : ""
                    }.`
                  : selectedCurrentState.status === "overdue"
                    ? "This compensation obligation passed its deadline with rest still outstanding."
                    : selectedCurrentState.status === "partially-applied"
                      ? "Some compensation has been completed, but further rest is still required before the deadline."
                      : "This weekly-rest compensation is still outstanding and must be completed by the deadline shown."}
              </Text>
            </View>

            {/* AUDIT HISTORY */}

            <View style={styles.auditSection}>
              <Text style={styles.auditHeading}>Audit History</Text>

              {selectedAuditHistory.length === 0 ? (
                <Text style={styles.auditDescription}>
                  No audit events recorded.
                </Text>
              ) : (
                selectedAuditHistory.map((item) => (
                  <View key={item.id} style={styles.auditItem}>
                    <View
                      style={[
                        styles.auditDot,

                        item.type === "compensation-cleared" &&
                          styles.auditDotGood,

                        item.type === "compensation-overdue" &&
                          styles.auditDotBreach,

                        item.type === "compensation-applied" &&
                          styles.auditDotInfo,
                      ]}
                    />

                    <View style={styles.auditTextBox}>
                      <Text style={styles.auditDate}>
                        {formatDisplayDate(item.date)}
                      </Text>

                      <Text style={styles.auditTitle}>{item.title}</Text>

                      <Text style={styles.auditDescription}>
                        {item.description}
                      </Text>

                      <Text style={styles.auditBalance}>
                        Remaining: {formatMinutes(item.remainingMinutes)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* JESS PLACEHOLDER */}

            <View style={styles.jessRow}>
              <View>
                <Text style={styles.jessHeading}>
                  Need help understanding this?
                </Text>

                <Text style={styles.jessSubtext}>
                  Jess will explain your rest position in plain English.
                </Text>
              </View>

              <Pressable style={styles.jessButton}>
                <Text style={styles.jessButtonText}>Ask Jess →</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* WEEKLY SUMMARY */}

        <View style={styles.weeklySummary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Driving</Text>

            <Text style={styles.summaryValue}>
              {formatMinutes(sampleComplianceResult.totalDrivingMinutes)}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Work</Text>

            <Text style={styles.summaryValue}>
              {formatMinutes(sampleComplianceResult.totalWorkingMinutes)}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Reduced Rests</Text>

            <Text style={styles.summaryValue}>
              {sampleComplianceResult.reducedDailyRests}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Extended Driving Days</Text>

            <Text style={styles.summaryValue}>
              {sampleComplianceResult.extendedDrivingDays}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>WTD Status</Text>

            <Text
              style={
                sampleComplianceResult.level === "good"
                  ? styles.summaryGood
                  : sampleComplianceResult.level === "warning"
                    ? styles.summaryWarning
                    : styles.summaryBreach
              }
            >
              {getWeekStatusText()}
            </Text>
          </View>
        </View>

        {/* COMPLIANCE ISSUES */}

        {sampleComplianceResult.issues.length > 0 && (
          <View style={styles.issuePanel}>
            <Text style={styles.issuePanelTitle}>Compliance Issues</Text>

            {sampleComplianceResult.issues.map((issue) => (
              <View key={issue.id} style={styles.issueRow}>
                <View
                  style={[
                    styles.issueDot,

                    issue.level === "warning" && styles.issueDotWarning,

                    issue.level === "breach" && styles.issueDotBreach,
                  ]}
                />

                <View style={styles.issueTextBox}>
                  <Text style={styles.issueTitle}>{issue.title}</Text>

                  <Text style={styles.issueDescription}>
                    {issue.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
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
    padding: 24,
    gap: 18,
    backgroundColor: "#06111f",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  brand: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
  },

  title: {
    color: "#8293a8",
    fontSize: 16,
    marginTop: 2,
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  diaryTabs: {
    flexDirection: "row",
    gap: 8,
  },

  diaryTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#183049",
    backgroundColor: "#081523",
  },

  fortnightDateRange: {
    color: "#8ec7ff",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },

  fortnightStatus: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 16,
    padding: 16,
  },

  fortnightStatusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },

  fortnightStatusLabel: {
    color: "#8293a8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  fortnightStatusValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },

  fortnightRemaining: {
    alignItems: "flex-end",
  },

  fortnightRemainingLabel: {
    color: "#8293a8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  fortnightRemainingValue: {
    color: "#55e68e",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },

  fortnightProgressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 5,
    backgroundColor: "#17324d",
    overflow: "hidden",
    marginTop: 14,
  },

  fortnightProgressFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: "#258cff",
  },

  fortnightPercentage: {
    color: "#8293a8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
  },

  diaryTabActive: {
    borderColor: "#258cff",
    backgroundColor: "#0d3159",
  },

  diaryTabText: {
    color: "#8293a8",
    fontSize: 12,
    fontWeight: "800",
  },

  diaryTabTextActive: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },

  backButton: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },

  backText: {
    color: "#5cb1ff",
    fontWeight: "800",
  },

  weekBadge: {
    backgroundColor: "#10375f",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },

  weekBadgeText: {
    color: "#ffffff",
    fontWeight: "800",
  },

  weekNavigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  navButton: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },

  navButtonText: {
    color: "#8ec7ff",
    fontWeight: "700",
  },

  thisWeek: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },

  daysGrid: {
    flexDirection: "row",
    gap: 10,
  },

  dayColumn: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 16,
    padding: 12,
  },

  dayHeader: {
    marginBottom: 10,
  },

  dayHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 6,
  },

  dayName: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },

  date: {
    color: "#8293a8",
    fontSize: 13,
    marginTop: 2,
  },

  eventBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "flex-end",
  },

  eventBadge: {
    minWidth: 25,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  eventBadgeGood: {
    backgroundColor: "#123c28",
    borderColor: "#70f0a5",
  },

  eventBadgeWarning: {
    backgroundColor: "#664315",
    borderColor: "#ffd26a",
  },

  eventBadgeBreach: {
    backgroundColor: "#681f25",
    borderColor: "#ff9494",
  },

  eventBadgeInfo: {
    backgroundColor: "#10375f",
    borderColor: "#76bdff",
  },

  eventBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },

  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 14,
  },

  statusGood: {
    backgroundColor: "#173f29",
  },

  statusWarning: {
    backgroundColor: "#5a4016",
  },

  statusBreach: {
    backgroundColor: "#5a1c1c",
  },

  statusRest: {
    backgroundColor: "#183049",
  },

  statusText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },

  metricBlock: {
    marginBottom: 8,
  },

  metricLabel: {
    color: "#8da2b8",
    fontSize: 12,
    fontWeight: "700",
  },

  drivingValue: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 3,
  },

  separator: {
    height: 1,
    backgroundColor: "#183049",
    marginVertical: 8,
  },

  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 7,
  },

  smallLabel: {
    color: "#8293a8",
    fontSize: 11,
  },

  smallValue: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },

  activityTrack: {
    height: 8,
    flexDirection: "row",
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 10,
    marginBottom: 12,
    backgroundColor: "#12273a",
  },

  activitySegment: {
    height: "100%",
  },

  drivingSegment: {
    flex: 5,
    backgroundColor: "#258cff",
  },

  workSegment: {
    flex: 2,
    backgroundColor: "#2ac1d4",
  },

  breakSegment: {
    flex: 4,
    backgroundColor: "#4bc06b",
  },

  restBox: {
    marginTop: "auto",
    borderTopWidth: 1,
    borderTopColor: "#183049",
    paddingTop: 10,
  },

  restLabel: {
    color: "#8293a8",
    fontSize: 11,
  },

  restValue: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },

  compensationSection: {
    marginTop: 12,
  },

  compensationCard: {
    borderRadius: 11,
    padding: 10,
    borderWidth: 1,
    gap: 5,
  },

  compensationWarning: {
    backgroundColor: "#33250f",
    borderColor: "#8f621c",
  },

  compensationGood: {
    backgroundColor: "#102d20",
    borderColor: "#296e49",
  },

  compensationBreach: {
    backgroundColor: "#351518",
    borderColor: "#7f3037",
  },

  compensationInfo: {
    backgroundColor: "#102338",
    borderColor: "#28557d",
  },

  compensationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  compensationBadge: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },

  compensationTitle: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    flexShrink: 1,
  },

  compensationAmount: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },

  compensationSmall: {
    color: "#9eb1c2",
    fontSize: 9,
    fontWeight: "700",
  },

  compensationDeadline: {
    color: "#f2b84b",
    fontSize: 9,
    fontWeight: "800",
    marginTop: 2,
  },

  compensationDivider: {
    height: 1,
    backgroundColor: "#294057",
    marginVertical: 4,
  },

  compensationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },

  compensationLabel: {
    color: "#8293a8",
    fontSize: 9,
  },

  compensationValue: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },

  compensationValueGood: {
    color: "#54df8c",
  },

  compensationValueWarning: {
    color: "#f2b84b",
  },

  compensationValueBreach: {
    color: "#ff6868",
  },

  tapForDetails: {
    color: "#d6ad55",
    fontSize: 8,
    fontWeight: "800",
    marginTop: 3,
  },

  detailPanel: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#284057",
    borderRadius: 18,
    padding: 20,
    gap: 18,
  },

  detailPanelWarning: {
    borderColor: "#76551e",
  },

  detailPanelGood: {
    borderColor: "#296e49",
  },

  detailPanelBreach: {
    borderColor: "#7f3037",
  },

  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  detailEyebrow: {
    color: "#8293a8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },

  detailTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 3,
  },

  detailStatus: {
    fontSize: 14,
    fontWeight: "900",
    marginTop: 5,
  },

  detailStatusWarning: {
    color: "#f2b84b",
  },

  detailStatusGood: {
    color: "#54df8c",
  },

  detailStatusBreach: {
    color: "#ff6868",
  },

  closeButton: {
    backgroundColor: "#102338",
    borderWidth: 1,
    borderColor: "#284057",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  closeButtonText: {
    color: "#76bdff",
    fontWeight: "800",
    fontSize: 11,
  },

  detailMetrics: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },

  detailMetric: {
    flex: 1,
    minWidth: 150,
    backgroundColor: "#081624",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 13,
    padding: 14,
  },

  detailMetricLabel: {
    color: "#8293a8",
    fontSize: 11,
    fontWeight: "700",
  },

  detailMetricValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 5,
  },

  detailMetricWarning: {
    color: "#f2b84b",
  },

  detailMetricGood: {
    color: "#54df8c",
  },

  detailInformation: {
    backgroundColor: "#081624",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 13,
    padding: 14,
    gap: 10,
  },

  detailInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },

  detailInfoLabel: {
    color: "#8293a8",
    fontSize: 11,
  },

  detailInfoValue: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },

  detailInfoGood: {
    color: "#54df8c",
  },

  detailInfoValueSmall: {
    color: "#9db1c5",
    fontSize: 10,
    fontWeight: "700",
  },

  explanationBox: {
    backgroundColor: "#241d0f",
    borderWidth: 1,
    borderColor: "#5f491c",
    borderRadius: 13,
    padding: 15,
  },

  explanationBoxGood: {
    backgroundColor: "#102d20",
    borderColor: "#296e49",
  },

  explanationBoxBreach: {
    backgroundColor: "#351518",
    borderColor: "#7f3037",
  },

  explanationHeading: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  explanationText: {
    color: "#b9c6d3",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },

  explanationImportant: {
    color: "#f2b84b",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 10,
  },

  explanationImportantGood: {
    color: "#54df8c",
  },

  explanationImportantBreach: {
    color: "#ff6868",
  },

  auditSection: {
    backgroundColor: "#081624",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 13,
    padding: 15,
  },

  auditHeading: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 12,
  },

  auditItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },

  auditDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#f2b84b",
    marginTop: 5,
  },

  auditDotGood: {
    backgroundColor: "#54df8c",
  },

  auditDotBreach: {
    backgroundColor: "#ff6868",
  },

  auditDotInfo: {
    backgroundColor: "#5cb1ff",
  },

  auditBalance: {
    color: "#d7e1ea",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 5,
  },

  auditTextBox: {
    flex: 1,
  },

  auditDate: {
    color: "#8293a8",
    fontSize: 10,
    fontWeight: "700",
  },

  auditTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2,
  },

  auditDescription: {
    color: "#9db1c5",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  jessRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#0e2033",
    borderWidth: 1,
    borderColor: "#265177",
    borderRadius: 13,
    padding: 15,
  },

  jessHeading: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },

  jessSubtext: {
    color: "#8fa6bc",
    fontSize: 11,
    marginTop: 3,
  },

  jessButton: {
    backgroundColor: "#10375f",
    borderWidth: 1,
    borderColor: "#3d7bae",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },

  jessButtonText: {
    color: "#8ec7ff",
    fontSize: 11,
    fontWeight: "900",
  },

  weeklySummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 16,
    padding: 18,
  },

  summaryItem: {
    flex: 1,
  },

  summaryLabel: {
    color: "#8293a8",
    fontSize: 12,
    fontWeight: "700",
  },

  summaryValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 5,
  },

  summaryGood: {
    color: "#54df8c",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 5,
  },

  summaryWarning: {
    color: "#f2b84b",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 5,
  },

  summaryBreach: {
    color: "#ff6868",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 5,
  },

  issuePanel: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },

  issuePanelTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },

  issueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  issueDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    backgroundColor: "#54df8c",
  },

  issueDotWarning: {
    backgroundColor: "#f2b84b",
  },

  issueDotBreach: {
    backgroundColor: "#ff6868",
  },

  issueTextBox: {
    flex: 1,
  },

  issueTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },

  issueDescription: {
    color: "#8293a8",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
});
