import {
    dailyDrivingStateScenarioResults,
    dailyDrivingStateScenarioSummary,
} from "./dailyDrivingStateScenarios";

console.log("========================================");

console.log("TACHOTRACK DAILY DRIVING STATE TESTS");

console.log("========================================");

for (const scenario of dailyDrivingStateScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `DAILY DRIVING STATE RESULT: ${dailyDrivingStateScenarioSummary.passed}/${
    dailyDrivingStateScenarioSummary.total
  } passed`,
);

console.log(
  dailyDrivingStateScenarioSummary.allPassed
    ? "✅ ALL DAILY DRIVING STATE SCENARIOS PASSED"
    : "❌ SOME DAILY DRIVING STATE SCENARIOS FAILED",
);

console.log("========================================");

export { dailyDrivingStateScenarioResults, dailyDrivingStateScenarioSummary };

