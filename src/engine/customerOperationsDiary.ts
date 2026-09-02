export type OperationsLocationType =
  | "customer"
  | "port"
  | "depot"
  | "company-site"
  | "partner-site"
  | "other";

export type OperationsEventSource = "manual" | "gps" | "admin-correction";

export interface OperationsLocation {
  id: string;
  name: string;
  type: OperationsLocationType;
  postcode?: string;
}

export interface OperationsTrailer {
  id: string;
  number: string;
  description?: string;
  initialLocationId?: string;
}

export interface OperationsBox {
  id: string;
  number: string;
  isoType?: string;
  sealNumber?: string;
  grossWeightKg?: number;
  initialLocationId?: string;
  initialLoadState: "loaded" | "empty";
}

interface OperationsEventBase {
  id: string;
  occurredAt: string;
  source: OperationsEventSource;
  note?: string;
}

export type OperationsDiaryEvent =
  | (OperationsEventBase & {
      type: "arrived-at-location";
      visitId: string;
      locationId: string;
    })
  | (OperationsEventBase & {
      type: "departed-location";
      visitId: string;
    })
  | (OperationsEventBase & {
      type: "trailer-attached";
      trailerId: string;
    })
  | (OperationsEventBase & {
      type: "trailer-detached";
      trailerId: string;
    })
  | (OperationsEventBase & {
      type: "loaded-box-collected";
      boxId: string;
      trailerId: string;
    })
  | (OperationsEventBase & {
      type: "box-dropped-for-unloading";
      boxId: string;
      trailerId: string;
    })
  | (OperationsEventBase & {
      type: "box-empty-ready";
      boxId: string;
      locationId: string;
    })
  | (OperationsEventBase & {
      type: "empty-box-collected";
      boxId: string;
      trailerId: string;
    })
  | (OperationsEventBase & {
      type: "empty-box-returned";
      boxId: string;
      trailerId: string;
    })
  | (OperationsEventBase & {
      type: "diary-note";
      locationId?: string;
      boxId?: string;
      trailerId?: string;
      text: string;
    });

export interface CustomerOperationsDiary {
  version: 1;
  id: string;
  dutyDate: string;
  tractorRegistration?: string;
  locations: OperationsLocation[];
  trailers: OperationsTrailer[];
  boxes: OperationsBox[];
  events: OperationsDiaryEvent[];
}

export interface OperationsVisitSummary {
  id: string;
  locationId: string;
  arrivedAt: string;
  departedAt: string | null;
  durationMinutes: number;
  active: boolean;
}

export interface OperationsLocationSummary {
  location: OperationsLocation;
  visitCount: number;
  completedVisitCount: number;
  totalDriverMinutes: number;
  activeVisitId: string | null;
}

export interface OperationsTrailerSummary {
  trailer: OperationsTrailer;
  attachedToTractor: boolean;
  locationId: string | null;
}

export type OperationsBoxStage =
  | "available-at-location"
  | "loaded-on-trailer"
  | "at-customer-unloading"
  | "empty-at-customer"
  | "empty-on-trailer"
  | "returned-empty";

export interface OperationsBoxSummary {
  box: OperationsBox;
  stage: OperationsBoxStage;
  loadState: "loaded" | "empty";
  locationId: string | null;
  trailerId: string | null;
  unloadingLocationId: string | null;
  loadedCollectedAt: string | null;
  unloadingStartedAt: string | null;
  emptyReadyAt: string | null;
  emptyCollectedAt: string | null;
  returnedAt: string | null;
  unloadingElapsedMinutes: number | null;
  driverPresentDuringUnloadingMinutes: number;
  fullCycleMinutes: number | null;
}

export interface CustomerOperationsDiarySnapshot {
  diaryId: string;
  dutyDate: string;
  occurredAt: string;
  activeVisit: OperationsVisitSummary | null;
  currentTrailerId: string | null;
  visits: OperationsVisitSummary[];
  locations: OperationsLocationSummary[];
  trailers: OperationsTrailerSummary[];
  boxes: OperationsBoxSummary[];
  totalDriverSiteMinutes: number;
  completedBoxCycles: number;
  activeUnloadingBoxes: number;
  emptyBoxesReady: number;
}

export interface CreateCustomerOperationsDiaryOptions {
  id: string;
  dutyDate: string;
  tractorRegistration?: string;
}

function requireNonBlank(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${fieldName} must not be blank.`);
  }

  return trimmed;
}

function parseDateOnly(value: string, fieldName: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  const milliseconds = new Date(`${value}T00:00:00.000Z`).getTime();

  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }
}

function parseTimestamp(value: string, fieldName: string): number {
  const milliseconds = new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }

  return milliseconds;
}

function minutesBetween(start: string, end: string): number {
  return Math.max(
    0,
    Math.floor(
      (parseTimestamp(end, "duration end") -
        parseTimestamp(start, "duration start")) /
        60_000,
    ),
  );
}

function intervalsOverlapMinutes(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
): number {
  const start = Math.max(
    parseTimestamp(firstStart, "overlap start"),
    parseTimestamp(secondStart, "overlap start"),
  );
  const end = Math.min(
    parseTimestamp(firstEnd, "overlap end"),
    parseTimestamp(secondEnd, "overlap end"),
  );

  return Math.max(0, Math.floor((end - start) / 60_000));
}

function getLocation(
  diary: CustomerOperationsDiary,
  locationId: string,
): OperationsLocation {
  const location = diary.locations.find((item) => item.id === locationId);

  if (location === undefined) {
    throw new Error(`Unknown operations location: ${locationId}`);
  }

  return location;
}

function getTrailer(
  diary: CustomerOperationsDiary,
  trailerId: string,
): OperationsTrailer {
  const trailer = diary.trailers.find((item) => item.id === trailerId);

  if (trailer === undefined) {
    throw new Error(`Unknown operations trailer: ${trailerId}`);
  }

  return trailer;
}

function getBox(
  diary: CustomerOperationsDiary,
  boxId: string,
): OperationsBox {
  const box = diary.boxes.find((item) => item.id === boxId);

  if (box === undefined) {
    throw new Error(`Unknown operations box: ${boxId}`);
  }

  return box;
}

export function createCustomerOperationsDiary(
  options: CreateCustomerOperationsDiaryOptions,
): CustomerOperationsDiary {
  const id = requireNonBlank(options.id, "Operations diary id");

  parseDateOnly(options.dutyDate, "operations duty date");

  return {
    version: 1,
    id,
    dutyDate: options.dutyDate,
    ...(options.tractorRegistration === undefined
      ? {}
      : {
          tractorRegistration: requireNonBlank(
            options.tractorRegistration,
            "Tractor registration",
          ),
        }),
    locations: [],
    trailers: [],
    boxes: [],
    events: [],
  };
}

export function registerOperationsLocation(
  diary: CustomerOperationsDiary,
  location: OperationsLocation,
): CustomerOperationsDiary {
  const id = requireNonBlank(location.id, "Location id");
  const name = requireNonBlank(location.name, "Location name");

  if (diary.locations.some((item) => item.id === id)) {
    throw new Error(`Duplicate operations location id: ${id}`);
  }

  return {
    ...diary,
    locations: [
      ...diary.locations,
      {
        ...location,
        id,
        name,
        ...(location.postcode === undefined
          ? {}
          : { postcode: requireNonBlank(location.postcode, "Postcode") }),
      },
    ],
  };
}

export function registerOperationsTrailer(
  diary: CustomerOperationsDiary,
  trailer: OperationsTrailer,
): CustomerOperationsDiary {
  const id = requireNonBlank(trailer.id, "Trailer id");
  const number = requireNonBlank(trailer.number, "Trailer number");

  if (
    diary.trailers.some(
      (item) => item.id === id || item.number.toLowerCase() === number.toLowerCase(),
    )
  ) {
    throw new Error(`Duplicate operations trailer: ${number}`);
  }

  if (trailer.initialLocationId !== undefined) {
    getLocation(diary, trailer.initialLocationId);
  }

  return {
    ...diary,
    trailers: [...diary.trailers, { ...trailer, id, number }],
  };
}

export function registerOperationsBox(
  diary: CustomerOperationsDiary,
  box: OperationsBox,
): CustomerOperationsDiary {
  const id = requireNonBlank(box.id, "Box id");
  const number = requireNonBlank(box.number, "Box number");

  if (
    diary.boxes.some(
      (item) => item.id === id || item.number.toLowerCase() === number.toLowerCase(),
    )
  ) {
    throw new Error(`Duplicate operations box: ${number}`);
  }

  if (box.initialLocationId !== undefined) {
    getLocation(diary, box.initialLocationId);
  }

  if (
    box.grossWeightKg !== undefined &&
    (!Number.isFinite(box.grossWeightKg) || box.grossWeightKg < 0)
  ) {
    throw new Error(`Invalid gross box weight: ${box.grossWeightKg}`);
  }

  return {
    ...diary,
    boxes: [...diary.boxes, { ...box, id, number }],
  };
}

function initialTrailerSummaries(
  diary: CustomerOperationsDiary,
): OperationsTrailerSummary[] {
  return diary.trailers.map((trailer) => ({
    trailer,
    attachedToTractor: false,
    locationId: trailer.initialLocationId ?? null,
  }));
}

function initialBoxSummaries(
  diary: CustomerOperationsDiary,
): OperationsBoxSummary[] {
  return diary.boxes.map((box) => ({
    box,
    stage: "available-at-location",
    loadState: box.initialLoadState,
    locationId: box.initialLocationId ?? null,
    trailerId: null,
    unloadingLocationId: null,
    loadedCollectedAt: null,
    unloadingStartedAt: null,
    emptyReadyAt: null,
    emptyCollectedAt: null,
    returnedAt: null,
    unloadingElapsedMinutes: null,
    driverPresentDuringUnloadingMinutes: 0,
    fullCycleMinutes: null,
  }));
}

export function buildCustomerOperationsDiarySnapshot(
  diary: CustomerOperationsDiary,
  occurredAt: string | number | Date = new Date(),
): CustomerOperationsDiarySnapshot {
  const nowMilliseconds =
    occurredAt instanceof Date
      ? occurredAt.getTime()
      : typeof occurredAt === "number"
        ? occurredAt
        : parseTimestamp(occurredAt, "operations snapshot time");

  if (!Number.isFinite(nowMilliseconds)) {
    throw new Error("Invalid operations snapshot time.");
  }

  const nowIso = new Date(nowMilliseconds).toISOString();
  const visits: OperationsVisitSummary[] = [];
  const trailers = initialTrailerSummaries(diary);
  const boxes = initialBoxSummaries(diary);
  let activeVisit: OperationsVisitSummary | null = null;
  let currentTrailerId: string | null = null;

  for (const event of diary.events) {
    switch (event.type) {
      case "arrived-at-location": {
        const visit: OperationsVisitSummary = {
          id: event.visitId,
          locationId: event.locationId,
          arrivedAt: event.occurredAt,
          departedAt: null,
          durationMinutes: 0,
          active: true,
        };

        visits.push(visit);
        activeVisit = visit;
        break;
      }

      case "departed-location": {
        const visit = visits.find((item) => item.id === event.visitId);

        if (visit !== undefined) {
          visit.departedAt = event.occurredAt;
          visit.durationMinutes = minutesBetween(
            visit.arrivedAt,
            event.occurredAt,
          );
          visit.active = false;
        }

        activeVisit = null;
        break;
      }

      case "trailer-attached": {
        const trailer = trailers.find(
          (item) => item.trailer.id === event.trailerId,
        );

        if (trailer !== undefined) {
          trailer.attachedToTractor = true;
          trailer.locationId = null;
        }

        currentTrailerId = event.trailerId;
        break;
      }

      case "trailer-detached": {
        const trailer = trailers.find(
          (item) => item.trailer.id === event.trailerId,
        );

        if (trailer !== undefined) {
          trailer.attachedToTractor = false;
          trailer.locationId = activeVisit?.locationId ?? null;
        }

        currentTrailerId = null;
        break;
      }

      case "loaded-box-collected": {
        const box = boxes.find((item) => item.box.id === event.boxId);

        if (box !== undefined) {
          box.stage = "loaded-on-trailer";
          box.loadState = "loaded";
          box.locationId = null;
          box.trailerId = event.trailerId;
          box.loadedCollectedAt = event.occurredAt;
        }

        break;
      }

      case "box-dropped-for-unloading": {
        const box = boxes.find((item) => item.box.id === event.boxId);

        if (box !== undefined) {
          box.stage = "at-customer-unloading";
          box.locationId = activeVisit?.locationId ?? null;
          box.trailerId = null;
          box.unloadingLocationId = activeVisit?.locationId ?? null;
          box.unloadingStartedAt = event.occurredAt;
        }

        break;
      }

      case "box-empty-ready": {
        const box = boxes.find((item) => item.box.id === event.boxId);

        if (box !== undefined) {
          box.stage = "empty-at-customer";
          box.loadState = "empty";
          box.locationId = event.locationId;
          box.emptyReadyAt = event.occurredAt;
        }

        break;
      }

      case "empty-box-collected": {
        const box = boxes.find((item) => item.box.id === event.boxId);

        if (box !== undefined) {
          box.stage = "empty-on-trailer";
          box.locationId = null;
          box.trailerId = event.trailerId;
          box.emptyCollectedAt = event.occurredAt;
        }

        break;
      }

      case "empty-box-returned": {
        const box = boxes.find((item) => item.box.id === event.boxId);

        if (box !== undefined) {
          box.stage = "returned-empty";
          box.locationId = activeVisit?.locationId ?? null;
          box.trailerId = null;
          box.returnedAt = event.occurredAt;
        }

        break;
      }

      case "diary-note":
        break;
    }
  }

  if (activeVisit !== null) {
    activeVisit.durationMinutes = minutesBetween(
      activeVisit.arrivedAt,
      nowIso,
    );
  }

  for (const box of boxes) {
    if (box.unloadingStartedAt !== null) {
      const unloadingEnd = box.emptyReadyAt ?? nowIso;

      box.unloadingElapsedMinutes = minutesBetween(
        box.unloadingStartedAt,
        unloadingEnd,
      );
      box.driverPresentDuringUnloadingMinutes = visits
        .filter((visit) => visit.locationId === box.unloadingLocationId)
        .reduce((total, visit) => {
          const visitEnd = visit.departedAt ?? nowIso;

          return (
            total +
            intervalsOverlapMinutes(
              visit.arrivedAt,
              visitEnd,
              box.unloadingStartedAt as string,
              unloadingEnd,
            )
          );
        }, 0);
    }

    if (box.loadedCollectedAt !== null && box.returnedAt !== null) {
      box.fullCycleMinutes = minutesBetween(
        box.loadedCollectedAt,
        box.returnedAt,
      );
    }
  }

  const locations = diary.locations.map(
    (location): OperationsLocationSummary => {
      const locationVisits = visits.filter(
        (visit) => visit.locationId === location.id,
      );

      return {
        location,
        visitCount: locationVisits.length,
        completedVisitCount: locationVisits.filter((visit) => !visit.active)
          .length,
        totalDriverMinutes: locationVisits.reduce(
          (total, visit) => total + visit.durationMinutes,
          0,
        ),
        activeVisitId:
          locationVisits.find((visit) => visit.active)?.id ?? null,
      };
    },
  );

  return {
    diaryId: diary.id,
    dutyDate: diary.dutyDate,
    occurredAt: nowIso,
    activeVisit,
    currentTrailerId,
    visits,
    locations,
    trailers,
    boxes,
    totalDriverSiteMinutes: visits.reduce(
      (total, visit) => total + visit.durationMinutes,
      0,
    ),
    completedBoxCycles: boxes.filter((box) => box.stage === "returned-empty")
      .length,
    activeUnloadingBoxes: boxes.filter(
      (box) => box.stage === "at-customer-unloading",
    ).length,
    emptyBoxesReady: boxes.filter(
      (box) => box.stage === "empty-at-customer",
    ).length,
  };
}

function assertActiveVisit(
  snapshot: CustomerOperationsDiarySnapshot,
  eventType: OperationsDiaryEvent["type"],
): OperationsVisitSummary {
  if (snapshot.activeVisit === null) {
    throw new Error(`${eventType} requires an active location visit.`);
  }

  return snapshot.activeVisit;
}

function getSnapshotBox(
  snapshot: CustomerOperationsDiarySnapshot,
  boxId: string,
): OperationsBoxSummary {
  const box = snapshot.boxes.find((item) => item.box.id === boxId);

  if (box === undefined) {
    throw new Error(`Unknown operations box: ${boxId}`);
  }

  return box;
}

function getSnapshotTrailer(
  snapshot: CustomerOperationsDiarySnapshot,
  trailerId: string,
): OperationsTrailerSummary {
  const trailer = snapshot.trailers.find(
    (item) => item.trailer.id === trailerId,
  );

  if (trailer === undefined) {
    throw new Error(`Unknown operations trailer: ${trailerId}`);
  }

  return trailer;
}

function validateOperationsEvent(
  diary: CustomerOperationsDiary,
  event: OperationsDiaryEvent,
): void {
  requireNonBlank(event.id, "Operations event id");
  const occurredMilliseconds = parseTimestamp(
    event.occurredAt,
    "operations event time",
  );

  if (diary.events.some((item) => item.id === event.id)) {
    throw new Error(`Duplicate operations event id: ${event.id}`);
  }

  const lastEvent = diary.events[diary.events.length - 1];

  if (
    lastEvent !== undefined &&
    occurredMilliseconds <
      parseTimestamp(lastEvent.occurredAt, "previous operations event time")
  ) {
    throw new Error("Operations events must be recorded chronologically.");
  }

  const snapshot = buildCustomerOperationsDiarySnapshot(
    diary,
    event.occurredAt,
  );

  switch (event.type) {
    case "arrived-at-location":
      getLocation(diary, event.locationId);
      requireNonBlank(event.visitId, "Visit id");

      if (snapshot.activeVisit !== null) {
        throw new Error("A driver cannot start overlapping location visits.");
      }

      if (
        diary.events.some(
          (item) =>
            "visitId" in item && item.visitId === event.visitId,
        )
      ) {
        throw new Error(`Duplicate operations visit id: ${event.visitId}`);
      }

      break;

    case "departed-location": {
      const activeVisit = assertActiveVisit(snapshot, event.type);

      if (activeVisit.id !== event.visitId) {
        throw new Error(`Cannot depart inactive visit: ${event.visitId}`);
      }

      break;
    }

    case "trailer-attached": {
      const activeVisit = assertActiveVisit(snapshot, event.type);
      const trailer = getSnapshotTrailer(snapshot, event.trailerId);

      if (snapshot.currentTrailerId !== null) {
        throw new Error("The tractor already has a trailer attached.");
      }

      if (trailer.attachedToTractor) {
        throw new Error(`Trailer is already attached: ${event.trailerId}`);
      }

      if (
        trailer.locationId !== null &&
        trailer.locationId !== activeVisit.locationId
      ) {
        throw new Error("Trailer is not at the driver's current location.");
      }

      break;
    }

    case "trailer-detached":
      assertActiveVisit(snapshot, event.type);
      getTrailer(diary, event.trailerId);

      if (snapshot.currentTrailerId !== event.trailerId) {
        throw new Error(`Trailer is not attached: ${event.trailerId}`);
      }

      break;

    case "loaded-box-collected": {
      const activeVisit = assertActiveVisit(snapshot, event.type);
      const location = getLocation(diary, activeVisit.locationId);
      const box = getSnapshotBox(snapshot, event.boxId);

      getTrailer(diary, event.trailerId);

      if (location.type !== "port" && location.type !== "depot") {
        throw new Error("A loaded box must be collected from a port or depot.");
      }

      if (snapshot.currentTrailerId !== event.trailerId) {
        throw new Error("The selected trailer is not attached to the tractor.");
      }

      if (
        box.stage !== "available-at-location" ||
        box.loadState !== "loaded"
      ) {
        throw new Error(`Box is not available as a loaded unit: ${event.boxId}`);
      }

      if (box.locationId !== null && box.locationId !== activeVisit.locationId) {
        throw new Error("Loaded box is not at the driver's current location.");
      }

      if (
        snapshot.boxes.some(
          (item) =>
            item.trailerId === event.trailerId &&
            (item.stage === "loaded-on-trailer" ||
              item.stage === "empty-on-trailer"),
        )
      ) {
        throw new Error("The trailer already carries a box.");
      }

      break;
    }

    case "box-dropped-for-unloading": {
      const activeVisit = assertActiveVisit(snapshot, event.type);
      const location = getLocation(diary, activeVisit.locationId);
      const box = getSnapshotBox(snapshot, event.boxId);

      if (location.type !== "customer") {
        throw new Error("Boxes may only enter unloading at a customer site.");
      }

      if (
        box.stage !== "loaded-on-trailer" ||
        box.trailerId !== event.trailerId
      ) {
        throw new Error("The loaded box is not on the selected trailer.");
      }

      if (snapshot.currentTrailerId !== event.trailerId) {
        throw new Error("The selected trailer is not attached to the tractor.");
      }

      break;
    }

    case "box-empty-ready": {
      const box = getSnapshotBox(snapshot, event.boxId);

      getLocation(diary, event.locationId);

      if (
        box.stage !== "at-customer-unloading" ||
        box.locationId !== event.locationId
      ) {
        throw new Error("Box is not unloading at the selected customer.");
      }

      break;
    }

    case "empty-box-collected": {
      const activeVisit = assertActiveVisit(snapshot, event.type);
      const box = getSnapshotBox(snapshot, event.boxId);

      if (snapshot.currentTrailerId !== event.trailerId) {
        throw new Error("The selected trailer is not attached to the tractor.");
      }

      if (
        box.stage !== "empty-at-customer" ||
        box.locationId !== activeVisit.locationId
      ) {
        throw new Error("Empty box is not ready at the current customer.");
      }

      if (
        snapshot.boxes.some(
          (item) =>
            item.trailerId === event.trailerId &&
            (item.stage === "loaded-on-trailer" ||
              item.stage === "empty-on-trailer"),
        )
      ) {
        throw new Error("The trailer already carries a box.");
      }

      break;
    }

    case "empty-box-returned": {
      const activeVisit = assertActiveVisit(snapshot, event.type);
      const location = getLocation(diary, activeVisit.locationId);
      const box = getSnapshotBox(snapshot, event.boxId);

      if (location.type !== "port" && location.type !== "depot") {
        throw new Error("An empty box must be returned to a port or depot.");
      }

      if (
        box.stage !== "empty-on-trailer" ||
        box.trailerId !== event.trailerId
      ) {
        throw new Error("The empty box is not on the selected trailer.");
      }

      if (snapshot.currentTrailerId !== event.trailerId) {
        throw new Error("The selected trailer is not attached to the tractor.");
      }

      break;
    }

    case "diary-note":
      requireNonBlank(event.text, "Diary note");

      if (event.locationId !== undefined) {
        getLocation(diary, event.locationId);
      }

      if (event.boxId !== undefined) {
        getBox(diary, event.boxId);
      }

      if (event.trailerId !== undefined) {
        getTrailer(diary, event.trailerId);
      }

      break;
  }
}

export function recordCustomerOperationsEvent(
  diary: CustomerOperationsDiary,
  event: OperationsDiaryEvent,
): CustomerOperationsDiary {
  validateOperationsEvent(diary, event);

  return {
    ...diary,
    events: [...diary.events, event],
  };
}
