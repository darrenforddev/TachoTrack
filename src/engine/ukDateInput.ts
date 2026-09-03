export interface UkDateParts {
  year: number;
  month: number;
  day: number;
}

export function parseUkDateInput(value: string): UkDateParts {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());

  if (match === null) {
    throw new Error("Use date DD/MM/YYYY and time HH:MM.");
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("Enter a valid UK date.");
  }

  return { year, month, day };
}

export function formatUkDateInput(value: Date = new Date()): string {
  return [
    String(value.getDate()).padStart(2, "0"),
    String(value.getMonth() + 1).padStart(2, "0"),
    value.getFullYear(),
  ].join("/");
}

export function formatUkDateInputFromIsoDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match === null) {
    throw new Error(`Invalid duty date: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid duty date: ${value}`);
  }

  return formatUkDateInput(date);
}

export function ukDateInputToIsoDate(value: string): string {
  const { year, month, day } = parseUkDateInput(value);

  return [
    year,
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

export function timestampFromUkDateTimeInputs(
  dateText: string,
  timeText: string,
): string {
  const { year, month, day } = parseUkDateInput(dateText);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText.trim());

  if (timeMatch === null) {
    throw new Error("Use date DD/MM/YYYY and time HH:MM.");
  }

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    throw new Error("Enter a valid local date and time.");
  }

  return date.toISOString();
}

export function isValidUkDateInput(value: string): boolean {
  try {
    parseUkDateInput(value);
    return true;
  } catch {
    return false;
  }
}

export function displayUkDateInput(value: string): string {
  if (!isValidUkDateInput(value)) {
    return value;
  }

  const { year, month, day } = parseUkDateInput(value);

  return new Date(year, month - 1, day, 12, 0, 0, 0).toLocaleDateString(
    "en-GB",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    },
  );
}
