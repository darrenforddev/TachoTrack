import {
    dailyRestScenarioResults,
    dailyRestScenarioSummary,
} from "./dailyRestScenarios";

console.log("========================================");

console.log("TACHOTRACK DAILY REST TESTS");

console.log("========================================");

for (const scenario of dailyRestScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `DAILY REST RESULT: ${dailyRestScenarioSummary.passed}/${
    dailyRestScenarioSummary.total
  } passed`,
);

console.log(
  dailyRestScenarioSummary.allPassed
    ? "✅ ALL DAILY REST SCENARIOS PASSED"
    : "❌ SOME DAILY REST SCENARIOS FAILED",
);

console.log("========================================");

export { dailyRestScenarioResults, dailyRestScenarioSummary };

