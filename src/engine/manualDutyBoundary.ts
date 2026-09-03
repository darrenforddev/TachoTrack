import type {
  ActivityHistoryEvent,
  ActivityHistoryState,
} from "../data/activityHistory";

export type ManualDutyBoundary =
  | "before-card-insertion"
  | "after-card-ejection";

export type ManualDutyBoundaryActivity = "other-work" | "poa" | "break";

export type ManualDutyBoundaryReason =
  | "office-admin"
  | "vehicle-checks"
  | "yard-work"
  | "loading-paperwork"
  | "waiting-known-in-advance"
  | "break-rest"
  | "other";

export type ManualDutyEvidenceSource =
  | "driver"
  | "driver-correction"
  | "admin-correction";

export interface ManualDutyBoundaryEvidence {
  id: string;
  dutyDate: string;
  boundary: ManualDutyBoundary;
  activity: ManualDutyBoundaryActivity;
  startedAt: string;
  endedAt: string;
  cardEventAt: string;
  recordedAt: string;
  reason: ManualDutyBoundaryReason;
  source: ManualDutyEvidenceSource;
  note?: string;
  revisesEvidenceId?: string;
}

export interface ManualDutyBoundaryState {
  version: 1;
  evidence: ManualDutyBoundaryEvidence[];
}

export interface EffectiveManualDutyBoundaryEntry {
  evidence: ManualDutyBoundaryEvidence;
  durationMilliseconds: number;
  durationMinutes: number;
  tachographMode: "OTHER WORK" | "AVAILABILITY" | "BREAK / REST";
  requiresTachographManualInput: true;
}

export type ManualDutyBoundarySnapshotStatus =
  | "empty"
  | "start-recorded"
  | "finish-recorded"
  | "complete";

export interface ManualDutyBoundarySnapshot {
  dutyDate: string;
  status: ManualDutyBoundarySnapshotStatus;
  beforeCardInsertion: EffectiveManualDutyBoundaryEntry | null;
  afterCardEjection: EffectiveManualDutyBoundaryEntry | null;
  actualDutyStartedAt: string | null;
  cardInsertedAt: string | null;
  cardEjectedAt: string | null;
  actualDutyFinishedAt: string | null;
  additionalOtherWorkMinutes: number;
  additionalPoaMinutes: number;
  additionalBreakRestMinutes: number;
  tachographManualInputsRequired: number;
}

const REASON_ACTIVITY: Partial<
  Record<ManualDutyBoundaryReason, ManualDutyBoundaryActivity>
> = {
  "office-admin": "other-work",
  "vehicle-checks": "other-work",
  "yard-work": "other-work",
  "loading-paperwork": "other-work",
  "waiting-known-in-advance": "poa",
  "break-rest": "break",
};

const BOUNDARIES: readonly ManualDutyBoundary[] = [
  "before-card-insertion",
  "after-card-ejection",
];

const ACTIVITIES: readonly ManualDutyBoundaryActivity[] = [
  "other-work",
  "poa",
  "break",
];

const REASONS: readonly ManualDutyBoundaryReason[] = [
  "office-admin",
  "vehicle-checks",
  "yard-work",
  "loading-paperwork",
  "waiting-known-in-advance",
  "break-rest",
  "other",
];

const SOURCES: readonly ManualDutyEvidenceSource[] = [
  "driver",
  "driver-correction",
  "admin-correction",
];

function requireNonBlank(value: string, label: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${label} must not be blank.`);
  }

  return trimmed;
}

function parseDateOnly(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid manual-duty date: ${value}`);
  }

  const milliseconds = new Date(`${value}T00:00:00.000Z`).getTime();

  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid manual-duty date: ${value}`);
  }
}

function parseTimestamp(value: string, label: string): number {
  const milliseconds = new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return milliseconds;
}

function activityMode(
  activity: ManualDutyBoundaryActivity,
): EffectiveManualDutyBoundaryEntry["tachographMode"] {
  switch (activity) {
    case "other-work":
      return "OTHER WORK";
    case "poa":
      return "AVAILABILITY";
    case "break":
      return "BREAK / REST";
  }
}

function validateEvidenceShape(evidence: ManualDutyBoundaryEvidence): void {
  requireNonBlank(evidence.id, "Manual-duty evidence id");
  parseDateOnly(evidence.dutyDate);

  if (!BOUNDARIES.includes(evidence.boundary)) {
    throw new Error(`Invalid manual-duty boundary: ${String(evidence.boundary)}`);
  }

  if (!ACTIVITIES.includes(evidence.activity)) {
    throw new Error(`Invalid manual-duty activity: ${String(evidence.activity)}`);
  }

  if (!REASONS.includes(evidence.reason)) {
    throw new Error(`Invalid manual-duty reason: ${String(evidence.reason)}`);
  }

  if (!SOURCES.includes(evidence.source)) {
    throw new Error(`Invalid manual-duty source: ${String(evidence.source)}`);
  }

  if (
    evidence.revisesEvidenceId !== undefined &&
    evidence.revisesEvidenceId.trim().length === 0
  ) {
    throw new Error("Manual-duty revision id must not be blank.");
  }

  if (evidence.note !== undefined && typeof evidence.note !== "string") {
    throw new Error("Manual-duty note must be text.");
  }

  const startedAt = parseTimestamp(
    evidence.startedAt,
    "manual-duty start time",
  );
  const endedAt = parseTimestamp(evidence.endedAt, "manual-duty end time");
  const cardEventAt = parseTimestamp(
    evidence.cardEventAt,
    "tachograph card-event time",
  );
  const recordedAt = parseTimestamp(
    evidence.recordedAt,
    "manual-duty recording time",
  );

  if (endedAt <= startedAt) {
    throw new Error("Manual-duty activity must end after it starts.");
  }

  if (
    evidence.boundary === "before-card-insertion" &&
    endedAt !== cardEventAt
  ) {
    throw new Error(
      "Before-card activity must end at the card-insertion time.",
    );
  }

  if (
    evidence.boundary === "after-card-ejection" &&
    startedAt !== cardEventAt
  ) {
    throw new Error(
      "After-card activity must start at the card-ejection time.",
    );
  }

  if (recordedAt < endedAt) {
    throw new Error(
      "Manual-duty evidence cannot be recorded before the activity ended.",
    );
  }

  const requiredActivity = REASON_ACTIVITY[evidence.reason];

  if (requiredActivity !== undefined && evidence.activity !== requiredActivity) {
    throw new Error(
      `${evidence.reason} must be recorded as ${requiredActivity}.`,
    );
  }

  if (
    evidence.reason === "other" &&
    (evidence.note === undefined || evidence.note.trim().length === 0)
  ) {
    throw new Error("An explanatory note is required for an other reason.");
  }

  if (evidence.note !== undefined) {
    requireNonBlank(evidence.note, "Manual-duty note");
  }
}

function evidenceDuration(
  evidence: ManualDutyBoundaryEvidence,
): EffectiveManualDutyBoundaryEntry {
  const durationMilliseconds =
    parseTimestamp(evidence.endedAt, "manual-duty end time") -
    parseTimestamp(evidence.startedAt, "manual-duty start time");

  return {
    evidence,
    durationMilliseconds,
    durationMinutes: Math.floor(durationMilliseconds / 60_000),
    tachographMode: activityMode(evidence.activity),
    requiresTachographManualInput: true,
  };
}

function getEffectiveEvidence(
  state: ManualDutyBoundaryState,
  dutyDate: string,
): ManualDutyBoundaryEvidence[] {
  const matching = state.evidence.filter(
    (evidence) => evidence.dutyDate === dutyDate,
  );
  const revisedIds = new Set(
    matching.flatMap((evidence) =>
      evidence.revisesEvidenceId === undefined
        ? []
        : [evidence.revisesEvidenceId],
    ),
  );

  return matching.filter((evidence) => !revisedIds.has(evidence.id));
}

function validateBoundarySequence(
  effectiveEvidence: readonly ManualDutyBoundaryEvidence[],
): void {
  const before = effectiveEvidence.find(
    (evidence) => evidence.boundary === "before-card-insertion",
  );
  const after = effectiveEvidence.find(
    (evidence) => evidence.boundary === "after-card-ejection",
  );

  if (before === undefined || after === undefined) {
    return;
  }

  const insertedAt = parseTimestamp(before.cardEventAt, "card-insertion time");
  const ejectedAt = parseTimestamp(after.cardEventAt, "card-ejection time");

  if (ejectedAt < insertedAt) {
    throw new Error("The card cannot be ejected before it was inserted.");
  }
}

export function createManualDutyBoundaryState(): ManualDutyBoundaryState {
  return {
    version: 1,
    evidence: [],
  };
}

export function recordManualDutyBoundaryEvidence(
  state: ManualDutyBoundaryState,
  evidence: ManualDutyBoundaryEvidence,
): ManualDutyBoundaryState {
  if (state.version !== 1 || !Array.isArray(state.evidence)) {
    throw new Error("Unsupported manual-duty boundary state.");
  }

  validateEvidenceShape(evidence);

  if (state.evidence.some((item) => item.id === evidence.id)) {
    throw new Error(`Duplicate manual-duty evidence id: ${evidence.id}`);
  }

  const lastEvidence = state.evidence[state.evidence.length - 1];

  if (
    lastEvidence !== undefined &&
    parseTimestamp(evidence.recordedAt, "manual-duty recording time") <
      parseTimestamp(lastEvidence.recordedAt, "previous recording time")
  ) {
    throw new Error("Manual-duty evidence must be appended chronologically.");
  }

  const currentEffective = getEffectiveEvidence(state, evidence.dutyDate);

  if (evidence.revisesEvidenceId === undefined) {
    if (
      evidence.source === "driver-correction" ||
      evidence.source === "admin-correction"
    ) {
      throw new Error("Correction evidence must identify the record it revises.");
    }

    if (
      currentEffective.some((item) => item.boundary === evidence.boundary)
    ) {
      throw new Error(
        `An effective ${evidence.boundary} record already exists for ${evidence.dutyDate}.`,
      );
    }
  } else {
    if (evidence.source === "driver") {
      throw new Error("A revision must use a correction source.");
    }

    const target = state.evidence.find(
      (item) => item.id === evidence.revisesEvidenceId,
    );

    if (target === undefined) {
      throw new Error(
        `Unknown manual-duty evidence revision target: ${evidence.revisesEvidenceId}`,
      );
    }

    if (!currentEffective.some((item) => item.id === target.id)) {
      throw new Error("Only the current effective boundary record may be revised.");
    }

    if (
      target.dutyDate !== evidence.dutyDate ||
      target.boundary !== evidence.boundary
    ) {
      throw new Error(
        "A manual-duty correction must preserve its duty date and boundary.",
      );
    }
  }

  const updated: ManualDutyBoundaryState = {
    version: 1,
    evidence: [...state.evidence, evidence],
  };

  const effectiveAfterUpdate = getEffectiveEvidence(updated, evidence.dutyDate);

  if (effectiveAfterUpdate.length > 2) {
    throw new Error("A duty date may only have two effective card boundaries.");
  }

  validateBoundarySequence(effectiveAfterUpdate);

  return updated;
}

export function buildManualDutyBoundarySnapshot(
  state: ManualDutyBoundaryState,
  dutyDate: string,
): ManualDutyBoundarySnapshot {
  parseDateOnly(dutyDate);

  const effective = getEffectiveEvidence(state, dutyDate);

  validateBoundarySequence(effective);

  const beforeEvidence =
    effective.find(
      (evidence) => evidence.boundary === "before-card-insertion",
    ) ?? null;
  const afterEvidence =
    effective.find(
      (evidence) => evidence.boundary === "after-card-ejection",
    ) ?? null;
  const before = beforeEvidence === null ? null : evidenceDuration(beforeEvidence);
  const after = afterEvidence === null ? null : evidenceDuration(afterEvidence);
  const entries = [before, after].filter(
    (entry): entry is EffectiveManualDutyBoundaryEntry => entry !== null,
  );

  let status: ManualDutyBoundarySnapshotStatus = "empty";

  if (before !== null && after !== null) {
    status = "complete";
  } else if (before !== null) {
    status = "start-recorded";
  } else if (after !== null) {
    status = "finish-recorded";
  }

  function totalMinutes(activity: ManualDutyBoundaryActivity): number {
    return entries
      .filter((entry) => entry.evidence.activity === activity)
      .reduce((total, entry) => total + entry.durationMinutes, 0);
  }

  return {
    dutyDate,
    status,
    beforeCardInsertion: before,
    afterCardEjection: after,
    actualDutyStartedAt: before?.evidence.startedAt ?? null,
    cardInsertedAt: before?.evidence.cardEventAt ?? null,
    cardEjectedAt: after?.evidence.cardEventAt ?? null,
    actualDutyFinishedAt: after?.evidence.endedAt ?? null,
    additionalOtherWorkMinutes: totalMinutes("other-work"),
    additionalPoaMinutes: totalMinutes("poa"),
    additionalBreakRestMinutes: totalMinutes("break"),
    tachographManualInputsRequired: entries.length,
  };
}

function eventBounds(event: ActivityHistoryEvent): {
  start: number;
  end: number;
} {
  return {
    start: parseTimestamp(event.startedAt, "activity-history start time"),
    end:
      event.endedAt === null
        ? Number.POSITIVE_INFINITY
        : parseTimestamp(event.endedAt, "activity-history end time"),
  };
}

function intervalIsCoveredByActivity(
  events: readonly ActivityHistoryEvent[],
  start: number,
  end: number,
  activity: ManualDutyBoundaryActivity,
): boolean {
  const matching = events
    .filter((event) => event.activity === activity)
    .map((event) => eventBounds(event))
    .filter((bounds) => bounds.end > start && bounds.start < end)
    .sort((first, second) => first.start - second.start);
  let coveredUntil = start;

  for (const bounds of matching) {
    if (bounds.start > coveredUntil) {
      return false;
    }

    coveredUntil = Math.max(coveredUntil, bounds.end);

    if (coveredUntil >= end) {
      return true;
    }
  }

  return false;
}

export function applyManualDutyBoundaryToActivityHistory(
  history: ActivityHistoryState,
  evidence: ManualDutyBoundaryEvidence,
): ActivityHistoryState {
  validateEvidenceShape(evidence);

  const projectedId = `manual-duty-${evidence.id}`;
  const existingProjection = history.events.find(
    (event) => event.id === projectedId,
  );

  if (existingProjection !== undefined) {
    if (
      existingProjection.activity === evidence.activity &&
      existingProjection.startedAt === evidence.startedAt &&
      existingProjection.endedAt === evidence.endedAt
    ) {
      return history;
    }

    throw new Error(`Conflicting projected manual-duty event: ${projectedId}`);
  }

  const start = parseTimestamp(evidence.startedAt, "manual-duty start time");
  const end = parseTimestamp(evidence.endedAt, "manual-duty end time");

  if (
    intervalIsCoveredByActivity(
      history.events,
      start,
      end,
      evidence.activity,
    )
  ) {
    return history;
  }

  const overlapping = history.events.filter((event) => {
    const bounds = eventBounds(event);

    return bounds.end > start && bounds.start < end;
  });

  if (overlapping.length > 0) {
    throw new Error(
      "Manual-duty activity overlaps an existing activity-history period.",
    );
  }

  const durationMilliseconds = end - start;
  const event: ActivityHistoryEvent = {
    id: projectedId,
    activity: evidence.activity,
    startedAt: evidence.startedAt,
    endedAt: evidence.endedAt,
    durationMilliseconds,
    source:
      evidence.source === "admin-correction" ? "admin-correction" : "manual",
  };

  return {
    events: [...history.events, event].sort(
      (first, second) =>
        parseTimestamp(first.startedAt, "activity-history start time") -
        parseTimestamp(second.startedAt, "activity-history start time"),
    ),
    activeEventId: history.activeEventId,
  };
}

export function closeActiveActivityHistoryAt(
  history: ActivityHistoryState,
  endedAt: string,
): ActivityHistoryState {
  const end = parseTimestamp(endedAt, "activity-history finish time");
  const active = history.events.find(
    (event) => event.id === history.activeEventId,
  );

  if (active === undefined) {
    throw new Error("There is no active activity-history event to finish.");
  }

  const start = parseTimestamp(active.startedAt, "active activity start time");

  if (end < start) {
    throw new Error("An active activity cannot finish before it started.");
  }

  return {
    events: history.events.map((event) =>
      event.id === active.id
        ? {
            ...event,
            endedAt,
            durationMilliseconds: end - start,
          }
        : event,
    ),
    activeEventId: null,
  };
}
