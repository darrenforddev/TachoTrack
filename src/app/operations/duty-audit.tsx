import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  loadManualDutyBoundaryStateResult,
  type ManualDutyBoundaryLoadResult,
} from "../../data/manualDutyBoundaryStorage";
import {
  createManualDutyBoundaryState,
  type ManualDutyBoundary,
} from "../../engine/manualDutyBoundary";
import {
  buildManualDutyAuditArchive,
  type ManualDutyAuditDay,
  type ManualDutyAuditEntry,
} from "../../engine/manualDutyBoundaryAudit";

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(value: number): string {
  const minutes = Math.max(0, Math.floor(value));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return hours === 0
    ? `${remainder}m`
    : `${hours}h ${remainder.toString().padStart(2, "0")}m`;
}

function statusLabel(status: ManualDutyAuditDay["status"]): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "start-recorded":
      return "Start recorded";
    case "finish-recorded":
      return "Finish recorded";
    case "empty":
      return "No effective evidence";
  }
}

function boundaryEntries(
  day: ManualDutyAuditDay,
  boundary: ManualDutyBoundary,
): ManualDutyAuditEntry[] {
  return day.entries
    .filter((entry) => entry.boundary === boundary)
    .slice()
    .reverse();
}

function EvidenceCard({ entry }: { entry: ManualDutyAuditEntry }) {
  const effective = entry.status === "effective";

  return (
    <View
      style={[
        styles.evidenceCard,
        effective ? styles.evidenceCardEffective : styles.evidenceCardSuperseded,
      ]}
    >
      <View style={styles.evidenceHeader}>
        <View style={styles.evidenceHeading}>
          <Text style={styles.revisionLabel}>{entry.revisionLabel}</Text>
          <Text style={styles.activityTitle}>{entry.activityLabel}</Text>
        </View>
        <View
          style={[
            styles.evidenceStatus,
            effective ? styles.statusEffective : styles.statusSuperseded,
          ]}
        >
          <Text
            style={[
              styles.evidenceStatusText,
              effective
                ? styles.statusEffectiveText
                : styles.statusSupersededText,
            ]}
          >
            {effective ? "EFFECTIVE" : "SUPERSEDED"}
          </Text>
        </View>
      </View>

      <View style={styles.modeRow}>
        <Text style={styles.modeText}>{entry.tachographMode}</Text>
        <Text style={styles.durationText}>{formatMinutes(entry.durationMinutes)}</Text>
      </View>

      <View style={styles.timeRoute}>
        <View style={styles.timePoint} />
        <View style={styles.timeCopy}>
          <Text style={styles.timeLabel}>FROM</Text>
          <Text style={styles.timeValue}>{formatTimestamp(entry.startedAt)}</Text>
        </View>
        <View style={styles.timeLine} />
        <View style={styles.timePoint} />
        <View style={styles.timeCopy}>
          <Text style={styles.timeLabel}>TO</Text>
          <Text style={styles.timeValue}>{formatTimestamp(entry.endedAt)}</Text>
        </View>
      </View>

      <View style={styles.detailGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>REASON</Text>
          <Text style={styles.detailValue}>{entry.reasonLabel}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>SOURCE</Text>
          <Text style={styles.detailValue}>{entry.sourceLabel}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>RECORDED</Text>
          <Text style={styles.detailValue}>{formatTimestamp(entry.recordedAt)}</Text>
        </View>
      </View>

      {entry.note === null ? null : (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>SUPPORTING NOTE</Text>
          <Text style={styles.noteText}>{entry.note}</Text>
        </View>
      )}

      {entry.adjustment === null ? null : (
        <View style={styles.adjustmentBox}>
          <Text style={styles.adjustmentTitle}>MANUAL ACTIVITY ADJUSTED</Text>
          <Text style={styles.adjustmentSummary}>
            {entry.adjustment.eventCount} manual activit
            {entry.adjustment.eventCount === 1 ? "y" : "ies"} · {formatMinutes(entry.adjustment.totalOverlapMinutes)} overlap
          </Text>
          {entry.adjustment.conflicts.map((conflict) => (
            <Text key={conflict.eventId} style={styles.adjustmentDetail}>
              {conflict.activity.toUpperCase()} · {formatTimestamp(conflict.overlapStartedAt)}–{formatTimestamp(conflict.overlapEndedAt)}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.chainRow}>
        <Text style={styles.chainText}>
          {entry.revisesEvidenceId === null
            ? "Beginning of revision chain"
            : `Revises ${entry.revisesEvidenceId}`}
        </Text>
        <Text style={styles.evidenceId}>ID {entry.evidenceId}</Text>
      </View>
    </View>
  );
}

function BoundaryColumn({
  title,
  subtitle,
  entries,
  accent,
}: {
  title: string;
  subtitle: string;
  entries: ManualDutyAuditEntry[];
  accent: "blue" | "green";
}) {
  return (
    <View
      style={[
        styles.boundaryColumn,
        accent === "blue" ? styles.boundaryBlue : styles.boundaryGreen,
      ]}
    >
      <Text style={styles.boundaryEyebrow}>{subtitle}</Text>
      <Text style={styles.boundaryTitle}>{title}</Text>
      <Text style={styles.boundaryCount}>
        {entries.length} protected record{entries.length === 1 ? "" : "s"}
      </Text>
      <View style={styles.evidenceList}>
        {entries.length === 0 ? (
          <View style={styles.emptyBoundary}>
            <Text style={styles.emptyBoundaryText}>No evidence recorded</Text>
          </View>
        ) : (
          entries.map((entry) => <EvidenceCard key={entry.evidenceId} entry={entry} />)
        )}
      </View>
    </View>
  );
}

export default function ManualDutyAuditScreen() {
  const [loadResult, setLoadResult] = useState<ManualDutyBoundaryLoadResult>({
    status: "empty",
    state: createManualDutyBoundaryState(),
    savedAt: null,
    issues: [],
  });
  const [selectedDutyDate, setSelectedDutyDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const archive = useMemo(
    () => buildManualDutyAuditArchive(loadResult.state),
    [loadResult.state],
  );
  const selectedDay =
    archive.days.find((day) => day.dutyDate === selectedDutyDate) ??
    archive.days[0] ??
    null;

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const loaded = await loadManualDutyBoundaryStateResult();
      const nextArchive = buildManualDutyAuditArchive(loaded.state);

      setLoadResult(loaded);
      setSelectedDutyDate((current) =>
        current !== null && nextArchive.days.some((day) => day.dutyDate === current)
          ? current
          : nextArchive.days[0]?.dutyDate ?? null,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Protected duty evidence could not be loaded.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function closeScreen(): void {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/operations/duty-boundary");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            <Image
              source={require("../../../assets/branding/tachotrack-header-logo.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="TachoTrack"
            />
            <View>
              <Text style={styles.eyebrow}>PROTECTED EVIDENCE</Text>
              <Text style={styles.title}>Duty Audit Trail</Text>
              <Text style={styles.subtitle}>
                Original entries and every correction remain visible
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerButton}
              onPress={() => router.replace("/operations/duty-boundary")}
            >
              <Text style={styles.headerButtonText}>Actual Duty Times</Text>
            </Pressable>
            <Pressable style={styles.headerButton} onPress={() => void refresh()}>
              <Text style={styles.headerButtonText}>Refresh</Text>
            </Pressable>
            <Pressable style={styles.closeButton} onPress={closeScreen}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.auditBanner}>
          <View style={styles.shieldIcon}>
            <Text style={styles.shieldText}>✓</Text>
          </View>
          <View style={styles.auditBannerCopy}>
            <Text style={styles.auditBannerTitle}>Append-only audit history</Text>
            <Text style={styles.auditBannerText}>
              Corrections supersede earlier entries; they never erase them. This
              is a read-only evidence view and does not replace the tachograph record.
            </Text>
          </View>
          <View style={styles.readOnlyBadge}>
            <Text style={styles.readOnlyBadgeText}>READ ONLY</Text>
          </View>
        </View>

        {error === null ? null : (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>! {error}</Text>
          </View>
        )}
        {loadResult.issues.length === 0 ? null : (
          <View style={styles.recoveryBanner}>
            <Text style={styles.recoveryTitle}>RECOVERED STORAGE WARNING</Text>
            {loadResult.issues.map((issue, index) => (
              <Text key={`${issue.code}-${index}`} style={styles.recoveryText}>
                {issue.message}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.summaryCyan]}>
            <Text style={styles.summaryLabel}>DUTY DAYS</Text>
            <Text style={styles.summaryValue}>{archive.dutyDayCount}</Text>
            <Text style={styles.summaryDetail}>with protected evidence</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryGreen]}>
            <Text style={styles.summaryLabel}>EFFECTIVE ENTRIES</Text>
            <Text style={styles.summaryValue}>{archive.effectiveEvidenceCount}</Text>
            <Text style={styles.summaryDetail}>{archive.evidenceCount} total records retained</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryAmber]}>
            <Text style={styles.summaryLabel}>CORRECTIONS</Text>
            <Text style={styles.summaryValue}>{archive.correctionCount}</Text>
            <Text style={styles.summaryDetail}>original evidence preserved</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryPurple]}>
            <Text style={styles.summaryLabel}>MANUAL ADJUSTMENTS</Text>
            <Text style={styles.summaryValue}>{archive.adjustedActivityCount}</Text>
            <Text style={styles.summaryDetail}>{formatMinutes(archive.adjustedOverlapMinutes)} recorded overlap</Text>
          </View>
        </View>

        <View style={styles.dateSection}>
          <View>
            <Text style={styles.sectionTitle}>Evidence by duty date</Text>
            <Text style={styles.sectionSubtitle}>Select a date to inspect its complete revision history</Text>
          </View>
          <ScrollView horizontal contentContainerStyle={styles.dateList}>
            {archive.days.map((day) => {
              const selected = day.dutyDate === selectedDay?.dutyDate;

              return (
                <Pressable
                  key={day.dutyDate}
                  onPress={() => setSelectedDutyDate(day.dutyDate)}
                  style={[styles.dateChip, selected ? styles.dateChipSelected : null]}
                >
                  <Text style={[styles.dateChipDate, selected ? styles.dateChipDateSelected : null]}>
                    {formatDate(day.dutyDate)}
                  </Text>
                  <Text style={styles.dateChipMeta}>
                    {statusLabel(day.status)} · {day.evidenceCount} record{day.evidenceCount === 1 ? "" : "s"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {busy ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Loading protected evidence…</Text>
          </View>
        ) : selectedDay === null ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No manual-duty evidence yet</Text>
            <Text style={styles.emptyText}>Saved start and finish entries will appear here automatically.</Text>
          </View>
        ) : (
          <View style={styles.dayPanel}>
            <View style={styles.dayHeader}>
              <View>
                <Text style={styles.dayEyebrow}>SELECTED DUTY</Text>
                <Text style={styles.dayTitle}>{formatDate(selectedDay.dutyDate)}</Text>
              </View>
              <View style={styles.dayMetrics}>
                <View style={styles.dayMetric}>
                  <Text style={styles.dayMetricValue}>{formatMinutes(selectedDay.effectiveActivityMinutes)}</Text>
                  <Text style={styles.dayMetricLabel}>effective activity</Text>
                </View>
                <View style={styles.dayMetric}>
                  <Text style={styles.dayMetricValue}>{selectedDay.correctionCount}</Text>
                  <Text style={styles.dayMetricLabel}>corrections</Text>
                </View>
                <View style={styles.dayStatusBadge}>
                  <Text style={styles.dayStatusText}>{statusLabel(selectedDay.status).toUpperCase()}</Text>
                </View>
              </View>
            </View>

            <View style={styles.boundaryGrid}>
              <BoundaryColumn
                title="Before card insertion"
                subtitle="START OF DUTY"
                entries={boundaryEntries(selectedDay, "before-card-insertion")}
                accent="blue"
              />
              <BoundaryColumn
                title="After card ejection"
                subtitle="END OF DUTY"
                entries={boundaryEntries(selectedDay, "after-card-ejection")}
                accent="green"
              />
            </View>
          </View>
        )}

        <Text style={styles.footerNote}>
          Audit evidence is immutable · effective entries drive compliance totals · tachograph entry remains legally required
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020817" },
  page: { padding: 16, gap: 12, backgroundColor: "#020817" },
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 },
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 14, flexShrink: 1 },
  logo: { width: 148, height: 50 },
  eyebrow: { color: "#38bdf8", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: "#f8fafc", fontSize: 25, fontWeight: "900", marginTop: 3 },
  subtitle: { color: "#7891b2", fontSize: 10, marginTop: 2 },
  headerActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  headerButton: { paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: "#25415f", borderRadius: 10, backgroundColor: "#071426" },
  headerButtonText: { color: "#38bdf8", fontSize: 9, fontWeight: "900" },
  closeButton: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 10, backgroundColor: "#f1f5f9" },
  closeButtonText: { color: "#071426", fontSize: 9, fontWeight: "900" },
  auditBanner: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderColor: "#166534", borderRadius: 14, backgroundColor: "#052e1b" },
  shieldIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#22c55e" },
  shieldText: { color: "#052e1b", fontSize: 17, fontWeight: "900" },
  auditBannerCopy: { flex: 1, minWidth: 240 },
  auditBannerTitle: { color: "#dcfce7", fontSize: 12, fontWeight: "900" },
  auditBannerText: { color: "#86cfa3", fontSize: 9, lineHeight: 14, marginTop: 3 },
  readOnlyBadge: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#22c55e", borderRadius: 999 },
  readOnlyBadgeText: { color: "#4ade80", fontSize: 8, fontWeight: "900" },
  errorBanner: { padding: 10, borderWidth: 1, borderColor: "#be123c", borderRadius: 10, backgroundColor: "#3f0718" },
  errorText: { color: "#fb7185", fontSize: 10, fontWeight: "800" },
  recoveryBanner: { padding: 12, borderWidth: 1, borderColor: "#f59e0b", borderRadius: 10, backgroundColor: "#291b03" },
  recoveryTitle: { color: "#fbbf24", fontSize: 9, fontWeight: "900" },
  recoveryText: { color: "#f7df9c", fontSize: 9, marginTop: 4 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { flex: 1, minWidth: 190, padding: 14, borderWidth: 1, borderColor: "#1b3551", borderTopWidth: 3, borderRadius: 14, backgroundColor: "#081628" },
  summaryCyan: { borderTopColor: "#38bdf8" },
  summaryGreen: { borderTopColor: "#22c55e" },
  summaryAmber: { borderTopColor: "#f59e0b" },
  summaryPurple: { borderTopColor: "#a855f7" },
  summaryLabel: { color: "#6782a3", fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  summaryValue: { color: "#f8fafc", fontSize: 23, fontWeight: "900", marginTop: 7 },
  summaryDetail: { color: "#7891b2", fontSize: 8, marginTop: 4 },
  dateSection: { gap: 10, padding: 14, borderWidth: 1, borderColor: "#1b3551", borderRadius: 14, backgroundColor: "#071426" },
  sectionTitle: { color: "#f8fafc", fontSize: 15, fontWeight: "900" },
  sectionSubtitle: { color: "#6782a3", fontSize: 9, marginTop: 3 },
  dateList: { gap: 7 },
  dateChip: { minWidth: 180, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderColor: "#29445f", borderRadius: 9, backgroundColor: "#081628" },
  dateChipSelected: { borderColor: "#38bdf8", backgroundColor: "#083344" },
  dateChipDate: { color: "#b5c4d8", fontSize: 9, fontWeight: "900" },
  dateChipDateSelected: { color: "#e0f2fe" },
  dateChipMeta: { color: "#6782a3", fontSize: 7, marginTop: 4 },
  emptyState: { alignItems: "center", padding: 34, borderWidth: 1, borderColor: "#1b3551", borderRadius: 14, backgroundColor: "#071426" },
  emptyTitle: { color: "#f8fafc", fontSize: 15, fontWeight: "900" },
  emptyText: { color: "#7891b2", fontSize: 9, marginTop: 6 },
  dayPanel: { gap: 12, padding: 14, borderWidth: 1, borderColor: "#1b3551", borderRadius: 15, backgroundColor: "#071426" },
  dayHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  dayEyebrow: { color: "#38bdf8", fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  dayTitle: { color: "#f8fafc", fontSize: 19, fontWeight: "900", marginTop: 4 },
  dayMetrics: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 },
  dayMetric: { alignItems: "flex-end" },
  dayMetricValue: { color: "#f8fafc", fontSize: 13, fontWeight: "900" },
  dayMetricLabel: { color: "#6782a3", fontSize: 7, marginTop: 2 },
  dayStatusBadge: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#22c55e", borderRadius: 999, backgroundColor: "#052e1b" },
  dayStatusText: { color: "#4ade80", fontSize: 8, fontWeight: "900" },
  boundaryGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 12 },
  boundaryColumn: { flex: 1, minWidth: 390, padding: 13, borderWidth: 1, borderColor: "#1b3551", borderTopWidth: 3, borderRadius: 13, backgroundColor: "#081628" },
  boundaryBlue: { borderTopColor: "#38bdf8" },
  boundaryGreen: { borderTopColor: "#22c55e" },
  boundaryEyebrow: { color: "#6782a3", fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  boundaryTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900", marginTop: 4 },
  boundaryCount: { color: "#7891b2", fontSize: 8, marginTop: 3 },
  evidenceList: { gap: 8, marginTop: 11 },
  evidenceCard: { padding: 12, borderWidth: 1, borderLeftWidth: 3, borderRadius: 11, backgroundColor: "#061222" },
  evidenceCardEffective: { borderColor: "#166534", borderLeftColor: "#22c55e" },
  evidenceCardSuperseded: { borderColor: "#35475d", borderLeftColor: "#64748b", opacity: 0.76 },
  evidenceHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  evidenceHeading: { flex: 1 },
  revisionLabel: { color: "#38bdf8", fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
  activityTitle: { color: "#f8fafc", fontSize: 14, fontWeight: "900", marginTop: 3 },
  evidenceStatus: { paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderRadius: 999 },
  statusEffective: { borderColor: "#22c55e", backgroundColor: "#052e1b" },
  statusSuperseded: { borderColor: "#64748b", backgroundColor: "#182334" },
  evidenceStatusText: { fontSize: 7, fontWeight: "900" },
  statusEffectiveText: { color: "#4ade80" },
  statusSupersededText: { color: "#94a3b8" },
  modeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 9 },
  modeText: { color: "#c084fc", fontSize: 8, fontWeight: "900" },
  durationText: { color: "#f8fafc", fontSize: 12, fontWeight: "900" },
  timeRoute: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 },
  timePoint: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#38bdf8" },
  timeLine: { flex: 1, height: 1, backgroundColor: "#29445f" },
  timeCopy: { minWidth: 115 },
  timeLabel: { color: "#4f6a8a", fontSize: 6, fontWeight: "900" },
  timeValue: { color: "#b5c4d8", fontSize: 8, fontWeight: "800", marginTop: 2 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 11 },
  detailItem: { flex: 1, minWidth: 105, padding: 8, borderRadius: 8, backgroundColor: "#08192d" },
  detailLabel: { color: "#4f6a8a", fontSize: 6, fontWeight: "900" },
  detailValue: { color: "#b5c4d8", fontSize: 8, fontWeight: "800", marginTop: 3 },
  noteBox: { marginTop: 9, padding: 9, borderWidth: 1, borderColor: "#29445f", borderRadius: 8, backgroundColor: "#08192d" },
  noteLabel: { color: "#6782a3", fontSize: 6, fontWeight: "900" },
  noteText: { color: "#cbd5e1", fontSize: 8, lineHeight: 13, marginTop: 3 },
  adjustmentBox: { marginTop: 9, padding: 9, borderWidth: 1, borderColor: "#a16207", borderRadius: 8, backgroundColor: "#291b03" },
  adjustmentTitle: { color: "#fbbf24", fontSize: 7, fontWeight: "900" },
  adjustmentSummary: { color: "#f7df9c", fontSize: 9, fontWeight: "800", marginTop: 3 },
  adjustmentDetail: { color: "#b99a55", fontSize: 7, marginTop: 4 },
  chainRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6, marginTop: 9 },
  chainText: { color: "#6782a3", fontSize: 7, fontStyle: "italic" },
  evidenceId: { color: "#415a79", fontSize: 6 },
  emptyBoundary: { alignItems: "center", padding: 20, borderWidth: 1, borderColor: "#1b3551", borderRadius: 9 },
  emptyBoundaryText: { color: "#5f7a9b", fontSize: 9, fontStyle: "italic" },
  footerNote: { color: "#415a79", fontSize: 8, textAlign: "center", marginTop: 2 },
});
