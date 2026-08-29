import {
    fortnightlyDriverHistoryScenarioResults,
    fortnightlyDriverHistoryScenarioSummary,
} from "./fortnightlyDriverHistoryScenarios";

console.log("========================================");

console.log("TACHOTRACK FORTNIGHTLY DRIVER HISTORY TESTS");

console.log("========================================");

for (const scenario of fortnightlyDriverHistoryScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `FORTNIGHTLY DRIVER HISTORY RESULT: ${
    fortnightlyDriverHistoryScenarioSummary.passed
  }/${fortnightlyDriverHistoryScenarioSummary.total} passed`,
);

console.log(
  fortnightlyDriverHistoryScenarioSummary.allPassed
    ? "✅ ALL FORTNIGHTLY DRIVER HISTORY SCENARIOS PASSED"
    : "❌ SOME FORTNIGHTLY DRIVER HISTORY SCENARIOS FAILED",
);

console.log("========================================");

export {
    fortnightlyDriverHistoryScenarioResults,
    fortnightlyDriverHistoryScenarioSummary
};

