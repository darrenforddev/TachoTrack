import type { WeeklyDriverHistory } from "../../data/weeklyDriverHistory";
import type { DriverDay } from "../types";
import { buildWeekComplianceNetworkMap } from "../weekComplianceNetworkMap";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Week compliance-network scenario failed: ${message}`);
  }
}

function makeDay(
  id: string,
  date: string,
  drivingMinutes: number,
  restMinutes: number = 11 * 60,
): DriverDay {
  return {
    id,
    date,
    activities: [],
    drivingMinutes,
    otherWorkMinutes: 60,
    breakMinutes: 45,
    poaMinutes: 30,
    restMinutes,
    dailyRestType: restMinutes >= 11 * 60 ? "regular" : "unknown",
  };
}

const currentWeek: WeeklyDriverHistory = {
  weekStartDate: "2026-08-24",
  weekEndDate: "2026-08-30",
  days: [
    makeDay("monday", "2026-08-24", 600),
    makeDay("tuesday", "2026-08-25", 600),
    makeDay("wednesday", "2026-08-26", 540),
    makeDay("thursday-breach", "2026-08-27", 540, 0),
    makeDay("friday", "2026-08-28", 540),
    makeDay("saturday-live", "2026-08-29", 540, 0),
  ],
};

const previousWeekDays = [
  makeDay("previous-week", "2026-08-20", 34 * 60),
];

const result = buildWeekComplianceNetworkMap({
  id: "week-network-scenario",
  currentWeek,
  previousWeekDays,
  liveDate: "2026-08-29",
  now: "2026-08-29T18:00:00.000Z",
});

assert(result.days.length === 7, "The coordinator must return seven day slots.");

assert(
  result.days.map((day) => day.date).join(",") ===
    "2026-08-24,2026-08-25,2026-08-26,2026-08-27,2026-08-28,2026-08-29,2026-08-30",
  "Day slots must remain in Monday-Sunday order.",
);

assert(
  result.days[6].recorded === false && result.days[6].level === null,
  "An unrecorded Sunday must remain an explicit empty slot.",
);

assert(
  result.days[0].drivingMinutes === 600 &&
    result.days[0].workingMinutes === 660 &&
    result.days[0].breakMinutes === 45,
  "Recorded day totals must reach the week summary unchanged.",
);

assert(
  result.days[3].level === "breach" && result.days[3].issueCount > 0,
  "A historical zero-rest day must retain its daily-rest breach.",
);

const liveRestResult = buildWeekComplianceNetworkMap({
  id: "week-network-live-rest-suppression",
  currentWeek: {
    weekStartDate: "2026-08-24",
    weekEndDate: "2026-08-30",
    days: [makeDay("monday-live", "2026-08-24", 60, 0)],
  },
  liveDate: "2026-08-24",
  now: "2026-08-24T10:00:00.000Z",
});

assert(
  liveRestResult.days[0].live &&
    liveRestResult.days[0].level !== "breach",
  "The live day must not manufacture a daily-rest breach.",
);

assert(
  result.states.weeklyDriving.drivingMinutesUsed === 56 * 60 &&
    result.states.weeklyDriving.status === "limit",
  "The six recorded days must reach the exact 56-hour weekly limit.",
);

assert(
  result.states.fortnightlyDriving.drivingMinutesUsed === 90 * 60 &&
    result.states.fortnightlyDriving.status === "limit",
  "Previous and current weeks must reach the exact 90-hour fortnight limit.",
);

assert(
  result.states.extendedDriving.extensionsUsed === 2 &&
    result.states.extendedDriving.extensionsRemaining === 0 &&
    result.states.extendedDriving.status === "exhausted",
  "Two 10-hour days must exhaust the extension allowance.",
);

assert(
  result.evidence.length === 9,
  "Six recorded days plus three aggregate states must create nine evidence events.",
);

assert(
  result.map.scale === "week" && result.map.livePosition !== null,
  "The coordinator must produce a live week-scale map.",
);

assert(
  result.map.lines.some((line) => line.id === "weekly-driving") &&
    result.map.lines.some((line) => line.id === "fortnightly-driving") &&
    result.map.lines.some((line) => line.id === "daily-rest"),
  "The map must expose weekly, fortnightly and daily-rest lines.",
);

let duplicateDateRejected = false;

try {
  buildWeekComplianceNetworkMap({
    id: "duplicate-date",
    currentWeek: {
      ...currentWeek,
      days: [...currentWeek.days, makeDay("duplicate", "2026-08-24", 0)],
    },
    now: "2026-08-29T18:00:00.000Z",
  });
} catch {
  duplicateDateRejected = true;
}

assert(duplicateDateRejected, "Duplicate DriverDay dates must be rejected.");

console.log("✓ Week compliance-network scenarios passed (12/12)");
