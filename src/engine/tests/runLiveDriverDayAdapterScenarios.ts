import {
    liveDriverDayAdapterScenarioResults,
    liveDriverDayAdapterScenarioSummary,
} from "./liveDriverDayAdapterScenarios";

console.log("========================================");

console.log("TACHOTRACK LIVE DRIVER DAY ADAPTER TESTS");

console.log("========================================");

for (const scenario of liveDriverDayAdapterScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `LIVE DRIVER DAY ADAPTER RESULT: ${
    liveDriverDayAdapterScenarioSummary.passed
  }/${liveDriverDayAdapterScenarioSummary.total} passed`,
);

console.log(
  liveDriverDayAdapterScenarioSummary.allPassed
    ? "✅ ALL LIVE DRIVER DAY ADAPTER SCENARIOS PASSED"
    : "❌ SOME LIVE DRIVER DAY ADAPTER SCENARIOS FAILED",
);

console.log("========================================");

export {
    liveDriverDayAdapterScenarioResults,
    liveDriverDayAdapterScenarioSummary
};

