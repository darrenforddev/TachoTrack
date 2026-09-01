import type { DriverDay } from "../types";
import { buildMonthComplianceJourney } from "../monthComplianceJourney";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Month Journey scenario failed: ${message}`);
  }
}

function makeBreakActivities(
  id: string,
  date: string,
  breakMinutes: number,
): DriverDay["activities"] {
  const firstBreakMinutes = Math.min(45, breakMinutes);
  const secondBreakMinutes = Math.max(0, breakMinutes - firstBreakMinutes);
  const activities: DriverDay["activities"] = [
    {
      id: `${id}-break-one`,
      type: "break",
      start: `${date}T10:30:00.000Z`,
      end: new Date(
        new Date(`${date}T10:30:00.000Z`).getTime() +
          firstBreakMinutes * 60 * 1000,
      ).toISOString(),
      durationMinutes: firstBreakMinutes,
    },
  ];

  if (secondBreakMinutes > 0) {
    activities.push({
      id: `${id}-break-two`,
      type: "break",
      start: `${date}T16:00:00.000Z`,
      end: new Date(
        new Date(`${date}T16:00:00.000Z`).getTime() +
          secondBreakMinutes * 60 * 1000,
      ).toISOString(),
      durationMinutes: secondBreakMinutes,
    });
  }

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
  const breakMinutes = drivingMinutes > 9 * 60 ? 90 : 45;

  return {
    id,
    date,
    activities: makeBreakActivities(id, date, breakMinutes),
    drivingMinutes,
    otherWorkMinutes: 60,
    breakMinutes,
    poaMinutes: 30,
    restMinutes,
    dailyRestType,
  };
}

const days: DriverDay[] = [
  makeDay("august-one", "2026-08-01", 480),
  makeDay("august-three", "2026-08-03", 600),
  makeDay("august-four", "2026-08-04", 600),
  makeDay("august-five", "2026-08-05", 540),
  makeDay("august-six-reduced", "2026-08-06", 540, 540, "reduced"),
  makeDay("august-seven", "2026-08-07", 540),
  makeDay("august-eight", "2026-08-08", 540),
  makeDay("august-ten-rest-breach", "2026-08-10", 60, 0, "unknown"),
  makeDay("august-live", "2026-08-29", 60, 0, "unknown"),
];

const result = buildMonthComplianceJourney({
  id: "august-month-journey",
  year: 2026,
  month: 7,
  days,
  liveDate: "2026-08-29",
  now: "2026-08-29T18:00:00.000Z",
});

assert(result.weeks.length === 6, "August 2026 must span six ISO-week rows.");

assert(
  result.monthStartDate === "2026-08-01" &&
    result.monthEndDate === "2026-08-31" &&
    result.calendarStartDate === "2026-07-27" &&
    result.calendarEndDate === "2026-09-06",
  "Month and calendar boundaries must be exact.",
);

assert(
  result.weeks.every((week) => week.days.length === 7),
  "Every Month Journey row must preserve seven day stations.",
);

assert(
  result.weeks[0].days[0].date === "2026-07-27" &&
    result.weeks[0].days[6].date === "2026-08-02",
  "The first partial week must retain its complete Monday-Sunday route.",
);

assert(result.totals.recordedDays === 9, "All nine August records must count.");

assert(
  result.totals.goodDays === 5 &&
    result.totals.warningDays === 3 &&
    result.totals.breachDays === 1,
  "Good, warning and breach days must remain distinct.",
);

assert(
  result.totals.compliancePercentage === 56,
  "Only fully good days must count toward the compliance percentage.",
);

assert(
  result.totals.drivingMinutes === 66 * 60 &&
    result.totals.workingMinutes === 75 * 60,
  "Month driving and working totals must be exact.",
);

assert(
  result.totals.regularRestCount === 6 &&
    result.totals.reducedRestCount === 1 &&
    result.totals.unknownRestCount === 2,
  "Month rest classifications must remain auditable.",
);

const exactLimitWeek = result.weeks.find(
  (week) => week.weekStartDate === "2026-08-03",
);

assert(
  exactLimitWeek?.states.weeklyDriving.drivingMinutesUsed === 56 * 60 &&
    exactLimitWeek.states.weeklyDriving.status === "limit",
  "A Month Journey week must preserve the exact 56-hour limit.",
);

assert(
  exactLimitWeek?.states.extendedDriving.extensionsUsed === 2 &&
    exactLimitWeek.states.extendedDriving.status === "exhausted",
  "A Month Journey week must preserve the two-extension allowance.",
);

assert(
  exactLimitWeek?.level === "warning",
  "A week containing legal extensions and reduced rest must warn.",
);

const historicalBreach = result.weeks
  .flatMap((week) => week.days)
  .find((day) => day.date === "2026-08-10");

assert(
  historicalBreach?.level === "breach" &&
    historicalBreach.lineSeverities["daily-rest"] === "breach",
  "Historical unfinished rest must remain a daily-rest breach.",
);

const liveDay = result.weeks
  .flatMap((week) => week.days)
  .find((day) => day.date === "2026-08-29");

assert(
  liveDay?.live === true && liveDay.level !== "breach",
  "The live month day must not manufacture a daily-rest breach.",
);

assert(
  result.weeks.some((week) => week.live),
  "The containing week must expose the live route.",
);

let duplicateRejected = false;

try {
  buildMonthComplianceJourney({
    id: "duplicate-month-day",
    year: 2026,
    month: 7,
    days: [...days, makeDay("duplicate", "2026-08-01", 0)],
    now: "2026-08-29T18:00:00.000Z",
  });
} catch {
  duplicateRejected = true;
}

assert(duplicateRejected, "Duplicate DriverDay dates must be rejected.");

let invalidMonthRejected = false;

try {
  buildMonthComplianceJourney({
    id: "invalid-month",
    year: 2026,
    month: 12,
    days: [],
    now: "2026-08-29T18:00:00.000Z",
  });
} catch {
  invalidMonthRejected = true;
}

assert(invalidMonthRejected, "Invalid month indexes must be rejected.");

let outsideLiveDateRejected = false;

try {
  buildMonthComplianceJourney({
    id: "outside-live-date",
    year: 2026,
    month: 7,
    days,
    liveDate: "2026-09-01",
    now: "2026-08-29T18:00:00.000Z",
  });
} catch {
  outsideLiveDateRejected = true;
}

assert(
  outsideLiveDateRejected,
  "A live date outside the selected month must be rejected.",
);

console.log("✓ Month compliance journey scenarios passed (18/18)");

