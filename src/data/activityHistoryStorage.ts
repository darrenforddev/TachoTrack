import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ActivityHistoryState } from "./activityHistory";

const ACTIVITY_HISTORY_STORAGE_KEY = "@tachotrack/activity-history/v1";

interface StoredActivityHistory {
  version: 1;
  savedAt: string;
  history: ActivityHistoryState;
}

function isValidActivityHistoryState(
  value: unknown,
): value is ActivityHistoryState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as ActivityHistoryState;

  if (!Array.isArray(candidate.events)) {
    return false;
  }

  if (
    candidate.activeEventId !== null &&
    typeof candidate.activeEventId !== "string"
  ) {
    return false;
  }

  return candidate.events.every((event) => {
    return (
      typeof event === "object" &&
      event !== null &&
      typeof event.id === "string" &&
      typeof event.activity === "string" &&
      typeof event.startedAt === "string" &&
      (event.endedAt === null || typeof event.endedAt === "string") &&
      (event.durationMilliseconds === null ||
        typeof event.durationMilliseconds === "number") &&
      typeof event.source === "string"
    );
  });
}

function isValidStoredActivityHistory(
  value: unknown,
): value is StoredActivityHistory {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as StoredActivityHistory;

  return (
    candidate.version === 1 &&
    typeof candidate.savedAt === "string" &&
    isValidActivityHistoryState(candidate.history)
  );
}

export async function saveActivityHistory(
  history: ActivityHistoryState,
): Promise<void> {
  const stored: StoredActivityHistory = {
    version: 1,
    savedAt: new Date().toISOString(),
    history,
  };

  await AsyncStorage.setItem(
    ACTIVITY_HISTORY_STORAGE_KEY,
    JSON.stringify(stored),
  );
}

export async function loadActivityHistory(): Promise<ActivityHistoryState | null> {
  const raw = await AsyncStorage.getItem(ACTIVITY_HISTORY_STORAGE_KEY);

  if (raw === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isValidStoredActivityHistory(parsed)) {
      return null;
    }

    return parsed.history;
  } catch {
    return null;
  }
}

export async function clearActivityHistory(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVITY_HISTORY_STORAGE_KEY);
}

export async function hasStoredActivityHistory(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(ACTIVITY_HISTORY_STORAGE_KEY);

  return raw !== null;
}
