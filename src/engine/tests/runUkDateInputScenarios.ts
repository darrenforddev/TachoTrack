import {
  displayUkDateInput,
  formatUkDateInput,
  formatUkDateInputFromIsoDate,
  isValidUkDateInput,
  parseUkDateInput,
  timestampFromUkDateTimeInputs,
  ukDateInputToIsoDate,
} from "../ukDateInput";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`UK date-input scenario failed: ${message}`);
  }
}

let passed = 0;
function pass(message: string): void {
  passed += 1;
  console.log(`✅ ${message}`);
}

const formatted = formatUkDateInput(new Date(2026, 8, 3, 12, 0, 0, 0));
assert(formatted === "03/09/2026", "local date must be DD/MM/YYYY");
pass("Local dates are formatted in UK order");

assert(
  formatUkDateInputFromIsoDate("2026-09-02") === "02/09/2026",
  "ISO duty date must format safely",
);
pass("Stored ISO duty dates display in UK format");

assert(
  ukDateInputToIsoDate("02/09/2026") === "2026-09-02",
  "UK date must convert to canonical ISO",
);
pass("UK duty dates convert to canonical engine dates");

const parts = parseUkDateInput("29/02/2028");
assert(
  parts.day === 29 && parts.month === 2 && parts.year === 2028,
  "valid leap day must parse",
);
pass("Valid leap years are accepted");

assert(!isValidUkDateInput("29/02/2027"), "invalid leap day must fail");
pass("Invalid leap days are rejected");

assert(!isValidUkDateInput("31/04/2026"), "invalid month day must fail");
pass("Impossible calendar dates are rejected");

assert(!isValidUkDateInput("2026-09-02"), "ISO input must not be shown");
pass("Non-UK visible date format is rejected");

const timestamp = new Date(
  timestampFromUkDateTimeInputs("02/09/2026", "05:40"),
);
assert(
  timestamp.getFullYear() === 2026 &&
    timestamp.getMonth() === 8 &&
    timestamp.getDate() === 2 &&
    timestamp.getHours() === 5 &&
    timestamp.getMinutes() === 40,
  "timestamp must preserve entered local components",
);
pass("UK date and time produce the correct local timestamp");

let invalidTimeRejected = false;
try {
  timestampFromUkDateTimeInputs("02/09/2026", "24:00");
} catch {
  invalidTimeRejected = true;
}
assert(invalidTimeRejected, "24:00 must be rejected");
pass("Invalid clock times are rejected");

assert(
  displayUkDateInput("02/09/2026") === "Wednesday 2 September",
  "friendly display must remain British",
);
pass("Friendly date labels remain British English");

console.log("============================================================");
console.log(`UK DATE-INPUT RESULT: ${passed}/${passed} passed`);
console.log("✅ ALL UK DATE-INPUT SCENARIOS PASSED");
console.log("============================================================");
