import {
  SAMPLE_CUSTOMER_OPERATIONS_NOW,
  sampleCustomerOperationsDiary,
} from "../../data/sampleCustomerOperationsDiary";
import { buildCustomerOperationsDiaryPresentation } from "../customerOperationsDiaryPresentation";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(
      `Customer operations presentation scenario failed: ${message}`,
    );
  }
}

const presentation = buildCustomerOperationsDiaryPresentation(
  sampleCustomerOperationsDiary,
  SAMPLE_CUSTOMER_OPERATIONS_NOW,
);

assert(
  presentation.currentLocationName === "Felixstowe Port" &&
    presentation.currentVisitMinutes === 20,
  "The live location card must show the active fourth port visit.",
);

assert(
  presentation.totalVisits === 7 &&
    presentation.customerVisits === 3 &&
    presentation.portVisits === 4,
  "Repeated customer and port visits must remain separate.",
);

assert(
  presentation.totalDriverSiteMinutes === 105 &&
    presentation.totalCustomerMinutes === 45 &&
    presentation.totalPortMinutes === 60,
  "The presentation must preserve driver time by site type.",
);

assert(
  presentation.currentTrailerNumber === "TRL-2048",
  "The attached trailer must remain visible.",
);

assert(
  presentation.completedBoxCycles === 2 &&
    presentation.activeUnloadingBoxes === 0 &&
    presentation.emptyBoxesReady === 0,
  "Both completed box cycles must be reflected in summary cards.",
);

const boxOne = presentation.boxes.find(
  (box) => box.number === "MSCU1234567",
);
const boxTwo = presentation.boxes.find(
  (box) => box.number === "TGHU7654321",
);

assert(
  boxOne?.stage === "returned-empty" && boxOne.completedSteps === 5,
  "Box one must complete all five visual journey steps.",
);

assert(
  boxTwo?.stage === "returned-empty" && boxTwo.completedSteps === 5,
  "Box two must complete all five visual journey steps independently.",
);

assert(
  boxOne?.unloadingElapsedMinutes === 105 &&
    boxOne.driverPresentDuringUnloadingMinutes === 15,
  "Box one must distinguish unloading time from driver-present time.",
);

assert(
  boxTwo?.unloadingElapsedMinutes === 70 &&
    boxTwo.driverPresentDuringUnloadingMinutes === 15,
  "Box two must preserve its separate unloading timings.",
);

assert(
  boxOne?.fullCycleMinutes === 215 && boxTwo?.fullCycleMinutes === 205,
  "Each box must show its own loaded-to-empty-return turnaround.",
);

assert(
  presentation.timeline.some(
    (item) =>
      item.title === "Box empty and ready · TGHU7654321" &&
      item.detail?.includes("while driver was returning box one") === true,
  ),
  "Customer updates made while the driver is absent must remain auditable.",
);

assert(
  presentation.visits[presentation.visits.length - 1]?.active === true &&
    presentation.visits[presentation.visits.length - 1]?.sequence === 7,
  "The route must finish with an explicit active visit, not a merged stop.",
);

let invalidNowRejected = false;

try {
  buildCustomerOperationsDiaryPresentation(
    sampleCustomerOperationsDiary,
    "not-a-time",
  );
} catch {
  invalidNowRejected = true;
}

assert(invalidNowRejected, "Invalid presentation times must be rejected.");

console.log(
  "✓ Customer operations diary presentation scenarios passed (13/13)",
);
