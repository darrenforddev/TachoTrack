import {
    restCompensationScenarioResults,
    restCompensationScenarioSummary,
} from "./restCompensationScenarios";

console.log("========================================");

console.log("TACHOTRACK WEEKLY REST COMPENSATION TESTS");

console.log("========================================");

for (const scenario of restCompensationScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `REST RESULT: ${restCompensationScenarioSummary.passed}/${
    restCompensationScenarioSummary.total
  } passed`,
);

console.log(
  restCompensationScenarioSummary.allPassed
    ? "✅ ALL REST COMPENSATION SCENARIOS PASSED"
    : "❌ SOME REST COMPENSATION SCENARIOS FAILED",
);

console.log("========================================");

export { restCompensationScenarioResults, restCompensationScenarioSummary };

