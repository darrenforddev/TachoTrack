import {
    weeklyRestDeadlineScenarios,
    weeklyRestDeadlineSummary,
} from "./weeklyRestDeadlineScenarios";

console.log("========================================");

console.log("TACHOTRACK WEEKLY REST DEADLINE TESTS");

console.log("========================================");

for (const test of weeklyRestDeadlineScenarios) {
  console.log(`${test.passed ? "✅" : "❌"} ${test.name}`);

  console.log(`   Source:   ${test.sourceDate}`);

  console.log(`   Expected: ${test.expectedDueDate}`);

  console.log(`   Actual:   ${test.actualDueDate}`);

  console.log("----------------------------------------");
}

console.log(
  `DEADLINE RESULT: ${weeklyRestDeadlineSummary.passed}/${
    weeklyRestDeadlineSummary.total
  } passed`,
);

console.log(
  weeklyRestDeadlineSummary.allPassed
    ? "✅ ALL WEEKLY REST DEADLINE SCENARIOS PASSED"
    : "❌ SOME WEEKLY REST DEADLINE SCENARIOS FAILED",
);

console.log("========================================");

export { weeklyRestDeadlineScenarios, weeklyRestDeadlineSummary };

