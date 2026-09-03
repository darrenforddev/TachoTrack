import {
  buildCustomerOperationsDiarySnapshot,
  recordCustomerOperationsEvent,
  type CustomerOperationsDiary,
  type CustomerOperationsDiarySnapshot,
  type OperationsDiaryEvent,
  type OperationsEventSource,
} from "./customerOperationsDiary";

export type CustomerOperationsWorkflowAction =
  | { type: "arrive"; locationId: string }
  | { type: "depart" }
  | { type: "attach-trailer"; trailerId: string }
  | { type: "detach-trailer" }
  | { type: "collect-loaded-box"; boxId: string }
  | { type: "drop-box-for-unloading"; boxId: string }
  | { type: "mark-box-empty-ready"; boxId: string }
  | { type: "collect-empty-box"; boxId: string }
  | { type: "return-empty-box"; boxId: string }
  | { type: "add-note"; text: string };

export interface CustomerOperationsDiaryWorkflowState {
  snapshot: CustomerOperationsDiarySnapshot;
  arrivalLocationIds: string[];
  canDepart: boolean;
  attachableTrailerIds: string[];
  detachableTrailerId: string | null;
  collectableLoadedBoxIds: string[];
  droppableLoadedBoxIds: string[];
  boxesAwaitingEmptyConfirmationIds: string[];
  collectableEmptyBoxIds: string[];
  returnableEmptyBoxIds: string[];
}

function requireNow(value: string | number | Date): string {
  const milliseconds =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error("Invalid customer operations workflow time.");
  }

  return new Date(milliseconds).toISOString();
}

function requireAvailable(
  values: readonly string[],
  value: string,
  actionLabel: string,
): void {
  if (!values.includes(value)) {
    throw new Error(`${actionLabel} is not currently available: ${value}`);
  }
}

function eventIdentityPart(
  diary: CustomerOperationsDiary,
  action: CustomerOperationsWorkflowAction,
): string {
  switch (action.type) {
    case "arrive":
      return action.locationId;
    case "attach-trailer":
      return action.trailerId;
    case "collect-loaded-box":
    case "drop-box-for-unloading":
    case "mark-box-empty-ready":
    case "collect-empty-box":
    case "return-empty-box":
      return action.boxId;
    case "depart":
    case "detach-trailer":
    case "add-note":
      return diary.id;
  }
}

function uniqueId(
  existingIds: readonly string[],
  baseId: string,
): string {
  if (!existingIds.includes(baseId)) {
    return baseId;
  }

  let suffix = 2;

  while (existingIds.includes(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function createEventId(
  diary: CustomerOperationsDiary,
  action: CustomerOperationsWorkflowAction,
  occurredAt: string,
): string {
  const safeTimestamp = occurredAt.replace(/[^0-9A-Za-z]/g, "-");
  const safeIdentity = eventIdentityPart(diary, action).replace(
    /[^0-9A-Za-z-]/g,
    "-",
  );
  const baseId = `operations-${safeTimestamp}-${action.type}-${safeIdentity}`;

  return uniqueId(
    diary.events.map((event) => event.id),
    baseId,
  );
}

function createVisitId(
  diary: CustomerOperationsDiary,
  locationId: string,
  occurredAt: string,
): string {
  const safeTimestamp = occurredAt.replace(/[^0-9A-Za-z]/g, "-");
  const safeLocation = locationId.replace(/[^0-9A-Za-z-]/g, "-");
  const existingVisitIds = diary.events.flatMap((event) =>
    "visitId" in event ? [event.visitId] : [],
  );

  return uniqueId(
    existingVisitIds,
    `operations-visit-${safeTimestamp}-${safeLocation}`,
  );
}

export function buildCustomerOperationsDiaryWorkflowState(
  diary: CustomerOperationsDiary,
  occurredAt: string | number | Date,
): CustomerOperationsDiaryWorkflowState {
  const now = requireNow(occurredAt);
  const snapshot = buildCustomerOperationsDiarySnapshot(diary, now);
  const activeLocation =
    snapshot.activeVisit === null
      ? null
      : (diary.locations.find(
          (location) => location.id === snapshot.activeVisit?.locationId,
        ) ?? null);
  const currentTrailerId = snapshot.currentTrailerId;
  const trailerHasBox =
    currentTrailerId !== null &&
    snapshot.boxes.some(
      (box) =>
        box.trailerId === currentTrailerId &&
        (box.stage === "loaded-on-trailer" ||
          box.stage === "empty-on-trailer"),
    );
  const atPortOrDepot =
    activeLocation?.type === "port" || activeLocation?.type === "depot";
  const atCustomer = activeLocation?.type === "customer";

  return {
    snapshot,
    arrivalLocationIds:
      snapshot.activeVisit === null
        ? diary.locations.map((location) => location.id)
        : [],
    canDepart: snapshot.activeVisit !== null,
    attachableTrailerIds:
      snapshot.activeVisit === null || currentTrailerId !== null
        ? []
        : snapshot.trailers
            .filter(
              (trailer) =>
                !trailer.attachedToTractor &&
                (trailer.locationId === null ||
                  trailer.locationId === snapshot.activeVisit?.locationId),
            )
            .map((trailer) => trailer.trailer.id),
    detachableTrailerId:
      snapshot.activeVisit === null ? null : currentTrailerId,
    collectableLoadedBoxIds:
      snapshot.activeVisit === null ||
      currentTrailerId === null ||
      trailerHasBox ||
      !atPortOrDepot
        ? []
        : snapshot.boxes
            .filter(
              (box) =>
                box.stage === "available-at-location" &&
                box.loadState === "loaded" &&
                (box.locationId === null ||
                  box.locationId === snapshot.activeVisit?.locationId),
            )
            .map((box) => box.box.id),
    droppableLoadedBoxIds:
      snapshot.activeVisit === null ||
      currentTrailerId === null ||
      !atCustomer
        ? []
        : snapshot.boxes
            .filter(
              (box) =>
                box.stage === "loaded-on-trailer" &&
                box.trailerId === currentTrailerId,
            )
            .map((box) => box.box.id),
    boxesAwaitingEmptyConfirmationIds: snapshot.boxes
      .filter((box) => box.stage === "at-customer-unloading")
      .map((box) => box.box.id),
    collectableEmptyBoxIds:
      snapshot.activeVisit === null ||
      currentTrailerId === null ||
      trailerHasBox ||
      !atCustomer
        ? []
        : snapshot.boxes
            .filter(
              (box) =>
                box.stage === "empty-at-customer" &&
                box.locationId === snapshot.activeVisit?.locationId,
            )
            .map((box) => box.box.id),
    returnableEmptyBoxIds:
      snapshot.activeVisit === null ||
      currentTrailerId === null ||
      !atPortOrDepot
        ? []
        : snapshot.boxes
            .filter(
              (box) =>
                box.stage === "empty-on-trailer" &&
                box.trailerId === currentTrailerId,
            )
            .map((box) => box.box.id),
  };
}

export function recordCustomerOperationsWorkflowAction(
  diary: CustomerOperationsDiary,
  action: CustomerOperationsWorkflowAction,
  occurredAt: string | number | Date = new Date(),
  source: OperationsEventSource = "manual",
): CustomerOperationsDiary {
  const now = requireNow(occurredAt);
  const workflow = buildCustomerOperationsDiaryWorkflowState(diary, now);
  const eventId = createEventId(diary, action, now);
  let event: OperationsDiaryEvent;

  switch (action.type) {
    case "arrive":
      requireAvailable(
        workflow.arrivalLocationIds,
        action.locationId,
        "Arrival",
      );
      event = {
        id: eventId,
        type: "arrived-at-location",
        visitId: createVisitId(diary, action.locationId, now),
        locationId: action.locationId,
        occurredAt: now,
        source,
      };
      break;

    case "depart":
      if (!workflow.canDepart || workflow.snapshot.activeVisit === null) {
        throw new Error("Departure is not currently available.");
      }
      event = {
        id: eventId,
        type: "departed-location",
        visitId: workflow.snapshot.activeVisit.id,
        occurredAt: now,
        source,
      };
      break;

    case "attach-trailer":
      requireAvailable(
        workflow.attachableTrailerIds,
        action.trailerId,
        "Trailer attachment",
      );
      event = {
        id: eventId,
        type: "trailer-attached",
        trailerId: action.trailerId,
        occurredAt: now,
        source,
      };
      break;

    case "detach-trailer":
      if (workflow.detachableTrailerId === null) {
        throw new Error("Trailer detachment is not currently available.");
      }
      event = {
        id: eventId,
        type: "trailer-detached",
        trailerId: workflow.detachableTrailerId,
        occurredAt: now,
        source,
      };
      break;

    case "collect-loaded-box":
      requireAvailable(
        workflow.collectableLoadedBoxIds,
        action.boxId,
        "Loaded-box collection",
      );
      if (workflow.snapshot.currentTrailerId === null) {
        throw new Error("Loaded-box collection requires an attached trailer.");
      }
      event = {
        id: eventId,
        type: "loaded-box-collected",
        boxId: action.boxId,
        trailerId: workflow.snapshot.currentTrailerId,
        occurredAt: now,
        source,
      };
      break;

    case "drop-box-for-unloading":
      requireAvailable(
        workflow.droppableLoadedBoxIds,
        action.boxId,
        "Box drop",
      );
      if (workflow.snapshot.currentTrailerId === null) {
        throw new Error("Box drop requires an attached trailer.");
      }
      event = {
        id: eventId,
        type: "box-dropped-for-unloading",
        boxId: action.boxId,
        trailerId: workflow.snapshot.currentTrailerId,
        occurredAt: now,
        source,
      };
      break;

    case "mark-box-empty-ready": {
      requireAvailable(
        workflow.boxesAwaitingEmptyConfirmationIds,
        action.boxId,
        "Empty-ready confirmation",
      );
      const box = workflow.snapshot.boxes.find(
        (item) => item.box.id === action.boxId,
      );

      if (box?.locationId === null || box?.locationId === undefined) {
        throw new Error("Empty-ready box has no customer location.");
      }
      event = {
        id: eventId,
        type: "box-empty-ready",
        boxId: action.boxId,
        locationId: box.locationId,
        occurredAt: now,
        source,
      };
      break;
    }

    case "collect-empty-box":
      requireAvailable(
        workflow.collectableEmptyBoxIds,
        action.boxId,
        "Empty-box collection",
      );
      if (workflow.snapshot.currentTrailerId === null) {
        throw new Error("Empty-box collection requires an attached trailer.");
      }
      event = {
        id: eventId,
        type: "empty-box-collected",
        boxId: action.boxId,
        trailerId: workflow.snapshot.currentTrailerId,
        occurredAt: now,
        source,
      };
      break;

    case "return-empty-box":
      requireAvailable(
        workflow.returnableEmptyBoxIds,
        action.boxId,
        "Empty-box return",
      );
      if (workflow.snapshot.currentTrailerId === null) {
        throw new Error("Empty-box return requires an attached trailer.");
      }
      event = {
        id: eventId,
        type: "empty-box-returned",
        boxId: action.boxId,
        trailerId: workflow.snapshot.currentTrailerId,
        occurredAt: now,
        source,
      };
      break;

    case "add-note":
      event = {
        id: eventId,
        type: "diary-note",
        text: action.text,
        ...(workflow.snapshot.activeVisit === null
          ? {}
          : { locationId: workflow.snapshot.activeVisit.locationId }),
        occurredAt: now,
        source,
      };
      break;
  }

  return recordCustomerOperationsEvent(diary, event);
}
