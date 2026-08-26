import {
    safetyMarginScenarioResults,
    safetyMarginScenarioSummary,
} from "./safetyMarginScenarios";

console.log("========================================");

console.log("TACHOTRACK SAFETY MARGIN TESTS");

console.log("========================================");

for (const scenario of safetyMarginScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `SAFETY RESULT: ${safetyMarginScenarioSummary.passed}/${
    safetyMarginScenarioSummary.total
  } passed`,
);

console.log(
  safetyMarginScenarioSummary.allPassed
    ? "✅ ALL SAFETY MARGIN SCENARIOS PASSED"
    : "❌ SOME SAFETY MARGIN SCENARIOS FAILED",
);

console.log("========================================");

export { safetyMarginScenarioResults, safetyMarginScenarioSummary };

