import type { WeeklyDriverHistory } from "../../data/weeklyDriverHistory";
import { evaluateDriverDay } from "../complianceEngine";
import { buildFortnightComplianceJourney } from "../fortnightComplianceJourney";
import { buildMonthComplianceJourney } from "../monthComplianceJourney";
import type { DriverDay } from "../types";
import { buildWeekComplianceNetworkMap } from "../weekComplianceNetworkMap";
import { buildYearComplianceJourney } from "../yearComplianceJourney";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Cross-scale Journey scenario failed: ${message}`);
  }
}

function buildActivities(
  id: string,
  date: string,
  drivingMinutes: number,
  otherWorkMinutes: number,
  breakMinutes: number,
  poaMinutes: number,
): DriverDay["activities"] {
  const activities: DriverDay["activities"] = [];
  let cursor = new Date(`${date}T06:00:00.000Z`).getTime();
  let drivingRemaining = drivingMinutes;
  let otherWorkRemaining = otherWorkMinutes;
  let breakRemaining = breakMinutes;
  let workingSinceBreak = 0;
  let sequence = 0;

  function add(
    type: DriverDay["activities"][number]["type"],
    durationMinutes: number,
  ): void {
    if (durationMinutes <= 0) {
      return;
    }

    const end = cursor + durationMinutes * 60 * 1000;

    activities.push({
      id: `${id}-activity-${sequence}`,
      type,
      start: new Date(cursor).toISOString(),
      end: new Date(end).toISOString(),
      durationMinutes,
    });

    cursor = end;
    sequence += 1;
  }

  while (drivingRemaining > 0 || otherWorkRemaining > 0) {
    const capacity = breakRemaining > 0 ? 270 - workingSinceBreak : Infinity;
    const type = drivingRemaining > 0 ? "driving" : "otherWork";
    const remaining = type === "driving" ? drivingRemaining : otherWorkRemaining;
    const duration = Math.min(remaining, capacity);

    add(type, duration);

    if (type === "driving") {
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
      const durationMinutes = Math.min(45, breakRemaining);

      add("break", durationMinutes);
      breakRemaining -= durationMinutes;
      workingSinceBreak = 0;
    }
  }

  add("break", breakRemaining);
  add("poa", poaMinutes);

  return activities;
}

function makeDay(
  id: string,
  date: string,
  drivingMinutes: number,
  options: {
    live?: boolean;
    restMinutes?: number;
    dailyRestType?: DriverDay["dailyRestType"];
  } = {},
): DriverDay {
  const otherWorkMinutes = 60;
  const breakMinutes = drivingMinutes > 9 * 60 ? 90 : 45;
  const poaMinutes = 30;
  const restMinutes = options.live ? 0 : (options.restMinutes ?? 11 * 60);
  const dailyRestType =
    options.live === true
      ? "unknown"
      : (options.dailyRestType ??
        (restMinutes >= 11 * 60 ? "regular" : "reduced"));

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
  };
}

function makeWeek(
  id: string,
  weekStartDate: string,
  drivingMinutes: number[],
  liveFinalDay: boolean = false,
): WeeklyDriverHistory {
  const start = new Date(`${weekStartDate}T00:00:00.000Z`).getTime();

  return {
    weekStartDate,
    weekEndDate: new Date(start + 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    days: drivingMinutes.map((minutes, index) => {
      const date = new Date(start + index * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      return makeDay(`${id}-${date}`, date, minutes, {
        live: liveFinalDay && index === drivingMinutes.length - 1,
      });
    }),
  };
}

const LIVE_DATE = "2026-08-29";
const NOW = "2026-08-29T12:00:00.000Z";
const previousWeek = makeWeek(
  "cross-scale-previous",
  "2026-08-17",
  [480, 480, 480, 480, 480],
);
const currentWeek = makeWeek(
  "cross-scale-current",
  "2026-08-24",
  [600, 600, 540, 540, 540, 30],
  true,
);
const allDays = [...previousWeek.days, ...currentWeek.days];
const snapshotBefore = JSON.stringify(allDays);
const liveDriverDay = currentWeek.days.find((day) => day.date === LIVE_DATE);

if (liveDriverDay === undefined) {
  throw new Error("Cross-scale Journey fixture is missing its live day.");
}

const daily = evaluateDriverDay(liveDriverDay, { isLiveDay: true });
const week = buildWeekComplianceNetworkMap({
  id: "cross-scale-week",
  currentWeek,
  previousWeekDays: previousWeek.days,
  liveDate: LIVE_DATE,
  now: NOW,
});
const fortnight = buildFortnightComplianceJourney({
  id: "cross-scale-fortnight",
  previousWeek,
  currentWeek,
  liveDate: LIVE_DATE,
  now: NOW,
});
const month = buildMonthComplianceJourney({
  id: "cross-scale-month",
  year: 2026,
  month: 7,
  days: allDays,
  liveDate: LIVE_DATE,
  now: NOW,
});
const year = buildYearComplianceJourney({
  id: "cross-scale-year",
  year: 2026,
  days: allDays,
  liveDate: LIVE_DATE,
  now: NOW,
});
const monthCurrentWeek = month.weeks.find(
  (item) => item.weekStartDate === currentWeek.weekStartDate,
);
const monthLiveDay = month.weeks
  .flatMap((item) => item.days)
  .find((day) => day.date === LIVE_DATE);
const august = year.months[7];
const yearLiveDay = august.result.weeks
  .flatMap((item) => item.days)
  .find((day) => day.date === LIVE_DATE);
const expectedDrivingMinutes = 87 * 60 + 30;
const expectedWorkingMinutes = expectedDrivingMinutes + 11 * 60;
const expectedBreakMinutes =
  allDays.reduce((total, day) => total + day.breakMinutes, 0);
const expectedPoaMinutes = 11 * 30;
const expectedRestMinutes = 10 * 11 * 60;

assert(
  daily.date === LIVE_DATE && daily.drivingMinutes === 30,
  "Daily evidence must preserve the selected date and driving total.",
);
assert(
  daily.level !== "breach",
  "The active day must not manufacture a daily-rest breach.",
);
assert(
  week.days.length === 7 && week.days.filter((day) => day.recorded).length === 6,
  "Week Journey must preserve seven stations and six records.",
);
assert(
  week.states.weeklyDriving.drivingMinutesUsed === 47 * 60 + 30,
  "Week Journey must preserve current-week driving.",
);
assert(
  week.states.fortnightlyDriving.drivingMinutesUsed === expectedDrivingMinutes,
  "Week Journey must carry the exact previous-week contribution.",
);
assert(
  fortnight.previousWeek.drivingMinutes === 40 * 60,
  "Fortnight Journey must preserve week-one driving.",
);
assert(
  fortnight.currentWeek.drivingMinutes === 47 * 60 + 30,
  "Fortnight Journey must preserve week-two driving.",
);
assert(
  fortnight.drivingMinutes === expectedDrivingMinutes &&
    fortnight.state.remainingMinutes === 2 * 60 + 30,
  "Fortnight Journey must preserve used and remaining 90-hour time.",
);
assert(
  month.totals.recordedDays === 11 &&
    month.totals.drivingMinutes === expectedDrivingMinutes,
  "Month Journey must count every record and driving minute once.",
);
assert(
  year.totals.recordedDays === 11 &&
    year.totals.drivingMinutes === expectedDrivingMinutes,
  "Year Journey must retain the same record and driving totals.",
);
assert(
  fortnight.workingMinutes === expectedWorkingMinutes &&
    month.totals.workingMinutes === expectedWorkingMinutes &&
    year.totals.workingMinutes === expectedWorkingMinutes,
  "Working time must remain identical across larger scales.",
);
assert(
  fortnight.breakMinutes === expectedBreakMinutes &&
    month.totals.breakMinutes === expectedBreakMinutes &&
    year.totals.breakMinutes === expectedBreakMinutes,
  "Break evidence must remain identical across larger scales.",
);
assert(
  fortnight.poaMinutes === expectedPoaMinutes &&
    month.totals.poaMinutes === expectedPoaMinutes &&
    year.totals.poaMinutes === expectedPoaMinutes,
  "POA evidence must remain identical across larger scales.",
);
assert(
  fortnight.restMinutes === expectedRestMinutes &&
    month.totals.restMinutes === expectedRestMinutes &&
    year.totals.restMinutes === expectedRestMinutes,
  "Rest evidence must remain identical across larger scales.",
);
assert(
  week.days.find((day) => day.date === LIVE_DATE)?.live === true &&
    fortnight.days.find((day) => day.date === LIVE_DATE)?.live === true &&
    monthLiveDay?.live === true &&
    yearLiveDay?.live === true,
  "The same live position must propagate through every Journey scale.",
);
assert(
  monthLiveDay?.level !== "breach" && yearLiveDay?.level !== "breach",
  "Larger scales must not turn an active rest into a breach.",
);
assert(
  monthCurrentWeek?.drivingMinutes === week.states.weeklyDriving.drivingMinutesUsed,
  "Month-to-week drill-down must preserve the selected week total.",
);
assert(
  august.result.totals.drivingMinutes === month.totals.drivingMinutes,
  "Year-to-month drill-down must preserve the selected month total.",
);
assert(
  fortnight.level === "warning" &&
    month.totals.level === "warning" &&
    august.level === "warning",
  "A legal warning must remain visible at fortnight, month and year scale.",
);
assert(
  JSON.stringify(allDays) === snapshotBefore,
  "Building every Journey scale must not mutate source driver evidence.",
);

console.log("✓ Cross-scale compliance Journey scenarios passed (20/20)");
