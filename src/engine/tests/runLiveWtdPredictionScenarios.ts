import { evaluateLiveWtdPrediction } from "../liveWtdPrediction";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function runScenario(name: string, test: () => void): void {
  try {
    test();
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}

/*
 * Scenario 1
 *
 * 4h59 consecutive working.
 *
 * Expected:
 * CLEAR
 */
runScenario("Scenario 1 - 4h59 is clear", () => {
  const result = evaluateLiveWtdPrediction(4 * 60 + 59);

  assert(result.level === "clear", `Expected clear, got ${result.level}`);

  assert(
    result.minutesUntilSixHourLimit === 61,
    `Expected 61 minutes remaining, got ${result.minutesUntilSixHourLimit}`,
  );
});

/*
 * Scenario 2
 *
 * Exactly 5h working.
 *
 * Expected:
 * ADVISORY
 */
runScenario("Scenario 2 - exactly 5h is advisory", () => {
  const result = evaluateLiveWtdPrediction(5 * 60);

  assert(result.level === "advisory", `Expected advisory, got ${result.level}`);

  assert(
    result.minutesUntilSixHourLimit === 60,
    `Expected 60 minutes remaining, got ${result.minutesUntilSixHourLimit}`,
  );
});

/*
 * Scenario 3
 *
 * 5h29 consecutive working.
 *
 * Expected:
 * ADVISORY
 */
runScenario("Scenario 3 - 5h29 remains advisory", () => {
  const result = evaluateLiveWtdPrediction(5 * 60 + 29);

  assert(result.level === "advisory", `Expected advisory, got ${result.level}`);

  assert(
    result.minutesUntilSixHourLimit === 31,
    `Expected 31 minutes remaining, got ${result.minutesUntilSixHourLimit}`,
  );
});

/*
 * Scenario 4
 *
 * Exactly 5h30.
 *
 * Expected:
 * WARNING
 */
runScenario("Scenario 4 - exactly 5h30 is warning", () => {
  const result = evaluateLiveWtdPrediction(5 * 60 + 30);

  assert(result.level === "warning", `Expected warning, got ${result.level}`);

  assert(
    result.minutesUntilSixHourLimit === 30,
    `Expected 30 minutes remaining, got ${result.minutesUntilSixHourLimit}`,
  );
});

/*
 * Scenario 5
 *
 * 5h59 consecutive working.
 *
 * Expected:
 * WARNING
 */
runScenario("Scenario 5 - 5h59 is warning", () => {
  const result = evaluateLiveWtdPrediction(5 * 60 + 59);

  assert(result.level === "warning", `Expected warning, got ${result.level}`);

  assert(
    result.minutesUntilSixHourLimit === 1,
    `Expected 1 minute remaining, got ${result.minutesUntilSixHourLimit}`,
  );
});

/*
 * Scenario 6
 *
 * Exactly 6h.
 *
 * Expected:
 * ACTION
 */
runScenario("Scenario 6 - exactly 6h requires action", () => {
  const result = evaluateLiveWtdPrediction(6 * 60);

  assert(result.level === "action", `Expected action, got ${result.level}`);

  assert(
    result.minutesUntilSixHourLimit === 0,
    `Expected 0 minutes remaining, got ${result.minutesUntilSixHourLimit}`,
  );
});

/*
 * Scenario 7
 *
 * 6h01 consecutive working.
 *
 * Expected:
 * BREACH
 */
runScenario("Scenario 7 - 6h01 is breach", () => {
  const result = evaluateLiveWtdPrediction(6 * 60 + 1);

  assert(result.level === "breach", `Expected breach, got ${result.level}`);

  assert(
    result.minutesUntilSixHourLimit === 0,
    `Expected 0 minutes remaining, got ${result.minutesUntilSixHourLimit}`,
  );
});

console.log("All live WTD prediction scenarios passed.");
