import {
    reducedDailyRestHistoryScenarioResults,
    reducedDailyRestHistoryScenarioSummary,
} from "./reducedDailyRestHistoryScenarios";

console.log("========================================");

console.log("TACHOTRACK REDUCED DAILY REST HISTORY TESTS");

console.log("========================================");

for (const scenario of reducedDailyRestHistoryScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `REDUCED REST HISTORY RESULT: ${
    reducedDailyRestHistoryScenarioSummary.passed
  }/${reducedDailyRestHistoryScenarioSummary.total} passed`,
);

console.log(
  reducedDailyRestHistoryScenarioSummary.allPassed
    ? "✅ ALL REDUCED DAILY REST HISTORY SCENARIOS PASSED"
    : "❌ SOME REDUCED DAILY REST HISTORY SCENARIOS FAILED",
);

console.log("========================================");

export {
    reducedDailyRestHistoryScenarioResults,
    reducedDailyRestHistoryScenarioSummary
};

