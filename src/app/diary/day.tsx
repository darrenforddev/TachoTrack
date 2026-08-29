import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import {
  createDriverHistoryArchive,
  getDriverDayFromArchive,
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

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }

  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
}

function formatDisplayDate(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatActivityEndTime(startTimestamp: string, endTimestamp: string) {
  const start = new Date(startTimestamp);
  const end = new Date(endTimestamp);

  const formattedEnd = formatTime(endTimestamp);

  const crossesCalendarDay =
    start.getFullYear() !== end.getFullYear() ||
    start.getMonth() !== end.getMonth() ||
    start.getDate() !== end.getDate();

  return crossesCalendarDay ? `${formattedEnd} (+1 day)` : formattedEnd;
}

function getActivityLabel(type: string) {
  switch (type) {
    case "driving":
      return "Driving";

    case "otherWork":
      return "Other Work";

    case "break":
      return "Break";

    case "poa":
      return "POA";

    case "rest":
      return "Rest";

    default:
      return type;
  }
}

export default function DailyDiaryScreen() {
  const params = useLocalSearchParams<{
    date?: string;
  }>();

  const selectedDate =
    typeof params.date === "string"
      ? params.date
      : new Date().toISOString().slice(0, 10);

  const [driverHistoryArchive, setDriverHistoryArchive] = useState(() =>
    createDriverHistoryArchive(),
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrateArchive() {
      const storedArchive = await loadDriverHistoryArchive();

      if (cancelled) {
        return;
      }

      setDriverHistoryArchive(storedArchive);
    }

    void hydrateArchive();

    return () => {
      cancelled = true;
    };
  }, []);

  const driverDay = useMemo(
    () => getDriverDayFromArchive(driverHistoryArchive, selectedDate),
    [driverHistoryArchive, selectedDate],
  );

  const compliance = useMemo(
    () => (driverDay !== null ? evaluateDriverDay(driverDay) : null),
    [driverDay],
  );

  const monthDate = new Date(`${selectedDate}T12:00:00`);

  const monthYear = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();

  if (driverDay === null || compliance === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>TachoTrack</Text>

              <Text style={styles.title}>Daily Record</Text>
            </View>

            <Pressable
              style={styles.backButton}
              onPress={() => router.replace("/")}
            >
              <Text style={styles.backText}>Dashboard</Text>
            </Pressable>
          </View>

          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No archived record</Text>

            <Text style={styles.emptyText}>
              No DriverDay is stored for {formatDisplayDate(selectedDate)}.
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={() =>
                router.push({
                  pathname: "/diary/month",
                  params: {
                    year: String(monthYear),
                    month: String(monthIndex),
                  },
                })
              }
            >
              <Text style={styles.primaryButtonText}>← Back to Month</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const workingMinutes = driverDay.drivingMinutes + driverDay.otherWorkMinutes;

  const timelineActivities = driverDay.activities.map((activity) => {
    const start = new Date(activity.start);
    const end = new Date(activity.end);

    const startMinutes = start.getHours() * 60 + start.getMinutes();

    const rawEndMinutes = end.getHours() * 60 + end.getMinutes();

    const crossesMidnight =
      end.getTime() < start.getTime()
        ? false
        : end.getDate() !== start.getDate() ||
          end.getMonth() !== start.getMonth() ||
          end.getFullYear() !== start.getFullYear();

    const endMinutes = crossesMidnight ? 24 * 60 : rawEndMinutes;

    const leftPercentage = (startMinutes / (24 * 60)) * 100;

    const widthPercentage =
      (Math.max(1, endMinutes - startMinutes) / (24 * 60)) * 100;

    return {
      ...activity,
      leftPercentage,
      widthPercentage,
    };
  });

  const sortedActivities = [...driverDay.activities].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  const firstActivity = sortedActivities[0];
  const lastActivity = sortedActivities[sortedActivities.length - 1];

  const shiftStart =
    firstActivity !== undefined ? formatTime(firstActivity.start) : "—";

  const shiftFinish =
    lastActivity !== undefined ? formatTime(lastActivity.end) : "—";

  const shiftSpanMinutes =
    firstActivity !== undefined && lastActivity !== undefined
      ? Math.max(
          0,
          Math.round(
            (new Date(lastActivity.end).getTime() -
              new Date(firstActivity.start).getTime()) /
              60000,
          ),
        )
      : 0;

  const drivingActivities = sortedActivities.filter(
    (activity) => activity.type === "driving",
  );

  const breakActivities = sortedActivities.filter(
    (activity) => activity.type === "break",
  );

  const longestDrivingMinutes =
    drivingActivities.length > 0
      ? Math.max(
          ...drivingActivities.map((activity) => activity.durationMinutes),
        )
      : 0;

  const longestBreakMinutes =
    breakActivities.length > 0
      ? Math.max(...breakActivities.map((activity) => activity.durationMinutes))
      : 0;

  const timelineLanes = [
    {
      type: "driving",
      label: "Driving",
    },
    {
      type: "otherWork",
      label: "Other Work",
    },
    {
      type: "break",
      label: "Break",
    },
    {
      type: "poa",
      label: "POA",
    },
    {
      type: "rest",
      label: "Rest",
    },
  ] as const;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>TachoTrack</Text>

            <Text style={styles.title}>Daily Record</Text>
          </View>

          <View style={styles.headerRight}>
            <Pressable
              style={styles.backButton}
              onPress={() =>
                router.push({
                  pathname: "/diary/month",
                  params: {
                    year: String(monthYear),
                    month: String(monthIndex),
                  },
                })
              }
            >
              <Text style={styles.backText}>← Month</Text>
            </Pressable>

            <Pressable
              style={styles.backButton}
              onPress={() =>
                router.push({
                  pathname: "/diary/year",
                  params: {
                    year: String(monthYear),
                  },
                })
              }
            >
              <Text style={styles.backText}>Year</Text>
            </Pressable>

            <Pressable
              style={styles.backButton}
              onPress={() => router.replace("/")}
            >
              <Text style={styles.backText}>Dashboard</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.heroPanel}>
          <Text style={styles.heroDate}>{formatDisplayDate(selectedDate)}</Text>

          <View
            style={[
              styles.complianceBadge,
              compliance.level === "good" && styles.complianceGood,
              compliance.level === "warning" && styles.complianceWarning,
              compliance.level === "breach" && styles.complianceBreach,
            ]}
          >
            <Text style={styles.complianceBadgeText}>
              {compliance.level.toUpperCase()} COMPLIANCE
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Driving</Text>

            <Text style={styles.statValue}>
              {formatMinutes(driverDay.drivingMinutes)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Other Work</Text>

            <Text style={styles.statValue}>
              {formatMinutes(driverDay.otherWorkMinutes)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Working Time</Text>

            <Text style={styles.statValue}>
              {formatMinutes(workingMinutes)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Break</Text>

            <Text style={styles.statValue}>
              {formatMinutes(driverDay.breakMinutes)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>POA</Text>

            <Text style={styles.statValue}>
              {formatMinutes(driverDay.poaMinutes)}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Rest</Text>

            <Text style={styles.statValue}>
              {formatMinutes(driverDay.restMinutes)}
            </Text>
          </View>
        </View>

        <View style={styles.timelinePanel}>
          <View>
            <Text style={styles.sectionTitle}>24-Hour Activity Timeline</Text>

            <Text style={styles.timelineSubtitle}>
              Tachograph activity across the complete day
            </Text>
          </View>

          <View style={styles.timelineChart}>
            <View style={styles.timelineScale}>
              {["00", "03", "06", "09", "12", "15", "18", "21", "24"].map(
                (hour) => (
                  <Text key={hour} style={styles.timelineScaleText}>
                    {hour}
                  </Text>
                ),
              )}
            </View>

            {timelineLanes.map((lane) => (
              <View key={lane.type} style={styles.timelineLaneRow}>
                <Text style={styles.timelineLaneLabel}>{lane.label}</Text>

                <View style={styles.timelineLaneTrack}>
                  {[25, 50, 75].map((position) => (
                    <View
                      key={position}
                      style={[
                        styles.timelineGridLine,
                        {
                          left: `${position}%`,
                        },
                      ]}
                    />
                  ))}

                  {timelineActivities
                    .filter((activity) => activity.type === lane.type)
                    .map((activity) => (
                      <View
                        key={activity.id}
                        style={[
                          styles.timelineLaneActivity,

                          activity.type === "driving" && styles.timelineDriving,

                          activity.type === "otherWork" &&
                            styles.timelineOtherWork,

                          activity.type === "break" && styles.timelineBreak,

                          activity.type === "poa" && styles.timelinePoa,

                          activity.type === "rest" && styles.timelineRest,

                          {
                            left: `${activity.leftPercentage}%`,
                            width: `${Math.max(
                              activity.widthPercentage,
                              0.6,
                            )}%`,
                          },
                        ]}
                      />
                    ))}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.timelineLegend}>
            <View style={styles.timelineLegendItem}>
              <View
                style={[styles.timelineLegendDot, styles.timelineDriving]}
              />
              <Text style={styles.timelineLegendText}>Driving</Text>
            </View>

            <View style={styles.timelineLegendItem}>
              <View
                style={[styles.timelineLegendDot, styles.timelineOtherWork]}
              />
              <Text style={styles.timelineLegendText}>Other Work</Text>
            </View>

            <View style={styles.timelineLegendItem}>
              <View style={[styles.timelineLegendDot, styles.timelineBreak]} />
              <Text style={styles.timelineLegendText}>Break</Text>
            </View>

            <View style={styles.timelineLegendItem}>
              <View style={[styles.timelineLegendDot, styles.timelinePoa]} />
              <Text style={styles.timelineLegendText}>POA</Text>
            </View>

            <View style={styles.timelineLegendItem}>
              <View style={[styles.timelineLegendDot, styles.timelineRest]} />
              <Text style={styles.timelineLegendText}>Rest</Text>
            </View>
          </View>
        </View>

        <View style={styles.shiftPanel}>
          <View>
            <Text style={styles.sectionTitle}>Shift Intelligence</Text>

            <Text style={styles.shiftSubtitle}>
              Automatically calculated from the archived activity record
            </Text>
          </View>

          <View style={styles.shiftGrid}>
            <View style={styles.shiftCard}>
              <Text style={styles.shiftLabel}>Shift Start</Text>

              <Text style={styles.shiftValue}>{shiftStart}</Text>
            </View>

            <View style={styles.shiftCard}>
              <Text style={styles.shiftLabel}>Shift Finish</Text>

              <Text style={styles.shiftValue}>{shiftFinish}</Text>
            </View>

            <View style={styles.shiftCard}>
              <Text style={styles.shiftLabel}>Shift Span</Text>

              <Text style={styles.shiftValue}>
                {formatMinutes(shiftSpanMinutes)}
              </Text>
            </View>

            <View style={styles.shiftCard}>
              <Text style={styles.shiftLabel}>Longest Drive</Text>

              <Text style={styles.shiftValue}>
                {formatMinutes(longestDrivingMinutes)}
              </Text>
            </View>

            <View style={styles.shiftCard}>
              <Text style={styles.shiftLabel}>Longest Break</Text>

              <Text style={styles.shiftValue}>
                {formatMinutes(longestBreakMinutes)}
              </Text>
            </View>

            <View style={styles.shiftCard}>
              <Text style={styles.shiftLabel}>Driving Periods</Text>

              <Text style={styles.shiftValue}>{drivingActivities.length}</Text>
            </View>

            <View style={styles.shiftCard}>
              <Text style={styles.shiftLabel}>Break Periods</Text>

              <Text style={styles.shiftValue}>{breakActivities.length}</Text>
            </View>
          </View>
        </View>
        <View style={styles.detailPanel}>
          <Text style={styles.sectionTitle}>Daily Compliance</Text>

          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Daily Rest Type</Text>

              <Text style={styles.detailValue}>{driverDay.dailyRestType}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Extended Driving Used</Text>

              <Text style={styles.detailValue}>
                {driverDay.extendedDrivingUsed ? "Yes" : "No"}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Compliance Level</Text>

              <Text style={styles.detailValue}>{compliance.level}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Compliance Issues</Text>

              <Text style={styles.detailValue}>{compliance.issues.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.detailPanel}>
          <Text style={styles.sectionTitle}>Compliance Issues</Text>

          {compliance.issues.length === 0 ? (
            <View style={styles.goodMessage}>
              <Text style={styles.goodMessageTitle}>
                No compliance issues recorded
              </Text>

              <Text style={styles.goodMessageText}>
                This DriverDay currently evaluates as compliant under the
                TachoTrack daily driving, rest and WTD rules.
              </Text>
            </View>
          ) : (
            compliance.issues.map((issue, index) => (
              <View key={`${issue.id}-${index}`} style={styles.issueCard}>
                <View style={styles.issueHeader}>
                  <Text style={styles.issueCode}>{issue.title}</Text>

                  <Text
                    style={[
                      styles.issueLevel,
                      issue.level === "warning" && styles.issueWarning,
                      issue.level === "breach" && styles.issueBreach,
                    ]}
                  >
                    {issue.level.toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.issueMessage}>{issue.description}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.detailPanel}>
          <Text style={styles.sectionTitle}>Activity Journal</Text>

          {driverDay.activities.length === 0 ? (
            <Text style={styles.emptyText}>
              No individual activity periods are stored for this day.
            </Text>
          ) : (
            driverDay.activities.map((activity, index) => (
              <View
                key={`${activity.start}-${index}`}
                style={styles.activityRow}
              >
                <View style={styles.activityTime}>
                  <Text style={styles.activityTimeText}>
                    {formatTime(activity.start)}
                  </Text>

                  <Text style={styles.activityTimeDivider}>→</Text>

                  <Text style={styles.activityTimeText}>
                    {formatActivityEndTime(activity.start, activity.end)}
                  </Text>
                </View>

                <View style={styles.activityMain}>
                  <Text style={styles.activityType}>
                    {getActivityLabel(activity.type)}
                  </Text>

                  <Text style={styles.activityDuration}>
                    {formatMinutes(activity.durationMinutes)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {driverDay.notes !== undefined && driverDay.notes.length > 0 && (
          <View style={styles.detailPanel}>
            <Text style={styles.sectionTitle}>Driver Notes</Text>

            {driverDay.notes.map((note, index) => (
              <Text key={`${note}-${index}`} style={styles.noteText}>
                • {note}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.auditPanel}>
          <Text style={styles.auditLabel}>RECORD ID</Text>

          <Text style={styles.auditValue}>{driverDay.id}</Text>

          <Text style={styles.auditText}>
            Source: TachoTrack permanent DriverHistoryArchive
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

  shiftPanel: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },

  shiftSubtitle: {
    color: "#718aa2",
    fontSize: 10,
    marginTop: 3,
  },

  shiftGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  shiftCard: {
    flexGrow: 1,
    flexBasis: 125,
    minWidth: 115,
    backgroundColor: "#091726",
    borderWidth: 1,
    borderColor: "#17324d",
    borderRadius: 11,
    padding: 13,
  },

  shiftLabel: {
    color: "#718aa2",
    fontSize: 9,
    fontWeight: "800",
  },

  shiftValue: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 5,
  },

  timelinePanel: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },

  timelineSubtitle: {
    color: "#718aa2",
    fontSize: 10,
    marginTop: 3,
  },

  timelineChart: {
    gap: 6,
  },

  timelineScale: {
    marginLeft: 90,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  timelineScaleText: {
    color: "#718aa2",
    fontSize: 9,
    fontWeight: "700",
  },

  timelineLaneRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  timelineLaneLabel: {
    width: 90,
    paddingRight: 10,
    color: "#9db1c5",
    fontSize: 10,
    fontWeight: "800",
  },

  timelineLaneTrack: {
    flex: 1,
    position: "relative",
    height: 28,
    backgroundColor: "#07121e",
    borderWidth: 1,
    borderColor: "#17324d",
    borderRadius: 6,
    overflow: "hidden",
  },

  timelineGridLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#183049",
  },

  timelineLaneActivity: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 4,
  },

  timelineDriving: {
    backgroundColor: "#e34d4d",
  },

  timelineOtherWork: {
    backgroundColor: "#3487d9",
  },

  timelineBreak: {
    backgroundColor: "#3bb273",
  },

  timelinePoa: {
    backgroundColor: "#d6a63a",
  },

  timelineRest: {
    backgroundColor: "#8a9aaa",
  },

  timelineLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginLeft: 90,
  },

  timelineLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  timelineLegendDot: {
    width: 9,
    height: 9,
    borderRadius: 3,
  },

  timelineLegendText: {
    color: "#9db1c5",
    fontSize: 10,
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
    gap: 16,
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
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
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
  },

  backText: {
    color: "#5cb1ff",
    fontWeight: "800",
    fontSize: 11,
  },

  heroPanel: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },

  heroDate: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "900",
  },

  complianceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },

  complianceGood: {
    backgroundColor: "#176332",
  },

  complianceWarning: {
    backgroundColor: "#8b5a12",
  },

  complianceBreach: {
    backgroundColor: "#7d2328",
  },

  complianceBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  statCard: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 130,
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 14,
    padding: 16,
  },

  statLabel: {
    color: "#8293a8",
    fontSize: 10,
    fontWeight: "700",
  },

  statValue: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 5,
  },

  detailPanel: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },

  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },

  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  detailItem: {
    flexGrow: 1,
    flexBasis: 160,
    minWidth: 140,
    backgroundColor: "#091726",
    borderWidth: 1,
    borderColor: "#17324d",
    borderRadius: 12,
    padding: 13,
  },

  detailLabel: {
    color: "#718aa2",
    fontSize: 10,
    fontWeight: "700",
  },

  detailValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 4,
    textTransform: "capitalize",
  },

  goodMessage: {
    backgroundColor: "#0e2d21",
    borderWidth: 1,
    borderColor: "#1f6244",
    borderRadius: 12,
    padding: 14,
  },

  goodMessageTitle: {
    color: "#54df8c",
    fontSize: 14,
    fontWeight: "900",
  },

  goodMessageText: {
    color: "#a8c4b5",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  issueCard: {
    backgroundColor: "#091726",
    borderWidth: 1,
    borderColor: "#213d56",
    borderRadius: 12,
    padding: 14,
    gap: 7,
  },

  issueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  issueCode: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },

  issueLevel: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },

  issueWarning: {
    color: "#f2b84b",
  },

  issueBreach: {
    color: "#ff6868",
  },

  issueMessage: {
    color: "#9db1c5",
    fontSize: 12,
    lineHeight: 18,
  },

  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#091726",
    borderWidth: 1,
    borderColor: "#17324d",
    borderRadius: 12,
    padding: 13,
  },

  activityTime: {
    width: 125,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  activityTimeText: {
    color: "#8ec7ff",
    fontSize: 11,
    fontWeight: "800",
  },

  activityTimeDivider: {
    color: "#526b82",
    fontSize: 10,
  },

  activityMain: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  activityType: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },

  activityDuration: {
    color: "#9db1c5",
    fontSize: 12,
    fontWeight: "800",
  },

  noteText: {
    color: "#c5d4e4",
    fontSize: 12,
    lineHeight: 19,
  },

  auditPanel: {
    backgroundColor: "#081523",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 14,
    padding: 16,
  },

  auditLabel: {
    color: "#718aa2",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },

  auditValue: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },

  auditText: {
    color: "#718aa2",
    fontSize: 10,
    marginTop: 7,
  },

  emptyPanel: {
    backgroundColor: "#0b1929",
    borderWidth: 1,
    borderColor: "#183049",
    borderRadius: 16,
    padding: 22,
    gap: 12,
  },

  emptyTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },

  emptyText: {
    color: "#8293a8",
    fontSize: 12,
    lineHeight: 18,
  },

  primaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#10375f",
    borderWidth: 1,
    borderColor: "#258cff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
});
