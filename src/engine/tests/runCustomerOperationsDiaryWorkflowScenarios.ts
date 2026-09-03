import {
  buildCustomerOperationsDiarySnapshot,
  createCustomerOperationsDiary,
  registerOperationsBox,
  registerOperationsLocation,
  registerOperationsTrailer,
  type CustomerOperationsDiary,
} from "../customerOperationsDiary";
import {
  buildCustomerOperationsDiaryWorkflowState,
  recordCustomerOperationsWorkflowAction,
} from "../customerOperationsDiaryWorkflow";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(
      `Customer operations workflow scenario failed: ${message}`,
    );
  }
}

function assertRejects(action: () => unknown, message: string): void {
  let rejected = false;

  try {
    action();
  } catch {
    rejected = true;
  }

  assert(rejected, message);
}

let diary = createCustomerOperationsDiary({
  id: "workflow-day-2026-09-02",
  dutyDate: "2026-09-02",
  tractorRegistration: "YX26 TTK",
});

diary = registerOperationsLocation(diary, {
  id: "port",
  name: "Felixstowe Port",
  type: "port",
});
diary = registerOperationsLocation(diary, {
  id: "customer",
  name: "Customer Distribution Centre",
  type: "customer",
});
diary = registerOperationsTrailer(diary, {
  id: "trailer",
  number: "TRL-2048",
  initialLocationId: "port",
});
diary = registerOperationsBox(diary, {
  id: "box",
  number: "MSCU1234567",
  initialLocationId: "port",
  initialLoadState: "loaded",
});

const initial = buildCustomerOperationsDiaryWorkflowState(
  diary,
  "2026-09-02T05:00:00.000Z",
);

assert(
  initial.arrivalLocationIds.join(",") === "port,customer" &&
    !initial.canDepart,
  "An inactive diary should offer arrivals but not departure.",
);

diary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "arrive", locationId: "port" },
  "2026-09-02T05:30:00.000Z",
);
const atPort = buildCustomerOperationsDiaryWorkflowState(
  diary,
  "2026-09-02T05:30:00.000Z",
);

assert(
  atPort.canDepart && atPort.attachableTrailerIds.includes("trailer"),
  "Arrival at the port should expose departure and the local trailer.",
);

assertRejects(
  () =>
    recordCustomerOperationsWorkflowAction(
      diary,
      { type: "arrive", locationId: "customer" },
      "2026-09-02T05:31:00.000Z",
    ),
  "Overlapping arrivals must be unavailable.",
);

diary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "attach-trailer", trailerId: "trailer" },
  "2026-09-02T05:35:00.000Z",
);
const attachedAtPort = buildCustomerOperationsDiaryWorkflowState(
  diary,
  "2026-09-02T05:35:00.000Z",
);

assert(
  attachedAtPort.detachableTrailerId === "trailer" &&
    attachedAtPort.collectableLoadedBoxIds.includes("box"),
  "Attaching the trailer should expose the loaded box at the port.",
);

assertRejects(
  () =>
    recordCustomerOperationsWorkflowAction(
      diary,
      { type: "attach-trailer", trailerId: "trailer" },
      "2026-09-02T05:36:00.000Z",
    ),
  "An attached trailer must not be offered again.",
);

diary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "collect-loaded-box", boxId: "box" },
  "2026-09-02T05:40:00.000Z",
);
const loadedAtPort = buildCustomerOperationsDiaryWorkflowState(
  diary,
  "2026-09-02T05:40:00.000Z",
);

assert(
  loadedAtPort.collectableLoadedBoxIds.length === 0 &&
    loadedAtPort.droppableLoadedBoxIds.length === 0,
  "A loaded box must not be droppable until the customer visit.",
);

diary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "depart" },
  "2026-09-02T05:45:00.000Z",
);
const travellingLoaded = buildCustomerOperationsDiaryWorkflowState(
  diary,
  "2026-09-02T06:00:00.000Z",
);

assert(
  travellingLoaded.arrivalLocationIds.length === 2 &&
    travellingLoaded.detachableTrailerId === null,
  "Travelling should expose arrivals but no site-only trailer action.",
);

diary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "arrive", locationId: "customer" },
  "2026-09-02T06:30:00.000Z",
);
const atCustomerLoaded = buildCustomerOperationsDiaryWorkflowState(
  diary,
  "2026-09-02T06:30:00.000Z",
);

assert(
  atCustomerLoaded.droppableLoadedBoxIds.join(",") === "box",
  "The loaded box should become droppable at the customer.",
);

diary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "drop-box-for-unloading", boxId: "box" },
  "2026-09-02T06:35:00.000Z",
);
const unloading = buildCustomerOperationsDiaryWorkflowState(
  diary,
  "2026-09-02T06:35:00.000Z",
);

assert(
  unloading.boxesAwaitingEmptyConfirmationIds.join(",") === "box",
  "A dropped box should await independent empty confirmation.",
);

diary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "depart" },
  "2026-09-02T06:40:00.000Z",
);
diary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "mark-box-empty-ready", boxId: "box" },
  "2026-09-02T07:30:00.000Z",
);
const readyWhileAbsent = buildCustomerOperationsDiaryWorkflowState(
  diary,
  "2026-09-02T07:30:00.000Z",
);

assert(
  readyWhileAbsent.snapshot.activeVisit === null &&
    readyWhileAbsent.snapshot.emptyBoxesReady === 1,
  "A customer empty-ready update must work while the driver is absent.",
);

diary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "arrive", locationId: "customer" },
  "2026-09-02T08:00:00.000Z",
);
const returnedForEmpty = buildCustomerOperationsDiaryWorkflowState(
  diary,
  "2026-09-02T08:00:00.000Z",
);

assert(
  returnedForEmpty.collectableEmptyBoxIds.join(",") === "box",
  "Returning to the customer should expose the ready empty box.",
);

diary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "collect-empty-box", boxId: "box" },
  "2026-09-02T08:05:00.000Z",
);
const emptyOnTrailer = buildCustomerOperationsDiaryWorkflowState(
  diary,
  "2026-09-02T08:05:00.000Z",
);

assert(
  emptyOnTrailer.snapshot.boxes[0]?.stage === "empty-on-trailer" &&
    emptyOnTrailer.returnableEmptyBoxIds.length === 0,
  "The empty box should travel on the trailer before port return.",
);

diary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "depart" },
  "2026-09-02T08:10:00.000Z",
);
diary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "arrive", locationId: "port" },
  "2026-09-02T08:50:00.000Z",
);
const returnAtPort = buildCustomerOperationsDiaryWorkflowState(
  diary,
  "2026-09-02T08:50:00.000Z",
);

assert(
  returnAtPort.returnableEmptyBoxIds.join(",") === "box",
  "The empty box should become returnable at the port.",
);

diary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "return-empty-box", boxId: "box" },
  "2026-09-02T08:55:00.000Z",
);
const completed = buildCustomerOperationsDiarySnapshot(
  diary,
  "2026-09-02T08:55:00.000Z",
);

assert(
  completed.completedBoxCycles === 1 &&
    completed.boxes[0]?.stage === "returned-empty",
  "Returning the empty box should complete its full cycle.",
);

const firstNoteDiary = recordCustomerOperationsWorkflowAction(
  diary,
  { type: "add-note", text: "Empty accepted at port." },
  "2026-09-02T08:55:00.000Z",
);
const secondNoteDiary = recordCustomerOperationsWorkflowAction(
  firstNoteDiary,
  { type: "add-note", text: "Awaiting next instruction." },
  "2026-09-02T08:55:00.000Z",
);
const firstNote = secondNoteDiary.events[secondNoteDiary.events.length - 2];
const secondNote = secondNoteDiary.events[secondNoteDiary.events.length - 1];

assert(
  firstNote?.id !== secondNote?.id,
  "Two actions in one millisecond must receive unique evidence ids.",
);

assert(
  firstNote?.type === "diary-note" &&
    firstNote.locationId === "port" &&
    secondNote?.type === "diary-note" &&
    secondNote.locationId === "port",
  "Notes recorded during a visit should inherit its location.",
);

assertRejects(
  () =>
    recordCustomerOperationsWorkflowAction(
      secondNoteDiary,
      { type: "collect-loaded-box", boxId: "box" },
      "2026-09-02T09:00:00.000Z",
    ),
  "Completed boxes must not expose loaded collection again.",
);

assertRejects(
  () =>
    buildCustomerOperationsDiaryWorkflowState(secondNoteDiary, "not-a-time"),
  "Invalid workflow times must be rejected.",
);

assert(
  secondNoteDiary.events.every(
    (event, index, events) =>
      index === 0 ||
      new Date(event.occurredAt).getTime() >=
        new Date(events[index - 1]?.occurredAt ?? "").getTime(),
  ),
  "Workflow evidence must remain chronological.",
);

console.log("✓ Customer operations diary workflow scenarios passed (19/19)");
