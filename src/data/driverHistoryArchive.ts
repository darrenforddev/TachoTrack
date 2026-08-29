import type { DriverDay } from "../engine/types";

export interface DriverHistoryArchive {
  version: 1;
  days: DriverDay[];
}

/**
 * Create a new empty long-term driver history archive.
 */
export function createDriverHistoryArchive(): DriverHistoryArchive {
  return {
    version: 1,
    days: [],
  };
}

/**
 * Insert or replace one DriverDay.
 *
 * There must only ever be one canonical record
 * for each YYYY-MM-DD date.
 */
export function upsertDriverDayIntoArchive(
  archive: DriverHistoryArchive,
  day: DriverDay,
): DriverHistoryArchive {
  const existingIndex = archive.days.findIndex(
    (existingDay) => existingDay.date === day.date,
  );

  let nextDays: DriverDay[];

  if (existingIndex >= 0) {
    nextDays = archive.days.map((existingDay) =>
      existingDay.date === day.date ? day : existingDay,
    );
  } else {
    nextDays = [...archive.days, day];
  }

  nextDays.sort((a, b) => a.date.localeCompare(b.date));

  return {
    ...archive,
    days: nextDays,
  };
}

/**
 * Return all stored days between two inclusive
 * YYYY-MM-DD boundaries.
 */
export function getDriverDaysInRange(
  archive: DriverHistoryArchive,
  startDate: string,
  endDate: string,
): DriverDay[] {
  return archive.days.filter(
    (day) => day.date >= startDate && day.date <= endDate,
  );
}

/**
 * Return all stored DriverDays for a calendar month.
 *
 * month is JavaScript-style:
 * 0 = January
 * 7 = August
 * 11 = December
 */
export function getDriverDaysForMonth(
  archive: DriverHistoryArchive,
  year: number,
  month: number,
): DriverDay[] {
  const monthPrefix = [year, String(month + 1).padStart(2, "0")].join("-");

  return archive.days.filter((day) => day.date.startsWith(`${monthPrefix}-`));
}

/**
 * Return all stored DriverDays for a calendar year.
 */
export function getDriverDaysForYear(
  archive: DriverHistoryArchive,
  year: number,
): DriverDay[] {
  return archive.days.filter((day) => day.date.startsWith(`${year}-`));
}

/**
 * Retrieve one exact DriverDay.
 */
export function getDriverDayFromArchive(
  archive: DriverHistoryArchive,
  date: string,
): DriverDay | null {
  return archive.days.find((day) => day.date === date) ?? null;
}
