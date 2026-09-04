import {
  buildManualDutyBoundarySnapshot,
  type ManualDutyBoundary,
  type ManualDutyBoundaryActivity,
  type ManualDutyBoundaryAdjustedActivity,
  type ManualDutyBoundaryReason,
  type ManualDutyBoundarySnapshotStatus,
  type ManualDutyBoundaryState,
  type ManualDutyEvidenceSource,
} from "./manualDutyBoundary";

export type ManualDutyAuditEntryStatus = "effective" | "superseded";

export interface ManualDutyAuditAdjustment {
  eventCount: number;
  totalOverlapMinutes: number;
  conflicts: ManualDutyBoundaryAdjustedActivity[];
}

export interface ManualDutyAuditEntry {
  evidenceId: string;
  dutyDate: string;
  boundary: ManualDutyBoundary;
  boundaryLabel: string;
  activity: ManualDutyBoundaryActivity;
  activityLabel: string;
  tachographMode: "OTHER WORK" | "AVAILABILITY" | "BREAK / REST";
  reason: ManualDutyBoundaryReason;
  reasonLabel: string;
  source: ManualDutyEvidenceSource;
  sourceLabel: string;
  startedAt: string;
  endedAt: string;
  cardEventAt: string;
  recordedAt: string;
  durationMinutes: number;
  note: string | null;
  status: ManualDutyAuditEntryStatus;
  revisionNumber: number;
  revisionLabel: string;
  revisesEvidenceId: string | null;
  revisedByEvidenceId: string | null;
  adjustment: ManualDutyAuditAdjustment | null;
}

export interface ManualDutyAuditDay {
  dutyDate: string;
  status: ManualDutyBoundarySnapshotStatus;
  evidenceCount: number;
  effectiveEvidenceCount: number;
  correctionCount: number;
  adjustedActivityCount: number;
  adjustedOverlapMinutes: number;
  effectiveActivityMinutes: number;
  latestRecordedAt: string | null;
  entries: ManualDutyAuditEntry[];
}

export interface ManualDutyAuditArchive {
  dutyDayCount: number;
  evidenceCount: number;
  effectiveEvidenceCount: number;
  correctionCount: number;
  adjustedActivityCount: number;
  adjustedOverlapMinutes: number;
  days: ManualDutyAuditDay[];
}

const ACTIVITY_LABELS: Record<ManualDutyBoundaryActivity, string> = {
  "other-work": "Other Work",
  poa: "Availability / POA",
  break: "Break / Rest",
};

const ACTIVITY_MODES: Record<
  ManualDutyBoundaryActivity,
  ManualDutyAuditEntry["tachographMode"]
> = {
  "other-work": "OTHER WORK",
  poa: "AVAILABILITY",
  break: "BREAK / REST",
};

const REASON_LABELS: Record<ManualDutyBoundaryReason, string> = {
  "office-admin": "Office / admin",
  "vehicle-checks": "Vehicle checks",
  "yard-work": "Yard work",
  "loading-paperwork": "Loading / paperwork",
  "waiting-known-in-advance": "Known waiting",
  "break-rest": "Break / rest",
  other: "Other",
};

const SOURCE_LABELS: Record<ManualDutyEvidenceSource, string> = {
  driver: "Driver entry",
  "driver-correction": "Driver correction",
  "admin-correction": "Admin correction",
};

function milliseconds(value: string): number {
  const result = new Date(value).getTime();

  if (!Number.isFinite(result)) {
    throw new Error(`Invalid manual-duty audit timestamp: ${value}`);
  }

  return result;
}

function revisionNumber(
  evidenceId: string,
  evidenceById: ReadonlyMap<string, ManualDutyBoundaryState["evidence"][number]>,
): number {
  let current = evidenceById.get(evidenceId);
  let result = 1;
  const visited = new Set<string>();

  while (current?.revisesEvidenceId !== undefined) {
    if (visited.has(current.id)) {
      throw new Error("Manual-duty audit revision chain contains a cycle.");
    }

    visited.add(current.id);
    result += 1;
    current = evidenceById.get(current.revisesEvidenceId);
  }

  return result;
}

function buildAuditDay(
  state: ManualDutyBoundaryState,
  dutyDate: string,
): ManualDutyAuditDay {
  const evidence = state.evidence.filter((item) => item.dutyDate === dutyDate);
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const revisedBy = new Map<string, string>();

  for (const item of evidence) {
    if (item.revisesEvidenceId !== undefined) {
      revisedBy.set(item.revisesEvidenceId, item.id);
    }
  }

  const entries = evidence
    .map((item): ManualDutyAuditEntry => {
      const revision = revisionNumber(item.id, evidenceById);
      const adjustment = item.activityAdjustment;

      return {
        evidenceId: item.id,
        dutyDate: item.dutyDate,
        boundary: item.boundary,
        boundaryLabel:
          item.boundary === "before-card-insertion"
            ? "Start of duty"
            : "End of duty",
        activity: item.activity,
        activityLabel: ACTIVITY_LABELS[item.activity],
        tachographMode: ACTIVITY_MODES[item.activity],
        reason: item.reason,
        reasonLabel: REASON_LABELS[item.reason],
        source: item.source,
        sourceLabel: SOURCE_LABELS[item.source],
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        cardEventAt: item.cardEventAt,
        recordedAt: item.recordedAt,
        durationMinutes: Math.floor(
          (milliseconds(item.endedAt) - milliseconds(item.startedAt)) / 60_000,
        ),
        note: item.note ?? null,
        status: revisedBy.has(item.id) ? "superseded" : "effective",
        revisionNumber: revision,
        revisionLabel:
          revision === 1 ? "Original entry" : `Correction ${revision - 1}`,
        revisesEvidenceId: item.revisesEvidenceId ?? null,
        revisedByEvidenceId: revisedBy.get(item.id) ?? null,
        adjustment:
          adjustment === undefined
            ? null
            : {
                eventCount: adjustment.conflicts.length,
                totalOverlapMinutes: adjustment.conflicts.reduce(
                  (total, conflict) => total + conflict.overlapMinutes,
                  0,
                ),
                conflicts: adjustment.conflicts.map((conflict) => ({
                  ...conflict,
                })),
              },
      };
    })
    .sort(
      (first, second) =>
        milliseconds(first.recordedAt) - milliseconds(second.recordedAt),
    );
  const snapshot = buildManualDutyBoundarySnapshot(state, dutyDate);
  const effectiveEntries = entries.filter((entry) => entry.status === "effective");

  return {
    dutyDate,
    status: snapshot.status,
    evidenceCount: entries.length,
    effectiveEvidenceCount: effectiveEntries.length,
    correctionCount: entries.filter((entry) => entry.revisionNumber > 1).length,
    adjustedActivityCount: entries.reduce(
      (total, entry) => total + (entry.adjustment?.eventCount ?? 0),
      0,
    ),
    adjustedOverlapMinutes: entries.reduce(
      (total, entry) => total + (entry.adjustment?.totalOverlapMinutes ?? 0),
      0,
    ),
    effectiveActivityMinutes: effectiveEntries.reduce(
      (total, entry) => total + entry.durationMinutes,
      0,
    ),
    latestRecordedAt:
      entries.length === 0 ? null : entries[entries.length - 1]!.recordedAt,
    entries,
  };
}

export function buildManualDutyAuditDay(
  state: ManualDutyBoundaryState,
  dutyDate: string,
): ManualDutyAuditDay {
  return buildAuditDay(state, dutyDate);
}

export function buildManualDutyAuditArchive(
  state: ManualDutyBoundaryState,
): ManualDutyAuditArchive {
  const dutyDates = [...new Set(state.evidence.map((item) => item.dutyDate))]
    .sort()
    .reverse();
  const days = dutyDates.map((dutyDate) => buildAuditDay(state, dutyDate));

  return {
    dutyDayCount: days.length,
    evidenceCount: days.reduce((total, day) => total + day.evidenceCount, 0),
    effectiveEvidenceCount: days.reduce(
      (total, day) => total + day.effectiveEvidenceCount,
      0,
    ),
    correctionCount: days.reduce((total, day) => total + day.correctionCount, 0),
    adjustedActivityCount: days.reduce(
      (total, day) => total + day.adjustedActivityCount,
      0,
    ),
    adjustedOverlapMinutes: days.reduce(
      (total, day) => total + day.adjustedOverlapMinutes,
      0,
    ),
    days,
  };
}
