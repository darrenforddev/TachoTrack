import {
    weeklyRestHistoryScenarioResults,
    weeklyRestHistoryScenarioSummary,
} from "./weeklyRestHistoryScenarios";

console.log("========================================");

console.log("TACHOTRACK WEEKLY REST HISTORY TESTS");

console.log("========================================");

for (const scenario of weeklyRestHistoryScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `WEEKLY REST HISTORY RESULT: ${weeklyRestHistoryScenarioSummary.passed}/${
    weeklyRestHistoryScenarioSummary.total
  } passed`,
);

console.log(
  weeklyRestHistoryScenarioSummary.allPassed
    ? "✅ ALL WEEKLY REST HISTORY SCENARIOS PASSED"
    : "❌ SOME WEEKLY REST HISTORY SCENARIOS FAILED",
);

console.log("========================================");

export { weeklyRestHistoryScenarioResults, weeklyRestHistoryScenarioSummary };

