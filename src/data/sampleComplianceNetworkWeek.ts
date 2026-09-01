import type { WeeklyDriverHistory } from "./weeklyDriverHistory";
import type { DriverDay } from "../engine/types";

function buildSampleActivities(
  id: string,
  date: string,
  drivingMinutes: number,
  otherWorkMinutes: number,
  breakMinutes: number,
  poaMinutes: number,
): DriverDay["activities"] {
  const activities: DriverDay["activities"] = [];
  let cursorMilliseconds = new Date(`${date}T06:00:00.000Z`).getTime();
  let sequence = 0;

  function addActivity(
    type: DriverDay["activities"][number]["type"],
    durationMinutes: number,
  ): void {
    if (durationMinutes <= 0) {
      return;
    }

    const startMilliseconds = cursorMilliseconds;
    const endMilliseconds =
      startMilliseconds + durationMinutes * 60 * 1000;

    activities.push({
      id: `${id}-activity-${sequence}`,
      type,
      start: new Date(startMilliseconds).toISOString(),
      end: new Date(endMilliseconds).toISOString(),
      durationMinutes,
    });

    cursorMilliseconds = endMilliseconds;
    sequence += 1;
  }

  let drivingRemaining = drivingMinutes;
  let otherWorkRemaining = otherWorkMinutes;
  let breakRemaining = breakMinutes;
  let workingSinceBreak = 0;

  while (drivingRemaining > 0 || otherWorkRemaining > 0) {
    const capacityBeforeBreak =
      breakRemaining > 0
        ? 270 - workingSinceBreak
        : Number.POSITIVE_INFINITY;
    const nextType = drivingRemaining > 0 ? "driving" : "otherWork";
    const nextRemaining =
      nextType === "driving" ? drivingRemaining : otherWorkRemaining;
    const duration = Math.min(nextRemaining, capacityBeforeBreak);

    addActivity(nextType, duration);

    if (nextType === "driving") {
      drivingRemaining -= duration;
    } else {
      otherWorkRemaining -= duration;
    }

    workingSinceBreak += duration;

    const moreWorkRemains = drivingRemaining > 0 || otherWorkRemaining > 0;

    if (workingSinceBreak === 270 && moreWorkRemains && breakRemaining > 0) {
      const qualifyingBreakMinutes = Math.min(45, breakRemaining);

      addActivity("break", qualifyingBreakMinutes);
      breakRemaining -= qualifyingBreakMinutes;
      workingSinceBreak = 0;
    }
  }

  addActivity("break", breakRemaining);
  addActivity("poa", poaMinutes);

  return activities;
}

function makeSampleDay(
  id: string,
  date: string,
  drivingMinutes: number,
  otherWorkMinutes: number,
  breakMinutes: number,
  poaMinutes: number,
  restMinutes: number,
  dailyRestType: DriverDay["dailyRestType"],
): DriverDay {
  return {
    id,
    date,
    activities: buildSampleActivities(
      id,
      date,
      drivingMinutes,
      otherWorkMinutes,
      breakMinutes,
      poaMinutes,
    ),
    drivingMinutes,
    otherWorkMinutes,
    breakMinutes,
    poaMinutes,
    restMinutes,
    dailyRestType,
    notes: ["Sample week used by the Compliance Network demo."],
  };
}

export const sampleComplianceNetworkCurrentWeek: WeeklyDriverHistory = {
  weekStartDate: "2026-08-24",
  weekEndDate: "2026-08-30",
  days: [
    makeSampleDay(
      "week-network-demo-monday",
      "2026-08-24",
      540,
      60,
      45,
      0,
      660,
      "regular",
    ),
    makeSampleDay(
      "week-network-demo-tuesday",
      "2026-08-25",
      480,
      120,
      45,
      30,
      660,
      "regular",
    ),
    makeSampleDay(
      "week-network-demo-wednesday",
      "2026-08-26",
      600,
      60,
      90,
      0,
      540,
      "reduced",
    ),
    makeSampleDay(
      "week-network-demo-thursday",
      "2026-08-27",
      270,
      180,
      45,
      60,
      660,
      "regular",
    ),
    makeSampleDay(
      "week-network-demo-friday",
      "2026-08-28",
      600,
      60,
      90,
      0,
      540,
      "reduced",
    ),
    makeSampleDay(
      "week-network-demo-saturday-live",
      "2026-08-29",
      360,
      120,
      45,
      30,
      0,
      "unknown",
    ),
  ],
};

export const sampleComplianceNetworkPreviousWeekDays: DriverDay[] = [
  makeSampleDay(
    "week-network-demo-previous-monday",
    "2026-08-17",
    480,
    60,
    45,
    0,
    660,
    "regular",
  ),
  makeSampleDay(
    "week-network-demo-previous-tuesday",
    "2026-08-18",
    480,
    60,
    45,
    0,
    660,
    "regular",
  ),
  makeSampleDay(
    "week-network-demo-previous-wednesday",
    "2026-08-19",
    480,
    60,
    45,
    0,
    660,
    "regular",
  ),
  makeSampleDay(
    "week-network-demo-previous-thursday",
    "2026-08-20",
    480,
    60,
    45,
    0,
    660,
    "regular",
  ),
  makeSampleDay(
    "week-network-demo-previous-friday",
    "2026-08-21",
    480,
    60,
    45,
    0,
    660,
    "regular",
  ),
];

export const SAMPLE_COMPLIANCE_NETWORK_WEEK_NOW =
  "2026-08-29T22:15:00.000Z";
