import {
    restResumptionScenarioResults,
    restResumptionScenarioSummary,
} from "./restResumptionScenarios";

console.log("========================================");

console.log("TACHOTRACK REST RESUMPTION GUARD TESTS");

console.log("========================================");

for (const scenario of restResumptionScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `RESUMPTION RESULT: ${restResumptionScenarioSummary.passed}/${
    restResumptionScenarioSummary.total
  } passed`,
);

console.log(
  restResumptionScenarioSummary.allPassed
    ? "✅ ALL REST RESUMPTION SCENARIOS PASSED"
    : "❌ SOME REST RESUMPTION SCENARIOS FAILED",
);

console.log("========================================");

export { restResumptionScenarioResults, restResumptionScenarioSummary };

