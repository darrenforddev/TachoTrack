import { runWeeklyDriverHistoryStorageScenarios } from "./weeklyDriverHistoryStorageScenarios";

async function run() {
  console.log("========================================");

  console.log("TACHOTRACK WEEKLY DRIVER HISTORY STORAGE TESTS");

  console.log("========================================");

  try {
    const { results, summary } = await runWeeklyDriverHistoryStorageScenarios();

    for (const scenario of results) {
      console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

      console.log(`   ${scenario.details}`);

      console.log("----------------------------------------");
    }

    console.log(
      `WEEKLY DRIVER HISTORY STORAGE RESULT: ${summary.passed}/${
        summary.total
      } passed`,
    );

    console.log(
      summary.allPassed
        ? "✅ ALL WEEKLY DRIVER HISTORY STORAGE SCENARIOS PASSED"
        : "❌ SOME WEEKLY DRIVER HISTORY STORAGE SCENARIOS FAILED",
    );
  } catch (error) {
    console.error("❌ WEEKLY DRIVER HISTORY STORAGE TEST RUNNER FAILED", error);
  }

  console.log("========================================");
}

void run();
