import {
    calendarComplianceEventScenarioResults,
    calendarComplianceEventScenarioSummary,
} from "./calendarComplianceEventsScenarios";

console.log("========================================");

console.log("TACHOTRACK CALENDAR COMPLIANCE EVENT TESTS");

console.log("========================================");

for (const scenario of calendarComplianceEventScenarioResults) {
  console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

  console.log(`   ${scenario.details}`);

  console.log("----------------------------------------");
}

console.log(
  `CALENDAR EVENT RESULT: ${calendarComplianceEventScenarioSummary.passed}/${
    calendarComplianceEventScenarioSummary.total
  } passed`,
);

console.log(
  calendarComplianceEventScenarioSummary.allPassed
    ? "✅ ALL CALENDAR COMPLIANCE EVENT SCENARIOS PASSED"
    : "❌ SOME CALENDAR COMPLIANCE EVENT SCENARIOS FAILED",
);

console.log("========================================");

export {
    calendarComplianceEventScenarioResults,
    calendarComplianceEventScenarioSummary
};

