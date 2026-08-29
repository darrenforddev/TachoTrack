import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import {
  createDriverHistoryArchive,
  getDriverDaysForYear,
} from "../../data/driverHistoryArchive";

import { loadDriverHistoryArchive } from "../../data/driverHistoryArchiveStorage";

import { evaluateDriverDay } from "../../engine/complianceEngine";

import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

function getMonthName(month: number) {
  return new Date(2026, month, 1).toLocaleDateString("en-GB", {
    month: "long",
  });
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }

  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
}

export default function YearDiaryScreen() {
  const [displayYear, setDisplayYear] = useState(2026);

  function showPreviousYear() {
    setDisplayYear((current) => current - 1);
  }

  function showNextYear() {
    setDisplayYear((current) => current + 1);
  }

  const todayDate = new Date().toISOString().slice(0, 10);

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

  const archivedYearDays = useMemo(
    () => getDriverDaysForYear(driverHistoryArchive, displayYear),
    [driverHistoryArchive, displayYear],
  );

  const yearDayStates = useMemo(
    () =>
      archivedYearDays.map((day) => {
        const compliance = evaluateDriverDay(day);

        const isRestDay =
          day.restMinutes > 0 &&
          day.drivingMinutes === 0 &&
          day.otherWorkMinutes === 0;

        return {
          date: day.date,
          state: isRestDay ? "rest" : compliance.level,
        };
      }),
    [archivedYearDays],
  );

  const yearRecordedDays = archivedYearDays.length;

  const yearGoodDays = yearDayStates.filter(
    (day) => day.state === "good",
  ).length;

  const yearWarningDays = yearDayStates.filter(
    (day) => day.state === "warning",
  ).length;

  const yearBreachDays = yearDayStates.filter(
    (day) => day.state === "breach",
  ).length;

  const yearRestDays = yearDayStates.filter(
    (day) => day.state === "rest",
  ).length;

  const yearTotalDrivingMinutes = archivedYearDays.reduce(
    (total, day) => total + day.drivingMinutes,
    0,
  );

  const yearTotalWorkingMinutes = archivedYearDays.reduce(
    (total, day) => total + day.drivingMinutes + day.otherWorkMinutes,
    0,
  );

  const yearCompliantDays = yearGoodDays + yearRestDays;

  const yearCompliancePercentage =
    yearRecordedDays === 0
      ? 100
      : Math.round((yearCompliantDays / yearRecordedDays) * 100);

  const yearDayStateMap = useMemo(
    () => new Map(yearDayStates.map((day) => [day.date, day.state])),
    [yearDayStates],
  );

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => {
        const lastDay = new Date(displayYear, monthIndex + 1, 0).getDate();

        return {
          monthIndex,
          name: getMonthName(monthIndex),
          days: Array.from({ length: lastDay }, (_, dayIndex) => {
            const dayNumber = dayIndex + 1;

            const date = [
              displayYear,
              String(monthIndex + 1).padStart(2, "0"),
              String(dayNumber).padStart(2, "0"),
            ].join("-");

            return {
              dayNumber,
              date,
              state: yearDayStateMap.get(date) ?? "empty",
            };
          }),
        };
      }),
    [displayYear, yearDayStateMap],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>TachoTrack</Text>

            <Text style={styles.title}>Year Compliance</Text>
          </View>

          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.backText}>← Dashboard</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Recorded Days</Text>
              <Text style={styles.summaryValue}>{yearRecordedDays}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Good Days</Text>
              <Text style={styles.summaryGood}>{yearGoodDays}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Warnings</Text>
              <Text style={styles.summaryWarning}>{yearWarningDays}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Breaches</Text>
              <Text style={styles.summaryBreach}>{yearBreachDays}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Rest Days</Text>
              <Text style={styles.summaryRest}>{yearRestDays}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Driving</Text>
              <Text style={styles.summaryValue}>
                {formatMinutes(yearTotalDrivingMinutes)}
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Working Time</Text>
              <Text style={styles.summaryValue}>
                {formatMinutes(yearTotalWorkingMinutes)}
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Compliance</Text>
              <Text style={styles.summaryGood}>
                {yearCompliancePercentage}%
              </Text>
            </View>
          </View>
          <View style={styles.monthsGrid}>
            {months.map((month) => (
              <Pressable
                key={month.monthIndex}
                style={styles.monthCard}
                onPress={() =>
                  router.push({
                    pathname: "/diary/month",
                    params: {
                      year: String(displayYear),
                      month: String(month.monthIndex),
                    },
                  })
                }
              >
                <View style={styles.monthHeader}>
                  <Text style={styles.monthName}>{month.name}</Text>

                  <Text style={styles.monthRecorded}>
                    {month.days.filter((day) => day.state !== "empty").length}{" "}
                    recorded
                  </Text>
                </View>

                <View style={styles.daysGrid}>
                  {month.days.map((day) => (
                    <View
                      key={day.date}
                      style={[
                        styles.daySquare,
                        day.state === "good" && styles.dayGood,
                        day.state === "warning" && styles.dayWarning,
                        day.state === "breach" && styles.dayBreach,
                        day.state === "rest" && styles.dayRest,
                        day.state === "empty" && styles.dayEmpty,
                        day.date > todayDate && styles.dayFuture,
                      ]}
                    >
                      <Text style={styles.dayNumber}>{day.dayNumber}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSquare, styles.dayGood]} />
              <Text style={styles.legendText}>Good</Text>
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
              <Text style={styles.legendText}>Rest</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={[styles.legendSquare, styles.dayEmpty]} />
              <Text style={styles.legendText}>No record</Text>
            </View>
          </View>
          <View style={styles.yearNavigation}>
            <Pressable style={styles.yearNavButton} onPress={showPreviousYear}>
              <Text style={styles.yearNavText}>‹ Previous Year</Text>
            </Pressable>

            <Text style={styles.year}>{displayYear}</Text>

            <Pressable style={styles.yearNavButton} onPress={showNextYear}>
              <Text style={styles.yearNavText}>Next Year ›</Text>
            </Pressable>
          </View>

          <Text style={styles.description}>
            Annual driver compliance heatmap · {archivedYearDays.length}{" "}
            recorded {archivedYearDays.length === 1 ? "day" : "days"}
          </Text>
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

  yearNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  yearNavButton: {
    backgroundColor: "#102236",
    borderWidth: 1,
    borderColor: "#183049",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },

  yearNavText: {
    color: "#8ec7ff",
    fontSize: 12,
    fontWeight: "800",
  },

  summary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 16,
    padding: 18,
  },

  summaryItem: {
    flexGrow: 1,
    flexBasis: 130,
    minWidth: 120,
  },

  summaryLabel: {
    color: "#8293a8",
    fontSize: 10,
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

  summaryRest: {
    color: "#5cb1ff",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 5,
  },

  monthsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  dayFuture: {
    opacity: 0.3,
  },

  monthCard: {
    flexGrow: 1,
    flexBasis: "31%",
    minWidth: 280,
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 16,
    padding: 16,
  },

  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  monthName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  monthRecorded: {
    color: "#8293a8",
    fontSize: 10,
    fontWeight: "700",
  },

  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },

  daySquare: {
    width: 31,
    height: 31,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: "#102236",
  },

  dayNumber: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },

  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "center",
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  legendSquare: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },

  legendText: {
    color: "#9cb0c5",
    fontSize: 11,
    fontWeight: "700",
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

  panel: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 16,
    padding: 20,
  },

  year: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
  },

  description: {
    color: "#8293a8",
    fontSize: 13,
    marginTop: 5,
  },
});
