import { router } from "expo-router";
import { useState } from "react";

import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { RestCompensationCalendarEvent } from "../../engine/weeklyRestCompensationAllocation";

import {
  getCalendarEventBadge,
  getCalendarEventsForDate,
  getWorstCalendarSeverity,
  toCalendarComplianceEvents,
  type CalendarComplianceEvent,
} from "../../engine/calendarComplianceEvents";

type ComplianceState = "good" | "warning" | "breach" | "rest" | "empty";

interface CalendarDay {
  date: number | null;
  state: ComplianceState;
}

interface CalendarWeek {
  weekNumber: number;
  days: CalendarDay[];
}

/**
 * --------------------------------------------------
 * AUGUST 2026 BASE CALENDAR DATA
 * --------------------------------------------------
 *
 * These are still our sample diary states.
 *
 * The important change in this version is that
 * compensation events now come through the
 * Calendar Compliance Event Adapter.
 */
const monthWeeks: CalendarWeek[] = [
  {
    weekNumber: 31,
    days: [
      { date: null, state: "empty" },
      { date: null, state: "empty" },
      { date: null, state: "empty" },
      { date: null, state: "empty" },
      { date: null, state: "empty" },
      { date: 1, state: "good" },
      { date: 2, state: "rest" },
    ],
  },

  {
    weekNumber: 32,
    days: [
      { date: 3, state: "good" },
      { date: 4, state: "good" },
      { date: 5, state: "warning" },
      { date: 6, state: "good" },
      { date: 7, state: "good" },
      { date: 8, state: "good" },
      { date: 9, state: "rest" },
    ],
  },

  {
    weekNumber: 33,
    days: [
      { date: 10, state: "good" },
      { date: 11, state: "good" },
      { date: 12, state: "good" },
      { date: 13, state: "good" },
      { date: 14, state: "good" },
      { date: 15, state: "good" },
      { date: 16, state: "rest" },
    ],
  },

  {
    weekNumber: 34,
    days: [
      { date: 17, state: "good" },
      { date: 18, state: "breach" },
      { date: 19, state: "good" },
      { date: 20, state: "good" },
      { date: 21, state: "warning" },
      { date: 22, state: "good" },
      { date: 23, state: "rest" },
    ],
  },

  {
    weekNumber: 35,
    days: [
      { date: 24, state: "good" },
      { date: 25, state: "good" },
      { date: 26, state: "breach" },
      { date: 27, state: "good" },
      { date: 28, state: "good" },
      { date: 29, state: "good" },
      { date: 30, state: "rest" },
    ],
  },

  {
    weekNumber: 36,
    days: [
      { date: 31, state: "good" },
      { date: null, state: "empty" },
      { date: null, state: "empty" },
      { date: null, state: "empty" },
      { date: null, state: "empty" },
      { date: null, state: "empty" },
      { date: null, state: "empty" },
    ],
  },
];

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * --------------------------------------------------
 * SAMPLE ENGINE AUDIT EVENTS
 * --------------------------------------------------
 *
 * These use the exact event structure generated
 * by our tested compensation-allocation engine.
 *
 * Later this array will disappear and the events
 * will come from actual stored driver history.
 */
const compensationAuditEvents: RestCompensationCalendarEvent[] = [
  {
    id: "aug-created-week-29",

    type: "compensation-created",

    date: "2026-08-05",

    sourceWeekNumber: 29,

    sourceObligationId: "week-29-compensation",

    minutes: 6 * 60,

    remainingMinutes: 6 * 60,

    message: "6 hours of weekly-rest compensation created.",
  },

  {
    id: "aug-applied-week-29",

    type: "compensation-applied",

    date: "2026-08-12",

    sourceWeekNumber: 29,

    sourceObligationId: "week-29-compensation",

    allocationRestId: "rest-2026-08-12",

    minutes: 4 * 60,

    remainingMinutes: 2 * 60,

    message: "4 hours of compensation applied.",
  },

  {
    id: "aug-cleared-week-29",

    type: "compensation-cleared",

    date: "2026-08-19",

    sourceWeekNumber: 29,

    sourceObligationId: "week-29-compensation",

    allocationRestId: "rest-2026-08-19",

    minutes: 2 * 60,

    remainingMinutes: 0,

    message: "Week 29 compensation fully cleared.",
  },

  {
    id: "aug-overdue-week-30",

    type: "compensation-overdue",

    date: "2026-08-21",

    sourceWeekNumber: 30,

    sourceObligationId: "week-30-compensation",

    minutes: 3 * 60,

    remainingMinutes: 3 * 60,

    message: "3 hours of weekly-rest compensation remained outstanding.",
  },

  {
    id: "aug-created-week-35",

    type: "compensation-created",

    date: "2026-08-30",

    sourceWeekNumber: 35,

    sourceObligationId: "week-35-compensation",

    minutes: 21 * 60,

    remainingMinutes: 21 * 60,

    message: "21 hours of weekly-rest compensation created.",
  },
];

/**
 * Convert raw engine audit records into
 * calendar-facing events.
 */
const calendarEvents = toCalendarComplianceEvents(compensationAuditEvents);

function getStateLabel(state: ComplianceState) {
  switch (state) {
    case "good":
      return "Good";

    case "warning":
      return "Warning";

    case "breach":
      return "Breach";

    case "rest":
      return "Rest";

    default:
      return "";
  }
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);

  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }

  return `${hours}h ` + `${mins.toString().padStart(2, "0")}m`;
}

function getFullDate(day: number) {
  return `2026-08-` + day.toString().padStart(2, "0");
}

/**
 * --------------------------------------------------
 * MERGE DIARY STATE + EVENT STATE
 * --------------------------------------------------
 *
 * Event rules do not replace the legal
 * compliance engine.
 *
 * This only decides the colour shown by the
 * monthly presentation layer.
 */
function resolveDayState(
  baseState: ComplianceState,
  events: CalendarComplianceEvent[],
): ComplianceState {
  if (baseState === "empty") {
    return "empty";
  }

  /**
   * Existing breach always remains breach.
   */
  if (baseState === "breach") {
    return "breach";
  }

  if (events.length === 0) {
    return baseState;
  }

  const eventSeverity = getWorstCalendarSeverity(events);

  /**
   * Overdue compensation creates
   * a breach-level calendar day.
   */
  if (eventSeverity === "breach") {
    return "breach";
  }

  /**
   * Newly-created compensation creates
   * an amber planning/compliance warning.
   */
  if (eventSeverity === "warning") {
    return "warning";
  }

  /**
   * Good/info events do not turn an
   * existing rest day green.
   */
  return baseState;
}

export default function MonthlyDiaryScreen() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const selectedEvents = selectedDate
    ? getCalendarEventsForDate(calendarEvents, selectedDate)
    : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        {/* HEADER */}

        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>TachoTrack</Text>

            <Text style={styles.title}>Monthly Compliance</Text>
          </View>

          <View style={styles.headerRight}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backText}>← Dashboard</Text>
            </Pressable>

            <View style={styles.monthBadge}>
              <Text style={styles.monthBadgeText}>AUGUST 2026</Text>
            </View>
          </View>
        </View>

        {/* MONTH NAVIGATION */}

        <View style={styles.monthNavigation}>
          <Pressable style={styles.navButton}>
            <Text style={styles.navText}>‹ Previous Month</Text>
          </Pressable>

          <Text style={styles.currentMonth}>August 2026</Text>

          <Pressable style={styles.navButton}>
            <Text style={styles.navText}>Next Month ›</Text>
          </Pressable>
        </View>

        {/* CALENDAR */}

        <View style={styles.calendar}>
          <View style={styles.calendarHeader}>
            <View style={styles.weekHeaderCell}>
              <Text style={styles.headerCellText}>Week</Text>
            </View>

            {dayNames.map((day) => (
              <View key={day} style={styles.dayHeaderCell}>
                <Text style={styles.headerCellText}>{day}</Text>
              </View>
            ))}
          </View>

          {monthWeeks.map((week) => (
            <View key={week.weekNumber} style={styles.weekRow}>
              <Pressable
                style={styles.weekNumberCell}
                onPress={() => {
                  if (week.weekNumber === 35) {
                    router.push("/diary/week");
                  }
                }}
              >
                <Text style={styles.weekNumberText}>W{week.weekNumber}</Text>

                <Text style={styles.weekOpenText}>Open</Text>
              </Pressable>

              {week.days.map((day, index) => {
                if (day.date === null) {
                  return (
                    <View
                      key={`${week.weekNumber}-${index}`}
                      style={[styles.dayCell, styles.dayEmpty]}
                    />
                  );
                }

                const fullDate = getFullDate(day.date);

                const dayEvents = getCalendarEventsForDate(
                  calendarEvents,
                  fullDate,
                );

                const displayState = resolveDayState(day.state, dayEvents);

                return (
                  <Pressable
                    key={`${week.weekNumber}-${index}`}
                    style={[
                      styles.dayCell,

                      displayState === "good" && styles.dayGood,

                      displayState === "warning" && styles.dayWarning,

                      displayState === "breach" && styles.dayBreach,

                      displayState === "rest" && styles.dayRest,
                    ]}
                    onPress={() => {
                      if (dayEvents.length > 0) {
                        setSelectedDate(fullDate);
                      } else {
                        setSelectedDate(null);
                      }
                    }}
                  >
                    <View style={styles.dayTopRow}>
                      <Text style={styles.dateText}>{day.date}</Text>

                      {dayEvents.length > 0 && (
                        <View style={styles.badgeRow}>
                          {dayEvents.map((event) => (
                            <View
                              key={event.id}
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
                            </View>
                          ))}
                        </View>
                      )}
                    </View>

                    <Text style={styles.stateText}>
                      {getStateLabel(displayState)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* LEGEND */}

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSquare, styles.dayGood]} />

            <Text style={styles.legendText}>Good compliance</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendSquare, styles.dayWarning]} />

            <Text style={styles.legendText}>Warning</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendSquare, styles.dayBreach]} />

            <Text style={styles.legendText}>Breach</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendSquare, styles.dayRest]} />

            <Text style={styles.legendText}>Rest day</Text>
          </View>

          <View style={styles.legendDivider} />

          <Text style={styles.legendEventText}>C = compensation</Text>

          <Text style={styles.legendEventText}>✓C = cleared</Text>

          <Text style={styles.legendEventText}>!C = missed</Text>
        </View>

        {/* SELECTED DAY DETAIL */}

        {selectedDate !== null && selectedEvents.length > 0 && (
          <View style={styles.eventDetailPanel}>
            <View style={styles.eventDetailHeader}>
              <View>
                <Text style={styles.eventDetailHeading}>Rest Compensation</Text>

                <Text style={styles.eventDetailDate}>{selectedDate}</Text>
              </View>

              <Pressable
                style={styles.closeDetailButton}
                onPress={() => setSelectedDate(null)}
              >
                <Text style={styles.closeDetailText}>Close</Text>
              </Pressable>
            </View>

            {selectedEvents.map((event) => (
              <View key={event.id} style={styles.eventDetailCard}>
                <View style={styles.eventDetailTitleRow}>
                  <View
                    style={[
                      styles.detailStatusDot,

                      event.severity === "good" && styles.detailDotGood,

                      event.severity === "warning" && styles.detailDotWarning,

                      event.severity === "breach" && styles.detailDotBreach,

                      event.severity === "info" && styles.detailDotInfo,
                    ]}
                  />

                  <Text style={styles.eventDetailTitle}>{event.title}</Text>
                </View>

                <Text style={styles.eventSummary}>{event.summary}</Text>

                <View style={styles.eventStats}>
                  <View style={styles.eventStat}>
                    <Text style={styles.eventStatLabel}>Source</Text>

                    <Text style={styles.eventStatValue}>
                      Week {event.sourceWeekNumber}
                    </Text>
                  </View>

                  <View style={styles.eventStat}>
                    <Text style={styles.eventStatLabel}>Event Amount</Text>

                    <Text style={styles.eventStatValue}>
                      {formatMinutes(event.minutes)}
                    </Text>
                  </View>

                  <View style={styles.eventStat}>
                    <Text style={styles.eventStatLabel}>Remaining</Text>

                    <Text
                      style={[
                        styles.eventStatValue,

                        event.remainingMinutes === 0 && styles.eventStatGood,

                        event.severity === "breach" && styles.eventStatBreach,
                      ]}
                    >
                      {formatMinutes(event.remainingMinutes)}
                    </Text>
                  </View>

                  <View style={styles.eventStat}>
                    <Text style={styles.eventStatLabel}>Status</Text>

                    <Text
                      style={[
                        styles.eventStatValue,

                        event.severity === "good" && styles.eventStatGood,

                        event.severity === "warning" && styles.eventStatWarning,

                        event.severity === "breach" && styles.eventStatBreach,
                      ]}
                    >
                      {event.severity === "good"
                        ? "Completed"
                        : event.severity === "breach"
                          ? "Missed"
                          : event.severity === "warning"
                            ? "Outstanding"
                            : "Applied"}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* MONTH SUMMARY */}

        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Driving</Text>

            <Text style={styles.summaryValue}>184h 32m</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Working Time</Text>

            <Text style={styles.summaryValue}>219h 10m</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Reduced Rests</Text>

            <Text style={styles.summaryValue}>3</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Amber Days</Text>

            <Text style={styles.summaryWarning}>2</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Breach Days</Text>

            <Text style={styles.summaryBreach}>2</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Compliance</Text>

            <Text style={styles.summaryGood}>94%</Text>
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

  monthBadge: {
    backgroundColor: "#10375f",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },

  monthBadgeText: {
    color: "#ffffff",
    fontWeight: "800",
  },

  monthNavigation: {
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

  navText: {
    color: "#8ec7ff",
    fontWeight: "700",
  },

  currentMonth: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },

  calendar: {
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#0b1929",
  },

  calendarHeader: {
    flexDirection: "row",
    backgroundColor: "#102236",
  },

  weekHeaderCell: {
    width: 90,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#183049",
  },

  dayHeaderCell: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#183049",
  },

  headerCellText: {
    color: "#c5d4e4",
    fontWeight: "800",
    fontSize: 13,
  },

  weekRow: {
    flexDirection: "row",
    minHeight: 74,
    borderTopWidth: 1,
    borderTopColor: "#183049",
  },

  weekNumberCell: {
    width: 90,
    backgroundColor: "#0d1c2c",
    borderRightWidth: 1,
    borderRightColor: "#183049",
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },

  weekNumberText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  weekOpenText: {
    color: "#4ba6ff",
    fontSize: 10,
    fontWeight: "700",
  },

  dayCell: {
    flex: 1,
    minHeight: 66,
    margin: 4,
    borderRadius: 9,
    padding: 8,
    justifyContent: "space-between",
  },

  dayGood: {
    backgroundColor: "#2e9f50",
  },

  dayWarning: {
    backgroundColor: "#e79a2f",
  },

  dayBreach: {
    backgroundColor: "#d94141",
  },

  dayRest: {
    backgroundColor: "#174d78",
  },

  dayEmpty: {
    backgroundColor: "#0a1724",
  },

  dayTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 6,
  },

  dateText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },

  stateText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    opacity: 0.95,
  },

  badgeRow: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  eventBadge: {
    minWidth: 24,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  eventBadgeGood: {
    backgroundColor: "#123c28",
    borderColor: "#70f0a5",
  },

  eventBadgeWarning: {
    backgroundColor: "#6a4315",
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

  legend: {
    flexDirection: "row",
    gap: 18,
    flexWrap: "wrap",
    alignItems: "center",
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  legendSquare: {
    width: 15,
    height: 15,
    borderRadius: 4,
  },

  legendText: {
    color: "#9cb0c5",
    fontSize: 12,
    fontWeight: "700",
  },

  legendDivider: {
    width: 1,
    height: 18,
    backgroundColor: "#284058",
  },

  legendEventText: {
    color: "#7991a8",
    fontSize: 11,
    fontWeight: "700",
  },

  eventDetailPanel: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#23435f",
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },

  eventDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  eventDetailHeading: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
  },

  eventDetailDate: {
    color: "#7f99b2",
    fontSize: 12,
    marginTop: 3,
  },

  closeDetailButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: "#10263b",
    borderWidth: 1,
    borderColor: "#23435f",
  },

  closeDetailText: {
    color: "#76bdff",
    fontSize: 11,
    fontWeight: "800",
  },

  eventDetailCard: {
    backgroundColor: "#091726",
    borderWidth: 1,
    borderColor: "#1a344d",
    borderRadius: 13,
    padding: 14,
    gap: 11,
  },

  eventDetailTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  detailStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  detailDotGood: {
    backgroundColor: "#54df8c",
  },

  detailDotWarning: {
    backgroundColor: "#f2b84b",
  },

  detailDotBreach: {
    backgroundColor: "#ff6868",
  },

  detailDotInfo: {
    backgroundColor: "#5cb1ff",
  },

  eventDetailTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  eventSummary: {
    color: "#9db1c5",
    fontSize: 12,
    lineHeight: 18,
  },

  eventStats: {
    flexDirection: "row",
    gap: 18,
    flexWrap: "wrap",
  },

  eventStat: {
    minWidth: 120,
  },

  eventStatLabel: {
    color: "#718aa2",
    fontSize: 10,
    fontWeight: "700",
  },

  eventStatValue: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 3,
  },

  eventStatGood: {
    color: "#54df8c",
  },

  eventStatWarning: {
    color: "#f2b84b",
  },

  eventStatBreach: {
    color: "#ff6868",
  },

  summary: {
    flexDirection: "row",
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
    fontSize: 11,
    fontWeight: "700",
  },

  summaryValue: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 5,
  },

  summaryGood: {
    color: "#54df8c",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 5,
  },

  summaryWarning: {
    color: "#f2b84b",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 5,
  },

  summaryBreach: {
    color: "#ff6868",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 5,
  },
});
