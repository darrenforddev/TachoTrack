import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

const projectRoot = path.resolve(scriptDirectory, "..");

const testsDirectory = path.join(projectRoot, "src", "engine", "tests");

const nodeEnvironmentPath = path.join(
  scriptDirectory,
  "scenario-node-environment.mjs",
);

let tsxImportUrl;

try {
  tsxImportUrl = pathToFileURL(require.resolve("tsx")).href;
} catch {
  console.error(
    "Scenario runner requires tsx. Run: npm install --save-dev tsx",
  );

  process.exit(1);
}

const suiteFileNames = readdirSync(testsDirectory, {
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && /^run.+Scenarios\.ts$/.test(entry.name))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

if (suiteFileNames.length === 0) {
  console.error("No TachoTrack scenario runners were found.");

  process.exit(1);
}

const results = [];

console.log("============================================================");
console.log("TACHOTRACK WHOLE-SYSTEM SCENARIO RUNNER");
console.log("============================================================");
console.log(`Suites discovered: ${suiteFileNames.length}`);
console.log("Each suite runs in an isolated process.");
console.log("============================================================");

for (const [index, suiteFileName] of suiteFileNames.entries()) {
  const suitePath = path.join(testsDirectory, suiteFileName);

  const startedAt = Date.now();

  console.log("");
  console.log(`[${index + 1}/${suiteFileNames.length}] RUN ${suiteFileName}`);
  console.log("------------------------------------------------------------");

  const execution = spawnSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(nodeEnvironmentPath).href,
      "--import",
      tsxImportUrl,
      suitePath,
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
      env: process.env,
    },
  );

  const standardOutput = execution.stdout ?? "";
  const errorOutput = execution.stderr ?? "";

  if (standardOutput.length > 0) {
    process.stdout.write(standardOutput);
  }

  if (errorOutput.length > 0) {
    process.stderr.write(errorOutput);
  }

  const combinedOutput = `${standardOutput}\n${errorOutput}`;

  const reportedScenarioFailure =
    /❌/u.test(combinedOutput) ||
    /SOME[^\r\n]*SCENARIOS FAILED/iu.test(combinedOutput) ||
    /FAILED:\s*[1-9]\d*/u.test(combinedOutput);

  const durationMilliseconds = Date.now() - startedAt;

  const passed =
    execution.error === undefined &&
    execution.status === 0 &&
    !reportedScenarioFailure;

  results.push({
    suiteFileName,
    passed,
    durationMilliseconds,
  });

  if (passed) {
    console.log(`PASS ${suiteFileName} (${durationMilliseconds}ms)`);
  } else {
    console.error(`FAIL ${suiteFileName} (${durationMilliseconds}ms)`);

    if (execution.error !== undefined) {
      console.error(execution.error.message);
    } else if (execution.status !== 0) {
      console.error(`Suite exited with code ${execution.status ?? "unknown"}.`);
    } else if (reportedScenarioFailure) {
      console.error(
        "Suite reported failed scenarios but returned exit code 0.",
      );
    }
  }
}

const passedSuites = results.filter((result) => result.passed);

const failedSuites = results.filter((result) => !result.passed);

const totalDurationMilliseconds = results.reduce(
  (total, result) => total + result.durationMilliseconds,
  0,
);

console.log("");
console.log("============================================================");
console.log("TACHOTRACK WHOLE-SYSTEM RESULT");
console.log("============================================================");
console.log(`Total suites:  ${results.length}`);
console.log(`Passed suites: ${passedSuites.length}`);
console.log(`Failed suites: ${failedSuites.length}`);
console.log(`Duration:      ${(totalDurationMilliseconds / 1000).toFixed(2)}s`);

if (failedSuites.length > 0) {
  console.log("");
  console.log("FAILED SUITES:");

  for (const failedSuite of failedSuites) {
    console.log(`- ${failedSuite.suiteFileName}`);
  }

  console.log("============================================================");
  console.error("TACHOTRACK WHOLE-SYSTEM SCENARIOS FAILED");

  process.exitCode = 1;
} else {
  console.log("============================================================");
  console.log("ALL TACHOTRACK WHOLE-SYSTEM SCENARIOS PASSED");

  process.exitCode = 0;
}
