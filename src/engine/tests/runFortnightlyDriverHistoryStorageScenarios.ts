import { runFortnightlyDriverHistoryStorageScenarios } from "./fortnightlyDriverHistoryStorageScenarios";

async function run() {
  console.log("========================================");

  console.log("TACHOTRACK FORTNIGHTLY DRIVER HISTORY STORAGE TESTS");

  console.log("========================================");

  const { results, summary } =
    await runFortnightlyDriverHistoryStorageScenarios();

  for (const scenario of results) {
    console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

    console.log(`   ${scenario.details}`);

    console.log("----------------------------------------");
  }

  console.log(
    `FORTNIGHTLY DRIVER HISTORY STORAGE RESULT: ${summary.passed}/${summary.total} passed`,
  );

  console.log(
    summary.allPassed
      ? "✅ ALL FORTNIGHTLY DRIVER HISTORY STORAGE SCENARIOS PASSED"
      : "❌ SOME FORTNIGHTLY DRIVER HISTORY STORAGE SCENARIOS FAILED",
  );

  console.log("========================================");
}

void run();
