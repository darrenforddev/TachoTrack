import {
    splitDailyRestScenarioResults,
    splitDailyRestScenarioSummary,
} from "./splitDailyRestScenarios";

console.log("========================================");

console.log("TACHOTRACK SPLIT DAILY REST TESTS");

console.log("========================================");

for (const scenario of splitDailyRestScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `SPLIT DAILY REST RESULT: ${splitDailyRestScenarioSummary.passed}/${
    splitDailyRestScenarioSummary.total
  } passed`,
);

console.log(
  splitDailyRestScenarioSummary.allPassed
    ? "✅ ALL SPLIT DAILY REST SCENARIOS PASSED"
    : "❌ SOME SPLIT DAILY REST SCENARIOS FAILED",
);

console.log("========================================");

export { splitDailyRestScenarioResults, splitDailyRestScenarioSummary };

