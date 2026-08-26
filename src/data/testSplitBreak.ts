import type { DriverDay } from "../engine/types";

import { evaluateDailyDrivingRules } from "../engine/drivingRules";

const splitBreakDay: DriverDay = {
  id: "split-break-test",
  date: "2026-08-31",

  activities: [
    {
      id: "drive-1",
      type: "driving",
      start: "2026-08-31T06:00:00",
      end: "2026-08-31T08:00:00",
      durationMinutes: 120,
    },

    {
      id: "break-1",
      type: "break",
      start: "2026-08-31T08:00:00",
      end: "2026-08-31T08:15:00",
      durationMinutes: 15,
    },

    {
      id: "drive-2",
      type: "driving",
      start: "2026-08-31T08:15:00",
      end: "2026-08-31T10:45:00",
      durationMinutes: 150,
    },

    {
      id: "break-2",
      type: "break",
      start: "2026-08-31T10:45:00",
      end: "2026-08-31T11:15:00",
      durationMinutes: 30,
    },

    {
      id: "drive-3",
      type: "driving",
      start: "2026-08-31T11:15:00",
      end: "2026-08-31T13:15:00",
      durationMinutes: 120,
    },
  ],

  drivingMinutes: 390,
  otherWorkMinutes: 0,
  breakMinutes: 45,
  poaMinutes: 0,
  restMinutes: 660,

  dailyRestType: "regular",
  notes: [],
};

export const splitBreakTestResult = evaluateDailyDrivingRules(splitBreakDay);
