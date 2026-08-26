import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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

const actions = [
  { label: "Driving", value: "03:18", active: true },
  { label: "Break", value: "00:42" },
  { label: "Other Work", value: "01:24" },
  { label: "POA", value: "00:35" },
];

const diaryItems = [
  { label: "Weekly Diary", subtitle: "View this week's driving record" },
  { label: "Monthly Compliance", subtitle: "Heat-map view by day and week" },
  { label: "Yearly Compliance", subtitle: "52-week compliance heat map" },
];

export default function HomeScreen() {
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
            <Text style={styles.timerValue}>03:18</Text>
            <Text style={styles.timerRemaining}>1h 12m remaining</Text>
          </View>

          <Text style={styles.heroHint}>4h 30m continuous driving limit</Text>
        </View>

        <View style={styles.actionGrid}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              style={[
                styles.actionCard,
                action.active && styles.actionCardActive,
              ]}
            >
              <Text
                style={[
                  styles.actionLabel,
                  action.active && styles.actionLabelActive,
                ]}
              >
                {action.label}
              </Text>

              <Text
                style={[
                  styles.actionValue,
                  action.active && styles.actionValueActive,
                ]}
              >
                {action.value}
              </Text>
            </Pressable>
          ))}
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
    fontSize: 46,
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
    fontSize: 28,
    fontWeight: "900",
    marginTop: 10,
  },

  actionValueActive: {
    color: "#67b8ff",
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
