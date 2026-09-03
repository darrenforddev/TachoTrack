import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  activateCustomerOperationsDiary,
  createCustomerOperationsDiaryArchive,
  getActiveCustomerOperationsDiary,
  getCustomerOperationsDiaryByDate,
  loadCustomerOperationsDiaryArchiveResult,
  saveCustomerOperationsDiaryArchive,
  upsertCustomerOperationsDiary,
  upsertCustomerOperationsDiaryInStorage,
  type CustomerOperationsDiaryArchive,
} from "../../data/customerOperationsDiaryStorage";
import {
  createCustomerOperationsDiary,
  registerOperationsBox,
  registerOperationsLocation,
  registerOperationsTrailer,
  type CustomerOperationsDiary,
  type OperationsBoxStage,
  type OperationsLocationType,
} from "../../engine/customerOperationsDiary";
import {
  buildCustomerOperationsDiaryWorkflowState,
  recordCustomerOperationsWorkflowAction,
  type CustomerOperationsWorkflowAction,
} from "../../engine/customerOperationsDiaryWorkflow";

const LOCATION_TYPES: Array<{
  type: OperationsLocationType;
  label: string;
}> = [
  { type: "customer", label: "Customer" },
  { type: "port", label: "Port" },
  { type: "depot", label: "Depot" },
  { type: "company-site", label: "Company" },
  { type: "partner-site", label: "Partner" },
  { type: "other", label: "Other" },
];

const BOX_STAGE_LABELS: Record<OperationsBoxStage, string> = {
  "available-at-location": "Available",
  "loaded-on-trailer": "Loaded in transit",
  "at-customer-unloading": "Unloading",
  "empty-at-customer": "Empty ready",
  "empty-on-trailer": "Empty in transit",
  "returned-empty": "Returned empty",
};

const BOX_STAGE_COLORS: Record<OperationsBoxStage, string> = {
  "available-at-location": "#64748b",
  "loaded-on-trailer": "#38bdf8",
  "at-customer-unloading": "#f59e0b",
  "empty-at-customer": "#a855f7",
  "empty-on-trailer": "#0ea5e9",
  "returned-empty": "#22c55e",
};

function localDateString(date: Date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(dateString: string): string {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  return hours === 0
    ? `${remainder}m`
    : `${hours}h ${remainder.toString().padStart(2, "0")}m`;
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueAssetId(
  prefix: string,
  value: string,
  existingIds: readonly string[],
): string {
  const safeValue = slug(value) || "entry";
  const baseId = `${prefix}-${safeValue}`;

  if (!existingIds.includes(baseId)) {
    return baseId;
  }

  let suffix = 2;

  while (existingIds.includes(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function closeScreen(): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace("/operations/day");
}

function ActionButton({
  label,
  onPress,
  tone = "primary",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "good" | "warning" | "neutral" | "danger";
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        tone === "good" ? styles.actionGood : null,
        tone === "warning" ? styles.actionWarning : null,
        tone === "neutral" ? styles.actionNeutral : null,
        tone === "danger" ? styles.actionDanger : null,
        disabled ? styles.actionDisabled : null,
      ]}
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function Field({
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#4f6a8a"
      keyboardType={keyboardType}
      autoCapitalize="characters"
      style={styles.input}
    />
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choiceChip, selected ? styles.choiceChipSelected : null]}
    >
      <Text
        style={[
          styles.choiceChipText,
          selected ? styles.choiceChipTextSelected : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StartDiaryCard({
  tractorRegistration,
  setTractorRegistration,
  onStart,
  busy,
  existingToday,
}: {
  tractorRegistration: string;
  setTractorRegistration: (value: string) => void;
  onStart: () => void;
  busy: boolean;
  existingToday: boolean;
}) {
  return (
    <View style={styles.startCard}>
      <Text style={styles.startEyebrow}>TODAY&apos;S OPERATIONS</Text>
      <Text style={styles.startTitle}>
        {existingToday ? "Resume today’s diary" : "Start today’s diary"}
      </Text>
      <Text style={styles.startText}>
        {existingToday
          ? "Your saved diary will reopen at its last verified event."
          : "Enter the tractor registration. Sites, trailers and boxes can be added as the day unfolds."}
      </Text>
      {existingToday ? null : (
        <View style={styles.startInputWrap}>
          <Text style={styles.fieldLabel}>TRACTOR REGISTRATION</Text>
          <Field
            value={tractorRegistration}
            onChangeText={setTractorRegistration}
            placeholder="YX26 TTK"
          />
        </View>
      )}
      <ActionButton
        label={busy ? "Saving…" : existingToday ? "Resume Diary" : "Start Diary"}
        onPress={onStart}
        tone="good"
        disabled={busy || (!existingToday && tractorRegistration.trim() === "")}
      />
    </View>
  );
}

export default function CustomerOperationsRecordScreen() {
  const today = localDateString();
  const [archive, setArchive] = useState<CustomerOperationsDiaryArchive>(() =>
    createCustomerOperationsDiaryArchive(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  const [tractorRegistration, setTractorRegistration] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationPostcode, setLocationPostcode] = useState("");
  const [locationType, setLocationType] =
    useState<OperationsLocationType>("customer");
  const [trailerNumber, setTrailerNumber] = useState("");
  const [trailerDescription, setTrailerDescription] = useState("");
  const [trailerLocationId, setTrailerLocationId] = useState<string | null>(
    null,
  );
  const [boxNumber, setBoxNumber] = useState("");
  const [boxIsoType, setBoxIsoType] = useState("40HC");
  const [boxSeal, setBoxSeal] = useState("");
  const [boxWeight, setBoxWeight] = useState("");
  const [boxInitialState, setBoxInitialState] = useState<"loaded" | "empty">(
    "loaded",
  );
  const [boxLocationId, setBoxLocationId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const activeDiary = getActiveCustomerOperationsDiary(archive);
  const existingToday = getCustomerOperationsDiaryByDate(archive, today);
  const workflow = useMemo(
    () =>
      activeDiary === null
        ? null
        : buildCustomerOperationsDiaryWorkflowState(activeDiary, clock),
    [activeDiary, clock],
  );

  const hydrate = useCallback(async () => {
    const loaded = await loadCustomerOperationsDiaryArchiveResult();

    if (loaded.status === "invalid") {
      setError(
        loaded.issues[0]?.message ??
          "Stored operations diary could not be loaded safely.",
      );
    } else {
      setArchive(loaded.archive);
      setError(null);
    }

    setHydrated(true);
    setClock(Date.now());
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30_000);

    return () => clearInterval(timer);
  }, []);

  async function withSave(
    action: () => Promise<CustomerOperationsDiaryArchive>,
    successMessage: string,
  ): Promise<void> {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await action();

      setArchive(updated);
      setMessage(successMessage);
      setClock(Date.now());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The action could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  function persistDiary(
    diary: CustomerOperationsDiary,
  ): Promise<CustomerOperationsDiaryArchive> {
    return upsertCustomerOperationsDiaryInStorage(diary, {
      makeActive: true,
    });
  }

  function startOrResumeDiary(): void {
    void withSave(async () => {
      const existing = getCustomerOperationsDiaryByDate(archive, today);

      if (existing !== null) {
        const activated = activateCustomerOperationsDiary(archive, existing.id);

        await saveCustomerOperationsDiaryArchive(activated);
        return activated;
      }

      const diary = createCustomerOperationsDiary({
        id: `customer-operations-${today}`,
        dutyDate: today,
        tractorRegistration: tractorRegistration.trim().toUpperCase(),
      });
      const updated = activateCustomerOperationsDiary(
        upsertCustomerOperationsDiary(archive, diary),
        diary.id,
      );

      await saveCustomerOperationsDiaryArchive(updated);
      return updated;
    }, existingToday === null ? "Today’s diary started." : "Today’s diary resumed.");
  }

  function recordAction(
    action: CustomerOperationsWorkflowAction,
    successMessage: string,
  ): void {
    if (activeDiary === null) {
      return;
    }

    void withSave(
      () =>
        persistDiary(
          recordCustomerOperationsWorkflowAction(
            activeDiary,
            action,
            new Date(),
          ),
        ),
      successMessage,
    );
  }

  function addLocation(): void {
    if (activeDiary === null || locationName.trim() === "") {
      return;
    }

    const id = uniqueAssetId(
      "location",
      locationName,
      activeDiary.locations.map((location) => location.id),
    );
    const next = registerOperationsLocation(activeDiary, {
      id,
      name: locationName.trim(),
      type: locationType,
      ...(locationPostcode.trim() === ""
        ? {}
        : { postcode: locationPostcode.trim().toUpperCase() }),
    });

    void withSave(async () => {
      const updated = await persistDiary(next);

      setLocationName("");
      setLocationPostcode("");
      return updated;
    }, "Location added.");
  }

  function addTrailer(): void {
    if (activeDiary === null || trailerNumber.trim() === "") {
      return;
    }

    const id = uniqueAssetId(
      "trailer",
      trailerNumber,
      activeDiary.trailers.map((trailer) => trailer.id),
    );
    const next = registerOperationsTrailer(activeDiary, {
      id,
      number: trailerNumber.trim().toUpperCase(),
      ...(trailerDescription.trim() === ""
        ? {}
        : { description: trailerDescription.trim() }),
      ...(trailerLocationId === null
        ? {}
        : { initialLocationId: trailerLocationId }),
    });

    void withSave(async () => {
      const updated = await persistDiary(next);

      setTrailerNumber("");
      setTrailerDescription("");
      setTrailerLocationId(null);
      return updated;
    }, "Trailer added.");
  }

  function addBox(): void {
    if (activeDiary === null || boxNumber.trim() === "") {
      return;
    }

    const parsedWeight =
      boxWeight.trim() === "" ? undefined : Number(boxWeight.trim());
    const id = uniqueAssetId(
      "box",
      boxNumber,
      activeDiary.boxes.map((box) => box.id),
    );
    const next = registerOperationsBox(activeDiary, {
      id,
      number: boxNumber.trim().toUpperCase(),
      initialLoadState: boxInitialState,
      ...(boxIsoType.trim() === ""
        ? {}
        : { isoType: boxIsoType.trim().toUpperCase() }),
      ...(boxSeal.trim() === ""
        ? {}
        : { sealNumber: boxSeal.trim().toUpperCase() }),
      ...(parsedWeight === undefined ? {} : { grossWeightKg: parsedWeight }),
      ...(boxLocationId === null
        ? {}
        : { initialLocationId: boxLocationId }),
    });

    void withSave(async () => {
      const updated = await persistDiary(next);

      setBoxNumber("");
      setBoxSeal("");
      setBoxWeight("");
      setBoxLocationId(null);
      return updated;
    }, "Box added.");
  }

  function addNote(): void {
    if (noteText.trim() === "") {
      return;
    }

    const text = noteText.trim();

    setNoteText("");
    recordAction({ type: "add-note", text }, "Diary note saved.");
  }

  const activeLocation =
    activeDiary === null || workflow?.snapshot.activeVisit === null
      ? null
      : (activeDiary.locations.find(
          (location) =>
            location.id === workflow?.snapshot.activeVisit?.locationId,
        ) ?? null);

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
              <Text style={styles.eyebrow}>LIVE FIELD ENTRY</Text>
              <Text style={styles.title}>Record Operations</Text>
              <Text style={styles.subtitle}>
                {activeDiary === null
                  ? formatDate(today)
                  : `${formatDate(activeDiary.dutyDate)} · autosave active`}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerButton}
              onPress={() => void hydrate()}
            >
              <Text style={styles.headerButtonText}>Refresh</Text>
            </Pressable>
            <Pressable style={styles.closeButton} onPress={closeScreen}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
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

        {!hydrated ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Loading protected diary…</Text>
          </View>
        ) : activeDiary === null ? (
          <StartDiaryCard
            tractorRegistration={tractorRegistration}
            setTractorRegistration={setTractorRegistration}
            onStart={startOrResumeDiary}
            busy={busy}
            existingToday={existingToday !== null}
          />
        ) : workflow === null ? null : (
          <>
            <View style={styles.liveSummaryRow}>
              <View style={[styles.liveSummaryCard, styles.liveSummarySite]}>
                <Text style={styles.summaryLabel}>CURRENT POSITION</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {activeLocation?.name ?? "Travelling"}
                </Text>
                <Text style={styles.summaryDetail}>
                  {workflow.snapshot.activeVisit === null
                    ? "Choose the next arrival below"
                    : `${formatMinutes(
                        workflow.snapshot.activeVisit.durationMinutes,
                      )} at this site`}
                </Text>
              </View>
              <View style={[styles.liveSummaryCard, styles.liveSummaryTrailer]}>
                <Text style={styles.summaryLabel}>ATTACHED TRAILER</Text>
                <Text style={styles.summaryValue}>
                  {activeDiary.trailers.find(
                    (trailer) =>
                      trailer.id === workflow.snapshot.currentTrailerId,
                  )?.number ?? "None"}
                </Text>
                <Text style={styles.summaryDetail}>
                  {activeDiary.tractorRegistration ?? "Tractor not entered"}
                </Text>
              </View>
              <View style={[styles.liveSummaryCard, styles.liveSummaryBoxes]}>
                <Text style={styles.summaryLabel}>BOX FLOW</Text>
                <Text style={styles.summaryValue}>
                  {workflow.snapshot.completedBoxCycles} returned
                </Text>
                <Text style={styles.summaryDetail}>
                  {workflow.snapshot.activeUnloadingBoxes} unloading · {" "}
                  {workflow.snapshot.emptyBoxesReady} ready
                </Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>
                    {activeLocation === null ? "Record arrival" : "Current site"}
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    {activeLocation === null
                      ? "Only registered locations are offered"
                      : `${activeLocation.name}${
                          activeLocation.postcode === undefined
                            ? ""
                            : ` · ${activeLocation.postcode}`
                        }`}
                  </Text>
                </View>
                {workflow.canDepart ? (
                  <ActionButton
                    label={busy ? "Saving…" : "Depart Site"}
                    tone="warning"
                    disabled={busy}
                    onPress={() =>
                      recordAction({ type: "depart" }, "Departure recorded.")
                    }
                  />
                ) : null}
              </View>
              {workflow.arrivalLocationIds.length === 0 ? null : (
                <View style={styles.locationActionGrid}>
                  {workflow.arrivalLocationIds.map((locationId) => {
                    const location = activeDiary.locations.find(
                      (item) => item.id === locationId,
                    );

                    if (location === undefined) {
                      return null;
                    }

                    return (
                      <View key={location.id} style={styles.locationActionCard}>
                        <Text style={styles.assetTitle}>{location.name}</Text>
                        <Text style={styles.assetMeta}>
                          {location.type.toUpperCase()}
                          {location.postcode === undefined
                            ? ""
                            : ` · ${location.postcode}`}
                        </Text>
                        <ActionButton
                          label={busy ? "Saving…" : "Arrive Here"}
                          disabled={busy}
                          onPress={() =>
                            recordAction(
                              { type: "arrive", locationId: location.id },
                              `Arrival at ${location.name} recorded.`,
                            )
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              )}
              {activeDiary.locations.length === 0 ? (
                <Text style={styles.emptyHint}>
                  Add the first customer, port or depot in Setup below.
                </Text>
              ) : null}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Trailer actions</Text>
              <Text style={styles.sectionSubtitle}>
                Only trailers available at the current site can be attached
              </Text>
              <View style={styles.assetGrid}>
                {activeDiary.trailers.map((trailer) => {
                  const summary = workflow.snapshot.trailers.find(
                    (item) => item.trailer.id === trailer.id,
                  );
                  const attachable = workflow.attachableTrailerIds.includes(
                    trailer.id,
                  );
                  const detachable =
                    workflow.detachableTrailerId === trailer.id;

                  return (
                    <View key={trailer.id} style={styles.assetCard}>
                      <Text style={styles.assetTitle}>{trailer.number}</Text>
                      <Text style={styles.assetMeta}>
                        {summary?.attachedToTractor
                          ? "ATTACHED TO TRACTOR"
                          : summary?.locationId === null
                            ? "LOCATION NOT SET"
                            : (activeDiary.locations.find(
                                (location) =>
                                  location.id === summary?.locationId,
                              )?.name ?? "REGISTERED")}
                      </Text>
                      {attachable ? (
                        <ActionButton
                          label="Attach Trailer"
                          disabled={busy}
                          onPress={() =>
                            recordAction(
                              {
                                type: "attach-trailer",
                                trailerId: trailer.id,
                              },
                              `${trailer.number} attached.`,
                            )
                          }
                        />
                      ) : null}
                      {detachable ? (
                        <ActionButton
                          label="Detach Trailer"
                          tone="neutral"
                          disabled={busy}
                          onPress={() =>
                            recordAction(
                              { type: "detach-trailer" },
                              `${trailer.number} detached.`,
                            )
                          }
                        />
                      ) : null}
                    </View>
                  );
                })}
                {activeDiary.trailers.length === 0 ? (
                  <Text style={styles.emptyHint}>No trailers registered yet.</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Box actions</Text>
              <Text style={styles.sectionSubtitle}>
                Each box keeps its own independent journey and unloading timer
              </Text>
              <View style={styles.boxGrid}>
                {workflow.snapshot.boxes.map((box) => {
                  const accent = BOX_STAGE_COLORS[box.stage];
                  const canCollectLoaded =
                    workflow.collectableLoadedBoxIds.includes(box.box.id);
                  const canDrop = workflow.droppableLoadedBoxIds.includes(
                    box.box.id,
                  );
                  const canMarkReady =
                    workflow.boxesAwaitingEmptyConfirmationIds.includes(
                      box.box.id,
                    );
                  const canCollectEmpty =
                    workflow.collectableEmptyBoxIds.includes(box.box.id);
                  const canReturnEmpty =
                    workflow.returnableEmptyBoxIds.includes(box.box.id);

                  return (
                    <View
                      key={box.box.id}
                      style={[styles.boxCard, { borderLeftColor: accent }]}
                    >
                      <View style={styles.boxHeader}>
                        <View>
                          <Text style={styles.boxNumber}>{box.box.number}</Text>
                          <Text style={styles.assetMeta}>
                            {box.box.isoType ?? "TYPE NOT SET"}
                            {box.box.sealNumber === undefined
                              ? ""
                              : ` · SEAL ${box.box.sealNumber}`}
                          </Text>
                        </View>
                        <Text style={[styles.boxStage, { color: accent }]}>
                          {BOX_STAGE_LABELS[box.stage].toUpperCase()}
                        </Text>
                      </View>
                      {box.unloadingElapsedMinutes === null ? null : (
                        <Text style={styles.boxTiming}>
                          Unloading {formatMinutes(box.unloadingElapsedMinutes)} ·
                          driver present {" "}
                          {formatMinutes(
                            box.driverPresentDuringUnloadingMinutes,
                          )}
                        </Text>
                      )}
                      <View style={styles.boxActions}>
                        {canCollectLoaded ? (
                          <ActionButton
                            label="Collect Loaded"
                            disabled={busy}
                            onPress={() =>
                              recordAction(
                                {
                                  type: "collect-loaded-box",
                                  boxId: box.box.id,
                                },
                                `${box.box.number} collected loaded.`,
                              )
                            }
                          />
                        ) : null}
                        {canDrop ? (
                          <ActionButton
                            label="Drop for Unloading"
                            tone="warning"
                            disabled={busy}
                            onPress={() =>
                              recordAction(
                                {
                                  type: "drop-box-for-unloading",
                                  boxId: box.box.id,
                                },
                                `${box.box.number} dropped for unloading.`,
                              )
                            }
                          />
                        ) : null}
                        {canMarkReady ? (
                          <ActionButton
                            label="Mark Empty Ready"
                            tone="good"
                            disabled={busy}
                            onPress={() =>
                              recordAction(
                                {
                                  type: "mark-box-empty-ready",
                                  boxId: box.box.id,
                                },
                                `${box.box.number} marked empty and ready.`,
                              )
                            }
                          />
                        ) : null}
                        {canCollectEmpty ? (
                          <ActionButton
                            label="Collect Empty"
                            disabled={busy}
                            onPress={() =>
                              recordAction(
                                {
                                  type: "collect-empty-box",
                                  boxId: box.box.id,
                                },
                                `${box.box.number} collected empty.`,
                              )
                            }
                          />
                        ) : null}
                        {canReturnEmpty ? (
                          <ActionButton
                            label="Return Empty"
                            tone="good"
                            disabled={busy}
                            onPress={() =>
                              recordAction(
                                {
                                  type: "return-empty-box",
                                  boxId: box.box.id,
                                },
                                `${box.box.number} returned empty.`,
                              )
                            }
                          />
                        ) : null}
                      </View>
                    </View>
                  );
                })}
                {activeDiary.boxes.length === 0 ? (
                  <Text style={styles.emptyHint}>No boxes registered yet.</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Quick diary note</Text>
              <Text style={styles.sectionSubtitle}>
                Notes inherit the current site automatically
              </Text>
              <View style={styles.inlineForm}>
                <View style={styles.flexField}>
                  <Field
                    value={noteText}
                    onChangeText={setNoteText}
                    placeholder="Waiting for paperwork, bay unavailable…"
                  />
                </View>
                <ActionButton
                  label="Save Note"
                  tone="neutral"
                  disabled={busy || noteText.trim() === ""}
                  onPress={addNote}
                />
              </View>
            </View>

            <View style={styles.setupCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Setup</Text>
                  <Text style={styles.sectionSubtitle}>
                    Add assets as the working day unfolds
                  </Text>
                </View>
                <View style={styles.protectedBadge}>
                  <Text style={styles.protectedBadgeText}>AUTOSAVE PROTECTED</Text>
                </View>
              </View>

              <View style={styles.setupGrid}>
                <View style={styles.setupPanel}>
                  <Text style={styles.setupTitle}>Add location</Text>
                  <View style={styles.choiceRow}>
                    {LOCATION_TYPES.map((choice) => (
                      <ChoiceChip
                        key={choice.type}
                        label={choice.label}
                        selected={locationType === choice.type}
                        onPress={() => setLocationType(choice.type)}
                      />
                    ))}
                  </View>
                  <Field
                    value={locationName}
                    onChangeText={setLocationName}
                    placeholder="Customer or site name"
                  />
                  <Field
                    value={locationPostcode}
                    onChangeText={setLocationPostcode}
                    placeholder="Postcode"
                  />
                  <ActionButton
                    label="Add Location"
                    disabled={busy || locationName.trim() === ""}
                    onPress={addLocation}
                  />
                </View>

                <View style={styles.setupPanel}>
                  <Text style={styles.setupTitle}>Add trailer</Text>
                  <Field
                    value={trailerNumber}
                    onChangeText={setTrailerNumber}
                    placeholder="Trailer number"
                  />
                  <Field
                    value={trailerDescription}
                    onChangeText={setTrailerDescription}
                    placeholder="Description (optional)"
                  />
                  <Text style={styles.fieldLabel}>INITIAL LOCATION</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.choiceRow}>
                      <ChoiceChip
                        label="Not set"
                        selected={trailerLocationId === null}
                        onPress={() => setTrailerLocationId(null)}
                      />
                      {activeDiary.locations.map((location) => (
                        <ChoiceChip
                          key={location.id}
                          label={location.name}
                          selected={trailerLocationId === location.id}
                          onPress={() => setTrailerLocationId(location.id)}
                        />
                      ))}
                    </View>
                  </ScrollView>
                  <ActionButton
                    label="Add Trailer"
                    disabled={busy || trailerNumber.trim() === ""}
                    onPress={addTrailer}
                  />
                </View>

                <View style={styles.setupPanel}>
                  <Text style={styles.setupTitle}>Add box</Text>
                  <View style={styles.choiceRow}>
                    <ChoiceChip
                      label="Loaded"
                      selected={boxInitialState === "loaded"}
                      onPress={() => setBoxInitialState("loaded")}
                    />
                    <ChoiceChip
                      label="Empty"
                      selected={boxInitialState === "empty"}
                      onPress={() => setBoxInitialState("empty")}
                    />
                  </View>
                  <Field
                    value={boxNumber}
                    onChangeText={setBoxNumber}
                    placeholder="Box / container number"
                  />
                  <View style={styles.twoFields}>
                    <View style={styles.flexField}>
                      <Field
                        value={boxIsoType}
                        onChangeText={setBoxIsoType}
                        placeholder="40HC"
                      />
                    </View>
                    <View style={styles.flexField}>
                      <Field
                        value={boxSeal}
                        onChangeText={setBoxSeal}
                        placeholder="Seal number"
                      />
                    </View>
                  </View>
                  <Field
                    value={boxWeight}
                    onChangeText={setBoxWeight}
                    placeholder="Gross weight kg (optional)"
                    keyboardType="numeric"
                  />
                  <Text style={styles.fieldLabel}>INITIAL LOCATION</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.choiceRow}>
                      <ChoiceChip
                        label="Not set"
                        selected={boxLocationId === null}
                        onPress={() => setBoxLocationId(null)}
                      />
                      {activeDiary.locations.map((location) => (
                        <ChoiceChip
                          key={location.id}
                          label={location.name}
                          selected={boxLocationId === location.id}
                          onPress={() => setBoxLocationId(location.id)}
                        />
                      ))}
                    </View>
                  </ScrollView>
                  <ActionButton
                    label="Add Box"
                    disabled={busy || boxNumber.trim() === ""}
                    onPress={addBox}
                  />
                </View>
              </View>
            </View>

            <View style={styles.auditFooter}>
              <Text style={styles.auditFooterText}>
                {activeDiary.events.length} timestamped events · last saved {" "}
                {activeDiary.events.length === 0
                  ? "when diary started"
                  : formatTime(
                      activeDiary.events[activeDiary.events.length - 1]
                        ?.occurredAt ?? new Date().toISOString(),
                    )}
              </Text>
              <Pressable
                style={styles.viewDiaryButton}
                onPress={() => router.replace("/operations/day")}
              >
                <Text style={styles.viewDiaryButtonText}>View Diary →</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020817" },
  page: { padding: 16, gap: 12, backgroundColor: "#020817" },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 14 },
  logo: { width: 170, height: 57 },
  eyebrow: {
    color: "#22c55e",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: { color: "#f8fafc", fontSize: 25, fontWeight: "900", marginTop: 3 },
  subtitle: { color: "#7891b2", fontSize: 11, marginTop: 3 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerButton: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#25415f",
    borderRadius: 11,
    backgroundColor: "#071426",
  },
  headerButtonText: { color: "#38bdf8", fontSize: 11, fontWeight: "900" },
  closeButton: {
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 11,
    backgroundColor: "#f1f5f9",
  },
  closeButtonText: { color: "#071426", fontSize: 11, fontWeight: "900" },
  successBanner: {
    padding: 11,
    borderWidth: 1,
    borderColor: "#166534",
    borderRadius: 10,
    backgroundColor: "#052e1b",
  },
  successText: { color: "#86efac", fontSize: 11, fontWeight: "800" },
  errorBanner: {
    padding: 11,
    borderWidth: 1,
    borderColor: "#9f1239",
    borderRadius: 10,
    backgroundColor: "#4c0519",
  },
  errorText: { color: "#fda4af", fontSize: 11, fontWeight: "800" },
  loadingCard: {
    minHeight: 420,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1b3551",
    borderRadius: 16,
    backgroundColor: "#061324",
  },
  loadingText: { color: "#7891b2", fontSize: 13, fontWeight: "800" },
  startCard: {
    minHeight: 470,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    borderWidth: 1,
    borderColor: "#1b3551",
    borderRadius: 18,
    backgroundColor: "#061324",
  },
  startEyebrow: {
    color: "#38bdf8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  startTitle: { color: "#f8fafc", fontSize: 28, fontWeight: "900", marginTop: 9 },
  startText: {
    maxWidth: 560,
    color: "#7891b2",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
  startInputWrap: { width: "100%", maxWidth: 420, marginVertical: 18 },
  liveSummaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  liveSummaryCard: {
    flex: 1,
    minWidth: 240,
    padding: 14,
    borderWidth: 1,
    borderTopWidth: 3,
    borderRadius: 14,
    backgroundColor: "#081628",
  },
  liveSummarySite: { borderColor: "#1b3551", borderTopColor: "#38bdf8" },
  liveSummaryTrailer: { borderColor: "#1b3551", borderTopColor: "#a855f7" },
  liveSummaryBoxes: { borderColor: "#1b3551", borderTopColor: "#22c55e" },
  summaryLabel: {
    color: "#6782a3",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  summaryValue: { color: "#f8fafc", fontSize: 19, fontWeight: "900", marginTop: 7 },
  summaryDetail: { color: "#8ba4c1", fontSize: 10, marginTop: 4 },
  sectionCard: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#1b3551",
    borderRadius: 16,
    backgroundColor: "#061324",
  },
  setupCard: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#25415f",
    borderRadius: 16,
    backgroundColor: "#071426",
  },
  sectionHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 13,
  },
  sectionTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "900" },
  sectionSubtitle: { color: "#6f89a8", fontSize: 10, marginTop: 4 },
  locationActionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  locationActionCard: {
    flex: 1,
    minWidth: 220,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#1b3551",
    borderRadius: 12,
    backgroundColor: "#091a2e",
  },
  assetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 13 },
  assetCard: {
    minWidth: 220,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#1b3551",
    borderRadius: 12,
    backgroundColor: "#091a2e",
  },
  assetTitle: { color: "#f8fafc", fontSize: 14, fontWeight: "900" },
  assetMeta: { color: "#6f89a8", fontSize: 8, fontWeight: "800" },
  boxGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 13 },
  boxCard: {
    flex: 1,
    minWidth: 390,
    padding: 13,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: "#1b3551",
    borderRadius: 12,
    backgroundColor: "#091a2e",
  },
  boxHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  boxNumber: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  boxStage: { fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  boxTiming: { color: "#8ba4c1", fontSize: 9, marginTop: 9 },
  boxActions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: "#0284c7",
  },
  actionGood: { backgroundColor: "#15803d" },
  actionWarning: { backgroundColor: "#b45309" },
  actionNeutral: { backgroundColor: "#334155" },
  actionDanger: { backgroundColor: "#be123c" },
  actionDisabled: { opacity: 0.35 },
  actionButtonText: { color: "#ffffff", fontSize: 10, fontWeight: "900" },
  inlineForm: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 13 },
  setupGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  setupPanel: {
    flex: 1,
    minWidth: 300,
    padding: 13,
    gap: 9,
    borderWidth: 1,
    borderColor: "#1b3551",
    borderRadius: 12,
    backgroundColor: "#091a2e",
  },
  setupTitle: { color: "#f8fafc", fontSize: 15, fontWeight: "900" },
  input: {
    minHeight: 42,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#29445f",
    borderRadius: 9,
    color: "#f8fafc",
    backgroundColor: "#061324",
    fontSize: 11,
    fontWeight: "700",
  },
  fieldLabel: { color: "#6782a3", fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  choiceChip: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#29445f",
    borderRadius: 999,
    backgroundColor: "#071426",
  },
  choiceChipSelected: { borderColor: "#0ea5e9", backgroundColor: "#083344" },
  choiceChipText: { color: "#7891b2", fontSize: 8, fontWeight: "800" },
  choiceChipTextSelected: { color: "#67e8f9" },
  twoFields: { flexDirection: "row", gap: 8 },
  flexField: { flex: 1, minWidth: 150 },
  protectedBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#166534",
    borderRadius: 999,
    backgroundColor: "#052e1b",
  },
  protectedBadgeText: { color: "#4ade80", fontSize: 8, fontWeight: "900" },
  emptyHint: { color: "#5f7a9b", fontSize: 11, fontStyle: "italic", marginTop: 10 },
  auditFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#04101f",
  },
  auditFooterText: { color: "#5f7a9b", fontSize: 9 },
  viewDiaryButton: { paddingHorizontal: 12, paddingVertical: 8 },
  viewDiaryButtonText: { color: "#38bdf8", fontSize: 10, fontWeight: "900" },
});
