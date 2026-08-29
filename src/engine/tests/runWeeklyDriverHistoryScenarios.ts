import {
    weeklyDriverHistoryScenarioResults,
    weeklyDriverHistoryScenarioSummary,
} from "./weeklyDriverHistoryScenarios";

console.log("========================================");

console.log("TACHOTRACK WEEKLY DRIVER HISTORY TESTS");

console.log("========================================");

for (const scenario of weeklyDriverHistoryScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `WEEKLY DRIVER HISTORY RESULT: ${weeklyDriverHistoryScenarioSummary.passed}/${
    weeklyDriverHistoryScenarioSummary.total
  } passed`,
);

console.log(
  weeklyDriverHistoryScenarioSummary.allPassed
    ? "✅ ALL WEEKLY DRIVER HISTORY SCENARIOS PASSED"
    : "❌ SOME WEEKLY DRIVER HISTORY SCENARIOS FAILED",
);

console.log("========================================");

export {
    weeklyDriverHistoryScenarioResults,
    weeklyDriverHistoryScenarioSummary
};

