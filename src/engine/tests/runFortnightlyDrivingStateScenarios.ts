import {
    fortnightlyDrivingStateScenarioResults,
    fortnightlyDrivingStateScenarioSummary,
} from "./fortnightlyDrivingStateScenarios";

console.log("========================================");

console.log("TACHOTRACK FORTNIGHTLY DRIVING STATE TESTS");

console.log("========================================");

for (const scenario of fortnightlyDrivingStateScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `FORTNIGHTLY DRIVING STATE RESULT: ${
    fortnightlyDrivingStateScenarioSummary.passed
  }/${fortnightlyDrivingStateScenarioSummary.total} passed`,
);

console.log(
  fortnightlyDrivingStateScenarioSummary.allPassed
    ? "✅ ALL FORTNIGHTLY DRIVING STATE SCENARIOS PASSED"
    : "❌ SOME FORTNIGHTLY DRIVING STATE SCENARIOS FAILED",
);

console.log("========================================");

export {
    fortnightlyDrivingStateScenarioResults,
    fortnightlyDrivingStateScenarioSummary
};

