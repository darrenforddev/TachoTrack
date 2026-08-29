import {
    continuousDrivingStateScenarioResults,
    continuousDrivingStateScenarioSummary,
} from "./continuousDrivingStateScenarios";

console.log("========================================");

console.log("TACHOTRACK CONTINUOUS DRIVING STATE TESTS");

console.log("========================================");

for (const scenario of continuousDrivingStateScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `CONTINUOUS DRIVING STATE RESULT: ${
    continuousDrivingStateScenarioSummary.passed
  }/${continuousDrivingStateScenarioSummary.total} passed`,
);

console.log(
  continuousDrivingStateScenarioSummary.allPassed
    ? "✅ ALL CONTINUOUS DRIVING STATE SCENARIOS PASSED"
    : "❌ SOME CONTINUOUS DRIVING STATE SCENARIOS FAILED",
);

console.log("========================================");

export {
    continuousDrivingStateScenarioResults,
    continuousDrivingStateScenarioSummary
};

