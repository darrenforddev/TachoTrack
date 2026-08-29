import {
    extendedDrivingAllowanceStateScenarioResults,
    extendedDrivingAllowanceStateScenarioSummary,
} from "./extendedDrivingAllowanceStateScenarios";

console.log("========================================");

console.log("TACHOTRACK EXTENDED DRIVING ALLOWANCE TESTS");

console.log("========================================");

for (const scenario of extendedDrivingAllowanceStateScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `EXTENDED DRIVING ALLOWANCE RESULT: ${
    extendedDrivingAllowanceStateScenarioSummary.passed
  }/${extendedDrivingAllowanceStateScenarioSummary.total} passed`,
);

console.log(
  extendedDrivingAllowanceStateScenarioSummary.allPassed
    ? "✅ ALL EXTENDED DRIVING ALLOWANCE SCENARIOS PASSED"
    : "❌ SOME EXTENDED DRIVING ALLOWANCE SCENARIOS FAILED",
);

console.log("========================================");

export {
    extendedDrivingAllowanceStateScenarioResults,
    extendedDrivingAllowanceStateScenarioSummary
};

