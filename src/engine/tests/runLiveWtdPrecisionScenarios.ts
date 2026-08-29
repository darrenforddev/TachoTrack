import { evaluateLiveWtdPrecision } from "../liveWtdPrecision";

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

const HOUR = 60 * 60 * 1000;
const SECOND = 1000;

/*
 * Scenario 1
 *
 * 5:59:59 consecutive working.
 *
 * The driver is one second away from the
 * six-hour action point.
 *
 * Expected:
 * WARNING
 */
runScenario("Scenario 1 - 5h59m59s is warning", () => {
  const result = evaluateLiveWtdPrecision(6 * HOUR - SECOND);

  assert(result.level === "warning", `Expected warning, got ${result.level}`);

  assert(
    result.secondsUntilSixHourLimit === 1,
    `Expected 1 second remaining, got ${result.secondsUntilSixHourLimit}`,
  );
});

/*
 * Scenario 2
 *
 * Exactly 6:00:00.
 *
 * The driver must not perform further working
 * time without the required qualifying break.
 *
 * Expected:
 * ACTION
 */
runScenario("Scenario 2 - exactly 6h is action", () => {
  const result = evaluateLiveWtdPrecision(6 * HOUR);

  assert(result.level === "action", `Expected action, got ${result.level}`);

  assert(
    result.secondsUntilSixHourLimit === 0,
    `Expected 0 seconds remaining, got ${result.secondsUntilSixHourLimit}`,
  );
});

/*
 * Scenario 3
 *
 * 6:00:01 consecutive working.
 *
 * Even though this would still appear as 360
 * whole minutes if rounded down, the precise
 * engine must recognise that six hours has
 * actually been exceeded.
 *
 * Expected:
 * BREACH
 */
runScenario("Scenario 3 - 6h00m01s is breach", () => {
  const result = evaluateLiveWtdPrecision(6 * HOUR + SECOND);

  assert(result.level === "breach", `Expected breach, got ${result.level}`);

  assert(
    result.consecutiveWorkingSeconds === 6 * 60 * 60 + 1,
    `Expected 21601 working seconds, got ${result.consecutiveWorkingSeconds}`,
  );
});

console.log("All live WTD precision scenarios passed.");
