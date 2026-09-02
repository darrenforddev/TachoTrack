import {
  buildCustomerOperationsDiarySnapshot,
  type CustomerOperationsDiary,
  type OperationsBoxStage,
  type OperationsLocationType,
} from "./customerOperationsDiary";

export interface CustomerOperationsVisitCard {
  id: string;
  sequence: number;
  locationId: string;
  locationName: string;
  locationType: OperationsLocationType;
  postcode: string | null;
  arrivedAt: string;
  departedAt: string | null;
  durationMinutes: number;
  active: boolean;
}

export interface CustomerOperationsBoxJourneyCard {
  id: string;
  number: string;
  isoType: string | null;
  sealNumber: string | null;
  grossWeightKg: number | null;
  stage: OperationsBoxStage;
  stageLabel: string;
  loadState: "loaded" | "empty";
  locationName: string | null;
  trailerNumber: string | null;
  loadedCollectedAt: string | null;
  unloadingStartedAt: string | null;
  emptyReadyAt: string | null;
  emptyCollectedAt: string | null;
  returnedAt: string | null;
  unloadingElapsedMinutes: number | null;
  driverPresentDuringUnloadingMinutes: number;
  fullCycleMinutes: number | null;
  completedSteps: number;
  totalSteps: 5;
}

export interface CustomerOperationsTimelineItem {
  id: string;
  occurredAt: string;
  title: string;
  detail: string | null;
}

export interface CustomerOperationsDiaryPresentation {
  diaryId: string;
  dutyDate: string;
  tractorRegistration: string | null;
  occurredAt: string;
  currentLocationName: string | null;
  currentLocationType: OperationsLocationType | null;
  currentVisitMinutes: number | null;
  currentTrailerNumber: string | null;
  totalVisits: number;
  customerVisits: number;
  portVisits: number;
  totalDriverSiteMinutes: number;
  totalCustomerMinutes: number;
  totalPortMinutes: number;
  completedBoxCycles: number;
  activeUnloadingBoxes: number;
  emptyBoxesReady: number;
  visits: CustomerOperationsVisitCard[];
  boxes: CustomerOperationsBoxJourneyCard[];
  timeline: CustomerOperationsTimelineItem[];
}

const BOX_STAGE_LABELS: Record<OperationsBoxStage, string> = {
  "available-at-location": "Available",
  "loaded-on-trailer": "Loaded in transit",
  "at-customer-unloading": "Unloading",
  "empty-at-customer": "Empty ready",
  "empty-on-trailer": "Empty in transit",
  "returned-empty": "Returned empty",
};

const BOX_STAGE_STEPS: Record<OperationsBoxStage, number> = {
  "available-at-location": 0,
  "loaded-on-trailer": 1,
  "at-customer-unloading": 2,
  "empty-at-customer": 3,
  "empty-on-trailer": 4,
  "returned-empty": 5,
};

function requireNow(value: string | number | Date): string {
  const milliseconds =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error("Invalid customer operations presentation time.");
  }

  return new Date(milliseconds).toISOString();
}

export function buildCustomerOperationsDiaryPresentation(
  diary: CustomerOperationsDiary,
  occurredAt: string | number | Date,
): CustomerOperationsDiaryPresentation {
  const now = requireNow(occurredAt);
  const snapshot = buildCustomerOperationsDiarySnapshot(diary, now);
  const locationsById = new Map(
    diary.locations.map((location) => [location.id, location]),
  );
  const trailersById = new Map(
    diary.trailers.map((trailer) => [trailer.id, trailer]),
  );
  const boxesById = new Map(diary.boxes.map((box) => [box.id, box]));
  const visitsById = new Map(
    snapshot.visits.map((visit) => [visit.id, visit]),
  );
  const currentLocation =
    snapshot.activeVisit === null
      ? null
      : (locationsById.get(snapshot.activeVisit.locationId) ?? null);
  const currentTrailer =
    snapshot.currentTrailerId === null
      ? null
      : (trailersById.get(snapshot.currentTrailerId) ?? null);
  const visits = snapshot.visits.map(
    (visit, index): CustomerOperationsVisitCard => {
      const location = locationsById.get(visit.locationId);

      if (location === undefined) {
        throw new Error(`Missing operations visit location: ${visit.locationId}`);
      }

      return {
        id: visit.id,
        sequence: index + 1,
        locationId: location.id,
        locationName: location.name,
        locationType: location.type,
        postcode: location.postcode ?? null,
        arrivedAt: visit.arrivedAt,
        departedAt: visit.departedAt,
        durationMinutes: visit.durationMinutes,
        active: visit.active,
      };
    },
  );
  const boxes = snapshot.boxes.map(
    (box): CustomerOperationsBoxJourneyCard => ({
      id: box.box.id,
      number: box.box.number,
      isoType: box.box.isoType ?? null,
      sealNumber: box.box.sealNumber ?? null,
      grossWeightKg: box.box.grossWeightKg ?? null,
      stage: box.stage,
      stageLabel: BOX_STAGE_LABELS[box.stage],
      loadState: box.loadState,
      locationName:
        box.locationId === null
          ? null
          : (locationsById.get(box.locationId)?.name ?? null),
      trailerNumber:
        box.trailerId === null
          ? null
          : (trailersById.get(box.trailerId)?.number ?? null),
      loadedCollectedAt: box.loadedCollectedAt,
      unloadingStartedAt: box.unloadingStartedAt,
      emptyReadyAt: box.emptyReadyAt,
      emptyCollectedAt: box.emptyCollectedAt,
      returnedAt: box.returnedAt,
      unloadingElapsedMinutes: box.unloadingElapsedMinutes,
      driverPresentDuringUnloadingMinutes:
        box.driverPresentDuringUnloadingMinutes,
      fullCycleMinutes: box.fullCycleMinutes,
      completedSteps: BOX_STAGE_STEPS[box.stage],
      totalSteps: 5,
    }),
  );
  const timeline = diary.events.map(
    (event): CustomerOperationsTimelineItem => {
      switch (event.type) {
        case "arrived-at-location": {
          const location = locationsById.get(event.locationId);

          return {
            id: event.id,
            occurredAt: event.occurredAt,
            title: `Arrived · ${location?.name ?? event.locationId}`,
            detail: location?.postcode ?? null,
          };
        }

        case "departed-location": {
          const visit = visitsById.get(event.visitId);
          const location =
            visit === undefined
              ? undefined
              : locationsById.get(visit.locationId);

          return {
            id: event.id,
            occurredAt: event.occurredAt,
            title: `Departed · ${location?.name ?? event.visitId}`,
            detail: null,
          };
        }

        case "trailer-attached":
          return {
            id: event.id,
            occurredAt: event.occurredAt,
            title: `Trailer attached · ${trailersById.get(event.trailerId)?.number ?? event.trailerId}`,
            detail: event.note ?? null,
          };

        case "trailer-detached":
          return {
            id: event.id,
            occurredAt: event.occurredAt,
            title: `Trailer detached · ${trailersById.get(event.trailerId)?.number ?? event.trailerId}`,
            detail: event.note ?? null,
          };

        case "loaded-box-collected":
          return {
            id: event.id,
            occurredAt: event.occurredAt,
            title: `Loaded box collected · ${boxesById.get(event.boxId)?.number ?? event.boxId}`,
            detail: null,
          };

        case "box-dropped-for-unloading":
          return {
            id: event.id,
            occurredAt: event.occurredAt,
            title: `Box dropped for unloading · ${boxesById.get(event.boxId)?.number ?? event.boxId}`,
            detail: null,
          };

        case "box-empty-ready":
          return {
            id: event.id,
            occurredAt: event.occurredAt,
            title: `Box empty and ready · ${boxesById.get(event.boxId)?.number ?? event.boxId}`,
            detail: event.note ?? null,
          };

        case "empty-box-collected":
          return {
            id: event.id,
            occurredAt: event.occurredAt,
            title: `Empty box collected · ${boxesById.get(event.boxId)?.number ?? event.boxId}`,
            detail: null,
          };

        case "empty-box-returned":
          return {
            id: event.id,
            occurredAt: event.occurredAt,
            title: `Empty box returned · ${boxesById.get(event.boxId)?.number ?? event.boxId}`,
            detail: null,
          };

        case "diary-note":
          return {
            id: event.id,
            occurredAt: event.occurredAt,
            title: "Diary note",
            detail: event.text,
          };
      }
    },
  );

  const totalCustomerMinutes = snapshot.locations
    .filter((item) => item.location.type === "customer")
    .reduce((total, item) => total + item.totalDriverMinutes, 0);
  const totalPortMinutes = snapshot.locations
    .filter(
      (item) =>
        item.location.type === "port" || item.location.type === "depot",
    )
    .reduce((total, item) => total + item.totalDriverMinutes, 0);

  return {
    diaryId: diary.id,
    dutyDate: diary.dutyDate,
    tractorRegistration: diary.tractorRegistration ?? null,
    occurredAt: now,
    currentLocationName: currentLocation?.name ?? null,
    currentLocationType: currentLocation?.type ?? null,
    currentVisitMinutes: snapshot.activeVisit?.durationMinutes ?? null,
    currentTrailerNumber: currentTrailer?.number ?? null,
    totalVisits: visits.length,
    customerVisits: visits.filter((visit) => visit.locationType === "customer")
      .length,
    portVisits: visits.filter(
      (visit) =>
        visit.locationType === "port" || visit.locationType === "depot",
    ).length,
    totalDriverSiteMinutes: snapshot.totalDriverSiteMinutes,
    totalCustomerMinutes,
    totalPortMinutes,
    completedBoxCycles: snapshot.completedBoxCycles,
    activeUnloadingBoxes: snapshot.activeUnloadingBoxes,
    emptyBoxesReady: snapshot.emptyBoxesReady,
    visits,
    boxes,
    timeline,
  };
}
