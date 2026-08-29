import AsyncStorage from "@react-native-async-storage/async-storage";

import type { DriverDay } from "../engine/types";

import type { FortnightlyDriverHistory } from "./fortnightlyDriverHistory";

import type { WeeklyDriverHistory } from "./weeklyDriverHistory";

const WEEKLY_HISTORY_STORAGE_KEY = "@tachotrack/weekly-driver-history/v1";

const FORTNIGHTLY_HISTORY_STORAGE_KEY =
  "@tachotrack/fortnightly-driver-history/v1";

interface StoredWeeklyDriverHistory {
  version: 1;
  savedAt: string;
  history: WeeklyDriverHistory;
}

interface StoredFortnightlyDriverHistory {
  version: 1;
  savedAt: string;
  history: FortnightlyDriverHistory;
}

function isDriverDay(value: unknown): value is DriverDay {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const day = value as Partial<DriverDay>;

  return (
    typeof day.id === "string" &&
    typeof day.date === "string" &&
    Array.isArray(day.activities) &&
    typeof day.drivingMinutes === "number" &&
    typeof day.otherWorkMinutes === "number" &&
    typeof day.breakMinutes === "number" &&
    typeof day.poaMinutes === "number" &&
    typeof day.restMinutes === "number"
  );
}

function isWeeklyDriverHistory(value: unknown): value is WeeklyDriverHistory {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const history = value as Partial<WeeklyDriverHistory>;

  return (
    typeof history.weekStartDate === "string" &&
    typeof history.weekEndDate === "string" &&
    Array.isArray(history.days) &&
    history.days.every(isDriverDay)
  );
}

function isFortnightlyDriverHistory(
  value: unknown,
): value is FortnightlyDriverHistory {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const history = value as Partial<FortnightlyDriverHistory>;

  return (
    isWeeklyDriverHistory(history.previousWeek) &&
    isWeeklyDriverHistory(history.currentWeek)
  );
}

function isStoredWeeklyDriverHistory(
  value: unknown,
): value is StoredWeeklyDriverHistory {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const stored = value as Partial<StoredWeeklyDriverHistory>;

  return (
    stored.version === 1 &&
    typeof stored.savedAt === "string" &&
    isWeeklyDriverHistory(stored.history)
  );
}

function isStoredFortnightlyDriverHistory(
  value: unknown,
): value is StoredFortnightlyDriverHistory {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const stored = value as Partial<StoredFortnightlyDriverHistory>;

  return (
    stored.version === 1 &&
    typeof stored.savedAt === "string" &&
    isFortnightlyDriverHistory(stored.history)
  );
}

/**
 * --------------------------------------------------
 * WEEKLY STORAGE
 * --------------------------------------------------
 */

export async function saveWeeklyDriverHistory(
  history: WeeklyDriverHistory,
): Promise<void> {
  const stored: StoredWeeklyDriverHistory = {
    version: 1,
    savedAt: new Date().toISOString(),
    history,
  };

  await AsyncStorage.setItem(
    WEEKLY_HISTORY_STORAGE_KEY,
    JSON.stringify(stored),
  );
}

export async function loadWeeklyDriverHistory(): Promise<WeeklyDriverHistory | null> {
  try {
    const raw = await AsyncStorage.getItem(WEEKLY_HISTORY_STORAGE_KEY);

    if (raw === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (!isStoredWeeklyDriverHistory(parsed)) {
      console.warn("TachoTrack weekly history storage was invalid.");

      return null;
    }

    return parsed.history;
  } catch (error) {
    console.error("Unable to load TachoTrack weekly history.", error);

    return null;
  }
}

export async function clearWeeklyDriverHistory(): Promise<void> {
  await AsyncStorage.removeItem(WEEKLY_HISTORY_STORAGE_KEY);
}

export async function hasStoredWeeklyDriverHistory(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(WEEKLY_HISTORY_STORAGE_KEY);

  return raw !== null;
}

/**
 * --------------------------------------------------
 * FORTNIGHTLY STORAGE
 * --------------------------------------------------
 */

export async function saveFortnightlyDriverHistory(
  history: FortnightlyDriverHistory,
): Promise<void> {
  const stored: StoredFortnightlyDriverHistory = {
    version: 1,
    savedAt: new Date().toISOString(),
    history,
  };

  await AsyncStorage.setItem(
    FORTNIGHTLY_HISTORY_STORAGE_KEY,
    JSON.stringify(stored),
  );
}

export async function loadFortnightlyDriverHistory(): Promise<FortnightlyDriverHistory | null> {
  try {
    const raw = await AsyncStorage.getItem(FORTNIGHTLY_HISTORY_STORAGE_KEY);

    if (raw === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (!isStoredFortnightlyDriverHistory(parsed)) {
      console.warn("TachoTrack fortnightly history storage was invalid.");

      return null;
    }

    return parsed.history;
  } catch (error) {
    console.error("Unable to load TachoTrack fortnightly history.", error);

    return null;
  }
}

export async function clearFortnightlyDriverHistory(): Promise<void> {
  await AsyncStorage.removeItem(FORTNIGHTLY_HISTORY_STORAGE_KEY);
}

export async function hasStoredFortnightlyDriverHistory(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(FORTNIGHTLY_HISTORY_STORAGE_KEY);

  return raw !== null;
}
