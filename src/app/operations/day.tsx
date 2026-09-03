import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getActiveCustomerOperationsDiary,
  loadCustomerOperationsDiaryArchiveResult,
  type CustomerOperationsDiaryLoadResult,
} from "../../data/customerOperationsDiaryStorage";
import {
  SAMPLE_CUSTOMER_OPERATIONS_NOW,
  sampleCustomerOperationsDiary,
} from "../../data/sampleCustomerOperationsDiary";
import {
  buildCustomerOperationsDiaryPresentation,
  type CustomerOperationsBoxJourneyCard,
  type CustomerOperationsDiaryPresentation,
  type CustomerOperationsVisitCard,
} from "../../engine/customerOperationsDiaryPresentation";
import type { OperationsBoxStage } from "../../engine/customerOperationsDiary";

type OperationsViewMode = "live" | "demo";

const BOX_STEPS = ["Loaded", "Dropped", "Empty", "Collected", "Returned"];

const STAGE_COLORS: Record<OperationsBoxStage, string> = {
  "available-at-location": "#64748b",
  "loaded-on-trailer": "#38bdf8",
  "at-customer-unloading": "#f59e0b",
  "empty-at-customer": "#a855f7",
  "empty-on-trailer": "#0ea5e9",
  "returned-empty": "#22c55e",
};

function formatMinutes(minutes: number | null): string {
  if (minutes === null) {
    return "—";
  }

  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  if (hours === 0) {
    return `${remainder}m`;
  }

  return `${hours}h ${remainder.toString().padStart(2, "0")}m`;
}

function formatTime(timestamp: string | null): string {
  if (timestamp === null) {
    return "—";
  }

  return new Date(timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateString: string): string {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function closeScreen(): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace("/");
}

function MetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <View style={[styles.metricCard, { borderTopColor: accent }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricDetail} numberOfLines={1}>
        {detail}
      </Text>
    </View>
  );
}

function VisitCard({ visit }: { visit: CustomerOperationsVisitCard }) {
  const accent = visit.active
    ? "#22c55e"
    : visit.locationType === "customer"
      ? "#a855f7"
      : "#38bdf8";

  return (
    <View
      style={[
        styles.visitCard,
        { borderTopColor: accent },
        visit.active ? styles.visitCardActive : null,
      ]}
    >
      <View style={styles.visitTopRow}>
        <Text style={[styles.visitSequence, { color: accent }]}>
          STOP {visit.sequence}
        </Text>
        {visit.active ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>HERE NOW</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.visitName} numberOfLines={2}>
        {visit.locationName}
      </Text>
      <Text style={styles.visitMeta}>
        {visit.locationType.toUpperCase()}
        {visit.postcode === null ? "" : ` · ${visit.postcode}`}
      </Text>
      <View style={styles.visitTimeRow}>
        <Text style={styles.visitClock}>{formatTime(visit.arrivedAt)}</Text>
        <View style={[styles.routeLine, { backgroundColor: accent }]} />
        <Text style={styles.visitClock}>{formatTime(visit.departedAt)}</Text>
      </View>
      <Text style={[styles.visitDuration, { color: accent }]}>
        {formatMinutes(visit.durationMinutes)} on site
      </Text>
    </View>
  );
}

function BoxJourneyCard({ box }: { box: CustomerOperationsBoxJourneyCard }) {
  const accent = STAGE_COLORS[box.stage];

  return (
    <View style={[styles.boxCard, { borderLeftColor: accent }]}>
      <View style={styles.boxHeader}>
        <View>
          <Text style={styles.boxNumber}>{box.number}</Text>
          <Text style={styles.boxMeta}>
            {box.isoType ?? "Type not entered"}
            {box.sealNumber === null ? "" : ` · Seal ${box.sealNumber}`}
          </Text>
        </View>
        <View style={[styles.stageBadge, { borderColor: accent }]}>
          <Text style={[styles.stageBadgeText, { color: accent }]}>
            {box.stageLabel.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.boxStepRow}>
        {BOX_STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const complete = box.completedSteps >= stepNumber;

          return (
            <View key={step} style={styles.boxStep}>
              <View
                style={[
                  styles.boxStepDot,
                  complete
                    ? { backgroundColor: accent, borderColor: accent }
                    : null,
                ]}
              />
              <Text
                style={[
                  styles.boxStepText,
                  complete ? { color: "#dbeafe" } : null,
                ]}
              >
                {step}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.boxTimingGrid}>
        <View style={styles.boxTimingCell}>
          <Text style={styles.boxTimingLabel}>UNLOAD TIME</Text>
          <Text style={styles.boxTimingValue}>
            {formatMinutes(box.unloadingElapsedMinutes)}
          </Text>
        </View>
        <View style={styles.boxTimingCell}>
          <Text style={styles.boxTimingLabel}>DRIVER PRESENT</Text>
          <Text style={styles.boxTimingValue}>
            {formatMinutes(box.driverPresentDuringUnloadingMinutes)}
          </Text>
        </View>
        <View style={styles.boxTimingCell}>
          <Text style={styles.boxTimingLabel}>FULL TURNAROUND</Text>
          <Text style={[styles.boxTimingValue, { color: accent }]}>
            {formatMinutes(box.fullCycleMinutes)}
          </Text>
        </View>
      </View>

      <View style={styles.boxFooter}>
        <Text style={styles.boxFooterText}>
          Loaded {formatTime(box.loadedCollectedAt)}
        </Text>
        <Text style={styles.boxFooterText}>
          Empty {formatTime(box.emptyReadyAt)}
        </Text>
        <Text style={styles.boxFooterText}>
          Returned {formatTime(box.returnedAt)}
        </Text>
      </View>
    </View>
  );
}

function EmptyLiveState({
  loadResult,
}: {
  loadResult: CustomerOperationsDiaryLoadResult | null;
}) {
  const invalid = loadResult?.status === "invalid";

  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIcon,
          invalid ? styles.emptyIconInvalid : null,
        ]}
      >
        <Text style={styles.emptyIconText}>{invalid ? "!" : "+"}</Text>
      </View>
      <Text style={styles.emptyTitle}>
        {invalid ? "Stored diary needs attention" : "No active operations diary"}
      </Text>
      <Text style={styles.emptyText}>
        {invalid
          ? "TachoTrack protected the stored evidence and did not overwrite it."
          : "When a live duty diary is started, the current site, trailer and every box journey will appear here."}
      </Text>
      {loadResult?.issues.map((issue) => (
        <Text key={`${issue.code}-${issue.diaryId ?? "archive"}`} style={styles.issueText}>
          {issue.message}
        </Text>
      ))}
    </View>
  );
}

function OperationsContent({
  presentation,
}: {
  presentation: CustomerOperationsDiaryPresentation;
}) {
  return (
    <>
      <View style={styles.metricsRow}>
        <MetricCard
          label="CURRENT SITE"
          value={presentation.currentLocationName ?? "Travelling"}
          detail={
            presentation.currentVisitMinutes === null
              ? "No active site visit"
              : `${formatMinutes(presentation.currentVisitMinutes)} at this stop`
          }
          accent="#38bdf8"
        />
        <MetricCard
          label="TRAILER"
          value={presentation.currentTrailerNumber ?? "None attached"}
          detail={presentation.tractorRegistration ?? "Tractor not entered"}
          accent="#a855f7"
        />
        <MetricCard
          label="BOX FLOW"
          value={`${presentation.completedBoxCycles} returned`}
          detail={`${presentation.activeUnloadingBoxes} unloading · ${presentation.emptyBoxesReady} ready`}
          accent="#22c55e"
        />
        <MetricCard
          label="SITE TIME"
          value={formatMinutes(presentation.totalDriverSiteMinutes)}
          detail={`${presentation.totalVisits} separate visits recorded`}
          accent="#f59e0b"
        />
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Today&apos;s site journey</Text>
            <Text style={styles.sectionSubtitle}>
              Every return to the same customer remains a separate auditable visit
            </Text>
          </View>
          <View style={styles.sectionPill}>
            <Text style={styles.sectionPillText}>
              {presentation.customerVisits} CUSTOMER · {presentation.portVisits} PORT
            </Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.visitStrip}
        >
          {presentation.visits.map((visit) => (
            <VisitCard key={visit.id} visit={visit} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Box journeys</Text>
            <Text style={styles.sectionSubtitle}>
              Loaded collection to empty return, tracked independently
            </Text>
          </View>
          <View style={[styles.sectionPill, styles.sectionPillGreen]}>
            <Text style={styles.sectionPillGreenText}>
              {presentation.completedBoxCycles}/{presentation.boxes.length} COMPLETE
            </Text>
          </View>
        </View>
        <View style={styles.boxGrid}>
          {presentation.boxes.map((box) => (
            <BoxJourneyCard key={box.id} box={box} />
          ))}
        </View>
      </View>

      <View style={styles.lowerGrid}>
        <View style={[styles.sectionCard, styles.timeSection]}>
          <Text style={styles.sectionTitle}>Where the duty time went</Text>
          <Text style={styles.sectionSubtitle}>
            Driver presence is kept separate from unattended unloading
          </Text>
          <View style={styles.timeBars}>
            <View style={styles.timeBarRow}>
              <View style={styles.timeBarLabels}>
                <Text style={styles.timeBarName}>Customer sites</Text>
                <Text style={styles.timeBarValue}>
                  {formatMinutes(presentation.totalCustomerMinutes)}
                </Text>
              </View>
              <View style={styles.timeBarTrack}>
                <View
                  style={[
                    styles.timeBarFill,
                    {
                      width: `${Math.min(
                        100,
                        presentation.totalDriverSiteMinutes === 0
                          ? 0
                          : (presentation.totalCustomerMinutes /
                              presentation.totalDriverSiteMinutes) *
                              100,
                      )}%`,
                      backgroundColor: "#a855f7",
                    },
                  ]}
                />
              </View>
            </View>
            <View style={styles.timeBarRow}>
              <View style={styles.timeBarLabels}>
                <Text style={styles.timeBarName}>Port and depot</Text>
                <Text style={styles.timeBarValue}>
                  {formatMinutes(presentation.totalPortMinutes)}
                </Text>
              </View>
              <View style={styles.timeBarTrack}>
                <View
                  style={[
                    styles.timeBarFill,
                    {
                      width: `${Math.min(
                        100,
                        presentation.totalDriverSiteMinutes === 0
                          ? 0
                          : (presentation.totalPortMinutes /
                              presentation.totalDriverSiteMinutes) *
                              100,
                      )}%`,
                      backgroundColor: "#38bdf8",
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.sectionCard, styles.timelineSection]}>
          <Text style={styles.sectionTitle}>Latest evidence</Text>
          <Text style={styles.sectionSubtitle}>
            Most recent operational events
          </Text>
          <View style={styles.timelineList}>
            {presentation.timeline
              .slice(-6)
              .reverse()
              .map((item) => (
                <View key={item.id} style={styles.timelineRow}>
                  <Text style={styles.timelineTime}>
                    {formatTime(item.occurredAt)}
                  </Text>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineCopy}>
                    <Text style={styles.timelineTitle}>{item.title}</Text>
                    {item.detail === null ? null : (
                      <Text style={styles.timelineDetail} numberOfLines={1}>
                        {item.detail}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
          </View>
        </View>
      </View>
    </>
  );
}

export default function CustomerOperationsDiaryScreen() {
  const [mode, setMode] = useState<OperationsViewMode>("live");
  const [liveNow, setLiveNow] = useState(() => Date.now());
  const [loadResult, setLoadResult] =
    useState<CustomerOperationsDiaryLoadResult | null>(null);

  const hydrate = useCallback(async () => {
    const loaded = await loadCustomerOperationsDiaryArchiveResult();

    setLoadResult(loaded);
    setLiveNow(Date.now());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const loaded = await loadCustomerOperationsDiaryArchiveResult();

      if (!cancelled) {
        setLoadResult(loaded);
        setLiveNow(Date.now());
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const diary =
    mode === "demo"
      ? sampleCustomerOperationsDiary
      : loadResult === null
        ? null
        : getActiveCustomerOperationsDiary(loadResult.archive);
  const presentation = useMemo(
    () =>
      diary === null
        ? null
        : buildCustomerOperationsDiaryPresentation(
            diary,
            mode === "demo" ? SAMPLE_CUSTOMER_OPERATIONS_NOW : liveNow,
          ),
    [diary, liveNow, mode],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>TACHOTRACK LIVE</Text>
            <Text style={styles.title}>Customer Operations Diary</Text>
            <Text style={styles.subtitle}>
              {presentation === null
                ? "Live trailer, box and customer evidence"
                : `${formatDate(presentation.dutyDate)} · updated ${formatTime(
                    presentation.occurredAt,
                  )}`}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.modeSwitch}>
              <Pressable
                style={[
                  styles.modeButton,
                  mode === "live" ? styles.modeButtonActive : null,
                ]}
                onPress={() => setMode("live")}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === "live" ? styles.modeButtonTextActive : null,
                  ]}
                >
                  Live
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modeButton,
                  mode === "demo" ? styles.modeButtonActive : null,
                ]}
                onPress={() => setMode("demo")}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === "demo" ? styles.modeButtonTextActive : null,
                  ]}
                >
                  Demo Day
                </Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.recordButton}
              onPress={() => router.push("/operations/record")}
            >
              <Text style={styles.recordButtonText}>Record</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => void hydrate()}>
              <Text style={styles.actionButtonText}>Refresh</Text>
            </Pressable>
            <Pressable style={styles.closeButton} onPress={closeScreen}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>

        {presentation === null ? (
          <EmptyLiveState loadResult={loadResult} />
        ) : (
          <OperationsContent presentation={presentation} />
        )}

        <Text style={styles.footerNote}>
          Read-only audit view · use Record to add timestamped operational evidence
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020817",
  },
  page: {
    padding: 16,
    gap: 12,
    backgroundColor: "#020817",
  },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  headerCopy: {
    flexShrink: 1,
  },
  eyebrow: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  title: {
    color: "#f8fafc",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 5,
  },
  subtitle: {
    color: "#7891b2",
    fontSize: 12,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modeSwitch: {
    flexDirection: "row",
    padding: 3,
    borderWidth: 1,
    borderColor: "#25415f",
    borderRadius: 12,
    backgroundColor: "#071426",
  },
  modeButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9,
  },
  modeButtonActive: {
    backgroundColor: "#0ea5e9",
  },
  modeButtonText: {
    color: "#7891b2",
    fontSize: 12,
    fontWeight: "800",
  },
  modeButtonTextActive: {
    color: "#ffffff",
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#25415f",
    borderRadius: 12,
    backgroundColor: "#071426",
  },
  actionButtonText: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "900",
  },
  recordButton: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#22c55e",
    borderRadius: 12,
    backgroundColor: "#14532d",
  },
  recordButtonText: {
    color: "#dcfce7",
    fontSize: 12,
    fontWeight: "900",
  },
  closeButton: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  closeButtonText: {
    color: "#071426",
    fontSize: 12,
    fontWeight: "900",
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: 220,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1b3551",
    borderTopWidth: 3,
    borderRadius: 14,
    backgroundColor: "#081628",
  },
  metricLabel: {
    color: "#6782a3",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  metricValue: {
    color: "#f8fafc",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 8,
  },
  metricDetail: {
    color: "#8ba4c1",
    fontSize: 11,
    marginTop: 5,
  },
  sectionCard: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#1b3551",
    borderRadius: 16,
    backgroundColor: "#061324",
  },
  sectionHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 13,
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: "#6f89a8",
    fontSize: 11,
    marginTop: 4,
  },
  sectionPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#155e75",
    backgroundColor: "#083344",
  },
  sectionPillText: {
    color: "#67e8f9",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  sectionPillGreen: {
    borderColor: "#166534",
    backgroundColor: "#052e1b",
  },
  sectionPillGreenText: {
    color: "#4ade80",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  visitStrip: {
    gap: 9,
    paddingBottom: 2,
  },
  visitCard: {
    width: 180,
    minHeight: 150,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1b3551",
    borderTopWidth: 3,
    borderRadius: 12,
    backgroundColor: "#091a2e",
  },
  visitCardActive: {
    borderColor: "#22c55e",
    backgroundColor: "#08261c",
  },
  visitTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  visitSequence: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  liveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#166534",
  },
  liveBadgeText: {
    color: "#86efac",
    fontSize: 7,
    fontWeight: "900",
  },
  visitName: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 17,
    marginTop: 9,
    minHeight: 34,
  },
  visitMeta: {
    color: "#6f89a8",
    fontSize: 8,
    fontWeight: "800",
    marginTop: 3,
  },
  visitTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  visitClock: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "800",
  },
  routeLine: {
    flex: 1,
    height: 2,
    borderRadius: 2,
    opacity: 0.7,
  },
  visitDuration: {
    fontSize: 10,
    fontWeight: "900",
    marginTop: 9,
  },
  boxGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  boxCard: {
    flex: 1,
    minWidth: 420,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1b3551",
    borderLeftWidth: 4,
    borderRadius: 13,
    backgroundColor: "#091a2e",
  },
  boxHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  boxNumber: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  boxMeta: {
    color: "#7891b2",
    fontSize: 10,
    marginTop: 3,
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 999,
  },
  stageBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  boxStepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    gap: 5,
  },
  boxStep: {
    flex: 1,
    alignItems: "center",
    gap: 5,
  },
  boxStepDot: {
    width: 10,
    height: 10,
    borderWidth: 2,
    borderColor: "#334c68",
    borderRadius: 999,
    backgroundColor: "#071426",
  },
  boxStepText: {
    color: "#58718f",
    fontSize: 8,
    fontWeight: "800",
  },
  boxTimingGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  boxTimingCell: {
    flex: 1,
    padding: 9,
    borderRadius: 9,
    backgroundColor: "#071426",
  },
  boxTimingLabel: {
    color: "#5f7a9b",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  boxTimingValue: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },
  boxFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 12,
  },
  boxFooterText: {
    color: "#7891b2",
    fontSize: 9,
    fontWeight: "700",
  },
  lowerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  timeSection: {
    flex: 1,
    minWidth: 430,
  },
  timelineSection: {
    flex: 1,
    minWidth: 430,
  },
  timeBars: {
    gap: 18,
    marginTop: 20,
  },
  timeBarRow: {
    gap: 7,
  },
  timeBarLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeBarName: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "800",
  },
  timeBarValue: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "900",
  },
  timeBarTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#152a43",
  },
  timeBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  timelineList: {
    gap: 9,
    marginTop: 14,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  timelineTime: {
    width: 36,
    color: "#38bdf8",
    fontSize: 9,
    fontWeight: "900",
    paddingTop: 2,
  },
  timelineDot: {
    width: 7,
    height: 7,
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: "#22c55e",
  },
  timelineCopy: {
    flex: 1,
  },
  timelineTitle: {
    color: "#dbeafe",
    fontSize: 10,
    fontWeight: "800",
  },
  timelineDetail: {
    color: "#647f9f",
    fontSize: 9,
    marginTop: 2,
  },
  emptyState: {
    minHeight: 440,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    borderWidth: 1,
    borderColor: "#1b3551",
    borderRadius: 16,
    backgroundColor: "#061324",
  },
  emptyIcon: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0ea5e9",
    borderRadius: 999,
    backgroundColor: "#082f49",
  },
  emptyIconInvalid: {
    borderColor: "#fb7185",
    backgroundColor: "#4c0519",
  },
  emptyIconText: {
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "500",
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 18,
  },
  emptyText: {
    maxWidth: 560,
    color: "#7891b2",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
  issueText: {
    maxWidth: 650,
    color: "#fda4af",
    fontSize: 10,
    textAlign: "center",
    marginTop: 8,
  },
  footerNote: {
    color: "#3f5877",
    fontSize: 9,
    textAlign: "center",
    marginTop: 2,
  },
});
