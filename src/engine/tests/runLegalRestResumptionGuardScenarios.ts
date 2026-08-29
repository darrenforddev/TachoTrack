import type { DriverActivityType } from "../../data/activityState";

import { evaluateLegalRestResumption } from "../legalRestResumptionGuard";

import type { LegalRestRestartState } from "../legalRestRestartState";

function createRestartState(
  overrides: Partial<LegalRestRestartState> = {},
): LegalRestRestartState {
  return {
    route: "reduced-daily-rest",
    restStartedAt: "2026-08-28T18:00:00.000Z",
    earliestLegalRestartTime: "2026-08-29T03:00:00.000Z",
    requiredCurrentRestMinutes: 9 * 60,
    elapsedCurrentRestMinutes: 9 * 60,
    remainingRestMinutes: 0,
    mayResumeWork: true,
    allowanceStatus: "verified",
    reducedRestAvailable: true,
    reducedRestsUsed: 0,
    reducedRestsRemaining: 3,
    reducedRestWillBeUsed: true,
    splitFirstPartAvailable: false,
    splitFirstPartMinutes: 0,
    referenceDeadline: "2026-08-29T06:00:00.000Z",
    restartWithinReferencePeriod: true,
    referenceStatus: "verified",
    referenceStart: "2026-08-28T06:00:00.000Z",
    message: "Test restart state.",
    ...overrides,
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Legal rest resumption guard scenario failed: ${message}`);
  }
}

function evaluate(activity: DriverActivityType, state: LegalRestRestartState) {
  return evaluateLegalRestResumption(activity, state);
}

/**
 * --------------------------------------------------
 * SCENARIO 1
 * BREAK DOES NOT END PROTECTED REST
 * --------------------------------------------------
 */
{
  const result = evaluate(
    "break",
    createRestartState({
      mayResumeWork: false,
      remainingRestMinutes: 60,
    }),
  );

  assert(
    result.level === "allowed",
    "Break should remain allowed during protected rest.",
  );

  assert(result.mayChangeActivity === true, "Break should not be blocked.");

  assert(
    result.endsProtectedRest === false,
    "Break must not end the protected rest session.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 2
 * REDUCED ROUTE — 8H59
 * --------------------------------------------------
 */
{
  const result = evaluate(
    "driving",
    createRestartState({
      route: "reduced-daily-rest",
      elapsedCurrentRestMinutes: 8 * 60 + 59,
      remainingRestMinutes: 1,
      mayResumeWork: false,
    }),
  );

  assert(result.level === "blocked", "Driving must be blocked at 8h59.");

  assert(
    result.mayChangeActivity === false,
    "The activity change must not proceed at 8h59.",
  );

  assert(result.remainingRestMinutes === 1, "One minute should remain.");
}

/**
 * --------------------------------------------------
 * SCENARIO 3
 * REDUCED ROUTE — 9H00
 * --------------------------------------------------
 */
{
  const result = evaluate(
    "driving",
    createRestartState({
      route: "reduced-daily-rest",
      elapsedCurrentRestMinutes: 9 * 60,
      remainingRestMinutes: 0,
      mayResumeWork: true,
      reducedRestWillBeUsed: true,
    }),
  );

  assert(
    result.level === "allowed",
    "Driving should be allowed after a valid 9-hour reduced rest.",
  );

  assert(
    result.mayChangeActivity === true,
    "The activity change should proceed at 9h.",
  );

  assert(
    result.endsProtectedRest === true,
    "Driving should end the completed protected rest.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 4
 * REGULAR ROUTE — 10H59
 * --------------------------------------------------
 */
{
  const result = evaluate(
    "other-work",
    createRestartState({
      route: "regular-daily-rest",
      earliestLegalRestartTime: "2026-08-29T05:00:00.000Z",
      requiredCurrentRestMinutes: 11 * 60,
      elapsedCurrentRestMinutes: 10 * 60 + 59,
      remainingRestMinutes: 1,
      mayResumeWork: false,
      reducedRestAvailable: false,
      reducedRestsUsed: 3,
      reducedRestsRemaining: 0,
      reducedRestWillBeUsed: false,
    }),
  );

  assert(
    result.level === "blocked",
    "Other Work must be blocked at 10h59 when 11h is required.",
  );

  assert(
    result.remainingRestMinutes === 1,
    "Exactly one minute should remain.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 5
 * REGULAR ROUTE — 11H00
 * --------------------------------------------------
 */
{
  const result = evaluate(
    "other-work",
    createRestartState({
      route: "regular-daily-rest",
      earliestLegalRestartTime: "2026-08-29T05:00:00.000Z",
      requiredCurrentRestMinutes: 11 * 60,
      elapsedCurrentRestMinutes: 11 * 60,
      remainingRestMinutes: 0,
      mayResumeWork: true,
      reducedRestAvailable: false,
      reducedRestsUsed: 3,
      reducedRestsRemaining: 0,
      reducedRestWillBeUsed: false,
    }),
  );

  assert(
    result.level === "allowed",
    "Other Work should be allowed after 11h regular daily rest.",
  );

  assert(
    result.endsProtectedRest === true,
    "Resuming Other Work should end the completed rest.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 6
 * SPLIT REGULAR — SECOND PART AT 8H59
 * --------------------------------------------------
 */
{
  const result = evaluate(
    "poa",
    createRestartState({
      route: "split-regular-daily-rest",
      elapsedCurrentRestMinutes: 8 * 60 + 59,
      remainingRestMinutes: 1,
      mayResumeWork: false,
      splitFirstPartAvailable: true,
      splitFirstPartMinutes: 3 * 60,
      reducedRestWillBeUsed: false,
    }),
  );

  assert(
    result.level === "blocked",
    "POA must be blocked at 8h59 of the second split-rest part.",
  );

  assert(
    result.mayChangeActivity === false,
    "The activity change must not proceed before 9h.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 7
 * SPLIT REGULAR — SECOND PART AT 9H00
 * --------------------------------------------------
 */
{
  const result = evaluate(
    "driving",
    createRestartState({
      route: "split-regular-daily-rest",
      elapsedCurrentRestMinutes: 9 * 60,
      remainingRestMinutes: 0,
      mayResumeWork: true,
      splitFirstPartAvailable: true,
      splitFirstPartMinutes: 3 * 60,
      reducedRestWillBeUsed: false,
    }),
  );

  assert(
    result.level === "allowed",
    "Driving should be allowed after the valid second 9-hour split-rest part.",
  );

  assert(
    result.endsProtectedRest === true,
    "Driving should end the completed split rest.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 8
 * 24H DEADLINE FAILURE
 * --------------------------------------------------
 */
{
  const result = evaluate(
    "driving",
    createRestartState({
      mayResumeWork: true,
      remainingRestMinutes: 0,
      restartWithinReferencePeriod: false,
      earliestLegalRestartTime: "2026-08-29T07:00:00.000Z",
      referenceDeadline: "2026-08-29T06:00:00.000Z",
    }),
  );

  assert(
    result.level === "blocked",
    "Restart must be blocked when the rest milestone falls after the reference deadline.",
  );

  assert(
    result.mayChangeActivity === false,
    "The activity change must not proceed after a failed deadline check.",
  );
}

/**
 * --------------------------------------------------
 * SCENARIO 9
 * ALL WORK-LIKE ACTIVITIES ARE GUARDED
 * --------------------------------------------------
 */
{
  const blockedState = createRestartState({
    mayResumeWork: false,
    remainingRestMinutes: 30,
  });

  const driving = evaluate("driving", blockedState);

  const otherWork = evaluate("other-work", blockedState);

  const poa = evaluate("poa", blockedState);

  assert(driving.level === "blocked", "Driving should be guarded.");

  assert(otherWork.level === "blocked", "Other Work should be guarded.");

  assert(poa.level === "blocked", "POA should be guarded.");
}
/**
 * --------------------------------------------------
 * SCENARIO 10
 * UNVERIFIED REFERENCE PERIOD
 * --------------------------------------------------
 */
{
  const result = evaluate(
    "driving",
    createRestartState({
      referenceStatus: "unverified",
      referenceStart: null,
      referenceDeadline: null,
      mayResumeWork: false,
      remainingRestMinutes: 0,
      restartWithinReferencePeriod: false,
      earliestLegalRestartTime: "2026-08-29T06:00:00.000Z",
    }),
  );

  assert(
    result.level === "blocked",
    "Restart must be blocked when the daily-rest reference period is unverified.",
  );

  assert(
    result.mayChangeActivity === false,
    "Driving must not be allowed when the reference period is unverified.",
  );

  assert(
    result.title === "Reference period unverified",
    "The guard should clearly distinguish an unverified reference period from a deadline failure.",
  );
}

console.log("✓ Legal rest resumption guard scenarios passed");
