import type { ActivityPeriod, DriverDay, DriverWeek } from "../engine/types";

function activity(
  id: string,
  type: ActivityPeriod["type"],
  start: string,
  end: string,
  durationMinutes: number,
): ActivityPeriod {
  return {
    id,
    type,
    start,
    end,
    durationMinutes,
  };
}

const monday: DriverDay = {
  id: "2026-08-24",
  date: "2026-08-24",

  activities: [
    activity(
      "mon-rest-1",
      "rest",
      "2026-08-24T00:00:00",
      "2026-08-24T06:00:00",
      360,
    ),

    activity(
      "mon-work-1",
      "otherWork",
      "2026-08-24T06:00:00",
      "2026-08-24T06:30:00",
      30,
    ),

    activity(
      "mon-drive-1",
      "driving",
      "2026-08-24T06:30:00",
      "2026-08-24T10:30:00",
      240,
    ),

    activity(
      "mon-break-1",
      "break",
      "2026-08-24T10:30:00",
      "2026-08-24T11:15:00",
      45,
    ),

    activity(
      "mon-drive-2",
      "driving",
      "2026-08-24T11:15:00",
      "2026-08-24T14:57:00",
      222,
    ),

    activity(
      "mon-work-2",
      "otherWork",
      "2026-08-24T14:57:00",
      "2026-08-24T15:32:00",
      35,
    ),

    activity(
      "mon-poa-1",
      "poa",
      "2026-08-24T15:32:00",
      "2026-08-24T16:07:00",
      35,
    ),

    activity(
      "mon-rest-2",
      "rest",
      "2026-08-24T16:07:00",
      "2026-08-25T01:27:00",
      560,
    ),
  ],

  drivingMinutes: 462,
  otherWorkMinutes: 65,
  breakMinutes: 45,
  poaMinutes: 35,
  restMinutes: 920,

  dailyRestType: "regular",

  notes: [],
};

const tuesday: DriverDay = {
  id: "2026-08-25",
  date: "2026-08-25",

  activities: [
    activity(
      "tue-rest-1",
      "rest",
      "2026-08-25T00:00:00",
      "2026-08-25T06:00:00",
      360,
    ),

    activity(
      "tue-work-1",
      "otherWork",
      "2026-08-25T06:00:00",
      "2026-08-25T06:30:00",
      30,
    ),

    activity(
      "tue-drive-1",
      "driving",
      "2026-08-25T06:30:00",
      "2026-08-25T11:00:00",
      270,
    ),

    activity(
      "tue-break-1",
      "break",
      "2026-08-25T11:00:00",
      "2026-08-25T11:45:00",
      45,
    ),

    activity(
      "tue-drive-2",
      "driving",
      "2026-08-25T11:45:00",
      "2026-08-25T15:35:00",
      230,
    ),

    activity(
      "tue-work-2",
      "otherWork",
      "2026-08-25T15:35:00",
      "2026-08-25T16:15:00",
      40,
    ),

    activity(
      "tue-rest-2",
      "rest",
      "2026-08-25T16:15:00",
      "2026-08-26T01:45:00",
      570,
    ),
  ],

  drivingMinutes: 500,
  otherWorkMinutes: 70,
  breakMinutes: 45,
  poaMinutes: 0,
  restMinutes: 930,

  dailyRestType: "regular",
  notes: [],
};

const wednesday: DriverDay = {
  id: "2026-08-26",
  date: "2026-08-26",

  activities: [
    activity(
      "wed-rest-1",
      "rest",
      "2026-08-26T00:00:00",
      "2026-08-26T06:00:00",
      360,
    ),

    activity(
      "wed-work-1",
      "otherWork",
      "2026-08-26T06:00:00",
      "2026-08-26T06:30:00",
      30,
    ),

    activity(
      "wed-drive-1",
      "driving",
      "2026-08-26T06:30:00",
      "2026-08-26T10:45:00",
      255,
    ),

    activity(
      "wed-break-1",
      "break",
      "2026-08-26T10:45:00",
      "2026-08-26T11:30:00",
      45,
    ),

    activity(
      "wed-drive-2",
      "driving",
      "2026-08-26T11:30:00",
      "2026-08-26T16:15:00",
      285,
    ),

    activity(
      "wed-work-2",
      "otherWork",
      "2026-08-26T16:15:00",
      "2026-08-26T17:10:00",
      55,
    ),

    activity(
      "wed-rest-2",
      "rest",
      "2026-08-26T17:10:00",
      "2026-08-27T02:10:00",
      540,
    ),
  ],

  drivingMinutes: 540,
  otherWorkMinutes: 85,
  breakMinutes: 45,
  poaMinutes: 0,
  restMinutes: 900,

  dailyRestType: "reduced",

  notes: ["Reduced daily rest used"],
};

const thursday: DriverDay = {
  id: "2026-08-27",
  date: "2026-08-27",

  activities: [
    activity(
      "thu-drive-1",
      "driving",
      "2026-08-27T07:00:00",
      "2026-08-27T11:00:00",
      240,
    ),

    activity(
      "thu-break-1",
      "break",
      "2026-08-27T11:00:00",
      "2026-08-27T11:45:00",
      45,
    ),

    activity(
      "thu-drive-2",
      "driving",
      "2026-08-27T11:45:00",
      "2026-08-27T16:05:00",
      260,
    ),

    activity(
      "thu-work-1",
      "otherWork",
      "2026-08-27T16:05:00",
      "2026-08-27T17:50:00",
      105,
    ),
  ],

  drivingMinutes: 500,
  otherWorkMinutes: 105,
  breakMinutes: 45,
  poaMinutes: 0,
  restMinutes: 700,

  dailyRestType: "regular",
  notes: [],
};

const friday: DriverDay = {
  id: "2026-08-28",
  date: "2026-08-28",

  activities: [
    activity(
      "fri-drive-1",
      "driving",
      "2026-08-28T07:00:00",
      "2026-08-28T11:00:00",
      240,
    ),

    activity(
      "fri-break-1",
      "break",
      "2026-08-28T11:00:00",
      "2026-08-28T11:45:00",
      45,
    ),

    activity(
      "fri-drive-2",
      "driving",
      "2026-08-28T11:45:00",
      "2026-08-28T15:55:00",
      250,
    ),

    activity(
      "fri-work-1",
      "otherWork",
      "2026-08-28T15:55:00",
      "2026-08-28T17:15:00",
      80,
    ),
  ],

  drivingMinutes: 490,
  otherWorkMinutes: 80,
  breakMinutes: 45,
  poaMinutes: 0,
  restMinutes: 700,

  dailyRestType: "regular",
  notes: [],
};

const saturday: DriverDay = {
  id: "2026-08-29",
  date: "2026-08-29",

  activities: [
    activity(
      "sat-drive-1",
      "driving",
      "2026-08-29T08:00:00",
      "2026-08-29T09:40:00",
      100,
    ),

    activity(
      "sat-work-1",
      "otherWork",
      "2026-08-29T09:40:00",
      "2026-08-29T10:15:00",
      35,
    ),
  ],

  drivingMinutes: 100,
  otherWorkMinutes: 35,
  breakMinutes: 0,
  poaMinutes: 0,
  restMinutes: 920,

  dailyRestType: "regular",
  notes: [],
};

const sunday: DriverDay = {
  id: "2026-08-30",
  date: "2026-08-30",

  activities: [
    activity(
      "sun-rest",
      "rest",
      "2026-08-30T00:00:00",
      "2026-08-30T23:59:00",
      1439,
    ),
  ],

  drivingMinutes: 0,
  otherWorkMinutes: 0,
  breakMinutes: 0,
  poaMinutes: 0,
  restMinutes: 1439,

  dailyRestType: "weekly",

  notes: ["Weekly rest"],
};

export const sampleWeek: DriverWeek = {
  id: "2026-week-35",

  weekNumber: 35,

  startDate: "2026-08-24",
  endDate: "2026-08-30",

  days: [monday, tuesday, wednesday, thursday, friday, saturday, sunday],
};
