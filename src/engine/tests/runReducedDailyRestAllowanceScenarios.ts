import { runReducedDailyRestAllowanceScenarios } from "./reducedDailyRestAllowanceScenarios";

async function run() {
  console.log("========================================");

  console.log("TACHOTRACK REDUCED DAILY REST ALLOWANCE TESTS");

  console.log("========================================");

  try {
    const { results, summary } = await runReducedDailyRestAllowanceScenarios();

    for (const scenario of results) {
      console.log(`${scenario.passed ? "✅" : "❌"} ${scenario.name}`);

      console.log(`   ${scenario.details}`);

      console.log("----------------------------------------");
    }

    console.log(
      `REDUCED DAILY REST ALLOWANCE RESULT: ` +
        `${summary.passed}/${summary.total} passed`,
    );

    console.log(
      summary.allPassed
        ? "✅ ALL REDUCED DAILY REST ALLOWANCE SCENARIOS PASSED"
        : "❌ SOME REDUCED DAILY REST ALLOWANCE SCENARIOS FAILED",
    );
  } catch (error) {
    console.error("❌ REDUCED DAILY REST ALLOWANCE TEST RUNNER FAILED", error);
  }

  console.log("========================================");
}

void run();
