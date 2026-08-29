import {
    liveContinuousDrivingScenarioResults,
    liveContinuousDrivingScenarioSummary,
} from "./liveContinuousDrivingScenarios";

console.log("========================================");

console.log("TACHOTRACK LIVE CONTINUOUS DRIVING TESTS");

console.log("========================================");

for (const scenario of liveContinuousDrivingScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `LIVE CONTINUOUS DRIVING RESULT: ${
    liveContinuousDrivingScenarioSummary.passed
  }/${liveContinuousDrivingScenarioSummary.total} passed`,
);

console.log(
  liveContinuousDrivingScenarioSummary.allPassed
    ? "✅ ALL LIVE CONTINUOUS DRIVING SCENARIOS PASSED"
    : "❌ SOME LIVE CONTINUOUS DRIVING SCENARIOS FAILED",
);

console.log("========================================");

export {
    liveContinuousDrivingScenarioResults,
    liveContinuousDrivingScenarioSummary
};

