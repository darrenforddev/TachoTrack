import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import { calculateFortnightlyDrivingState } from "../../engine/fortnightlyDrivingState";

import {
  createDriverHistoryArchive,
  getDriverDaysForMonth,
} from "../../data/driverHistoryArchive";

import { loadDriverHistoryArchive } from "../../data/driverHistoryArchiveStorage";

import {
  createCurrentFortnightlyDriverHistory,
  rollFortnightlyDriverHistoryForward,
} from "../../data/fortnightlyDriverHistory";

import { loadFortnightlyDriverHistory } from "../../data/weeklyDriverHistoryStorage";

import { evaluateDriverDay } from "../../engine/complianceEngine";

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

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getISOWeekNumber(date: Date): number {
  const target = new Date(date);

  target.setHours(0, 0, 0, 0);

  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));

  const week1 = new Date(target.getFullYear(), 0, 4);

  return (
    1 +
    Math.round(
      ((target.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}

function buildMonthWeeks(year: number, month: number): CalendarWeek[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const daysInMonth = lastDay.getDate();

  // Convert JavaScript Sunday-first numbering
  // into our Monday-first calendar.
  const firstDayOffset = (firstDay.getDay() + 6) % 7;

  const days: CalendarDay[] = [];

  for (let index = 0; index < firstDayOffset; index += 1) {
    days.push({
      date: null,
      state: "empty",
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({
      date: day,
      state: "good",
    });
  }

  while (days.length % 7 !== 0) {
    days.push({
      date: null,
      state: "empty",
    });
  }

  const weeks: CalendarWeek[] = [];

  for (let index = 0; index < days.length; index += 7) {
    const weekDays = days.slice(index, index + 7);

    const firstRealDay = weekDays.find((day) => day.date !== null);

    const referenceDate = new Date(year, month, firstRealDay?.date ?? 1);

    weeks.push({
      weekNumber: getISOWeekNumber(referenceDate),
      days: weekDays,
    });
  }

  return weeks;
}

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

function formatFortnightDate(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getFullDate(year: number, month: number, day: number) {
  return [
    year,
    String(month + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
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
  const params = useLocalSearchParams<{
    year?: string;
    month?: string;
  }>();

  const initialYear =
    typeof params.year === "string"
      ? Number(params.year)
      : new Date().getFullYear();

  const initialMonth =
    typeof params.month === "string"
      ? Number(params.month)
      : new Date().getMonth();
  const [displayDate, setDisplayDate] = useState(() => ({
    year: Number.isFinite(initialYear) ? initialYear : new Date().getFullYear(),

    month:
      Number.isFinite(initialMonth) && initialMonth >= 0 && initialMonth <= 11
        ? initialMonth
        : new Date().getMonth(),
  }));

  const displayYear = displayDate.year;
  const displayMonth = displayDate.month;
  const displayMonthName = new Date(
    displayYear,
    displayMonth,
    1,
  ).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const displayMonthBadge = displayMonthName.toUpperCase();
  function showPreviousMonth() {
    setDisplayDate((current) => {
      if (current.month === 0) {
        return {
          year: current.year - 1,
          month: 11,
        };
      }

      return {
        year: current.year,
        month: current.month - 1,
      };
    });
  }

  function showNextMonth() {
    setDisplayDate((current) => {
      if (current.month === 11) {
        return {
          year: current.year + 1,
          month: 0,
        };
      }

      return {
        year: current.year,
        month: current.month + 1,
      };
    });
  }
  const monthWeeks = useMemo(
    () => buildMonthWeeks(displayYear, displayMonth),
    [displayYear, displayMonth],
  );
  const [driverHistoryArchive, setDriverHistoryArchive] = useState(() =>
    createDriverHistoryArchive(),
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrateDriverHistoryArchive() {
      const storedArchive = await loadDriverHistoryArchive();

      if (cancelled) {
        return;
      }

      setDriverHistoryArchive(storedArchive);
    }

    void hydrateDriverHistoryArchive();

    return () => {
      cancelled = true;
    };
  }, []);

  const archivedMonthDays = useMemo(
    () =>
      getDriverDaysForMonth(driverHistoryArchive, displayYear, displayMonth),
    [driverHistoryArchive, displayYear, displayMonth],
  );
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

  const monthTotalDrivingMinutes = archivedMonthDays.reduce(
    (total, day) => total + day.drivingMinutes,
    0,
  );

  const monthTotalWorkingMinutes = archivedMonthDays.reduce(
    (total, day) => total + day.drivingMinutes + day.otherWorkMinutes,
    0,
  );

  const monthReducedRests = archivedMonthDays.filter(
    (day) => day.dailyRestType === "reduced",
  ).length;

  const storedComplianceResults = archivedMonthDays.map((day) =>
    evaluateDriverDay(day),
  );

  const monthAmberDays = storedComplianceResults.filter(
    (result) => result.level === "warning",
  ).length;

  const monthBreachDays = storedComplianceResults.filter(
    (result) => result.level === "breach",
  ).length;

  const monthGoodDays = storedComplianceResults.filter(
    (result) => result.level === "good",
  ).length;

  const monthCompliancePercentage =
    storedComplianceResults.length === 0
      ? 100
      : Math.round((monthGoodDays / storedComplianceResults.length) * 100);

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
            <Pressable
              style={styles.backButton}
              onPress={() =>
                router.push({
                  pathname: "/diary/year",
                  params: {
                    year: String(displayYear),
                  },
                })
              }
            >
              <Text style={styles.backText}>← Year View</Text>
            </Pressable>

            <Pressable
              style={styles.backButton}
              onPress={() => router.replace("/")}
            >
              <Text style={styles.backText}>Dashboard</Text>
            </Pressable>

            <View style={styles.monthBadge}>
              <Text style={styles.monthBadgeText}>{displayMonthBadge}</Text>
            </View>
          </View>
        </View>

        <View style={styles.diaryTabs}>
          <Pressable
            style={styles.diaryTab}
            onPress={() => router.push("/diary/week")}
          >
            <Text style={styles.diaryTabText}>Week</Text>
          </Pressable>

          <Pressable
            style={styles.diaryTab}
            onPress={() => router.push("/diary/fortnight")}
          >
            <Text style={styles.diaryTabText}>Fortnight</Text>
          </Pressable>

          <View style={[styles.diaryTab, styles.diaryTabActive]}>
            <Text style={styles.diaryTabTextActive}>Month</Text>
          </View>
        </View>

        <View style={styles.fortnightStatus}>
          <View style={styles.fortnightStatusHeader}>
            <View>
              <Text style={styles.fortnightStatusLabel}>FORTNIGHT DRIVING</Text>

              <Text style={styles.fortnightDateRange}>
                {formatFortnightDate(
                  fortnightlyHistory.previousWeek.weekStartDate,
                )}
                {" – "}
                {formatFortnightDate(
                  fortnightlyHistory.currentWeek.weekEndDate,
                )}
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

        {/* MONTH NAVIGATION */}

        <View style={styles.monthNavigation}>
          <Pressable style={styles.navButton} onPress={showPreviousMonth}>
            <Text style={styles.navText}>‹ Previous Month</Text>
          </Pressable>

          <Text style={styles.currentMonth}>{displayMonthName}</Text>

          <Pressable style={styles.navButton} onPress={showNextMonth}>
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

                const fullDate = getFullDate(
                  displayYear,
                  displayMonth,
                  day.date,
                );
                const storedDay = archivedMonthDays.find(
                  (item) => item.date === fullDate,
                );

                const storedCompliance =
                  storedDay !== undefined ? evaluateDriverDay(storedDay) : null;

                const dayEvents = getCalendarEventsForDate(
                  calendarEvents,
                  fullDate,
                );

                const baseState: ComplianceState =
                  storedDay === undefined
                    ? "empty"
                    : storedDay.restMinutes > 0 &&
                        storedDay.drivingMinutes === 0 &&
                        storedDay.otherWorkMinutes === 0
                      ? "rest"
                      : (storedCompliance?.level ?? "empty");

                const displayState = resolveDayState(baseState, dayEvents);

                return (
                  <Pressable
                    key={`${week.weekNumber}-${index}`}
                    style={[
                      styles.dayCell,

                      displayState === "good" && styles.dayGood,

                      displayState === "warning" && styles.dayWarning,

                      displayState === "breach" && styles.dayBreach,

                      displayState === "rest" && styles.dayRest,

                      displayState === "empty" && styles.dayEmpty,
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

                    {storedDay !== undefined &&
                      storedDay.drivingMinutes > 0 && (
                        <Text style={styles.dayDrivingText}>
                          {formatMinutes(storedDay.drivingMinutes)}
                        </Text>
                      )}

                    {storedDay !== undefined &&
                      storedDay.otherWorkMinutes > 0 && (
                        <Text style={styles.dayOtherWorkText}>
                          {formatMinutes(storedDay.otherWorkMinutes)} Other Work
                        </Text>
                      )}

                    {storedDay !== undefined &&
                      storedDay.restMinutes > 0 &&
                      storedDay.drivingMinutes === 0 &&
                      storedDay.otherWorkMinutes === 0 && (
                        <Text style={styles.dayRestText}>
                          {formatMinutes(storedDay.restMinutes)} Rest
                        </Text>
                      )}

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

            <Text style={styles.summaryValue}>
              {formatMinutes(monthTotalDrivingMinutes)}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Working Time</Text>

            <Text style={styles.summaryValue}>
              {formatMinutes(monthTotalWorkingMinutes)}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Reduced Rests</Text>

            <Text style={styles.summaryValue}>{monthReducedRests}</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Amber Days</Text>

            <Text style={styles.summaryWarning}>{monthAmberDays}</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Breach Days</Text>

            <Text style={styles.summaryBreach}>{monthBreachDays}</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Compliance</Text>

            <Text style={styles.summaryGood}>{monthCompliancePercentage}%</Text>
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

  fortnightDateRange: {
    color: "#8ec7ff",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
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
    minHeight: 92,
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
    minHeight: 84,
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

  dayDrivingText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },

  dayOtherWorkText: {
    color: "#c5d4e4",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },

  dayRestText: {
    color: "#8ec7ff",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
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
