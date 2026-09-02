import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createCustomerOperationsDiary,
  recordCustomerOperationsEvent,
  registerOperationsBox,
  registerOperationsLocation,
  registerOperationsTrailer,
  type CustomerOperationsDiary,
  type OperationsBox,
  type OperationsDiaryEvent,
  type OperationsEventSource,
  type OperationsLocation,
  type OperationsLocationType,
  type OperationsTrailer,
} from "../engine/customerOperationsDiary";

export const CUSTOMER_OPERATIONS_DIARY_STORAGE_KEY =
  "tachotrack.customer-operations-diary-archive.v1";

export interface CustomerOperationsDiaryArchive {
  version: 1;
  diaries: CustomerOperationsDiary[];
  activeDiaryId: string | null;
}

export interface CustomerOperationsDiaryStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type CustomerOperationsDiaryLoadStatus =
  | "empty"
  | "loaded"
  | "recovered"
  | "invalid";

export type CustomerOperationsDiaryRecoveryIssueCode =
  | "invalid-json"
  | "unsupported-version"
  | "invalid-envelope"
  | "invalid-diary"
  | "duplicate-diary-id"
  | "duplicate-duty-date"
  | "missing-active-diary";

export interface CustomerOperationsDiaryRecoveryIssue {
  code: CustomerOperationsDiaryRecoveryIssueCode;
  message: string;
  diaryId?: string;
}

export interface CustomerOperationsDiaryLoadResult {
  status: CustomerOperationsDiaryLoadStatus;
  archive: CustomerOperationsDiaryArchive;
  savedAt: string | null;
  issues: CustomerOperationsDiaryRecoveryIssue[];
}

interface StoredCustomerOperationsDiaryArchive {
  version: 1;
  savedAt: string;
  archive: CustomerOperationsDiaryArchive;
}

const LOCATION_TYPES: readonly OperationsLocationType[] = [
  "customer",
  "port",
  "depot",
  "company-site",
  "partner-site",
  "other",
];

const EVENT_SOURCES: readonly OperationsEventSource[] = [
  "manual",
  "gps",
  "admin-correction",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function isLocationType(value: unknown): value is OperationsLocationType {
  return LOCATION_TYPES.some((item) => item === value);
}

function isEventSource(value: unknown): value is OperationsEventSource {
  return EVENT_SOURCES.some((item) => item === value);
}

function requireLocation(value: unknown): OperationsLocation {
  if (
    !isRecord(value) ||
    !isNonBlankString(value.id) ||
    !isNonBlankString(value.name) ||
    !isLocationType(value.type) ||
    !isOptionalString(value.postcode)
  ) {
    throw new Error("Stored operations location is invalid.");
  }

  return {
    id: value.id,
    name: value.name,
    type: value.type,
    ...(value.postcode === undefined ? {} : { postcode: value.postcode }),
  };
}

function requireTrailer(value: unknown): OperationsTrailer {
  if (
    !isRecord(value) ||
    !isNonBlankString(value.id) ||
    !isNonBlankString(value.number) ||
    !isOptionalString(value.description) ||
    !isOptionalString(value.initialLocationId)
  ) {
    throw new Error("Stored operations trailer is invalid.");
  }

  return {
    id: value.id,
    number: value.number,
    ...(value.description === undefined
      ? {}
      : { description: value.description }),
    ...(value.initialLocationId === undefined
      ? {}
      : { initialLocationId: value.initialLocationId }),
  };
}

function requireBox(value: unknown): OperationsBox {
  if (
    !isRecord(value) ||
    !isNonBlankString(value.id) ||
    !isNonBlankString(value.number) ||
    !isOptionalString(value.isoType) ||
    !isOptionalString(value.sealNumber) ||
    !isOptionalString(value.initialLocationId) ||
    (value.initialLoadState !== "loaded" &&
      value.initialLoadState !== "empty") ||
    (value.grossWeightKg !== undefined &&
      (typeof value.grossWeightKg !== "number" ||
        !Number.isFinite(value.grossWeightKg)))
  ) {
    throw new Error("Stored operations box is invalid.");
  }

  return {
    id: value.id,
    number: value.number,
    initialLoadState: value.initialLoadState,
    ...(value.isoType === undefined ? {} : { isoType: value.isoType }),
    ...(value.sealNumber === undefined
      ? {}
      : { sealNumber: value.sealNumber }),
    ...(value.grossWeightKg === undefined
      ? {}
      : { grossWeightKg: value.grossWeightKg }),
    ...(value.initialLocationId === undefined
      ? {}
      : { initialLocationId: value.initialLocationId }),
  };
}

function hasValidEventBase(
  value: Record<string, unknown>,
): value is Record<string, unknown> & {
  id: string;
  occurredAt: string;
  source: OperationsEventSource;
  note?: string;
} {
  return (
    isNonBlankString(value.id) &&
    isIsoTimestamp(value.occurredAt) &&
    isEventSource(value.source) &&
    isOptionalString(value.note)
  );
}

function requireEvent(value: unknown): OperationsDiaryEvent {
  if (!isRecord(value) || !hasValidEventBase(value)) {
    throw new Error("Stored operations event is invalid.");
  }

  const base = {
    id: value.id,
    occurredAt: value.occurredAt,
    source: value.source,
    ...(value.note === undefined ? {} : { note: value.note }),
  };

  switch (value.type) {
    case "arrived-at-location":
      if (
        !isNonBlankString(value.visitId) ||
        !isNonBlankString(value.locationId)
      ) {
        break;
      }

      return {
        ...base,
        type: value.type,
        visitId: value.visitId,
        locationId: value.locationId,
      };

    case "departed-location":
      if (!isNonBlankString(value.visitId)) {
        break;
      }

      return { ...base, type: value.type, visitId: value.visitId };

    case "trailer-attached":
    case "trailer-detached":
      if (!isNonBlankString(value.trailerId)) {
        break;
      }

      return { ...base, type: value.type, trailerId: value.trailerId };

    case "loaded-box-collected":
    case "box-dropped-for-unloading":
    case "empty-box-collected":
    case "empty-box-returned":
      if (
        !isNonBlankString(value.boxId) ||
        !isNonBlankString(value.trailerId)
      ) {
        break;
      }

      return {
        ...base,
        type: value.type,
        boxId: value.boxId,
        trailerId: value.trailerId,
      };

    case "box-empty-ready":
      if (
        !isNonBlankString(value.boxId) ||
        !isNonBlankString(value.locationId)
      ) {
        break;
      }

      return {
        ...base,
        type: value.type,
        boxId: value.boxId,
        locationId: value.locationId,
      };

    case "diary-note":
      if (
        !isNonBlankString(value.text) ||
        !isOptionalString(value.locationId) ||
        !isOptionalString(value.boxId) ||
        !isOptionalString(value.trailerId)
      ) {
        break;
      }

      return {
        ...base,
        type: value.type,
        text: value.text,
        ...(value.locationId === undefined
          ? {}
          : { locationId: value.locationId }),
        ...(value.boxId === undefined ? {} : { boxId: value.boxId }),
        ...(value.trailerId === undefined
          ? {}
          : { trailerId: value.trailerId }),
      };
  }

  throw new Error("Stored operations event has an invalid type or payload.");
}

/**
 * Rebuild persisted evidence through the public engine API. This makes storage
 * recovery prove every asset reference, timestamp and state transition instead
 * of trusting a JSON cast.
 */
export function restoreCustomerOperationsDiary(
  value: unknown,
): CustomerOperationsDiary {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isNonBlankString(value.id) ||
    !isNonBlankString(value.dutyDate) ||
    !isOptionalString(value.tractorRegistration) ||
    !Array.isArray(value.locations) ||
    !Array.isArray(value.trailers) ||
    !Array.isArray(value.boxes) ||
    !Array.isArray(value.events)
  ) {
    throw new Error("Stored customer operations diary is invalid.");
  }

  let diary = createCustomerOperationsDiary({
    id: value.id,
    dutyDate: value.dutyDate,
    ...(value.tractorRegistration === undefined
      ? {}
      : { tractorRegistration: value.tractorRegistration }),
  });

  for (const locationValue of value.locations) {
    diary = registerOperationsLocation(diary, requireLocation(locationValue));
  }

  for (const trailerValue of value.trailers) {
    diary = registerOperationsTrailer(diary, requireTrailer(trailerValue));
  }

  for (const boxValue of value.boxes) {
    diary = registerOperationsBox(diary, requireBox(boxValue));
  }

  for (const eventValue of value.events) {
    diary = recordCustomerOperationsEvent(diary, requireEvent(eventValue));
  }

  return diary;
}

export function createCustomerOperationsDiaryArchive(): CustomerOperationsDiaryArchive {
  return {
    version: 1,
    diaries: [],
    activeDiaryId: null,
  };
}

export function getCustomerOperationsDiaryById(
  archive: CustomerOperationsDiaryArchive,
  diaryId: string,
): CustomerOperationsDiary | null {
  return archive.diaries.find((diary) => diary.id === diaryId) ?? null;
}

export function getCustomerOperationsDiaryByDate(
  archive: CustomerOperationsDiaryArchive,
  dutyDate: string,
): CustomerOperationsDiary | null {
  return archive.diaries.find((diary) => diary.dutyDate === dutyDate) ?? null;
}

export function getActiveCustomerOperationsDiary(
  archive: CustomerOperationsDiaryArchive,
): CustomerOperationsDiary | null {
  if (archive.activeDiaryId === null) {
    return null;
  }

  return getCustomerOperationsDiaryById(archive, archive.activeDiaryId);
}

export function upsertCustomerOperationsDiary(
  archive: CustomerOperationsDiaryArchive,
  diary: CustomerOperationsDiary,
): CustomerOperationsDiaryArchive {
  const restoredDiary = restoreCustomerOperationsDiary(diary);
  const replacedIds = archive.diaries
    .filter(
      (item) =>
        item.id === restoredDiary.id ||
        item.dutyDate === restoredDiary.dutyDate,
    )
    .map((item) => item.id);
  const diaries = archive.diaries
    .filter(
      (item) =>
        item.id !== restoredDiary.id &&
        item.dutyDate !== restoredDiary.dutyDate,
    )
    .concat(restoredDiary)
    .sort((left, right) => left.dutyDate.localeCompare(right.dutyDate));
  const activeDiaryId =
    archive.activeDiaryId !== null &&
    replacedIds.includes(archive.activeDiaryId)
      ? restoredDiary.id
      : archive.activeDiaryId;

  return {
    version: 1,
    diaries,
    activeDiaryId,
  };
}

export function activateCustomerOperationsDiary(
  archive: CustomerOperationsDiaryArchive,
  diaryId: string,
): CustomerOperationsDiaryArchive {
  if (getCustomerOperationsDiaryById(archive, diaryId) === null) {
    throw new Error(`Cannot activate unknown operations diary: ${diaryId}`);
  }

  return { ...archive, activeDiaryId: diaryId };
}

export function clearActiveCustomerOperationsDiary(
  archive: CustomerOperationsDiaryArchive,
): CustomerOperationsDiaryArchive {
  return { ...archive, activeDiaryId: null };
}

export function removeCustomerOperationsDiary(
  archive: CustomerOperationsDiaryArchive,
  diaryId: string,
): CustomerOperationsDiaryArchive {
  return {
    ...archive,
    diaries: archive.diaries.filter((diary) => diary.id !== diaryId),
    activeDiaryId:
      archive.activeDiaryId === diaryId ? null : archive.activeDiaryId,
  };
}

function recoverArchive(
  value: unknown,
): Pick<CustomerOperationsDiaryLoadResult, "archive" | "issues"> | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.diaries) ||
    (value.activeDiaryId !== null &&
      typeof value.activeDiaryId !== "string")
  ) {
    return null;
  }

  const archive = createCustomerOperationsDiaryArchive();
  const issues: CustomerOperationsDiaryRecoveryIssue[] = [];
  const diaryIds = new Set<string>();
  const dutyDates = new Set<string>();

  for (const diaryValue of value.diaries) {
    const hintedDiaryId =
      isRecord(diaryValue) && typeof diaryValue.id === "string"
        ? diaryValue.id
        : undefined;

    try {
      const diary = restoreCustomerOperationsDiary(diaryValue);

      if (diaryIds.has(diary.id)) {
        issues.push({
          code: "duplicate-diary-id",
          message: `Duplicate stored operations diary id was skipped: ${diary.id}`,
          diaryId: diary.id,
        });
        continue;
      }

      if (dutyDates.has(diary.dutyDate)) {
        issues.push({
          code: "duplicate-duty-date",
          message: `Duplicate stored duty date was skipped: ${diary.dutyDate}`,
          diaryId: diary.id,
        });
        continue;
      }

      diaryIds.add(diary.id);
      dutyDates.add(diary.dutyDate);
      archive.diaries.push(diary);
    } catch (error) {
      issues.push({
        code: "invalid-diary",
        message:
          error instanceof Error
            ? error.message
            : "Invalid stored operations diary was skipped.",
        ...(hintedDiaryId === undefined ? {} : { diaryId: hintedDiaryId }),
      });
    }
  }

  archive.diaries.sort((left, right) =>
    left.dutyDate.localeCompare(right.dutyDate),
  );

  if (value.activeDiaryId !== null) {
    if (diaryIds.has(value.activeDiaryId)) {
      archive.activeDiaryId = value.activeDiaryId;
    } else {
      issues.push({
        code: "missing-active-diary",
        message: `Stored active operations diary was unavailable: ${value.activeDiaryId}`,
        diaryId: value.activeDiaryId,
      });
    }
  }

  return { archive, issues };
}

export function decodeCustomerOperationsDiaryStorage(
  raw: string | null,
): CustomerOperationsDiaryLoadResult {
  if (raw === null) {
    return {
      status: "empty",
      archive: createCustomerOperationsDiaryArchive(),
      savedAt: null,
      issues: [],
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      status: "invalid",
      archive: createCustomerOperationsDiaryArchive(),
      savedAt: null,
      issues: [
        {
          code: "invalid-json",
          message: "Customer operations diary storage was not valid JSON.",
        },
      ],
    };
  }

  if (!isRecord(parsed) || parsed.version !== 1) {
    return {
      status: "invalid",
      archive: createCustomerOperationsDiaryArchive(),
      savedAt: null,
      issues: [
        {
          code: "unsupported-version",
          message: "Customer operations diary storage version is unsupported.",
        },
      ],
    };
  }

  if (!isIsoTimestamp(parsed.savedAt)) {
    return {
      status: "invalid",
      archive: createCustomerOperationsDiaryArchive(),
      savedAt: null,
      issues: [
        {
          code: "invalid-envelope",
          message: "Customer operations diary storage envelope is invalid.",
        },
      ],
    };
  }

  const recovered = recoverArchive(parsed.archive);

  if (recovered === null) {
    return {
      status: "invalid",
      archive: createCustomerOperationsDiaryArchive(),
      savedAt: parsed.savedAt,
      issues: [
        {
          code: "invalid-envelope",
          message: "Stored customer operations diary archive is invalid.",
        },
      ],
    };
  }

  return {
    status: recovered.issues.length === 0 ? "loaded" : "recovered",
    archive: recovered.archive,
    savedAt: parsed.savedAt,
    issues: recovered.issues,
  };
}

function prepareArchiveForSave(
  archive: CustomerOperationsDiaryArchive,
): CustomerOperationsDiaryArchive {
  if (archive.version !== 1) {
    throw new Error("Unsupported customer operations diary archive version.");
  }

  const diaryIds = new Set<string>();
  const dutyDates = new Set<string>();
  const diaries = archive.diaries.map((diary) => {
    const restored = restoreCustomerOperationsDiary(diary);

    if (diaryIds.has(restored.id)) {
      throw new Error(`Duplicate operations diary id: ${restored.id}`);
    }

    if (dutyDates.has(restored.dutyDate)) {
      throw new Error(`Duplicate operations duty date: ${restored.dutyDate}`);
    }

    diaryIds.add(restored.id);
    dutyDates.add(restored.dutyDate);
    return restored;
  });

  if (
    archive.activeDiaryId !== null &&
    !diaryIds.has(archive.activeDiaryId)
  ) {
    throw new Error(
      `Active operations diary is missing: ${archive.activeDiaryId}`,
    );
  }

  return {
    version: 1,
    diaries: [...diaries].sort((left, right) =>
      left.dutyDate.localeCompare(right.dutyDate),
    ),
    activeDiaryId: archive.activeDiaryId,
  };
}

export async function saveCustomerOperationsDiaryArchive(
  archive: CustomerOperationsDiaryArchive,
  storage: CustomerOperationsDiaryStorageAdapter = AsyncStorage,
): Promise<void> {
  const stored: StoredCustomerOperationsDiaryArchive = {
    version: 1,
    savedAt: new Date().toISOString(),
    archive: prepareArchiveForSave(archive),
  };

  await storage.setItem(
    CUSTOMER_OPERATIONS_DIARY_STORAGE_KEY,
    JSON.stringify(stored),
  );
}

export async function loadCustomerOperationsDiaryArchiveResult(
  storage: CustomerOperationsDiaryStorageAdapter = AsyncStorage,
): Promise<CustomerOperationsDiaryLoadResult> {
  const raw = await storage.getItem(CUSTOMER_OPERATIONS_DIARY_STORAGE_KEY);

  return decodeCustomerOperationsDiaryStorage(raw);
}

export async function loadCustomerOperationsDiaryArchive(
  storage: CustomerOperationsDiaryStorageAdapter = AsyncStorage,
): Promise<CustomerOperationsDiaryArchive> {
  const result = await loadCustomerOperationsDiaryArchiveResult(storage);

  return result.archive;
}

export async function upsertCustomerOperationsDiaryInStorage(
  diary: CustomerOperationsDiary,
  options: {
    makeActive?: boolean;
    storage?: CustomerOperationsDiaryStorageAdapter;
  } = {},
): Promise<CustomerOperationsDiaryArchive> {
  const storage = options.storage ?? AsyncStorage;
  const loadResult = await loadCustomerOperationsDiaryArchiveResult(storage);

  if (loadResult.status === "invalid") {
    throw new Error(
      "Customer operations diary storage is invalid and was not overwritten.",
    );
  }

  let updated = upsertCustomerOperationsDiary(loadResult.archive, diary);

  if (options.makeActive === true) {
    updated = activateCustomerOperationsDiary(updated, diary.id);
  }

  await saveCustomerOperationsDiaryArchive(updated, storage);
  return updated;
}

export async function clearActiveCustomerOperationsDiaryInStorage(
  storage: CustomerOperationsDiaryStorageAdapter = AsyncStorage,
): Promise<CustomerOperationsDiaryArchive> {
  const loadResult = await loadCustomerOperationsDiaryArchiveResult(storage);

  if (loadResult.status === "invalid") {
    throw new Error(
      "Customer operations diary storage is invalid and was not overwritten.",
    );
  }

  const updated = clearActiveCustomerOperationsDiary(loadResult.archive);

  await saveCustomerOperationsDiaryArchive(updated, storage);
  return updated;
}

export async function clearCustomerOperationsDiaryStorage(
  storage: CustomerOperationsDiaryStorageAdapter = AsyncStorage,
): Promise<void> {
  await storage.removeItem(CUSTOMER_OPERATIONS_DIARY_STORAGE_KEY);
}

export async function hasStoredCustomerOperationsDiaryArchive(
  storage: CustomerOperationsDiaryStorageAdapter = AsyncStorage,
): Promise<boolean> {
  return (
    (await storage.getItem(CUSTOMER_OPERATIONS_DIARY_STORAGE_KEY)) !== null
  );
}
