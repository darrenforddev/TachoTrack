import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  createCurrentFortnightlyDriverHistory,
  rollFortnightlyDriverHistoryForward,
} from "../../data/fortnightlyDriverHistory";

import { loadFortnightlyDriverHistory } from "../../data/weeklyDriverHistoryStorage";

import { calculateFortnightlyDrivingState } from "../../engine/fortnightlyDrivingState";

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));

  const hours = Math.floor(safeMinutes / 60);

  const remainingMinutes = safeMinutes % 60;

  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
}

function formatShortDate(dateString: string): string {
  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function formatDayName(dateString: string): string {
  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString(undefined, {
    weekday: "short",
  });
}

export default function FortnightDiaryScreen() {
  const [history, setHistory] = useState(() =>
    createCurrentFortnightlyDriverHistory(Date.now()),
  );

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const stored = await loadFortnightlyDriverHistory();

      if (cancelled) {
        return;
      }

      if (stored !== null) {
        setHistory(rollFortnightlyDriverHistoryForward(stored, Date.now()));
      }

      setHydrated(true);
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  const fortnightState = useMemo(
    () =>
      calculateFortnightlyDrivingState(
        history.previousWeek.days,
        history.currentWeek.days,
      ),
    [history.previousWeek.days, history.currentWeek.days],
  );

  const previousWeekMinutes = history.previousWeek.days.reduce(
    (total, day) => total + day.drivingMinutes,
    0,
  );

  const currentWeekMinutes = history.currentWeek.days.reduce(
    (total, day) => total + day.drivingMinutes,
    0,
  );

  const recordedDays = [
    ...history.previousWeek.days,
    ...history.currentWeek.days,
  ];

  const recordedDaysByDate = new Map(
    recordedDays.map((day) => [day.date, day]),
  );

  const fortnightStart = new Date(
    `${history.previousWeek.weekStartDate}T12:00:00`,
  );

  const today = new Date();

  const todayDateString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const allDays = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(fortnightStart);

    date.setDate(fortnightStart.getDate() + index);

    const dateString = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    const recordedDay = recordedDaysByDate.get(dateString);

    return {
      date: dateString,
      drivingMinutes: recordedDay?.drivingMinutes ?? 0,
    };
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          <View>
            <Text style={styles.title}>Fortnight Driving</Text>

            <Text style={styles.subtitle}>Two-week 90h driving compliance</Text>
            <View style={styles.diaryTabs}>
              <Pressable
                style={styles.diaryTab}
                onPress={() => router.push("/diary/week")}
              >
                <Text style={styles.diaryTabText}>Week</Text>
              </Pressable>

              <View style={[styles.diaryTab, styles.diaryTabActive]}>
                <Text style={styles.diaryTabTextActive}>Fortnight</Text>
              </View>

              <Pressable
                style={styles.diaryTab}
                onPress={() => router.push("/diary/month")}
              >
                <Text style={styles.diaryTabText}>Month</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.periodCard}>
          <Text style={styles.periodLabel}>CURRENT FORTNIGHT</Text>

          <Text style={styles.periodValue}>
            {formatShortDate(history.previousWeek.weekStartDate)}
            {"  →  "}
            {formatShortDate(history.currentWeek.weekEndDate)}
          </Text>
        </View>

        <View style={styles.weekGrid}>
          <View style={styles.weekCard}>
            <Text style={styles.weekLabel}>Previous Week</Text>

            <Text style={styles.weekValue}>
              {formatMinutes(previousWeekMinutes)}
            </Text>

            <Text style={styles.weekDates}>
              {formatShortDate(history.previousWeek.weekStartDate)}
              {" – "}
              {formatShortDate(history.previousWeek.weekEndDate)}
            </Text>
          </View>

          <View style={styles.weekCard}>
            <Text style={styles.weekLabel}>Current Week</Text>

            <Text style={styles.weekValue}>
              {formatMinutes(currentWeekMinutes)}
            </Text>

            <Text style={styles.weekDates}>
              {formatShortDate(history.currentWeek.weekStartDate)}
              {" – "}
              {formatShortDate(history.currentWeek.weekEndDate)}
            </Text>
          </View>
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>FORTNIGHT TOTAL</Text>

          <Text style={styles.progressValue}>
            {formatMinutes(fortnightState.drivingMinutesUsed)}
            {" / "}
            {formatMinutes(fortnightState.limitMinutes)}
          </Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, fortnightState.percentageUsed)}%`,
                },
              ]}
            />
          </View>

          <View style={styles.progressFooter}>
            <Text style={styles.progressText}>
              {fortnightState.percentageUsed.toFixed(1)}% used
            </Text>

            <Text style={styles.remainingText}>
              {formatMinutes(fortnightState.remainingMinutes)} remaining
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>14-Day Driving Record</Text>

          <Text style={styles.sectionText}>
            Daily driving recorded across both consecutive weeks.
          </Text>
        </View>

        <View style={styles.weekSection}>
          <View style={styles.weekSectionHeader}>
            <Text style={styles.weekSectionLabel}>PREVIOUS WEEK</Text>

            <Text style={styles.weekSectionDates}>
              {formatShortDate(history.previousWeek.weekStartDate)}
              {" – "}
              {formatShortDate(history.previousWeek.weekEndDate)}
            </Text>
          </View>

          <View style={styles.dayGrid}>
            {allDays.slice(0, 7).map((day) => (
              <View
                key={day.date}
                style={[
                  styles.dayCard,
                  day.date > todayDateString && styles.dayCardFuture,
                  day.date === todayDateString && styles.dayCardToday,
                ]}
              >
                <Text style={styles.dayName}>{formatDayName(day.date)}</Text>

                <Text style={styles.dayDate}>{formatShortDate(day.date)}</Text>

                {day.date === todayDateString && (
                  <Text style={styles.todayLabel}>TODAY</Text>
                )}

                <Text style={styles.dayDriving}>
                  {formatMinutes(day.drivingMinutes)}
                </Text>

                <Text style={styles.dayLabel}>DRIVING</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.weekSection}>
          <View style={styles.weekSectionHeader}>
            <Text style={styles.weekSectionLabel}>CURRENT WEEK</Text>

            <Text style={styles.weekSectionDates}>
              {formatShortDate(history.currentWeek.weekStartDate)}
              {" – "}
              {formatShortDate(history.currentWeek.weekEndDate)}
            </Text>
          </View>

          <View style={styles.dayGrid}>
            {allDays.slice(7, 14).map((day) => (
              <View
                key={day.date}
                style={[
                  styles.dayCard,
                  day.date > todayDateString && styles.dayCardFuture,
                  day.date === todayDateString && styles.dayCardToday,
                ]}
              >
                <Text style={styles.dayName}>{formatDayName(day.date)}</Text>

                <Text style={styles.dayDate}>{formatShortDate(day.date)}</Text>

                {day.date === todayDateString && (
                  <Text style={styles.todayLabel}>TODAY</Text>
                )}

                <Text style={styles.dayDriving}>
                  {formatMinutes(day.drivingMinutes)}
                </Text>

                <Text style={styles.dayLabel}>DRIVING</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.storageStatus}>
          {hydrated
            ? "Fortnight history loaded"
            : "Loading fortnight history..."}
        </Text>
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
    gap: 20,
    backgroundColor: "#06111f",
  },

  header: {
    gap: 14,
  },

  backButton: {
    alignSelf: "flex-start",
  },

  backText: {
    color: "#4ba6ff",
    fontSize: 14,
    fontWeight: "800",
  },

  title: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
  },

  subtitle: {
    color: "#8293a8",
    fontSize: 14,
    marginTop: 4,
  },

  diaryTabs: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
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

  periodCard: {
    backgroundColor: "#081523",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 18,
    padding: 18,
  },

  periodLabel: {
    color: "#8293a8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  periodValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 6,
  },

  weekGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  weekCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 20,
    padding: 20,
  },

  weekLabel: {
    color: "#8293a8",
    fontSize: 12,
    fontWeight: "800",
  },

  weekValue: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 8,
  },

  weekDates: {
    color: "#607488",
    fontSize: 11,
    marginTop: 6,
  },

  progressCard: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 22,
    padding: 22,
  },

  progressLabel: {
    color: "#8293a8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },

  progressValue: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 8,
  },

  progressTrack: {
    width: "100%",
    height: 12,
    borderRadius: 6,
    backgroundColor: "#17324d",
    overflow: "hidden",
    marginTop: 18,
  },

  progressFill: {
    height: "100%",
    borderRadius: 6,
    backgroundColor: "#258cff",
  },

  progressFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
  },

  progressText: {
    color: "#8293a8",
    fontSize: 12,
    fontWeight: "700",
  },

  remainingText: {
    color: "#55e68e",
    fontSize: 12,
    fontWeight: "900",
  },

  sectionHeader: {
    gap: 4,
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
  },

  sectionText: {
    color: "#8293a8",
    fontSize: 13,
  },

  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  weekSection: {
    gap: 10,
  },

  weekSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  weekSectionLabel: {
    color: "#67b8ff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },

  weekSectionDates: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },

  dayCard: {
    flexGrow: 1,
    flexBasis: "13%",
    minWidth: 110,
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 16,
    padding: 14,
  },

  dayCardFuture: {
    opacity: 0.45,
  },

  dayCardToday: {
    borderColor: "#258cff",
    borderWidth: 2,
    backgroundColor: "#0d2035",
  },

  todayLabel: {
    alignSelf: "flex-start",
    color: "#06111f",
    backgroundColor: "#67b8ff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 7,
  },

  dayName: {
    color: "#67b8ff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },

  dayDate: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 4,
  },

  dayDriving: {
    color: "#67b8ff",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 14,
  },

  dayLabel: {
    color: "#8293a8",
    fontSize: 9,
    fontWeight: "800",
    marginTop: 3,
    letterSpacing: 0.8,
  },

  emptyCard: {
    width: "100%",
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 18,
    padding: 22,
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  emptyText: {
    color: "#8293a8",
    fontSize: 12,
    marginTop: 5,
  },

  storageStatus: {
    color: "#607488",
    fontSize: 10,
    textAlign: "center",
  },
});
