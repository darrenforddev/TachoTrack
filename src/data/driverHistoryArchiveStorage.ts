import AsyncStorage from "@react-native-async-storage/async-storage";

import type { DriverDay } from "../engine/types";

import {
    createDriverHistoryArchive,
    upsertDriverDayIntoArchive,
    type DriverHistoryArchive,
} from "./driverHistoryArchive";

const DRIVER_HISTORY_ARCHIVE_KEY = "tachotrack.driver-history-archive.v1";

/**
 * --------------------------------------------------
 * SAVE ARCHIVE
 * --------------------------------------------------
 *
 * Save the complete long-term driver history archive.
 */
export async function saveDriverHistoryArchive(
  archive: DriverHistoryArchive,
): Promise<void> {
  await AsyncStorage.setItem(
    DRIVER_HISTORY_ARCHIVE_KEY,
    JSON.stringify(archive),
  );
}

/**
 * --------------------------------------------------
 * LOAD ARCHIVE
 * --------------------------------------------------
 *
 * Load the driver's permanent history.
 *
 * If no archive exists yet, or the stored data is
 * invalid, return a new empty archive.
 */
export async function loadDriverHistoryArchive(): Promise<DriverHistoryArchive> {
  const stored = await AsyncStorage.getItem(DRIVER_HISTORY_ARCHIVE_KEY);

  if (stored === null) {
    return createDriverHistoryArchive();
  }

  try {
    const parsed = JSON.parse(stored) as DriverHistoryArchive;

    if (parsed.version !== 1 || !Array.isArray(parsed.days)) {
      return createDriverHistoryArchive();
    }

    return parsed;
  } catch {
    return createDriverHistoryArchive();
  }
}

/**
 * --------------------------------------------------
 * UPSERT ONE DRIVER DAY
 * --------------------------------------------------
 *
 * Insert or replace one DriverDay in the permanent
 * archive.
 *
 * Existing history is loaded first so updating
 * today's live DriverDay never removes older days.
 */
export async function upsertDriverDayInArchiveStorage(
  day: DriverDay,
): Promise<void> {
  await upsertDriverDaysInArchiveStorage([day]);
}

/**
 * --------------------------------------------------
 * UPSERT MULTIPLE DRIVER DAYS
 * --------------------------------------------------
 *
 * Inserts or replaces several DriverDay records using
 * ONE archive load and ONE archive save.
 *
 * This is important around midnight, where one live
 * activity may overlap two calendar days.
 *
 * Example:
 *
 * 23:30 -> 00:15
 *
 * We may need to update both:
 *
 * Thursday
 * Friday
 *
 * together without one write accidentally replacing
 * the result of another.
 */
export async function upsertDriverDaysInArchiveStorage(
  days: DriverDay[],
): Promise<void> {
  if (days.length === 0) {
    return;
  }

  const archive = await loadDriverHistoryArchive();

  const updatedArchive = days.reduce(
    (currentArchive, day) => upsertDriverDayIntoArchive(currentArchive, day),
    archive,
  );

  await saveDriverHistoryArchive(updatedArchive);
}
