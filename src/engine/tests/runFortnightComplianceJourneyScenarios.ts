import type { WeeklyDriverHistory } from "../../data/weeklyDriverHistory";
import type { DriverDay } from "../types";
import { buildFortnightComplianceJourney } from "../fortnightComplianceJourney";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Fortnight Journey scenario failed: ${message}`);
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

  return activities;
}

function makeDay(
  id: string,
  date: string,
  drivingMinutes: number,
  live: boolean = false,
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
    poaMinutes: 0,
    restMinutes: live ? 0 : 11 * 60,
    dailyRestType: live ? "unknown" : "regular",
  };
}

function makeWeek(
  id: string,
  weekStartDate: string,
  drivingMinutes: number[],
  liveFinalDay: boolean = false,
): WeeklyDriverHistory {
  const start = new Date(`${weekStartDate}T00:00:00.000Z`).getTime();
  const days = drivingMinutes.map((minutes, index) => {
    const date = new Date(start + index * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    return makeDay(
      `${id}-${date}`,
      date,
      minutes,
      liveFinalDay && index === drivingMinutes.length - 1,
    );
  });

  return {
    weekStartDate,
    weekEndDate: new Date(start + 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    days,
  };
}

const previousWeek = makeWeek(
  "fortnight-previous",
  "2026-08-17",
  [480, 480, 480, 480, 480],
);
const currentWeek = makeWeek(
  "fortnight-current",
  "2026-08-24",
  [600, 600, 540, 540, 540, 30],
  true,
);
const result = buildFortnightComplianceJourney({
  id: "fortnight-journey-evidence",
  previousWeek,
  currentWeek,
  liveDate: "2026-08-29",
  now: "2026-08-29T12:00:00.000Z",
});

assert(
  result.fortnightStartDate === "2026-08-17" &&
    result.fortnightEndDate === "2026-08-30",
  "The exact fourteen-day boundary must be preserved.",
);
assert(result.days.length === 14, "The route must expose fourteen day stations.");
assert(
  result.previousWeek.days.length === 7 && result.currentWeek.days.length === 7,
  "Both connected week sections must preserve seven days.",
);
assert(result.recordedDayCount === 11, "All recorded days must be counted once.");
assert(
  result.previousWeek.drivingMinutes === 40 * 60,
  "Previous-week driving must remain exact.",
);
assert(
  result.currentWeek.drivingMinutes === 47 * 60 + 30,
  "Current-week driving must remain exact.",
);
assert(
  result.drivingMinutes === 87 * 60 + 30,
  "The combined fortnight total must remain exact.",
);
assert(
  result.state.remainingMinutes === 2 * 60 + 30,
  "The remaining 90-hour allowance must remain exact.",
);
assert(result.state.status === "warning", "Eight-hour proximity must warn.");
assert(result.level === "warning", "The journey must expose its worst legal level.");
assert(
  result.previousWeek.live === false && result.currentWeek.live === true,
  "Only the current containing week may be live.",
);
assert(
  result.days.find((day) => day.date === "2026-08-29")?.level !== "breach",
  "The live day must not manufacture an unfinished-rest breach.",
);

const exactLimit = buildFortnightComplianceJourney({
  id: "fortnight-exact-limit",
  previousWeek,
  currentWeek: makeWeek(
    "fortnight-limit-current",
    "2026-08-24",
    [600, 600, 540, 540, 540, 180],
  ),
  now: "2026-08-30T12:00:00.000Z",
});

assert(
  exactLimit.state.drivingMinutesUsed === 90 * 60 &&
    exactLimit.state.status === "limit",
  "Exactly 90 hours must be represented as the legal limit.",
);

const breach = buildFortnightComplianceJourney({
  id: "fortnight-breach",
  previousWeek,
  currentWeek: makeWeek(
    "fortnight-breach-current",
    "2026-08-24",
    [600, 600, 540, 540, 540, 240],
  ),
  now: "2026-08-30T12:00:00.000Z",
});

assert(
  breach.state.status === "breach" && breach.level === "breach",
  "Driving beyond 90 hours must breach the fortnight route.",
);

let nonConsecutiveRejected = false;

try {
  buildFortnightComplianceJourney({
    id: "non-consecutive-fortnight",
    previousWeek,
    currentWeek: makeWeek("wrong-current", "2026-08-31", [480]),
    now: "2026-09-01T12:00:00.000Z",
  });
} catch {
  nonConsecutiveRejected = true;
}

assert(nonConsecutiveRejected, "Non-consecutive weeks must be rejected.");

let outsideLiveDateRejected = false;

try {
  buildFortnightComplianceJourney({
    id: "outside-live-date",
    previousWeek,
    currentWeek,
    liveDate: "2026-08-23",
    now: "2026-08-29T12:00:00.000Z",
  });
} catch {
  outsideLiveDateRejected = true;
}

assert(
  outsideLiveDateRejected,
  "A live date outside the current week must be rejected.",
);

let duplicateRejected = false;

try {
  buildFortnightComplianceJourney({
    id: "duplicate-day",
    previousWeek,
    currentWeek: {
      ...currentWeek,
      days: [...currentWeek.days, currentWeek.days[0]],
    },
    now: "2026-08-29T12:00:00.000Z",
  });
} catch {
  duplicateRejected = true;
}

assert(duplicateRejected, "Duplicate DriverDay dates must be rejected.");

let blankIdRejected = false;

try {
  buildFortnightComplianceJourney({
    id: "   ",
    previousWeek,
    currentWeek,
    now: "2026-08-29T12:00:00.000Z",
  });
} catch {
  blankIdRejected = true;
}

assert(blankIdRejected, "A blank Fortnight Journey id must be rejected.");

console.log("✓ Fortnight compliance journey scenarios passed (18/18)");
