import type { RestSession } from "../../data/restSession";

import { buildComplianceNetworkMap } from "../complianceNetworkMap";
import { buildRestComplianceNetworkEvidence } from "../restComplianceNetworkEvidence";

interface ScenarioResult {
  name: string;
  passed: boolean;
  details: string;
}

function result(
  name: string,
  passed: boolean,
  details: string,
): ScenarioResult {
  return {
    name,
    passed,
    details,
  };
}

function restSession(overrides: Partial<RestSession> = {}): RestSession {
  return {
    id: "overnight-daily-rest",
    type: "daily",
    startedAt: "2026-09-01T21:00:00.000Z",
    endedAt: null,
    durationMilliseconds: null,
    status: "active",
    ...overrides,
  };
}

const scenarios: ScenarioResult[] = [];

const activeDailyRest = restSession();

const protectedEvidence = buildRestComplianceNetworkEvidence({
  session: activeDailyRest,
  baseRestMinutes: 11 * 60,
  currentDateTime: "2026-09-02T05:00:00.000Z",
});

const protectedTimer = protectedEvidence.timers?.[0];

scenarios.push(
  result(
    "Active overnight rest creates a protected live timer",
    protectedTimer?.state === "protected" &&
      protectedTimer.elapsedMinutes === 8 * 60 &&
      protectedTimer.remainingToLegalMinutes === 3 * 60,
    `State: ${protectedTimer?.state}, elapsed: ${protectedTimer?.elapsedMinutes}, remaining: ${protectedTimer?.remainingToLegalMinutes}`,
  ),
);

scenarios.push(
  result(
    "Regular daily rest exposes legal and recommended resume times",
    protectedTimer?.legalCompleteAt === "2026-09-02T08:00:00.000Z" &&
      protectedTimer.recommendedResumeAt === "2026-09-02T08:05:00.000Z" &&
      protectedTimer.remainingToRecommendedMinutes === 185,
    `Legal: ${protectedTimer?.legalCompleteAt}, recommended: ${protectedTimer?.recommendedResumeAt}`,
  ),
);

scenarios.push(
  result(
    "Daily rest evidence travels on the daily-rest line",
    protectedEvidence.lineIds.length === 1 &&
      protectedEvidence.lineIds[0] === "daily-rest" &&
      protectedEvidence.severity === "info",
    `Lines: ${protectedEvidence.lineIds.join(", ")}, severity: ${protectedEvidence.severity}`,
  ),
);

const dayMap = buildComplianceNetworkMap({
  id: "overnight-rest-map",
  scale: "day",
  startAt: "2026-09-01T18:00:00.000Z",
  endAt: "2026-09-02T10:00:00.000Z",
  events: [protectedEvidence],
  now: "2026-09-02T05:00:00.000Z",
});

scenarios.push(
  result(
    "The rest timer reaches its map station unchanged",
    dayMap.stations.length === 1 &&
      dayMap.stations[0]?.timers.length === 1 &&
      dayMap.stations[0]?.timers[0]?.id === protectedTimer?.id,
    `Station timers: ${dayMap.stations[0]?.timers.length ?? 0}`,
  ),
);

const legalCompletionEvidence = buildRestComplianceNetworkEvidence({
  session: activeDailyRest,
  baseRestMinutes: 11 * 60,
  currentDateTime: "2026-09-02T08:00:00.000Z",
});

const legalCompletionTimer = legalCompletionEvidence.timers?.[0];

scenarios.push(
  result(
    "Exact legal completion enters the safety buffer",
    legalCompletionTimer?.state === "safety-buffer" &&
      legalCompletionTimer.legallyComplete &&
      !legalCompletionTimer.recommendedResumeReached &&
      legalCompletionTimer.remainingToRecommendedMinutes === 5,
    `State: ${legalCompletionTimer?.state}, safety remaining: ${legalCompletionTimer?.remainingToRecommendedMinutes}`,
  ),
);

const safeResumeEvidence = buildRestComplianceNetworkEvidence({
  session: activeDailyRest,
  baseRestMinutes: 11 * 60,
  currentDateTime: "2026-09-02T08:05:00.000Z",
});

const safeResumeTimer = safeResumeEvidence.timers?.[0];

scenarios.push(
  result(
    "Recommended resume time clears the overnight station",
    safeResumeTimer?.state === "cleared" &&
      safeResumeTimer.legallyComplete &&
      safeResumeTimer.recommendedResumeReached &&
      safeResumeEvidence.severity === "good",
    `State: ${safeResumeTimer?.state}, severity: ${safeResumeEvidence.severity}`,
  ),
);

const compensatedWeeklyRest = restSession({
  id: "compensated-weekly-rest",
  type: "weekly",
  startedAt: "2026-09-18T18:00:00.000Z",
});

const compensatedEvidence = buildRestComplianceNetworkEvidence({
  session: compensatedWeeklyRest,
  baseRestMinutes: 45 * 60,
  compensationMinutes: 21 * 60,
  currentDateTime: "2026-09-21T06:00:00.000Z",
});

const compensatedTimer = compensatedEvidence.timers?.[0];

scenarios.push(
  result(
    "Compensated weekly rest creates the full 66-hour timer",
    compensatedTimer?.totalRequiredMinutes === 66 * 60 &&
      compensatedTimer.legalCompleteAt === "2026-09-21T12:00:00.000Z",
    `Required: ${compensatedTimer?.totalRequiredMinutes}, completes: ${compensatedTimer?.legalCompleteAt}`,
  ),
);

scenarios.push(
  result(
    "Compensated weekly rest forms a map interchange",
    compensatedEvidence.lineIds.includes("weekly-rest") &&
      compensatedEvidence.lineIds.includes("compensation") &&
      compensatedEvidence.lineIds.length === 2,
    `Lines: ${compensatedEvidence.lineIds.join(", ")}`,
  ),
);

const interruptedRest = restSession({
  id: "interrupted-daily-rest",
  endedAt: "2026-09-02T05:00:00.000Z",
  durationMilliseconds: 8 * 60 * 60 * 1000,
  status: "interrupted",
});

const interruptedEvidence = buildRestComplianceNetworkEvidence({
  session: interruptedRest,
  baseRestMinutes: 9 * 60,
  currentDateTime: "2026-09-02T09:00:00.000Z",
});

const interruptedTimer = interruptedEvidence.timers?.[0];

scenarios.push(
  result(
    "Interrupted rest freezes at its actual end time",
    interruptedTimer?.state === "interrupted" &&
      interruptedTimer.elapsedMinutes === 8 * 60 &&
      interruptedTimer.remainingToLegalMinutes === 60 &&
      interruptedEvidence.severity === "breach",
    `State: ${interruptedTimer?.state}, missing: ${interruptedTimer?.remainingToLegalMinutes}`,
  ),
);

const exactCompletedRest = restSession({
  id: "exact-completed-rest",
  endedAt: "2026-09-02T06:00:00.000Z",
  durationMilliseconds: 9 * 60 * 60 * 1000,
  status: "completed",
});

const exactCompletedEvidence = buildRestComplianceNetworkEvidence({
  session: exactCompletedRest,
  baseRestMinutes: 9 * 60,
  currentDateTime: "2026-09-02T09:00:00.000Z",
});

const exactCompletedTimer = exactCompletedEvidence.timers?.[0];

scenarios.push(
  result(
    "Exact legal rest completion still preserves the safety buffer",
    exactCompletedTimer?.state === "safety-buffer" &&
      exactCompletedTimer.legallyComplete &&
      exactCompletedTimer.remainingToRecommendedMinutes === 5,
    `State: ${exactCompletedTimer?.state}, safety remaining: ${exactCompletedTimer?.remainingToRecommendedMinutes}`,
  ),
);

const customSafetyEvidence = buildRestComplianceNetworkEvidence({
  session: activeDailyRest,
  baseRestMinutes: 11 * 60,
  currentDateTime: "2026-09-02T08:00:00.000Z",
  safetySettings: {
    legalSafetyMarginMinutes: 2,
    planningWarningMinutes: 20,
  },
});

const customSafetyTimer = customSafetyEvidence.timers?.[0];

scenarios.push(
  result(
    "Configured two-minute rest safety margin reaches the timer",
    customSafetyTimer?.recommendedResumeAt === "2026-09-02T08:02:00.000Z" &&
      customSafetyTimer.remainingToRecommendedMinutes === 2,
    `Recommended: ${customSafetyTimer?.recommendedResumeAt}`,
  ),
);

let invalidTargetRejected = false;

try {
  buildRestComplianceNetworkEvidence({
    session: activeDailyRest,
    baseRestMinutes: -1,
    currentDateTime: "2026-09-02T05:00:00.000Z",
  });
} catch {
  invalidTargetRejected = true;
}

scenarios.push(
  result(
    "Invalid rest targets are rejected",
    invalidTargetRejected,
    `Rejected: ${String(invalidTargetRejected)}`,
  ),
);

const passed = scenarios.filter((scenario) => scenario.passed).length;
const failed = scenarios.length - passed;

console.log("============================================================");
console.log("TACHOTRACK REST COMPLIANCE NETWORK EVIDENCE TESTS");
console.log("============================================================");

for (const scenario of scenarios) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);
  console.log(`   ${scenario.details}`);
  console.log("----------------------------------------");
}

console.log(
  `REST COMPLIANCE NETWORK EVIDENCE RESULT: ${passed}/${scenarios.length} passed`,
);

if (failed > 0) {
  console.log("❌ SOME REST COMPLIANCE NETWORK EVIDENCE SCENARIOS FAILED");

  throw new Error(`${failed} rest compliance-network scenarios failed.`);
}

console.log("✅ ALL REST COMPLIANCE NETWORK EVIDENCE SCENARIOS PASSED");
console.log("============================================================");
