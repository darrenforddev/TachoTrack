import {
    weeklyDrivingStateScenarioResults,
    weeklyDrivingStateScenarioSummary,
} from "./weeklyDrivingStateScenarios";

console.log("========================================");

console.log("TACHOTRACK WEEKLY DRIVING STATE TESTS");

console.log("========================================");

for (const scenario of weeklyDrivingStateScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `WEEKLY DRIVING STATE RESULT: ${weeklyDrivingStateScenarioSummary.passed}/${
    weeklyDrivingStateScenarioSummary.total
  } passed`,
);

console.log(
  weeklyDrivingStateScenarioSummary.allPassed
    ? "✅ ALL WEEKLY DRIVING STATE SCENARIOS PASSED"
    : "❌ SOME WEEKLY DRIVING STATE SCENARIOS FAILED",
);

console.log("========================================");

export { weeklyDrivingStateScenarioResults, weeklyDrivingStateScenarioSummary };

