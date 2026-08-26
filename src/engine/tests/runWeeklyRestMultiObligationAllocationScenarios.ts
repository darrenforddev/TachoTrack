import {
    weeklyRestMultiObligationScenarioResults,
    weeklyRestMultiObligationScenarioSummary,
} from "./weeklyRestMultiObligationAllocationScenarios";

console.log("========================================");

console.log("TACHOTRACK MULTI-OBLIGATION ALLOCATION TESTS");

console.log("========================================");

for (const scenario of weeklyRestMultiObligationScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `MULTI ALLOCATION RESULT: ${
    weeklyRestMultiObligationScenarioSummary.passed
  }/${weeklyRestMultiObligationScenarioSummary.total} passed`,
);

console.log(
  weeklyRestMultiObligationScenarioSummary.allPassed
    ? "✅ ALL MULTI-OBLIGATION ALLOCATION SCENARIOS PASSED"
    : "❌ SOME MULTI-OBLIGATION ALLOCATION SCENARIOS FAILED",
);

console.log("========================================");

export {
    weeklyRestMultiObligationScenarioResults,
    weeklyRestMultiObligationScenarioSummary
};

