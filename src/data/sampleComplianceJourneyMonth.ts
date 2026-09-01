import type { DriverDay } from "../engine/types";

const MINUTES_PER_HOUR = 60;

function buildActivities(
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

    const endMilliseconds =
      cursorMilliseconds + durationMinutes * 60 * 1000;

    activities.push({
      id: `${id}-activity-${sequence}`,
      type,
      start: new Date(cursorMilliseconds).toISOString(),
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

    if (
      workingSinceBreak === 270 &&
      (drivingRemaining > 0 || otherWorkRemaining > 0) &&
      breakRemaining > 0
    ) {
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

function makeDay(
  id: string,
  date: string,
  drivingMinutes: number,
  options: {
    otherWorkMinutes?: number;
    poaMinutes?: number;
    restMinutes?: number;
    dailyRestType?: DriverDay["dailyRestType"];
  } = {},
): DriverDay {
  const otherWorkMinutes = options.otherWorkMinutes ?? 60;
  const poaMinutes = options.poaMinutes ?? 30;
  const breakMinutes = drivingMinutes > 9 * MINUTES_PER_HOUR ? 90 : 45;
  const restMinutes = options.restMinutes ?? 11 * MINUTES_PER_HOUR;
  const dailyRestType =
    options.dailyRestType ??
    (restMinutes >= 11 * MINUTES_PER_HOUR ? "regular" : "unknown");

  return {
    id,
    date,
    activities: buildActivities(
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
    notes: ["Sample month used by the Month Journey demo."],
  };
}

export const SAMPLE_COMPLIANCE_JOURNEY_MONTH_YEAR = 2026;
export const SAMPLE_COMPLIANCE_JOURNEY_MONTH_INDEX = 7;
export const SAMPLE_COMPLIANCE_JOURNEY_MONTH_NOW =
  "2026-08-29T18:00:00.000Z";
export const SAMPLE_COMPLIANCE_JOURNEY_MONTH_LIVE_DATE = "2026-08-29";

export const sampleComplianceJourneyMonthDays: DriverDay[] = [
  // Previous-week context for the opening fortnight position.
  makeDay("month-demo-july-27", "2026-07-27", 480),
  makeDay("month-demo-july-28", "2026-07-28", 480),
  makeDay("month-demo-july-29", "2026-07-29", 480),
  makeDay("month-demo-july-30", "2026-07-30", 480),
  makeDay("month-demo-july-31", "2026-07-31", 480),

  // W31 — partial August week.
  makeDay("month-demo-august-01", "2026-08-01", 480),

  // W32 — two legal 10-hour extensions and two reduced rests.
  makeDay("month-demo-august-03", "2026-08-03", 540),
  makeDay("month-demo-august-04", "2026-08-04", 480),
  makeDay("month-demo-august-05", "2026-08-05", 600, {
    restMinutes: 540,
    dailyRestType: "reduced",
  }),
  makeDay("month-demo-august-06", "2026-08-06", 270, {
    otherWorkMinutes: 180,
    poaMinutes: 60,
  }),
  makeDay("month-demo-august-07", "2026-08-07", 600, {
    restMinutes: 540,
    dailyRestType: "reduced",
  }),

  // W33 — one deliberately short historical rest for visible evidence.
  makeDay("month-demo-august-10", "2026-08-10", 540),
  makeDay("month-demo-august-11", "2026-08-11", 480),
  makeDay("month-demo-august-12", "2026-08-12", 540),
  makeDay("month-demo-august-13", "2026-08-13", 480),
  makeDay("month-demo-august-14", "2026-08-14", 540, {
    restMinutes: 480,
    dailyRestType: "unknown",
  }),

  // W34 — a compliant working week.
  makeDay("month-demo-august-17", "2026-08-17", 480),
  makeDay("month-demo-august-18", "2026-08-18", 540),
  makeDay("month-demo-august-19", "2026-08-19", 480),
  makeDay("month-demo-august-20", "2026-08-20", 540),
  makeDay("month-demo-august-21", "2026-08-21", 480),

  // W35 — the approved demo week and a live overnight-rest hand-off.
  makeDay("month-demo-august-24", "2026-08-24", 540),
  makeDay("month-demo-august-25", "2026-08-25", 480, {
    otherWorkMinutes: 120,
  }),
  makeDay("month-demo-august-26", "2026-08-26", 600, {
    restMinutes: 540,
    dailyRestType: "reduced",
  }),
  makeDay("month-demo-august-27", "2026-08-27", 270, {
    otherWorkMinutes: 180,
    poaMinutes: 60,
  }),
  makeDay("month-demo-august-28", "2026-08-28", 600, {
    restMinutes: 540,
    dailyRestType: "reduced",
  }),
  makeDay("month-demo-august-29-live", "2026-08-29", 360, {
    otherWorkMinutes: 120,
    restMinutes: 0,
    dailyRestType: "unknown",
  }),

  // W36 — final partial August week.
  makeDay("month-demo-august-31", "2026-08-31", 150),
];
