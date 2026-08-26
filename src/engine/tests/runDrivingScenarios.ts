import {
    drivingScenarioResults,
    drivingScenarioSummary,
} from "./drivingScenarios";

console.log("========================================");

console.log("TACHOTRACK DRIVING SCENARIO TESTS");

console.log("========================================");

for (const scenario of drivingScenarioResults) {
  const symbol = scenario.passed ? "✅" : "❌";

  console.log(`${symbol} ${scenario.name}`);

  console.log(`   Expected: ${scenario.expectedLevel}`);

  console.log(`   Actual:   ${scenario.actualLevel}`);

  console.log(`   Issues:   ${scenario.issueCount}`);

  if (scenario.details) {
    console.log(`   Note:     ${scenario.details}`);
  }

  console.log("----------------------------------------");
}

console.log(
  `RESULT: ${drivingScenarioSummary.passed}/${drivingScenarioSummary.total} passed`,
);

console.log(`FAILED: ${drivingScenarioSummary.failed}`);

console.log(
  drivingScenarioSummary.allPassed
    ? "✅ ALL DRIVING SCENARIOS PASSED"
    : "❌ SOME DRIVING SCENARIOS FAILED",
);

console.log("========================================");

export { drivingScenarioResults, drivingScenarioSummary };

