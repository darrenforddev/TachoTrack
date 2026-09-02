import {
  activateCustomerOperationsDiary,
  clearActiveCustomerOperationsDiary,
  clearCustomerOperationsDiaryStorage,
  createCustomerOperationsDiaryArchive,
  decodeCustomerOperationsDiaryStorage,
  getActiveCustomerOperationsDiary,
  getCustomerOperationsDiaryByDate,
  getCustomerOperationsDiaryById,
  hasStoredCustomerOperationsDiaryArchive,
  loadCustomerOperationsDiaryArchiveResult,
  removeCustomerOperationsDiary,
  restoreCustomerOperationsDiary,
  saveCustomerOperationsDiaryArchive,
  upsertCustomerOperationsDiary,
  upsertCustomerOperationsDiaryInStorage,
  type CustomerOperationsDiaryArchive,
  type CustomerOperationsDiaryStorageAdapter,
} from "../../data/customerOperationsDiaryStorage";
import {
  createCustomerOperationsDiary,
  recordCustomerOperationsEvent,
  registerOperationsBox,
  registerOperationsLocation,
  registerOperationsTrailer,
  type CustomerOperationsDiary,
} from "../customerOperationsDiary";

class MemoryStorage implements CustomerOperationsDiaryStorageAdapter {
  private readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }

  firstValue(): string | null {
    return this.values.values().next().value ?? null;
  }
}

function buildDiary(
  id: string,
  dutyDate: string,
  eventPrefix: string,
): CustomerOperationsDiary {
  let diary = createCustomerOperationsDiary({
    id,
    dutyDate,
    tractorRegistration: "YX26 TTK",
  });

  diary = registerOperationsLocation(diary, {
    id: `${eventPrefix}-port`,
    name: "Felixstowe Port",
    type: "port",
    postcode: "IP11 3SY",
  });
  diary = registerOperationsTrailer(diary, {
    id: `${eventPrefix}-trailer`,
    number: `${eventPrefix.toUpperCase()}-TRL`,
    initialLocationId: `${eventPrefix}-port`,
  });
  diary = registerOperationsBox(diary, {
    id: `${eventPrefix}-box`,
    number: `${eventPrefix.toUpperCase()}U1234567`,
    initialLocationId: `${eventPrefix}-port`,
    initialLoadState: "loaded",
  });
  diary = recordCustomerOperationsEvent(diary, {
    id: `${eventPrefix}-arrive`,
    type: "arrived-at-location",
    visitId: `${eventPrefix}-visit`,
    locationId: `${eventPrefix}-port`,
    occurredAt: `${dutyDate}T06:00:00.000Z`,
    source: "manual",
  });
  diary = recordCustomerOperationsEvent(diary, {
    id: `${eventPrefix}-attach`,
    type: "trailer-attached",
    trailerId: `${eventPrefix}-trailer`,
    occurredAt: `${dutyDate}T06:05:00.000Z`,
    source: "manual",
  });

  return diary;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(
      `Customer operations diary storage scenario failed: ${message}`,
    );
  }
}

async function assertRejects(
  action: () => Promise<unknown> | unknown,
  message: string,
): Promise<void> {
  let rejected = false;

  try {
    await action();
  } catch {
    rejected = true;
  }

  assert(rejected, message);
}

async function run(): Promise<void> {
  let passed = 0;

  function pass(message: string): void {
    passed += 1;
    console.log(`✅ ${message}`);
  }

  const firstDiary = buildDiary("operations-2026-09-02", "2026-09-02", "a");
  const olderDiary = buildDiary("operations-2026-09-01", "2026-09-01", "b");

  let archive = createCustomerOperationsDiaryArchive();

  assert(
    archive.diaries.length === 0 && archive.activeDiaryId === null,
    "A new archive should be empty and inactive.",
  );
  pass("A new archive is empty and inactive");

  archive = upsertCustomerOperationsDiary(archive, firstDiary);
  assert(archive.diaries.length === 1, "Upsert should add a diary.");
  pass("Upsert adds the first operational diary");

  assert(
    getCustomerOperationsDiaryById(archive, firstDiary.id)?.dutyDate ===
      "2026-09-02",
    "Lookup by id should return the canonical diary.",
  );
  pass("A diary can be found by identifier");

  assert(
    getCustomerOperationsDiaryByDate(archive, "2026-09-02")?.id ===
      firstDiary.id,
    "Lookup by date should return the canonical diary.",
  );
  pass("A diary can be found by duty date");

  archive = upsertCustomerOperationsDiary(archive, olderDiary);
  assert(
    archive.diaries.map((diary) => diary.dutyDate).join(",") ===
      "2026-09-01,2026-09-02",
    "Archive diaries should remain chronological.",
  );
  pass("Archive diaries remain chronological");

  archive = activateCustomerOperationsDiary(archive, firstDiary.id);
  assert(
    getActiveCustomerOperationsDiary(archive)?.id === firstDiary.id,
    "Activation should expose the active diary.",
  );
  pass("The live operational diary survives as explicit active state");

  const correctedFirstDiary = {
    ...firstDiary,
    tractorRegistration: "YX26 NEW",
  };
  archive = upsertCustomerOperationsDiary(archive, correctedFirstDiary);
  assert(
    archive.diaries.length === 2 &&
      getActiveCustomerOperationsDiary(archive)?.tractorRegistration ===
        "YX26 NEW",
    "Replacing the same diary should keep it active.",
  );
  pass("Correcting the active diary preserves its active identity");

  const replacementDateDiary = buildDiary(
    "replacement-2026-09-02",
    "2026-09-02",
    "c",
  );
  archive = upsertCustomerOperationsDiary(archive, replacementDateDiary);
  assert(
    archive.diaries.length === 2 &&
      archive.activeDiaryId === replacementDateDiary.id &&
      getCustomerOperationsDiaryById(archive, firstDiary.id) === null,
    "Replacing a duty date should move active state to the replacement.",
  );
  pass("One canonical diary is retained for each duty date");

  archive = clearActiveCustomerOperationsDiary(archive);
  assert(
    getActiveCustomerOperationsDiary(archive) === null,
    "Clearing active state should retain history but no active diary.",
  );
  pass("Active state can be cleared without deleting history");

  archive = activateCustomerOperationsDiary(archive, replacementDateDiary.id);
  archive = removeCustomerOperationsDiary(archive, replacementDateDiary.id);
  assert(
    archive.activeDiaryId === null &&
      getCustomerOperationsDiaryById(archive, replacementDateDiary.id) ===
        null,
    "Removing the active diary should clear its pointer.",
  );
  pass("Removing the active diary cannot leave a dangling pointer");

  await assertRejects(
    () => activateCustomerOperationsDiary(archive, "missing-diary"),
    "Unknown diaries must not become active.",
  );
  pass("Unknown diaries cannot become active");

  const restored = restoreCustomerOperationsDiary(
    JSON.parse(JSON.stringify(firstDiary)),
  );
  assert(
    restored.id === firstDiary.id &&
      restored.dutyDate === firstDiary.dutyDate &&
      restored.locations.length === firstDiary.locations.length &&
      restored.trailers.length === firstDiary.trailers.length &&
      restored.boxes.length === firstDiary.boxes.length &&
      restored.events.length === firstDiary.events.length &&
      restored.events[restored.events.length - 1]?.id ===
        firstDiary.events[firstDiary.events.length - 1]?.id,
    "A valid diary should round-trip through evidence replay.",
  );
  pass("Stored evidence is rebuilt through the engine rules");

  const emptyDecode = decodeCustomerOperationsDiaryStorage(null);
  assert(
    emptyDecode.status === "empty" && emptyDecode.archive.diaries.length === 0,
    "Missing storage should hydrate as an empty archive.",
  );
  pass("A first app launch hydrates safely with no stored diary");

  const memory = new MemoryStorage();
  const activeArchive = activateCustomerOperationsDiary(
    upsertCustomerOperationsDiary(
      createCustomerOperationsDiaryArchive(),
      firstDiary,
    ),
    firstDiary.id,
  );

  await saveCustomerOperationsDiaryArchive(activeArchive, memory);
  const loaded = await loadCustomerOperationsDiaryArchiveResult(memory);
  assert(
    loaded.status === "loaded" &&
      loaded.archive.activeDiaryId === firstDiary.id &&
      loaded.archive.diaries[0]?.events.length === firstDiary.events.length,
    "Save and load should preserve the active diary and evidence.",
  );
  pass("An active shift survives a complete storage round trip");

  assert(
    await hasStoredCustomerOperationsDiaryArchive(memory),
    "Stored archive should be detectable.",
  );
  await clearCustomerOperationsDiaryStorage(memory);
  assert(
    !(await hasStoredCustomerOperationsDiaryArchive(memory)),
    "Clear should remove stored archive.",
  );
  pass("Stored diary presence and clearing are explicit");

  const upsertMemory = new MemoryStorage();
  const upserted = await upsertCustomerOperationsDiaryInStorage(firstDiary, {
    makeActive: true,
    storage: upsertMemory,
  });
  assert(
    upserted.activeDiaryId === firstDiary.id &&
      upserted.diaries.length === 1,
    "Storage upsert should save and activate in one operation.",
  );
  pass("A newly started shift can be saved and activated atomically");

  const invalidJson = decodeCustomerOperationsDiaryStorage("not-json");
  assert(
    invalidJson.status === "invalid" &&
      invalidJson.issues[0]?.code === "invalid-json",
    "Invalid JSON should be reported without throwing.",
  );
  pass("Invalid JSON falls back safely with an audit issue");

  const unsupported = decodeCustomerOperationsDiaryStorage(
    JSON.stringify({ version: 99, savedAt: new Date().toISOString() }),
  );
  assert(
    unsupported.status === "invalid" &&
      unsupported.issues[0]?.code === "unsupported-version",
    "Unknown storage versions should be rejected safely.",
  );
  pass("Unknown future storage versions are not misread");

  const futureStorage = new MemoryStorage();
  await futureStorage.setItem(
    "tachotrack.customer-operations-diary-archive.v1",
    JSON.stringify({ version: 99, savedAt: new Date().toISOString() }),
  );
  await assertRejects(
    () =>
      upsertCustomerOperationsDiaryInStorage(firstDiary, {
        makeActive: true,
        storage: futureStorage,
      }),
    "An invalid or future archive must not be overwritten automatically.",
  );
  assert(
    JSON.parse(futureStorage.firstValue() as string).version === 99,
    "Rejected writes should leave unknown stored data untouched.",
  );
  pass("Invalid or future storage is protected from automatic overwrite");

  await saveCustomerOperationsDiaryArchive(activeArchive, memory);
  const validEnvelope = JSON.parse(memory.firstValue() as string) as {
    version: number;
    savedAt: string;
    archive: CustomerOperationsDiaryArchive;
  };
  const badDiary = {
    ...JSON.parse(JSON.stringify(firstDiary)),
    id: "damaged-diary",
    events: [
      {
        id: "impossible-departure",
        type: "departed-location",
        visitId: "never-opened",
        occurredAt: "2026-09-03T06:00:00.000Z",
        source: "manual",
      },
    ],
  };
  const partiallyDamaged = decodeCustomerOperationsDiaryStorage(
    JSON.stringify({
      ...validEnvelope,
      archive: {
        ...validEnvelope.archive,
        diaries: [...validEnvelope.archive.diaries, badDiary],
      },
    }),
  );
  assert(
    partiallyDamaged.status === "recovered" &&
      partiallyDamaged.archive.diaries.length === 1 &&
      partiallyDamaged.issues.some((issue) => issue.code === "invalid-diary"),
    "One corrupt diary should not destroy valid history.",
  );
  pass("Valid history is recovered when one stored diary is damaged");

  const danglingActive = decodeCustomerOperationsDiaryStorage(
    JSON.stringify({
      ...validEnvelope,
      archive: {
        ...validEnvelope.archive,
        activeDiaryId: "missing-active",
      },
    }),
  );
  assert(
    danglingActive.status === "recovered" &&
      danglingActive.archive.activeDiaryId === null &&
      danglingActive.issues.some(
        (issue) => issue.code === "missing-active-diary",
      ),
    "Dangling active state should be cleared and reported.",
  );
  pass("Dangling active state is repaired during recovery");

  const duplicateIdArchive: CustomerOperationsDiaryArchive = {
    version: 1,
    diaries: [firstDiary, { ...olderDiary, id: firstDiary.id }],
    activeDiaryId: null,
  };
  await assertRejects(
    () => saveCustomerOperationsDiaryArchive(duplicateIdArchive, memory),
    "Saving duplicate diary identifiers should fail.",
  );
  pass("Duplicate diary identifiers cannot be persisted");

  const duplicateDateArchive: CustomerOperationsDiaryArchive = {
    version: 1,
    diaries: [
      firstDiary,
      { ...olderDiary, id: "another-id", dutyDate: firstDiary.dutyDate },
    ],
    activeDiaryId: null,
  };
  await assertRejects(
    () => saveCustomerOperationsDiaryArchive(duplicateDateArchive, memory),
    "Saving duplicate duty dates should fail.",
  );
  pass("Duplicate duty dates cannot be persisted");

  console.log("============================================================");
  console.log(
    `CUSTOMER OPERATIONS DIARY STORAGE RESULT: ${passed}/${passed} passed`,
  );
  console.log("✅ ALL CUSTOMER OPERATIONS STORAGE SCENARIOS PASSED");
  console.log("============================================================");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
