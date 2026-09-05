import {
  buildDutyBoundaryPromptAssistantPlan,
  createDutyBoundaryPromptAssistantState,
  recordDutyBoundaryNoEntryAcknowledgement,
  type DutyBoundaryPromptAssistantState,
} from "../dutyBoundaryPromptAssistant";
import {
  buildManualDutyBoundarySnapshot,
  createManualDutyBoundaryState,
  recordManualDutyBoundaryEvidence,
  type ManualDutyBoundaryEvidence,
  type ManualDutyBoundaryState,
} from "../manualDutyBoundary";

let passed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Duty prompt assistant scenario failed: ${message}`);
  }
}

function scenario(message: string, check: () => void): void {
  check();
  passed += 1;
  console.log(`✅ ${message}`);
}

function expectError(message: string, action: () => unknown): void {
  let failed = false;

  try {
    action();
  } catch {
    failed = true;
  }

  assert(failed, message);
  passed += 1;
  console.log(`✅ ${message}`);
}

const DUTY_DATE = "2026-09-05";

function startEvidence(
  overrides: Partial<ManualDutyBoundaryEvidence> = {},
): ManualDutyBoundaryEvidence {
  return {
    id: "manual-duty-start-2026-09-05",
    dutyDate: DUTY_DATE,
    boundary: "before-card-insertion",
    activity: "other-work",
    startedAt: "2026-09-05T05:40:00.000Z",
    endedAt: "2026-09-05T06:00:00.000Z",
    cardEventAt: "2026-09-05T06:00:00.000Z",
    recordedAt: "2026-09-05T06:00:00.000Z",
    reason: "vehicle-checks",
    source: "driver",
    ...overrides,
  };
}

function finishEvidence(
  overrides: Partial<ManualDutyBoundaryEvidence> = {},
): ManualDutyBoundaryEvidence {
  return {
    id: "manual-duty-finish-2026-09-05",
    dutyDate: DUTY_DATE,
    boundary: "after-card-ejection",
    activity: "other-work",
    startedAt: "2026-09-05T17:00:00.000Z",
    endedAt: "2026-09-05T17:20:00.000Z",
    cardEventAt: "2026-09-05T17:00:00.000Z",
    recordedAt: "2026-09-05T17:20:00.000Z",
    reason: "office-admin",
    source: "driver",
    ...overrides,
  };
}

function snapshot(state: ManualDutyBoundaryState = createManualDutyBoundaryState()) {
  return buildManualDutyBoundarySnapshot(state, DUTY_DATE);
}

scenario("A new assistant state is empty and versioned", () => {
  const state = createDutyBoundaryPromptAssistantState();

  assert(state.version === 1, "The assistant state version must be one.");
  assert(state.acknowledgements.length === 0, "A new state must be empty.");
});

scenario("No prompt is shown before an operations diary starts", () => {
  const plan = buildDutyBoundaryPromptAssistantPlan(
    createDutyBoundaryPromptAssistantState(),
    snapshot(),
    "not-started",
  );

  assert(plan.primaryPrompt === null, "No boundary should be prompted yet.");
  assert(plan.unresolvedPromptCount === 0, "Nothing should be unresolved.");
  assert(
    plan.beforeCardInsertion.status === "not-due" &&
      plan.afterCardEjection.status === "not-due",
    "Both prompts must remain dormant.",
  );
});

scenario("Starting operations asks about work before card insertion", () => {
  const plan = buildDutyBoundaryPromptAssistantPlan(
    createDutyBoundaryPromptAssistantState(),
    snapshot(),
    "active",
  );

  assert(
    plan.primaryPrompt === "before-card-insertion",
    "The pre-card question must be first.",
  );
  assert(
    plan.beforeCardInsertion.status === "choice-required",
    "A driver choice must be required.",
  );
  assert(plan.canContinueOperations, "The prompt must not block field work.");
});

scenario("The finish prompt is held back during an active shift", () => {
  const plan = buildDutyBoundaryPromptAssistantPlan(
    createDutyBoundaryPromptAssistantState(),
    snapshot(),
    "active",
  );

  assert(
    plan.afterCardEjection.status === "not-due",
    "Post-card work must not be requested early.",
  );
});

scenario("Recorded start evidence completes the start prompt", () => {
  const boundaryState = recordManualDutyBoundaryEvidence(
    createManualDutyBoundaryState(),
    startEvidence(),
  );
  const plan = buildDutyBoundaryPromptAssistantPlan(
    createDutyBoundaryPromptAssistantState(),
    snapshot(boundaryState),
    "active",
  );

  assert(
    plan.beforeCardInsertion.status === "entry-recorded",
    "Existing protected evidence must satisfy the prompt.",
  );
  assert(plan.primaryPrompt === null, "No duplicate prompt should be shown.");
});

scenario("The driver can confirm there was nothing to record", () => {
  const state = recordDutyBoundaryNoEntryAcknowledgement(
    createDutyBoundaryPromptAssistantState(),
    {
      id: "no-start-entry-2026-09-05",
      dutyDate: DUTY_DATE,
      boundary: "before-card-insertion",
      cardEventAt: "2026-09-05T06:00:00.000Z",
      acknowledgedAt: "2026-09-05T06:01:00.000Z",
    },
  );
  const plan = buildDutyBoundaryPromptAssistantPlan(
    state,
    snapshot(),
    "active",
  );

  assert(
    plan.beforeCardInsertion.status === "confirmed-no-entry",
    "The acknowledgement must suppress repeat prompting.",
  );
  assert(
    plan.beforeCardInsertion.canRecordEntry,
    "The driver must still be able to add evidence later.",
  );
});

scenario("A finish request requires both unresolved choices", () => {
  const plan = buildDutyBoundaryPromptAssistantPlan(
    createDutyBoundaryPromptAssistantState(),
    snapshot(),
    "finish-requested",
  );

  assert(plan.unresolvedPromptCount === 2, "Both choices must be outstanding.");
  assert(
    plan.primaryPrompt === "before-card-insertion",
    "Missed start evidence must be resolved before finishing.",
  );
  assert(!plan.canCompleteShift, "The shift must not complete silently.");
});

scenario("Resolving the start advances a finish request to post-card work", () => {
  const boundaryState = recordManualDutyBoundaryEvidence(
    createManualDutyBoundaryState(),
    startEvidence(),
  );
  const plan = buildDutyBoundaryPromptAssistantPlan(
    createDutyBoundaryPromptAssistantState(),
    snapshot(boundaryState),
    "finish-requested",
  );

  assert(plan.unresolvedPromptCount === 1, "Only one choice should remain.");
  assert(
    plan.primaryPrompt === "after-card-ejection",
    "The assistant must advance to the finish question.",
  );
});

scenario("Recorded start and finish evidence allow shift completion", () => {
  let boundaryState = recordManualDutyBoundaryEvidence(
    createManualDutyBoundaryState(),
    startEvidence(),
  );
  boundaryState = recordManualDutyBoundaryEvidence(
    boundaryState,
    finishEvidence(),
  );
  const plan = buildDutyBoundaryPromptAssistantPlan(
    createDutyBoundaryPromptAssistantState(),
    snapshot(boundaryState),
    "finish-requested",
  );

  assert(plan.unresolvedPromptCount === 0, "All choices must be resolved.");
  assert(plan.canCompleteShift, "The shift can now complete.");
});

scenario("Two nothing-to-record decisions also allow shift completion", () => {
  let state = recordDutyBoundaryNoEntryAcknowledgement(
    createDutyBoundaryPromptAssistantState(),
    {
      id: "no-start-entry",
      dutyDate: DUTY_DATE,
      boundary: "before-card-insertion",
      cardEventAt: "2026-09-05T06:00:00.000Z",
      acknowledgedAt: "2026-09-05T06:01:00.000Z",
    },
  );
  state = recordDutyBoundaryNoEntryAcknowledgement(state, {
    id: "no-finish-entry",
    dutyDate: DUTY_DATE,
    boundary: "after-card-ejection",
    cardEventAt: "2026-09-05T17:00:00.000Z",
    acknowledgedAt: "2026-09-05T17:01:00.000Z",
  });
  const plan = buildDutyBoundaryPromptAssistantPlan(
    state,
    snapshot(),
    "finish-requested",
  );

  assert(plan.canCompleteShift, "Explicit no-entry choices must be sufficient.");
});

scenario("Protected evidence overrides an earlier no-entry choice", () => {
  const state = recordDutyBoundaryNoEntryAcknowledgement(
    createDutyBoundaryPromptAssistantState(),
    {
      id: "no-start-entry",
      dutyDate: DUTY_DATE,
      boundary: "before-card-insertion",
      cardEventAt: "2026-09-05T06:00:00.000Z",
      acknowledgedAt: "2026-09-05T06:01:00.000Z",
    },
  );
  const boundaryState = recordManualDutyBoundaryEvidence(
    createManualDutyBoundaryState(),
    startEvidence({ recordedAt: "2026-09-05T06:10:00.000Z" }),
  );
  const plan = buildDutyBoundaryPromptAssistantPlan(
    state,
    snapshot(boundaryState),
    "active",
  );

  assert(
    plan.beforeCardInsertion.status === "entry-recorded",
    "Evidence must become the effective outcome.",
  );
  assert(
    plan.beforeCardInsertion.effectiveAcknowledgement?.id === "no-start-entry",
    "The earlier acknowledgement must remain available for audit.",
  );
});

scenario("Acknowledgements for another duty date do not suppress prompts", () => {
  const state = recordDutyBoundaryNoEntryAcknowledgement(
    createDutyBoundaryPromptAssistantState(),
    {
      id: "no-start-entry-yesterday",
      dutyDate: "2026-09-04",
      boundary: "before-card-insertion",
      cardEventAt: "2026-09-04T06:00:00.000Z",
      acknowledgedAt: "2026-09-04T06:01:00.000Z",
    },
  );
  const plan = buildDutyBoundaryPromptAssistantPlan(
    state,
    snapshot(),
    "active",
  );

  assert(
    plan.beforeCardInsertion.status === "choice-required",
    "Each duty date must be considered independently.",
  );
});

expectError("Invalid duty dates are rejected", () =>
  recordDutyBoundaryNoEntryAcknowledgement(
    createDutyBoundaryPromptAssistantState(),
    {
      id: "invalid-date",
      dutyDate: "05/09/2026",
      boundary: "before-card-insertion",
      cardEventAt: "2026-09-05T06:00:00.000Z",
      acknowledgedAt: "2026-09-05T06:01:00.000Z",
    },
  ),
);

expectError("Blank acknowledgement identifiers are rejected", () =>
  recordDutyBoundaryNoEntryAcknowledgement(
    createDutyBoundaryPromptAssistantState(),
    {
      id: "   ",
      dutyDate: DUTY_DATE,
      boundary: "before-card-insertion",
      cardEventAt: "2026-09-05T06:00:00.000Z",
      acknowledgedAt: "2026-09-05T06:01:00.000Z",
    },
  ),
);

expectError("Duplicate acknowledgement identifiers are rejected", () => {
  const state = recordDutyBoundaryNoEntryAcknowledgement(
    createDutyBoundaryPromptAssistantState(),
    {
      id: "duplicate-id",
      dutyDate: DUTY_DATE,
      boundary: "before-card-insertion",
      cardEventAt: "2026-09-05T06:00:00.000Z",
      acknowledgedAt: "2026-09-05T06:01:00.000Z",
    },
  );

  return recordDutyBoundaryNoEntryAcknowledgement(state, {
    id: "duplicate-id",
    dutyDate: DUTY_DATE,
    boundary: "after-card-ejection",
    cardEventAt: "2026-09-05T17:00:00.000Z",
    acknowledgedAt: "2026-09-05T17:01:00.000Z",
  });
});

expectError("A no-entry choice cannot predate its card event", () =>
  recordDutyBoundaryNoEntryAcknowledgement(
    createDutyBoundaryPromptAssistantState(),
    {
      id: "early-acknowledgement",
      dutyDate: DUTY_DATE,
      boundary: "after-card-ejection",
      cardEventAt: "2026-09-05T17:00:00.000Z",
      acknowledgedAt: "2026-09-05T16:59:00.000Z",
    },
  ),
);

expectError("Invalid stored acknowledgement decisions are rejected", () => {
  const state = {
    version: 1,
    acknowledgements: [
      {
        id: "invalid-decision",
        dutyDate: DUTY_DATE,
        boundary: "before-card-insertion",
        decision: "dismissed",
        cardEventAt: "2026-09-05T06:00:00.000Z",
        acknowledgedAt: "2026-09-05T06:01:00.000Z",
        source: "driver",
      },
    ],
  } as unknown as DutyBoundaryPromptAssistantState;

  return buildDutyBoundaryPromptAssistantPlan(state, snapshot(), "active");
});

console.log("============================================================");
console.log(
  `DUTY BOUNDARY PROMPT ASSISTANT RESULT: ${passed}/${passed} passed`,
);
console.log("✅ ALL DUTY BOUNDARY PROMPT ASSISTANT SCENARIOS PASSED");
console.log("============================================================");
