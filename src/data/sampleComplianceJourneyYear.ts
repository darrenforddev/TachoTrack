import type { DriverDay } from "../engine/types";
import {
  SAMPLE_COMPLIANCE_JOURNEY_MONTH_LIVE_DATE,
  SAMPLE_COMPLIANCE_JOURNEY_MONTH_NOW,
  sampleComplianceJourneyMonthDays,
} from "./sampleComplianceJourneyMonth";

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
  drivingMinutes: number = 8 * MINUTES_PER_HOUR,
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
    notes: ["Sample year used by the Year Journey demo."],
  };
}

function buildFourWeekMonth(year: number, month: number): DriverDay[] {
  const days: DriverDay[] = [];
  const monthEnd = Date.UTC(year, month + 1, 1);

  for (
    let cursor = Date.UTC(year, month, 1);
    cursor < monthEnd && days.length < 20;
    cursor += 24 * 60 * 60 * 1000
  ) {
    const date = new Date(cursor);
    const weekday = date.getUTCDay();

    if (weekday === 0 || weekday === 6) {
      continue;
    }

    const dateString = date.toISOString().slice(0, 10);

    days.push(makeDay(`year-demo-${dateString}`, dateString));
  }

  return days;
}

function replaceDay(
  days: DriverDay[],
  replacement: DriverDay,
): DriverDay[] {
  return days.map((day) =>
    day.date === replacement.date ? replacement : day,
  );
}

let generatedDays = Array.from({ length: 12 }, (_, month) =>
  month === 7 ? [] : buildFourWeekMonth(2026, month),
).flat();

generatedDays = replaceDay(
  generatedDays,
  makeDay("year-demo-february-reduced", "2026-02-10", 600, {
    restMinutes: 540,
    dailyRestType: "reduced",
  }),
);
generatedDays = replaceDay(
  generatedDays,
  makeDay("year-demo-april-rest-breach", "2026-04-15", 480, {
    restMinutes: 480,
    dailyRestType: "unknown",
  }),
);
generatedDays = replaceDay(
  generatedDays,
  makeDay("year-demo-june-extension-one", "2026-06-08", 600),
);
generatedDays = replaceDay(
  generatedDays,
  makeDay("year-demo-june-extension-two", "2026-06-09", 600),
);
generatedDays = replaceDay(
  generatedDays,
  makeDay("year-demo-october-reduced", "2026-10-12", 600, {
    restMinutes: 540,
    dailyRestType: "reduced",
  }),
);
generatedDays = replaceDay(
  generatedDays,
  makeDay("year-demo-december-rest-breach", "2026-12-18", 480, {
    restMinutes: 480,
    dailyRestType: "unknown",
  }),
);

const augustDays = sampleComplianceJourneyMonthDays.filter((day) =>
  day.date.startsWith("2026-08-"),
);

export const SAMPLE_COMPLIANCE_JOURNEY_YEAR = 2026;
export const SAMPLE_COMPLIANCE_JOURNEY_YEAR_NOW =
  SAMPLE_COMPLIANCE_JOURNEY_MONTH_NOW;
export const SAMPLE_COMPLIANCE_JOURNEY_YEAR_LIVE_DATE =
  SAMPLE_COMPLIANCE_JOURNEY_MONTH_LIVE_DATE;

export const sampleComplianceJourneyYearDays: DriverDay[] = [
  ...generatedDays,
  ...augustDays,
].sort((left, right) => left.date.localeCompare(right.date));
