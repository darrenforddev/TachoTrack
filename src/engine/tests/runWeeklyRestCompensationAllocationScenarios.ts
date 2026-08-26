import {
    weeklyRestCompensationAllocationScenarioResults,
    weeklyRestCompensationAllocationScenarioSummary,
} from "./weeklyRestCompensationAllocationScenarios";

console.log("========================================");

console.log("TACHOTRACK COMPENSATION ALLOCATION TESTS");

console.log("========================================");

for (const scenario of weeklyRestCompensationAllocationScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `ALLOCATION RESULT: ${
    weeklyRestCompensationAllocationScenarioSummary.passed
  }/${weeklyRestCompensationAllocationScenarioSummary.total} passed`,
);

console.log(
  weeklyRestCompensationAllocationScenarioSummary.allPassed
    ? "✅ ALL COMPENSATION ALLOCATION SCENARIOS PASSED"
    : "❌ SOME COMPENSATION ALLOCATION SCENARIOS FAILED",
);

console.log("========================================");

export {
    weeklyRestCompensationAllocationScenarioResults,
    weeklyRestCompensationAllocationScenarioSummary
};

