import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  getActiveCustomerOperationsDiary,
  loadCustomerOperationsDiaryArchiveResult,
} from "../../data/customerOperationsDiaryStorage";
import {
  reconcileManualDutyBoundaryActivityStorage,
  recordManualDutyBoundaryEvidenceWithActivityHistory,
} from "../../data/manualDutyBoundaryActivityStorage";
import {
  buildManualDutyBoundarySnapshot,
  createManualDutyBoundaryState,
  type ManualDutyBoundary,
  type ManualDutyBoundaryActivity,
  type ManualDutyBoundaryEvidence,
  type ManualDutyBoundaryReason,
  type ManualDutyBoundaryState,
} from "../../engine/manualDutyBoundary";
import {
  ManualDutyBoundaryActivityConflictError,
  type ManualDutyBoundaryActivityConflict,
  type ManualDutyBoundaryActivityOverlapResolution,
} from "../../engine/manualDutyBoundaryActivityAdapter";
import {
  displayUkDateInput as displayDate,
  formatUkDateInput as localDate,
  formatUkDateInputFromIsoDate,
  isValidUkDateInput as isValidDateInput,
  timestampFromUkDateTimeInputs as timestampFromInputs,
  ukDateInputToIsoDate,
} from "../../engine/ukDateInput";

interface ReasonOption {
  reason: ManualDutyBoundaryReason;
  label: string;
  activity: ManualDutyBoundaryActivity;
  mode: string;
}

interface PendingActivityConflict {
  error: ManualDutyBoundaryActivityConflictError;
  evidence: ManualDutyBoundaryEvidence;
  wasCorrection: boolean;
}

const REASONS: readonly ReasonOption[] = [
  { reason: "office-admin", label: "Office / admin", activity: "other-work", mode: "OTHER WORK" },
  { reason: "vehicle-checks", label: "Vehicle checks", activity: "other-work", mode: "OTHER WORK" },
  { reason: "yard-work", label: "Yard work", activity: "other-work", mode: "OTHER WORK" },
  { reason: "loading-paperwork", label: "Loading / paperwork", activity: "other-work", mode: "OTHER WORK" },
  { reason: "waiting-known-in-advance", label: "Known waiting", activity: "poa", mode: "AVAILABILITY" },
  { reason: "break-rest", label: "Break / rest", activity: "break", mode: "BREAK / REST" },
  { reason: "other", label: "Other", activity: "other-work", mode: "EXPLAIN" },
];

function localTime(value: Date = new Date()): string {
  return `${String(value.getHours()).padStart(2, "0")}:${String(
    value.getMinutes(),
  ).padStart(2, "0")}`;
}

function displayTimestamp(value: string | null): string {
  return value === null
    ? "Not recorded"
    : new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
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

function activityLabel(
  activity: ManualDutyBoundaryActivityConflict["activity"],
): string {
  switch (activity) {
    case "driving":
      return "Driving";
    case "break":
      return "Break / rest";
    case "other-work":
      return "Other Work";
    case "poa":
      return "Availability / POA";
  }
}

function sourceLabel(
  source: ManualDutyBoundaryActivityConflict["source"],
): string {
  switch (source) {
    case "manual":
      return "Manual activity";
    case "tachograph":
      return "Tachograph evidence";
    case "gps":
      return "GPS evidence";
    case "admin-correction":
      return "Admin-corrected evidence";
  }
}

function displayClock(value: string | null): string {
  return value === null
    ? "still active"
    : new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function findReason(reason: ManualDutyBoundaryReason): ReasonOption {
  return REASONS.find((item) => item.reason === reason) ?? REASONS[0]!;
}

function uniqueId(
  state: ManualDutyBoundaryState,
  boundary: ManualDutyBoundary,
  recordedAt: string,
): string {
  const base = `manual-duty-${boundary}-${recordedAt.replace(/[^0-9A-Za-z]/g, "-")}`;
  const ids = state.evidence.map((item) => item.id);

  if (!ids.includes(base)) {
    return base;
  }

  let suffix = 2;

  while (ids.includes(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

function closeScreen(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/operations/record");
  }
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  wide = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.field, wide ? styles.fieldWide : null]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#4f6a8a"
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

function ReasonSelector({
  selected,
  onSelect,
}: {
  selected: ManualDutyBoundaryReason;
  onSelect: (reason: ManualDutyBoundaryReason) => void;
}) {
  return (
    <View style={styles.reasonGrid}>
      {REASONS.map((option) => {
        const active = selected === option.reason;

        return (
          <Pressable
            key={option.reason}
            onPress={() => onSelect(option.reason)}
            style={[styles.reasonChip, active ? styles.reasonChipActive : null]}
          >
            <Text style={[styles.reasonLabel, active ? styles.reasonLabelActive : null]}>
              {option.label}
            </Text>
            <Text style={[styles.reasonMode, active ? styles.reasonModeActive : null]}>
              {option.mode}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ManualDutyBoundaryScreen() {
  const initialNow = new Date();
  const initialEarlier = new Date(initialNow.getTime() - 20 * 60_000);
  const [state, setState] = useState<ManualDutyBoundaryState>(() =>
    createManualDutyBoundaryState(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] =
    useState<PendingActivityConflict | null>(null);
  const [dutyDate, setDutyDate] = useState(() => localDate(initialNow));
  const dutyDateRef = useRef(dutyDate);

  const [actualStartDate, setActualStartDate] = useState(() => localDate(initialEarlier));
  const [actualStartTime, setActualStartTime] = useState(() => localTime(initialEarlier));
  const [cardInsertedDate, setCardInsertedDate] = useState(() => localDate(initialNow));
  const [cardInsertedTime, setCardInsertedTime] = useState(() => localTime(initialNow));
  const [startReason, setStartReason] = useState<ManualDutyBoundaryReason>("vehicle-checks");
  const [startNote, setStartNote] = useState("");

  const [cardEjectedDate, setCardEjectedDate] = useState(() => localDate(initialEarlier));
  const [cardEjectedTime, setCardEjectedTime] = useState(() => localTime(initialEarlier));
  const [actualFinishDate, setActualFinishDate] = useState(() => localDate(initialNow));
  const [actualFinishTime, setActualFinishTime] = useState(() => localTime(initialNow));
  const [finishReason, setFinishReason] = useState<ManualDutyBoundaryReason>("office-admin");
  const [finishNote, setFinishNote] = useState("");

  const snapshotDutyDate = isValidDateInput(dutyDate)
    ? ukDateInputToIsoDate(dutyDate)
    : "1970-01-01";
  const snapshot = useMemo(
    () => buildManualDutyBoundarySnapshot(state, snapshotDutyDate),
    [snapshotDutyDate, state],
  );

  useEffect(() => {
    dutyDateRef.current = dutyDate;
  }, [dutyDate]);

  const hydrate = useCallback(async () => {
    setMessage(null);
    setError(null);

    try {
      const operationsResult = await loadCustomerOperationsDiaryArchiveResult();
      const operationsDiary = getActiveCustomerOperationsDiary(
        operationsResult.archive,
      );
      const targetDutyDate =
        operationsDiary?.dutyDate ??
        ukDateInputToIsoDate(dutyDateRef.current);
      const reconciled = await reconcileManualDutyBoundaryActivityStorage(
        targetDutyDate,
      );
      const boundaryResult = reconciled.boundaryLoadResult;

      setState(boundaryResult.state);

      if (boundaryResult.status === "recovered") {
        setMessage("Valid evidence recovered; damaged evidence was isolated.");
      } else if (
        reconciled.sync.projectedEvidenceIds.length > 0 ||
        reconciled.sync.activeHistoryFinished
      ) {
        setMessage("Activity history and compliance totals reconciled.");
      }

      if (operationsDiary !== null) {
        setDutyDate(formatUkDateInputFromIsoDate(operationsDiary.dutyDate));
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Duty evidence could not be refreshed safely.",
      );
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const evidence = snapshot.beforeCardInsertion?.evidence;

    if (evidence !== undefined) {
      setActualStartDate(localDate(new Date(evidence.startedAt)));
      setActualStartTime(localTime(new Date(evidence.startedAt)));
      setCardInsertedDate(localDate(new Date(evidence.cardEventAt)));
      setCardInsertedTime(localTime(new Date(evidence.cardEventAt)));
      setStartReason(evidence.reason);
      setStartNote(evidence.note ?? "");
    }
  }, [snapshot.beforeCardInsertion?.evidence.id]);

  useEffect(() => {
    const evidence = snapshot.afterCardEjection?.evidence;

    if (evidence !== undefined) {
      setCardEjectedDate(localDate(new Date(evidence.cardEventAt)));
      setCardEjectedTime(localTime(new Date(evidence.cardEventAt)));
      setActualFinishDate(localDate(new Date(evidence.endedAt)));
      setActualFinishTime(localTime(new Date(evidence.endedAt)));
      setFinishReason(evidence.reason);
      setFinishNote(evidence.note ?? "");
    }
  }, [snapshot.afterCardEjection?.evidence.id]);

  async function saveBoundary(boundary: ManualDutyBoundary): Promise<void> {
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(null);
    setError(null);
    setPendingConflict(null);

    let attemptedEvidence: ManualDutyBoundaryEvidence | null = null;
    let wasCorrection = false;

    try {
      const recordedAt = new Date().toISOString();
      const current =
        boundary === "before-card-insertion"
          ? snapshot.beforeCardInsertion?.evidence
          : snapshot.afterCardEjection?.evidence;
      wasCorrection = current !== undefined;
      const reason =
        boundary === "before-card-insertion" ? startReason : finishReason;
      const reasonDetails = findReason(reason);
      const note = boundary === "before-card-insertion" ? startNote : finishNote;
      const startedAt =
        boundary === "before-card-insertion"
          ? timestampFromInputs(actualStartDate, actualStartTime)
          : timestampFromInputs(cardEjectedDate, cardEjectedTime);
      const endedAt =
        boundary === "before-card-insertion"
          ? timestampFromInputs(cardInsertedDate, cardInsertedTime)
          : timestampFromInputs(actualFinishDate, actualFinishTime);
      const evidence: ManualDutyBoundaryEvidence = {
        id: uniqueId(state, boundary, recordedAt),
        dutyDate: ukDateInputToIsoDate(dutyDate),
        boundary,
        activity: reasonDetails.activity,
        startedAt,
        endedAt,
        cardEventAt: boundary === "before-card-insertion" ? endedAt : startedAt,
        recordedAt,
        reason,
        source: current === undefined ? "driver" : "driver-correction",
        ...(note.trim() === "" ? {} : { note: note.trim() }),
        ...(current === undefined ? {} : { revisesEvidenceId: current.id }),
      };
      attemptedEvidence = evidence;
      await persistEvidence(evidence, wasCorrection, "reject");
    } catch (caught) {
      if (
        caught instanceof ManualDutyBoundaryActivityConflictError &&
        attemptedEvidence !== null
      ) {
        setPendingConflict({
          error: caught,
          evidence: attemptedEvidence,
          wasCorrection,
        });
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : "Duty times could not be saved.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function persistEvidence(
    evidence: ManualDutyBoundaryEvidence,
    wasCorrection: boolean,
    overlapResolution: ManualDutyBoundaryActivityOverlapResolution,
  ): Promise<void> {
    const result =
      await recordManualDutyBoundaryEvidenceWithActivityHistory(evidence, {
        overlapResolution,
      });

    setState(result.boundaryState);
    setPendingConflict(null);
    const activityMessage =
      result.sync.replacedActivityEventIds.length > 0
        ? ` ${result.sync.replacedActivityEventIds.length} overlapping manual ${
            result.sync.replacedActivityEventIds.length === 1
              ? "activity was"
              : "activities were"
          } adjusted; compliance totals updated.`
        : result.sync.projectedEvidenceIds.length > 0 ||
            result.sync.activeHistoryFinished
          ? " Activity history and compliance totals updated."
          : " Existing activity already covers this time.";
    setMessage(
      `${
        wasCorrection
          ? "Correction saved; original evidence retained."
          : evidence.boundary === "before-card-insertion"
            ? "Actual start and card insertion saved."
            : "Card ejection and actual finish saved."
      }${activityMessage}`,
    );
  }

  async function resolvePendingConflict(): Promise<void> {
    if (busy || pendingConflict === null || !pendingConflict.error.canReplaceAll) {
      return;
    }

    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      await persistEvidence(
        pendingConflict.evidence,
        pendingConflict.wasCorrection,
        "replace-manual",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The activity conflict could not be resolved.",
      );
    } finally {
      setBusy(false);
    }
  }

  function keepExistingActivity(): void {
    setPendingConflict(null);
    setError(null);
    setMessage("Existing activity kept. No new duty evidence was saved.");
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
              <Text style={styles.eyebrow}>MANUAL-ENTRY ASSISTANT</Text>
              <Text style={styles.title}>Actual Duty Times</Text>
              <Text style={styles.subtitle}>{displayDate(dutyDate)}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerButton} onPress={() => void hydrate()}>
              <Text style={styles.headerButtonText}>Refresh</Text>
            </Pressable>
            <Pressable style={styles.closeButton} onPress={closeScreen}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.legalBanner}>
          <View style={styles.legalIcon}>
            <Text style={styles.legalIconText}>!</Text>
          </View>
          <View style={styles.legalCopy}>
            <Text style={styles.legalTitle}>Tachograph entry still required</Text>
            <Text style={styles.legalText}>
              TachoTrack keeps supporting evidence and prepares the correct mode
              and times. It does not replace the required tachograph, chart or
              signed printout entry.
            </Text>
          </View>
          <View style={styles.auditBadge}>
            <Text style={styles.auditBadgeText}>AUDIT PROTECTED</Text>
          </View>
        </View>

        {message === null ? null : (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓ {message}</Text>
          </View>
        )}
        {error === null ? null : (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>! {error}</Text>
          </View>
        )}
        {pendingConflict === null ? null : (
          <View style={styles.conflictCard}>
            <View style={styles.conflictHeader}>
              <View style={styles.conflictIcon}>
                <Text style={styles.conflictIconText}>!</Text>
              </View>
              <View style={styles.conflictHeadingCopy}>
                <Text style={styles.conflictEyebrow}>ACTIVITY CONFLICT</Text>
                <Text style={styles.conflictTitle}>Your choice is required</Text>
                <Text style={styles.conflictIntro}>
                  The proposed {activityLabel(pendingConflict.evidence.activity)} entry
                  from {displayClock(pendingConflict.evidence.startedAt)} to {displayClock(pendingConflict.evidence.endedAt)} overlaps recorded activity.
                </Text>
              </View>
            </View>

            <View style={styles.conflictList}>
              {pendingConflict.error.conflicts.map((conflict) => (
                <View key={conflict.eventId} style={styles.conflictRow}>
                  <View style={styles.conflictRowMain}>
                    <Text style={styles.conflictActivity}>
                      {activityLabel(conflict.activity)}
                    </Text>
                    <Text style={styles.conflictMeta}>
                      {sourceLabel(conflict.source)} · {displayClock(conflict.startedAt)}–{displayClock(conflict.endedAt)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.conflictStatus,
                      conflict.replaceable
                        ? styles.conflictStatusReplaceable
                        : styles.conflictStatusProtected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.conflictStatusText,
                        conflict.replaceable
                          ? styles.conflictStatusTextReplaceable
                          : styles.conflictStatusTextProtected,
                      ]}
                    >
                      {conflict.replaceable ? "MANUAL · CAN ADJUST" : "PROTECTED"}
                    </Text>
                    <Text style={styles.conflictMinutes}>
                      {formatMinutes(conflict.overlapMinutes)} overlap
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.conflictGuidance}>
              {pendingConflict.error.canReplaceAll
                ? "Use Duty Entry will trim only the overlapping manual activity. Any recorded time before or after it will be preserved, preventing double-counting."
                : "Tachograph, GPS and admin-corrected evidence cannot be replaced automatically. Keep the existing activity and correct the protected source record first."}
            </Text>

            <View style={styles.conflictActions}>
              <Pressable
                disabled={busy}
                onPress={keepExistingActivity}
                style={styles.keepActivityButton}
              >
                <Text style={styles.keepActivityButtonText}>Keep Existing Activity</Text>
              </Pressable>
              {pendingConflict.error.canReplaceAll ? (
                <Pressable
                  disabled={busy}
                  onPress={() => void resolvePendingConflict()}
                  style={[
                    styles.useDutyEntryButton,
                    busy ? styles.buttonDisabled : null,
                  ]}
                >
                  <Text style={styles.useDutyEntryButtonText}>
                    {busy ? "Updating…" : "Use Duty Entry"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        {!hydrated ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Loading protected evidence…</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, styles.summaryStart]}>
                <Text style={styles.summaryLabel}>ACTUAL DUTY START</Text>
                <Text style={styles.summaryValue}>
                  {displayTimestamp(snapshot.actualDutyStartedAt)}
                </Text>
                <Text style={styles.summaryDetail}>
                  Card inserted {displayTimestamp(snapshot.cardInsertedAt)}
                </Text>
              </View>
              <View style={[styles.summaryCard, styles.summaryFinish]}>
                <Text style={styles.summaryLabel}>ACTUAL DUTY FINISH</Text>
                <Text style={styles.summaryValue}>
                  {displayTimestamp(snapshot.actualDutyFinishedAt)}
                </Text>
                <Text style={styles.summaryDetail}>
                  Card ejected {displayTimestamp(snapshot.cardEjectedAt)}
                </Text>
              </View>
              <View style={[styles.summaryCard, styles.summaryWork]}>
                <Text style={styles.summaryLabel}>EXTRA OTHER WORK</Text>
                <Text style={styles.summaryValue}>
                  {formatMinutes(snapshot.additionalOtherWorkMinutes)}
                </Text>
                <Text style={styles.summaryDetail}>
                  {snapshot.tachographManualInputsRequired} tachograph input
                  {snapshot.tachographManualInputsRequired === 1 ? "" : "s"} due
                </Text>
              </View>
            </View>

            <View style={styles.dutyDateCard}>
              <View>
                <Text style={styles.sectionTitle}>Duty record</Text>
                <Text style={styles.sectionSubtitle}>The date on which this duty began</Text>
              </View>
              <Field
                label="DUTY DATE"
                value={dutyDate}
                onChangeText={setDutyDate}
                placeholder="DD/MM/YYYY"
              />
            </View>

            <View style={styles.boundaryGrid}>
              <View style={[styles.boundaryCard, styles.boundaryStart]}>
                <View style={styles.boundaryHeader}>
                  <View>
                    <Text style={styles.stepLabel}>STEP 1 · START OF DUTY</Text>
                    <Text style={styles.boundaryTitle}>Before card insertion</Text>
                  </View>
                  <View style={styles.modeBadge}>
                    <Text style={styles.modeBadgeText}>{findReason(startReason).mode}</Text>
                  </View>
                </View>
                <Text style={styles.boundaryText}>
                  Include clocking on, paperwork, vehicle checks or any other
                  activity completed before inserting the card.
                </Text>
                <View style={styles.timeGrid}>
                  <Field label="ACTUAL START DATE" value={actualStartDate} onChangeText={setActualStartDate} placeholder="DD/MM/YYYY" />
                  <Field label="ACTUAL START TIME" value={actualStartTime} onChangeText={setActualStartTime} placeholder="HH:MM" />
                  <Field label="CARD INSERTED DATE" value={cardInsertedDate} onChangeText={setCardInsertedDate} placeholder="DD/MM/YYYY" />
                  <Field label="CARD INSERTED TIME" value={cardInsertedTime} onChangeText={setCardInsertedTime} placeholder="HH:MM" />
                </View>
                <Text style={styles.choiceLabel}>WHAT WERE YOU DOING?</Text>
                <ReasonSelector selected={startReason} onSelect={setStartReason} />
                <Field
                  label={startReason === "other" ? "EXPLANATION REQUIRED" : "OPTIONAL NOTE"}
                  value={startNote}
                  onChangeText={setStartNote}
                  placeholder="Add supporting detail"
                  wide
                />
                <Pressable
                  disabled={busy}
                  onPress={() => void saveBoundary("before-card-insertion")}
                  style={[styles.saveButton, busy ? styles.buttonDisabled : null]}
                >
                  <Text style={styles.saveButtonText}>
                    {busy
                      ? "Saving…"
                      : snapshot.beforeCardInsertion === null
                        ? "Save Start Evidence"
                        : "Save Start Correction"}
                  </Text>
                </Pressable>
              </View>

              <View style={[styles.boundaryCard, styles.boundaryFinish]}>
                <View style={styles.boundaryHeader}>
                  <View>
                    <Text style={styles.stepLabel}>STEP 2 · END OF DUTY</Text>
                    <Text style={styles.boundaryTitle}>After card ejection</Text>
                  </View>
                  <View style={styles.modeBadge}>
                    <Text style={styles.modeBadgeText}>{findReason(finishReason).mode}</Text>
                  </View>
                </View>
                <Text style={styles.boundaryText}>
                  Include office visits, paperwork, clocking off or any other
                  activity completed after ejecting the card.
                </Text>
                <View style={styles.timeGrid}>
                  <Field label="CARD EJECTED DATE" value={cardEjectedDate} onChangeText={setCardEjectedDate} placeholder="DD/MM/YYYY" />
                  <Field label="CARD EJECTED TIME" value={cardEjectedTime} onChangeText={setCardEjectedTime} placeholder="HH:MM" />
                  <Field label="ACTUAL FINISH DATE" value={actualFinishDate} onChangeText={setActualFinishDate} placeholder="DD/MM/YYYY" />
                  <Field label="ACTUAL FINISH TIME" value={actualFinishTime} onChangeText={setActualFinishTime} placeholder="HH:MM" />
                </View>
                <Text style={styles.choiceLabel}>WHAT WERE YOU DOING?</Text>
                <ReasonSelector selected={finishReason} onSelect={setFinishReason} />
                <Field
                  label={finishReason === "other" ? "EXPLANATION REQUIRED" : "OPTIONAL NOTE"}
                  value={finishNote}
                  onChangeText={setFinishNote}
                  placeholder="Add supporting detail"
                  wide
                />
                <Pressable
                  disabled={busy}
                  onPress={() => void saveBoundary("after-card-ejection")}
                  style={[styles.saveButton, busy ? styles.buttonDisabled : null]}
                >
                  <Text style={styles.saveButtonText}>
                    {busy
                      ? "Saving…"
                      : snapshot.afterCardEjection === null
                        ? "Save Finish Evidence"
                        : "Save Finish Correction"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.promptCard}>
              <View>
                <Text style={styles.sectionTitle}>Tachograph prompts</Text>
                <Text style={styles.sectionSubtitle}>
                  Complete these on the tachograph before driving again
                </Text>
              </View>
              <View style={styles.promptList}>
                {snapshot.beforeCardInsertion === null ? (
                  <Text style={styles.emptyPrompt}>Start boundary not recorded.</Text>
                ) : (
                  <View style={styles.promptRow}>
                    <Text style={styles.promptNumber}>1</Text>
                    <View style={styles.promptCopy}>
                      <Text style={styles.promptTitle}>{snapshot.beforeCardInsertion.tachographMode}</Text>
                      <Text style={styles.promptText}>
                        {displayTimestamp(snapshot.beforeCardInsertion.evidence.startedAt)} → {displayTimestamp(snapshot.beforeCardInsertion.evidence.endedAt)}
                      </Text>
                    </View>
                    <Text style={styles.promptDuration}>{formatMinutes(snapshot.beforeCardInsertion.durationMinutes)}</Text>
                  </View>
                )}
                {snapshot.afterCardEjection === null ? (
                  <Text style={styles.emptyPrompt}>Finish boundary not recorded.</Text>
                ) : (
                  <View style={styles.promptRow}>
                    <Text style={styles.promptNumber}>2</Text>
                    <View style={styles.promptCopy}>
                      <Text style={styles.promptTitle}>{snapshot.afterCardEjection.tachographMode}</Text>
                      <Text style={styles.promptText}>
                        {displayTimestamp(snapshot.afterCardEjection.evidence.startedAt)} → {displayTimestamp(snapshot.afterCardEjection.evidence.endedAt)}
                      </Text>
                    </View>
                    <Text style={styles.promptDuration}>{formatMinutes(snapshot.afterCardEjection.durationMinutes)}</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}

        <Text style={styles.footerNote}>
          Corrections append new evidence · original entries remain available for audit
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
  subtitle: { color: "#7891b2", fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerButton: { paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: "#25415f", borderRadius: 10, backgroundColor: "#071426" },
  headerButtonText: { color: "#38bdf8", fontSize: 10, fontWeight: "900" },
  closeButton: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 10, backgroundColor: "#f1f5f9" },
  closeButtonText: { color: "#071426", fontSize: 10, fontWeight: "900" },
  legalBanner: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderColor: "#a16207", borderRadius: 14, backgroundColor: "#2b1d04" },
  legalIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#f59e0b" },
  legalIconText: { color: "#111827", fontSize: 18, fontWeight: "900" },
  legalCopy: { flex: 1, minWidth: 240 },
  legalTitle: { color: "#fde68a", fontSize: 12, fontWeight: "900" },
  legalText: { color: "#d6b96c", fontSize: 9, lineHeight: 14, marginTop: 3 },
  auditBadge: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#f59e0b", borderRadius: 999 },
  auditBadgeText: { color: "#fbbf24", fontSize: 8, fontWeight: "900" },
  successBanner: { padding: 10, borderWidth: 1, borderColor: "#166534", borderRadius: 10, backgroundColor: "#052e1b" },
  successText: { color: "#4ade80", fontSize: 10, fontWeight: "800" },
  errorBanner: { padding: 10, borderWidth: 1, borderColor: "#be123c", borderRadius: 10, backgroundColor: "#3f0718" },
  errorText: { color: "#fb7185", fontSize: 10, fontWeight: "800" },
  conflictCard: { padding: 14, borderWidth: 1, borderColor: "#f59e0b", borderLeftWidth: 4, borderRadius: 14, backgroundColor: "#291b03" },
  conflictHeader: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  conflictIcon: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#f59e0b" },
  conflictIconText: { color: "#1c1302", fontSize: 15, fontWeight: "900" },
  conflictHeadingCopy: { flex: 1 },
  conflictEyebrow: { color: "#fbbf24", fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  conflictTitle: { color: "#fff7d6", fontSize: 17, fontWeight: "900", marginTop: 3 },
  conflictIntro: { color: "#d6bd83", fontSize: 10, lineHeight: 15, marginTop: 5 },
  conflictList: { gap: 7, marginTop: 12 },
  conflictRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 10, borderWidth: 1, borderColor: "#674b12", borderRadius: 10, backgroundColor: "#171103" },
  conflictRowMain: { flex: 1, minWidth: 220 },
  conflictActivity: { color: "#f8fafc", fontSize: 11, fontWeight: "900" },
  conflictMeta: { color: "#a9905c", fontSize: 8, marginTop: 4 },
  conflictStatus: { minWidth: 130, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderRadius: 8 },
  conflictStatusReplaceable: { borderColor: "#22c55e", backgroundColor: "#052e1b" },
  conflictStatusProtected: { borderColor: "#fb7185", backgroundColor: "#3f0718" },
  conflictStatusText: { fontSize: 7, fontWeight: "900", textAlign: "center" },
  conflictStatusTextReplaceable: { color: "#4ade80" },
  conflictStatusTextProtected: { color: "#fb7185" },
  conflictMinutes: { color: "#d6bd83", fontSize: 8, fontWeight: "800", textAlign: "center", marginTop: 3 },
  conflictGuidance: { color: "#d6bd83", fontSize: 9, lineHeight: 14, marginTop: 11 },
  conflictActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, marginTop: 12 },
  keepActivityButton: { minWidth: 165, alignItems: "center", paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: "#7c6330", borderRadius: 9, backgroundColor: "#171103" },
  keepActivityButtonText: { color: "#f7df9c", fontSize: 9, fontWeight: "900" },
  useDutyEntryButton: { minWidth: 140, alignItems: "center", paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: "#22c55e", borderRadius: 9, backgroundColor: "#14532d" },
  useDutyEntryButtonText: { color: "#dcfce7", fontSize: 9, fontWeight: "900" },
  loadingCard: { padding: 30, alignItems: "center", borderWidth: 1, borderColor: "#1b3551", borderRadius: 14, backgroundColor: "#081628" },
  loadingText: { color: "#7891b2", fontSize: 12 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { flex: 1, minWidth: 220, padding: 14, borderWidth: 1, borderColor: "#1b3551", borderTopWidth: 3, borderRadius: 14, backgroundColor: "#081628" },
  summaryStart: { borderTopColor: "#38bdf8" },
  summaryFinish: { borderTopColor: "#22c55e" },
  summaryWork: { borderTopColor: "#a855f7" },
  summaryLabel: { color: "#6782a3", fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  summaryValue: { color: "#f8fafc", fontSize: 17, fontWeight: "900", marginTop: 8 },
  summaryDetail: { color: "#7891b2", fontSize: 9, marginTop: 5 },
  dutyDateCard: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderWidth: 1, borderColor: "#1b3551", borderRadius: 14, backgroundColor: "#071426" },
  sectionTitle: { color: "#f8fafc", fontSize: 15, fontWeight: "900" },
  sectionSubtitle: { color: "#6782a3", fontSize: 9, marginTop: 3 },
  boundaryGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 12 },
  boundaryCard: { flex: 1, minWidth: 360, padding: 15, borderWidth: 1, borderColor: "#1b3551", borderTopWidth: 3, borderRadius: 15, backgroundColor: "#081628" },
  boundaryStart: { borderTopColor: "#38bdf8" },
  boundaryFinish: { borderTopColor: "#22c55e" },
  boundaryHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  stepLabel: { color: "#38bdf8", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  boundaryTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "900", marginTop: 4 },
  modeBadge: { paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: "#a855f7", borderRadius: 999, backgroundColor: "#1f1235" },
  modeBadgeText: { color: "#d8b4fe", fontSize: 8, fontWeight: "900" },
  boundaryText: { color: "#7891b2", fontSize: 9, lineHeight: 14, marginTop: 9 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 13 },
  field: { flex: 1, minWidth: 135 },
  fieldWide: { flexBasis: "100%", marginTop: 10 },
  fieldLabel: { color: "#6782a3", fontSize: 7, fontWeight: "900", letterSpacing: 0.8, marginBottom: 5 },
  input: { color: "#f8fafc", fontSize: 11, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: "#29445f", borderRadius: 9, backgroundColor: "#04101f" },
  choiceLabel: { color: "#6782a3", fontSize: 7, fontWeight: "900", letterSpacing: 0.8, marginTop: 14, marginBottom: 6 },
  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reasonChip: { minWidth: 105, paddingHorizontal: 9, paddingVertical: 8, borderWidth: 1, borderColor: "#29445f", borderRadius: 9, backgroundColor: "#071426" },
  reasonChipActive: { borderColor: "#38bdf8", backgroundColor: "#083344" },
  reasonLabel: { color: "#7891b2", fontSize: 8, fontWeight: "800" },
  reasonLabelActive: { color: "#e0f2fe" },
  reasonMode: { color: "#4f6a8a", fontSize: 6, fontWeight: "900", marginTop: 3 },
  reasonModeActive: { color: "#38bdf8" },
  saveButton: { alignItems: "center", marginTop: 12, paddingVertical: 11, borderWidth: 1, borderColor: "#22c55e", borderRadius: 10, backgroundColor: "#14532d" },
  saveButtonText: { color: "#dcfce7", fontSize: 10, fontWeight: "900" },
  buttonDisabled: { opacity: 0.45 },
  promptCard: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: 15, borderWidth: 1, borderColor: "#1b3551", borderRadius: 15, backgroundColor: "#071426" },
  promptList: { flex: 1, minWidth: 360, gap: 7 },
  promptRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, backgroundColor: "#081628" },
  promptNumber: { color: "#ffffff", fontSize: 10, fontWeight: "900", width: 25, height: 25, textAlign: "center", paddingTop: 6, borderRadius: 13, backgroundColor: "#0ea5e9" },
  promptCopy: { flex: 1 },
  promptTitle: { color: "#f8fafc", fontSize: 10, fontWeight: "900" },
  promptText: { color: "#7891b2", fontSize: 8, marginTop: 3 },
  promptDuration: { color: "#4ade80", fontSize: 11, fontWeight: "900" },
  emptyPrompt: { color: "#5f7a9b", fontSize: 9, fontStyle: "italic", padding: 10 },
  footerNote: { color: "#415a79", fontSize: 8, textAlign: "center", marginTop: 2 },
});
