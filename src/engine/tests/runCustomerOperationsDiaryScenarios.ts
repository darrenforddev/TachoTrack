import {
  buildCustomerOperationsDiarySnapshot,
  createCustomerOperationsDiary,
  recordCustomerOperationsEvent,
  registerOperationsBox,
  registerOperationsLocation,
  registerOperationsTrailer,
  type CustomerOperationsDiary,
  type OperationsDiaryEvent,
} from "../customerOperationsDiary";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Customer operations diary scenario failed: ${message}`);
  }
}

type OperationsEventWithoutSource =
  OperationsDiaryEvent extends infer Event
    ? Event extends OperationsDiaryEvent
      ? Omit<Event, "source">
      : never
    : never;

function manualEvent(
  event: OperationsEventWithoutSource,
): OperationsDiaryEvent {
  return { ...event, source: "manual" } as OperationsDiaryEvent;
}

function record(
  diary: CustomerOperationsDiary,
  event: OperationsEventWithoutSource,
): CustomerOperationsDiary {
  return recordCustomerOperationsEvent(diary, manualEvent(event));
}

let diary = createCustomerOperationsDiary({
  id: "multi-box-customer-day",
  dutyDate: "2026-09-02",
  tractorRegistration: "YX26 TTK",
});

diary = registerOperationsLocation(diary, {
  id: "port",
  name: "Felixstowe Port",
  type: "port",
  postcode: "IP11 3SY",
});
diary = registerOperationsLocation(diary, {
  id: "customer",
  name: "Customer Distribution Centre",
  type: "customer",
  postcode: "IP14 1AB",
});
diary = registerOperationsTrailer(diary, {
  id: "trailer-one",
  number: "TRL-2048",
  description: "Sliding skeletal trailer",
  initialLocationId: "port",
});
diary = registerOperationsBox(diary, {
  id: "box-one",
  number: "MSCU1234567",
  isoType: "40HC",
  sealNumber: "SEAL-1001",
  grossWeightKg: 27_400,
  initialLocationId: "port",
  initialLoadState: "loaded",
});
diary = registerOperationsBox(diary, {
  id: "box-two",
  number: "TGHU7654321",
  isoType: "40HC",
  sealNumber: "SEAL-1002",
  grossWeightKg: 25_800,
  initialLocationId: "port",
  initialLoadState: "loaded",
});

const originalRegistrationSnapshot = JSON.stringify({
  locations: diary.locations,
  trailers: diary.trailers,
  boxes: diary.boxes,
});

diary = record(
  diary,
  {
    id: "arrive-port-one",
    type: "arrived-at-location",
    visitId: "port-visit-one",
    locationId: "port",
    occurredAt: "2026-09-02T05:30:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "attach-trailer",
    type: "trailer-attached",
    trailerId: "trailer-one",
    occurredAt: "2026-09-02T05:35:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "collect-loaded-box-one",
    type: "loaded-box-collected",
    boxId: "box-one",
    trailerId: "trailer-one",
    occurredAt: "2026-09-02T05:45:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "depart-port-one",
    type: "departed-location",
    visitId: "port-visit-one",
    occurredAt: "2026-09-02T05:50:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "arrive-customer-one",
    type: "arrived-at-location",
    visitId: "customer-visit-one",
    locationId: "customer",
    occurredAt: "2026-09-02T06:30:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "drop-box-one",
    type: "box-dropped-for-unloading",
    boxId: "box-one",
    trailerId: "trailer-one",
    occurredAt: "2026-09-02T06:40:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "depart-customer-one",
    type: "departed-location",
    visitId: "customer-visit-one",
    occurredAt: "2026-09-02T06:45:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "arrive-port-two",
    type: "arrived-at-location",
    visitId: "port-visit-two",
    locationId: "port",
    occurredAt: "2026-09-02T07:25:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "collect-loaded-box-two",
    type: "loaded-box-collected",
    boxId: "box-two",
    trailerId: "trailer-one",
    occurredAt: "2026-09-02T07:30:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "depart-port-two",
    type: "departed-location",
    visitId: "port-visit-two",
    occurredAt: "2026-09-02T07:35:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "arrive-customer-two",
    type: "arrived-at-location",
    visitId: "customer-visit-two",
    locationId: "customer",
    occurredAt: "2026-09-02T08:15:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "drop-box-two",
    type: "box-dropped-for-unloading",
    boxId: "box-two",
    trailerId: "trailer-one",
    occurredAt: "2026-09-02T08:20:00.000Z",
  },
);

const twoBoxesUnloading = buildCustomerOperationsDiarySnapshot(
  diary,
  "2026-09-02T08:20:00.000Z",
);

diary = record(
  diary,
  {
    id: "box-one-empty-ready",
    type: "box-empty-ready",
    boxId: "box-one",
    locationId: "customer",
    occurredAt: "2026-09-02T08:25:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "collect-empty-box-one",
    type: "empty-box-collected",
    boxId: "box-one",
    trailerId: "trailer-one",
    occurredAt: "2026-09-02T08:27:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "depart-customer-two",
    type: "departed-location",
    visitId: "customer-visit-two",
    occurredAt: "2026-09-02T08:30:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "arrive-port-three",
    type: "arrived-at-location",
    visitId: "port-visit-three",
    locationId: "port",
    occurredAt: "2026-09-02T09:10:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "return-empty-box-one",
    type: "empty-box-returned",
    boxId: "box-one",
    trailerId: "trailer-one",
    occurredAt: "2026-09-02T09:15:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "depart-port-three",
    type: "departed-location",
    visitId: "port-visit-three",
    occurredAt: "2026-09-02T09:20:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "box-two-empty-ready-away",
    type: "box-empty-ready",
    boxId: "box-two",
    locationId: "customer",
    occurredAt: "2026-09-02T09:50:00.000Z",
    note: "Customer confirmed the second box was empty while driver was away.",
  },
);
diary = record(
  diary,
  {
    id: "arrive-customer-three",
    type: "arrived-at-location",
    visitId: "customer-visit-three",
    locationId: "customer",
    occurredAt: "2026-09-02T10:00:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "collect-empty-box-two",
    type: "empty-box-collected",
    boxId: "box-two",
    trailerId: "trailer-one",
    occurredAt: "2026-09-02T10:05:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "depart-customer-three",
    type: "departed-location",
    visitId: "customer-visit-three",
    occurredAt: "2026-09-02T10:10:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "arrive-port-four",
    type: "arrived-at-location",
    visitId: "port-visit-four",
    locationId: "port",
    occurredAt: "2026-09-02T10:50:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "return-empty-box-two",
    type: "empty-box-returned",
    boxId: "box-two",
    trailerId: "trailer-one",
    occurredAt: "2026-09-02T10:55:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "detach-trailer",
    type: "trailer-detached",
    trailerId: "trailer-one",
    occurredAt: "2026-09-02T11:00:00.000Z",
  },
);
diary = record(
  diary,
  {
    id: "depart-port-four",
    type: "departed-location",
    visitId: "port-visit-four",
    occurredAt: "2026-09-02T11:05:00.000Z",
  },
);

const snapshot = buildCustomerOperationsDiarySnapshot(
  diary,
  "2026-09-02T11:05:00.000Z",
);
const portSummary = snapshot.locations.find(
  (item) => item.location.id === "port",
);
const customerSummary = snapshot.locations.find(
  (item) => item.location.id === "customer",
);
const trailerSummary = snapshot.trailers.find(
  (item) => item.trailer.id === "trailer-one",
);
const boxOne = snapshot.boxes.find((item) => item.box.id === "box-one");
const boxTwo = snapshot.boxes.find((item) => item.box.id === "box-two");

assert(diary.events.length === 26, "Every operational change must be audited.");
assert(snapshot.visits.length === 7, "All seven site visits must remain separate.");
assert(snapshot.activeVisit === null, "The final port departure must close the visit.");
assert(
  portSummary?.visitCount === 4 && portSummary.completedVisitCount === 4,
  "Repeated port calls must be counted independently.",
);
assert(
  customerSummary?.visitCount === 3 &&
    customerSummary.completedVisitCount === 3,
  "Repeated customer visits must be counted independently.",
);
assert(portSummary?.totalDriverMinutes === 55, "Port time must total 55 minutes.");
assert(
  customerSummary?.totalDriverMinutes === 40,
  "Customer time must total 40 minutes.",
);
assert(
  snapshot.totalDriverSiteMinutes === 95,
  "All driver site time must total 95 minutes without double counting.",
);
assert(
  twoBoxesUnloading.activeUnloadingBoxes === 2,
  "Several boxes must be able to unload at the same customer simultaneously.",
);
assert(
  twoBoxesUnloading.boxes.every(
    (box) => box.stage === "at-customer-unloading",
  ),
  "Both boxes must retain independent unloading states.",
);
assert(
  boxOne?.stage === "returned-empty" && boxTwo?.stage === "returned-empty",
  "Both completed box cycles must finish back at the port.",
);
assert(snapshot.completedBoxCycles === 2, "Two completed turns must be counted.");
assert(snapshot.activeUnloadingBoxes === 0, "No unloading must remain active.");
assert(snapshot.emptyBoxesReady === 0, "No empty box must remain awaiting collection.");
assert(
  boxOne?.unloadingElapsedMinutes === 105,
  "The first box unloading cycle must continue while the driver is away.",
);
assert(
  boxTwo?.unloadingElapsedMinutes === 90,
  "The second box unloading duration must remain independent.",
);
assert(
  boxOne?.driverPresentDuringUnloadingMinutes === 15,
  "Only 15 minutes of the first unload occurred with the driver present.",
);
assert(
  boxTwo?.driverPresentDuringUnloadingMinutes === 10,
  "Only 10 minutes of the second unload occurred with the driver present.",
);
assert(boxOne?.fullCycleMinutes === 210, "The first full box turn must be 210 minutes.");
assert(boxTwo?.fullCycleMinutes === 205, "The second full box turn must be 205 minutes.");
assert(snapshot.currentTrailerId === null, "The trailer must finish detached.");
assert(
  trailerSummary?.attachedToTractor === false &&
    trailerSummary.locationId === "port",
  "The detached trailer must remain recorded at the port.",
);
assert(
  JSON.stringify({
    locations: diary.locations,
    trailers: diary.trailers,
    boxes: diary.boxes,
  }) === originalRegistrationSnapshot,
  "Building the diary must not mutate registered locations or assets.",
);

let overlapRejected = false;

try {
  let invalid = createCustomerOperationsDiary({
    id: "overlap-test",
    dutyDate: "2026-09-02",
  });

  invalid = registerOperationsLocation(invalid, {
    id: "one",
    name: "First Site",
    type: "customer",
  });
  invalid = registerOperationsLocation(invalid, {
    id: "two",
    name: "Second Site",
    type: "customer",
  });
  invalid = record(invalid, {
    id: "arrive-one",
    type: "arrived-at-location",
    visitId: "visit-one",
    locationId: "one",
    occurredAt: "2026-09-02T08:00:00.000Z",
  });
  record(invalid, {
    id: "arrive-two",
    type: "arrived-at-location",
    visitId: "visit-two",
    locationId: "two",
    occurredAt: "2026-09-02T08:05:00.000Z",
  });
} catch {
  overlapRejected = true;
}

assert(overlapRejected, "Overlapping driver visits must be rejected.");

let backdatedRejected = false;

try {
  record(diary, {
    id: "backdated-note",
    type: "diary-note",
    text: "This should not be inserted behind later evidence.",
    occurredAt: "2026-09-02T10:00:00.000Z",
  });
} catch {
  backdatedRejected = true;
}

assert(backdatedRejected, "Backdated append-only events must be rejected.");

let duplicateBoxRejected = false;

try {
  registerOperationsBox(diary, {
    id: "duplicate-box",
    number: "mscu1234567",
    initialLoadState: "loaded",
  });
} catch {
  duplicateBoxRejected = true;
}

assert(duplicateBoxRejected, "Duplicate box numbers must be rejected.");

let invalidWeightRejected = false;

try {
  registerOperationsBox(diary, {
    id: "invalid-weight",
    number: "BADU0000001",
    grossWeightKg: -1,
    initialLoadState: "loaded",
  });
} catch {
  invalidWeightRejected = true;
}

assert(invalidWeightRejected, "Invalid box weights must be rejected.");

let crossMidnight = createCustomerOperationsDiary({
  id: "cross-midnight-shift",
  dutyDate: "2026-09-02",
});

crossMidnight = registerOperationsLocation(crossMidnight, {
  id: "night-port",
  name: "Night Port",
  type: "port",
});
crossMidnight = record(crossMidnight, {
  id: "night-arrival",
  type: "arrived-at-location",
  visitId: "night-visit",
  locationId: "night-port",
  occurredAt: "2026-09-02T23:50:00.000Z",
});
crossMidnight = record(crossMidnight, {
  id: "night-departure",
  type: "departed-location",
  visitId: "night-visit",
  occurredAt: "2026-09-03T00:10:00.000Z",
});

assert(
  buildCustomerOperationsDiarySnapshot(
    crossMidnight,
    "2026-09-03T00:10:00.000Z",
  ).totalDriverSiteMinutes === 20,
  "A working day must be allowed to continue across midnight.",
);

console.log("✓ Customer operations diary scenarios passed (28/28)");
