import {
    activityHistoryAdapterScenarioResults,
    activityHistoryAdapterScenarioSummary,
} from "./activityHistoryAdapterScenarios";

console.log("========================================");

console.log("TACHOTRACK ACTIVITY HISTORY ADAPTER TESTS");

console.log("========================================");

for (const scenario of activityHistoryAdapterScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `ACTIVITY HISTORY ADAPTER RESULT: ${
    activityHistoryAdapterScenarioSummary.passed
  }/${activityHistoryAdapterScenarioSummary.total} passed`,
);

console.log(
  activityHistoryAdapterScenarioSummary.allPassed
    ? "✅ ALL ACTIVITY HISTORY ADAPTER SCENARIOS PASSED"
    : "❌ SOME ACTIVITY HISTORY ADAPTER SCENARIOS FAILED",
);

console.log("========================================");

export {
    activityHistoryAdapterScenarioResults,
    activityHistoryAdapterScenarioSummary
};

