import {
  MANUAL_DUTY_BOUNDARY_STORAGE_KEY,
  clearManualDutyBoundaryStorage,
  decodeManualDutyBoundaryStorage,
  hasStoredManualDutyBoundaryState,
  loadManualDutyBoundaryStateResult,
  recordManualDutyBoundaryEvidenceInStorage,
  restoreManualDutyBoundaryState,
  saveManualDutyBoundaryState,
  type ManualDutyBoundaryStorageAdapter,
} from "../../data/manualDutyBoundaryStorage";
import {
  buildManualDutyBoundarySnapshot,
  createManualDutyBoundaryState,
  recordManualDutyBoundaryEvidence,
  type ManualDutyBoundaryEvidence,
} from "../manualDutyBoundary";

let passed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Manual-duty storage scenario failed: ${message}`);
  }
}

function pass(message: string): void {
  passed += 1;
  console.log(`✓ ${message}`);
}

async function expectAsyncError(
  action: () => Promise<unknown>,
  message: string,
): Promise<void> {
  let failed = false;

  try {
    await action();
  } catch {
    failed = true;
  }

  assert(failed, message);
  pass(message);
}

class MemoryStorage implements ManualDutyBoundaryStorageAdapter {
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
}

function before(
  overrides: Partial<ManualDutyBoundaryEvidence> = {},
): ManualDutyBoundaryEvidence {
  return {
    id: "stored-duty-start",
    dutyDate: "2026-09-03",
    boundary: "before-card-insertion",
    activity: "other-work",
    startedAt: "2026-09-03T05:40:00.000Z",
    endedAt: "2026-09-03T06:00:00.000Z",
    cardEventAt: "2026-09-03T06:00:00.000Z",
    recordedAt: "2026-09-03T06:00:00.000Z",
    reason: "vehicle-checks",
    source: "driver",
    ...overrides,
  };
}

function after(
  overrides: Partial<ManualDutyBoundaryEvidence> = {},
): ManualDutyBoundaryEvidence {
  return {
    id: "stored-duty-finish",
    dutyDate: "2026-09-03",
    boundary: "after-card-ejection",
    activity: "other-work",
    startedAt: "2026-09-03T17:00:00.000Z",
    endedAt: "2026-09-03T17:25:00.000Z",
    cardEventAt: "2026-09-03T17:00:00.000Z",
    recordedAt: "2026-09-03T17:25:00.000Z",
    reason: "office-admin",
    source: "driver",
    ...overrides,
  };
}

async function run(): Promise<void> {
  const emptyStorage = new MemoryStorage();
  const empty = await loadManualDutyBoundaryStateResult(emptyStorage);

  assert(empty.status === "empty" && empty.state.evidence.length === 0, "");
  pass("A first launch hydrates as a safe empty boundary state");

  let state = recordManualDutyBoundaryEvidence(
    createManualDutyBoundaryState(),
    before(),
  );
  state = recordManualDutyBoundaryEvidence(state, after());
  const roundTripStorage = new MemoryStorage();

  await saveManualDutyBoundaryState(state, roundTripStorage);

  const roundTrip = await loadManualDutyBoundaryStateResult(roundTripStorage);
  const roundTripSnapshot = buildManualDutyBoundarySnapshot(
    roundTrip.state,
    "2026-09-03",
  );

  assert(
    roundTrip.status === "loaded" &&
      roundTripSnapshot.status === "complete" &&
      roundTripSnapshot.additionalOtherWorkMinutes === 45,
    "",
  );
  pass("Start and finish evidence survive a complete storage round trip");

  const correction = before({
    id: "stored-duty-start-correction",
    startedAt: "2026-09-03T05:35:00.000Z",
    recordedAt: "2026-09-03T17:30:00.000Z",
    source: "driver-correction",
    revisesEvidenceId: "stored-duty-start",
  });
  const corrected = recordManualDutyBoundaryEvidence(state, correction);
  const correctionStorage = new MemoryStorage();

  await saveManualDutyBoundaryState(corrected, correctionStorage);

  const correctedLoaded = await loadManualDutyBoundaryStateResult(
    correctionStorage,
  );

  assert(
    correctedLoaded.state.evidence.length === 3 &&
      buildManualDutyBoundarySnapshot(
        correctedLoaded.state,
        "2026-09-03",
      ).actualDutyStartedAt === "2026-09-03T05:35:00.000Z",
    "",
  );
  pass("Corrections retain original evidence and remain effective after reload");

  const atomicStorage = new MemoryStorage();
  const atomicallyStored = await recordManualDutyBoundaryEvidenceInStorage(
    before(),
    atomicStorage,
  );

  assert(
    atomicallyStored.evidence.length === 1 &&
      (await loadManualDutyBoundaryStateResult(atomicStorage)).status ===
        "loaded",
    "",
  );
  pass("New boundary evidence can be validated and saved atomically");

  assert(await hasStoredManualDutyBoundaryState(atomicStorage), "");
  pass("Stored boundary-state presence is explicit");

  await clearManualDutyBoundaryStorage(atomicStorage);

  assert(!(await hasStoredManualDutyBoundaryState(atomicStorage)), "");
  pass("Boundary storage can be cleared explicitly");

  const invalidJson = decodeManualDutyBoundaryStorage("not json");

  assert(
    invalidJson.status === "invalid" &&
      invalidJson.issues[0]?.code === "invalid-json",
    "",
  );
  pass("Invalid JSON is reported without manufacturing evidence");

  const future = decodeManualDutyBoundaryStorage(
    JSON.stringify({ version: 2, savedAt: new Date().toISOString(), state }),
  );

  assert(
    future.status === "invalid" &&
      future.issues[0]?.code === "unsupported-version",
    "",
  );
  pass("Unknown future storage versions are not misread");

  const invalidEnvelope = decodeManualDutyBoundaryStorage(
    JSON.stringify({ version: 1, savedAt: "invalid", state }),
  );

  assert(
    invalidEnvelope.status === "invalid" &&
      invalidEnvelope.issues[0]?.code === "invalid-envelope",
    "",
  );
  pass("An invalid storage envelope is rejected");

  const invalidStateEnvelope = decodeManualDutyBoundaryStorage(
    JSON.stringify({
      version: 1,
      savedAt: "2026-09-03T18:00:00.000Z",
      state: { version: 1, evidence: "not-an-array" },
    }),
  );

  assert(
    invalidStateEnvelope.status === "invalid" &&
      invalidStateEnvelope.issues[0]?.code === "invalid-envelope",
    "",
  );
  pass("A malformed state container is rejected");

  const recovered = decodeManualDutyBoundaryStorage(
    JSON.stringify({
      version: 1,
      savedAt: "2026-09-03T18:00:00.000Z",
      state: {
        version: 1,
        evidence: [before(), { id: "damaged", boundary: "unknown" }, after()],
      },
    }),
  );

  assert(
    recovered.status === "recovered" &&
      recovered.state.evidence.length === 2 &&
      recovered.issues.length === 1 &&
      recovered.issues[0]?.evidenceId === "damaged",
    "",
  );
  pass("Valid evidence is recovered when one stored item is damaged");

  const missingRevisionTarget = decodeManualDutyBoundaryStorage(
    JSON.stringify({
      version: 1,
      savedAt: "2026-09-03T18:00:00.000Z",
      state: {
        version: 1,
        evidence: [
          before({
            id: "orphan-correction",
            source: "admin-correction",
            revisesEvidenceId: "missing-original",
          }),
        ],
      },
    }),
  );

  assert(
    missingRevisionTarget.status === "recovered" &&
      missingRevisionTarget.state.evidence.length === 0,
    "",
  );
  pass("A correction with missing original evidence is isolated safely");

  const duplicateEvidence = decodeManualDutyBoundaryStorage(
    JSON.stringify({
      version: 1,
      savedAt: "2026-09-03T18:00:00.000Z",
      state: { version: 1, evidence: [before(), before()] },
    }),
  );

  assert(
    duplicateEvidence.status === "recovered" &&
      duplicateEvidence.state.evidence.length === 1,
    "",
  );
  pass("Duplicate stored evidence identifiers cannot enter recovered state");

  const invalidStorage = new MemoryStorage();

  await invalidStorage.setItem(MANUAL_DUTY_BOUNDARY_STORAGE_KEY, "bad json");
  await expectAsyncError(
    () => recordManualDutyBoundaryEvidenceInStorage(before(), invalidStorage),
    "Invalid existing storage is protected from automatic overwrite",
  );

  const futureStorage = new MemoryStorage();

  await futureStorage.setItem(
    MANUAL_DUTY_BOUNDARY_STORAGE_KEY,
    JSON.stringify({
      version: 99,
      savedAt: "2026-09-03T18:00:00.000Z",
      state,
    }),
  );
  await expectAsyncError(
    () => recordManualDutyBoundaryEvidenceInStorage(before(), futureStorage),
    "Future storage is protected from automatic overwrite",
  );

  await expectAsyncError(
    () =>
      saveManualDutyBoundaryState(
        {
          version: 1,
          evidence: [before(), before()],
        },
        new MemoryStorage(),
      ),
    "Invalid duplicate evidence cannot be persisted",
  );

  const recoveredStorage = new MemoryStorage();

  await recoveredStorage.setItem(
    MANUAL_DUTY_BOUNDARY_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      savedAt: "2026-09-03T18:00:00.000Z",
      state: {
        version: 1,
        evidence: [before(), { id: "damaged" }],
      },
    }),
  );
  const repaired = await recordManualDutyBoundaryEvidenceInStorage(
    after(),
    recoveredStorage,
  );

  assert(
    repaired.evidence.length === 2 &&
      (await loadManualDutyBoundaryStateResult(recoveredStorage)).status ===
        "loaded",
    "",
  );
  pass("Recovered valid evidence can be repaired by a later saved action");

  const restored = restoreManualDutyBoundaryState({
    version: 1,
    evidence: [before(), after()],
  });

  assert(restored.evidence.length === 2, "");
  pass("Strict restoration replays all evidence through engine rules");

  let strictFailed = false;

  try {
    restoreManualDutyBoundaryState({
      version: 1,
      evidence: [before(), { id: "bad" }],
    });
  } catch {
    strictFailed = true;
  }

  assert(strictFailed, "");
  pass("Strict restoration rejects a partially invalid state");

  console.log("=".repeat(60));
  console.log(`MANUAL DUTY-BOUNDARY STORAGE RESULT: ${passed}/${passed} passed`);
  console.log("=".repeat(60));
}

void run();
