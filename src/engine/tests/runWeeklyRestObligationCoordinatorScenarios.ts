import {
    weeklyRestCoordinatorScenarioResults,
    weeklyRestCoordinatorScenarioSummary,
} from "./weeklyRestObligationCoordinatorScenarios";

console.log("========================================");

console.log("TACHOTRACK WEEKLY REST COORDINATOR TESTS");

console.log("========================================");

for (const scenario of weeklyRestCoordinatorScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `COORDINATOR RESULT: ${weeklyRestCoordinatorScenarioSummary.passed}/${
    weeklyRestCoordinatorScenarioSummary.total
  } passed`,
);

console.log(
  weeklyRestCoordinatorScenarioSummary.allPassed
    ? "✅ ALL WEEKLY REST COORDINATOR SCENARIOS PASSED"
    : "❌ SOME WEEKLY REST COORDINATOR SCENARIOS FAILED",
);

console.log("========================================");

export {
    weeklyRestCoordinatorScenarioResults,
    weeklyRestCoordinatorScenarioSummary
};

