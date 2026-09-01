import type { DriverDay } from "../types";
import { buildYearComplianceJourney } from "../yearComplianceJourney";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Year Journey scenario failed: ${message}`);
  }
}

function buildActivities(
  id: string,
  date: string,
  drivingMinutes: number,
  otherWorkMinutes: number,
  breakMinutes: number,
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

  return activities;
}

function makeDay(
  id: string,
  date: string,
  drivingMinutes: number,
  restMinutes: number = 11 * 60,
  dailyRestType: DriverDay["dailyRestType"] =
    restMinutes >= 11 * 60 ? "regular" : "unknown",
): DriverDay {
  const otherWorkMinutes = 60;
  const breakMinutes = drivingMinutes > 9 * 60 ? 90 : 45;

  return {
    id,
    date,
    activities: buildActivities(
      id,
      date,
      drivingMinutes,
      otherWorkMinutes,
      breakMinutes,
    ),
    drivingMinutes,
    otherWorkMinutes,
    breakMinutes,
    poaMinutes: 30,
    restMinutes,
    dailyRestType,
  };
}

const days: DriverDay[] = [
  makeDay("year-january-good", "2026-01-12", 480),
  makeDay("year-february-warning", "2026-02-09", 600, 540, "reduced"),
  makeDay("year-march-breach", "2026-03-09", 60, 0, "unknown"),
  makeDay("year-august-extension-one", "2026-08-03", 600),
  makeDay("year-august-extension-two", "2026-08-04", 600),
  makeDay("year-august-standard-one", "2026-08-05", 540),
  makeDay("year-august-standard-two", "2026-08-06", 540),
  makeDay("year-august-standard-three", "2026-08-07", 540),
  makeDay("year-august-standard-four", "2026-08-08", 540),
  makeDay("year-august-live", "2026-08-29", 60, 0, "unknown"),
  makeDay("year-december-good", "2026-12-31", 480),
];

const result = buildYearComplianceJourney({
  id: "year-journey-2026",
  year: 2026,
  days,
  liveDate: "2026-08-29",
  now: "2026-08-29T18:00:00.000Z",
});

assert(result.months.length === 12, "A year must expose twelve month routes.");

assert(
  result.yearStartDate === "2026-01-01" &&
    result.yearEndDate === "2026-12-31",
  "Year boundaries must be exact.",
);

assert(result.totals.recordedDays === 11, "All eleven driver days must count.");

assert(
  result.totals.goodDays === 7 &&
    result.totals.warningDays === 3 &&
    result.totals.breachDays === 1,
  "Year day levels must remain distinct.",
);

assert(
  result.totals.compliancePercentage === 64,
  "Only fully good days must count toward yearly compliance.",
);

assert(
  result.totals.drivingMinutes === 84 * 60 &&
    result.totals.workingMinutes === 95 * 60,
  "Year driving and working totals must be exact.",
);

assert(
  result.totals.regularRestCount === 8 &&
    result.totals.reducedRestCount === 1 &&
    result.totals.unknownRestCount === 2,
  "Year rest classifications must remain auditable.",
);

assert(
  result.totals.recordedMonths === 5 && result.totals.emptyMonths === 7,
  "Recorded and empty months must be counted separately.",
);

assert(
  result.totals.goodMonths === 2 &&
    result.totals.warningMonths === 2 &&
    result.totals.breachMonths === 1,
  "Good, warning and breach months must remain distinct.",
);

assert(
  result.totals.recordedWeeks === 6,
  "Recorded ISO weeks must be de-duplicated across month boundaries.",
);

const february = result.months[1];
const march = result.months[2];
const august = result.months[7];

assert(february?.level === "warning", "February must expose its warning.");
assert(march?.level === "breach", "March must expose its rest breach.");
assert(august?.level === "warning", "August must expose legal-limit warnings.");

const exactLimitWeek = august?.result.weeks.find(
  (week) => week.weekStartDate === "2026-08-03",
);

assert(
  exactLimitWeek?.states.weeklyDriving.drivingMinutesUsed === 56 * 60 &&
    exactLimitWeek.states.weeklyDriving.status === "limit",
  "The Year Journey must preserve an exact 56-hour week.",
);

assert(
  exactLimitWeek?.states.extendedDriving.extensionsUsed === 2 &&
    exactLimitWeek.states.extendedDriving.status === "exhausted",
  "The Year Journey must preserve the weekly extension allowance.",
);

assert(august?.live === true, "The containing month must expose the live route.");

const liveDay = august?.result.weeks
  .flatMap((week) => week.days)
  .find((day) => day.date === "2026-08-29");

assert(
  liveDay?.live === true && liveDay.level !== "breach",
  "The live year day must not manufacture a daily-rest breach.",
);

let invalidYearRejected = false;

try {
  buildYearComplianceJourney({
    id: "invalid-year",
    year: 1969,
    days: [],
    now: "2026-08-29T18:00:00.000Z",
  });
} catch {
  invalidYearRejected = true;
}

assert(invalidYearRejected, "Invalid years must be rejected.");

let duplicateRejected = false;

try {
  buildYearComplianceJourney({
    id: "duplicate-year-day",
    year: 2026,
    days: [...days, makeDay("duplicate", "2026-01-12", 0)],
    now: "2026-08-29T18:00:00.000Z",
  });
} catch {
  duplicateRejected = true;
}

assert(duplicateRejected, "Duplicate DriverDay dates must be rejected.");

let outsideLiveDateRejected = false;

try {
  buildYearComplianceJourney({
    id: "outside-live-year",
    year: 2026,
    days,
    liveDate: "2027-01-01",
    now: "2026-08-29T18:00:00.000Z",
  });
} catch {
  outsideLiveDateRejected = true;
}

assert(
  outsideLiveDateRejected,
  "A live date outside the selected year must be rejected.",
);

console.log("✓ Year compliance journey scenarios passed (20/20)");
