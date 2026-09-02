import {
  createCustomerOperationsDiary,
  recordCustomerOperationsEvent,
  registerOperationsBox,
  registerOperationsLocation,
  registerOperationsTrailer,
  type CustomerOperationsDiary,
  type OperationsDiaryEvent,
} from "../engine/customerOperationsDiary";

export const SAMPLE_CUSTOMER_OPERATIONS_NOW =
  "2026-09-02T11:10:00.000Z";

type ManualOperationsEvent =
  OperationsDiaryEvent extends infer Event
    ? Event extends OperationsDiaryEvent
      ? Omit<Event, "source">
      : never
    : never;

function recordManual(
  diary: CustomerOperationsDiary,
  event: ManualOperationsEvent,
): CustomerOperationsDiary {
  return recordCustomerOperationsEvent(diary, {
    ...event,
    source: "manual",
  } as OperationsDiaryEvent);
}

function buildSampleCustomerOperationsDiary(): CustomerOperationsDiary {
  let diary = createCustomerOperationsDiary({
    id: "demo-customer-operations-2026-09-02",
    dutyDate: "2026-09-02",
    tractorRegistration: "YX26 TTK",
  });

  diary = registerOperationsLocation(diary, {
    id: "felixstowe-port",
    name: "Felixstowe Port",
    type: "port",
    postcode: "IP11 3SY",
  });
  diary = registerOperationsLocation(diary, {
    id: "customer-distribution-centre",
    name: "Customer Distribution Centre",
    type: "customer",
    postcode: "IP14 1AB",
  });
  diary = registerOperationsTrailer(diary, {
    id: "trailer-2048",
    number: "TRL-2048",
    description: "Sliding skeletal trailer",
    initialLocationId: "felixstowe-port",
  });
  diary = registerOperationsBox(diary, {
    id: "box-mscu-1234567",
    number: "MSCU1234567",
    isoType: "40HC",
    sealNumber: "SEAL-1001",
    grossWeightKg: 27_400,
    initialLocationId: "felixstowe-port",
    initialLoadState: "loaded",
  });
  diary = registerOperationsBox(diary, {
    id: "box-tghu-7654321",
    number: "TGHU7654321",
    isoType: "40HC",
    sealNumber: "SEAL-1002",
    grossWeightKg: 25_800,
    initialLocationId: "felixstowe-port",
    initialLoadState: "loaded",
  });

  const events: ManualOperationsEvent[] = [
    {
      id: "demo-arrive-port-one",
      type: "arrived-at-location",
      visitId: "demo-port-visit-one",
      locationId: "felixstowe-port",
      occurredAt: "2026-09-02T05:30:00.000Z",
    },
    {
      id: "demo-attach-trailer",
      type: "trailer-attached",
      trailerId: "trailer-2048",
      occurredAt: "2026-09-02T05:35:00.000Z",
    },
    {
      id: "demo-collect-box-one-loaded",
      type: "loaded-box-collected",
      boxId: "box-mscu-1234567",
      trailerId: "trailer-2048",
      occurredAt: "2026-09-02T05:45:00.000Z",
    },
    {
      id: "demo-depart-port-one",
      type: "departed-location",
      visitId: "demo-port-visit-one",
      occurredAt: "2026-09-02T05:50:00.000Z",
    },
    {
      id: "demo-arrive-customer-one",
      type: "arrived-at-location",
      visitId: "demo-customer-visit-one",
      locationId: "customer-distribution-centre",
      occurredAt: "2026-09-02T06:30:00.000Z",
    },
    {
      id: "demo-drop-box-one",
      type: "box-dropped-for-unloading",
      boxId: "box-mscu-1234567",
      trailerId: "trailer-2048",
      occurredAt: "2026-09-02T06:40:00.000Z",
    },
    {
      id: "demo-depart-customer-one",
      type: "departed-location",
      visitId: "demo-customer-visit-one",
      occurredAt: "2026-09-02T06:45:00.000Z",
    },
    {
      id: "demo-arrive-port-two",
      type: "arrived-at-location",
      visitId: "demo-port-visit-two",
      locationId: "felixstowe-port",
      occurredAt: "2026-09-02T07:25:00.000Z",
    },
    {
      id: "demo-collect-box-two-loaded",
      type: "loaded-box-collected",
      boxId: "box-tghu-7654321",
      trailerId: "trailer-2048",
      occurredAt: "2026-09-02T07:30:00.000Z",
    },
    {
      id: "demo-depart-port-two",
      type: "departed-location",
      visitId: "demo-port-visit-two",
      occurredAt: "2026-09-02T07:35:00.000Z",
    },
    {
      id: "demo-arrive-customer-two",
      type: "arrived-at-location",
      visitId: "demo-customer-visit-two",
      locationId: "customer-distribution-centre",
      occurredAt: "2026-09-02T08:15:00.000Z",
    },
    {
      id: "demo-drop-box-two",
      type: "box-dropped-for-unloading",
      boxId: "box-tghu-7654321",
      trailerId: "trailer-2048",
      occurredAt: "2026-09-02T08:20:00.000Z",
    },
    {
      id: "demo-box-one-empty-ready",
      type: "box-empty-ready",
      boxId: "box-mscu-1234567",
      locationId: "customer-distribution-centre",
      occurredAt: "2026-09-02T08:25:00.000Z",
    },
    {
      id: "demo-collect-box-one-empty",
      type: "empty-box-collected",
      boxId: "box-mscu-1234567",
      trailerId: "trailer-2048",
      occurredAt: "2026-09-02T08:30:00.000Z",
    },
    {
      id: "demo-depart-customer-two",
      type: "departed-location",
      visitId: "demo-customer-visit-two",
      occurredAt: "2026-09-02T08:35:00.000Z",
    },
    {
      id: "demo-arrive-port-three",
      type: "arrived-at-location",
      visitId: "demo-port-visit-three",
      locationId: "felixstowe-port",
      occurredAt: "2026-09-02T09:15:00.000Z",
    },
    {
      id: "demo-return-box-one-empty",
      type: "empty-box-returned",
      boxId: "box-mscu-1234567",
      trailerId: "trailer-2048",
      occurredAt: "2026-09-02T09:20:00.000Z",
    },
    {
      id: "demo-depart-port-three",
      type: "departed-location",
      visitId: "demo-port-visit-three",
      occurredAt: "2026-09-02T09:25:00.000Z",
    },
    {
      id: "demo-box-two-empty-ready",
      type: "box-empty-ready",
      boxId: "box-tghu-7654321",
      locationId: "customer-distribution-centre",
      occurredAt: "2026-09-02T09:30:00.000Z",
      note: "Customer marked box empty while driver was returning box one.",
    },
    {
      id: "demo-arrive-customer-three",
      type: "arrived-at-location",
      visitId: "demo-customer-visit-three",
      locationId: "customer-distribution-centre",
      occurredAt: "2026-09-02T10:05:00.000Z",
    },
    {
      id: "demo-collect-box-two-empty",
      type: "empty-box-collected",
      boxId: "box-tghu-7654321",
      trailerId: "trailer-2048",
      occurredAt: "2026-09-02T10:10:00.000Z",
    },
    {
      id: "demo-depart-customer-three",
      type: "departed-location",
      visitId: "demo-customer-visit-three",
      occurredAt: "2026-09-02T10:15:00.000Z",
    },
    {
      id: "demo-arrive-port-four",
      type: "arrived-at-location",
      visitId: "demo-port-visit-four",
      locationId: "felixstowe-port",
      occurredAt: "2026-09-02T10:50:00.000Z",
    },
    {
      id: "demo-return-box-two-empty",
      type: "empty-box-returned",
      boxId: "box-tghu-7654321",
      trailerId: "trailer-2048",
      occurredAt: "2026-09-02T10:55:00.000Z",
    },
    {
      id: "demo-completion-note",
      type: "diary-note",
      locationId: "felixstowe-port",
      trailerId: "trailer-2048",
      text: "Both empty boxes returned. Awaiting next instruction.",
      occurredAt: "2026-09-02T11:00:00.000Z",
    },
  ];

  return events.reduce(recordManual, diary);
}

export const sampleCustomerOperationsDiary =
  buildSampleCustomerOperationsDiary();
