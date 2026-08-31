import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const coverageDir = path.join(root, "coverage");
const coveragePath = path.join(coverageDir, "unit-coverage.txt");
const unitTestDir = path.join(root, "test", "unit");

await fs.mkdir(coverageDir, { recursive: true });
const testFiles = (await fs.readdir(unitTestDir))
  .filter((file) => file.endsWith(".test.mjs"))
  .sort()
  .map((file) => path.join("test", "unit", file));

if (testFiles.length === 0) {
  throw new Error("No unit test files were found.");
}

/*
 * Node applies coverage thresholds across every included file at once, so the
 * catalog helpers and the adaptive learning core are measured in separate
 * passes. Each gate reflects what that code can realistically hold: the
 * catalog is fully covered, while the learner model keeps defensive branches
 * for corrupt storage that tests should not have to enumerate exhaustively.
 */
const passes = [
  {
    label: "Game catalog",
    include: ["scripts/lib/game-catalog.mjs"],
    lines: 100,
    functions: 100,
    branches: 95,
  },
  {
    label: "Adaptive learning core",
    include: ["lib/adrian-learner-model.ts", "lib/adrian-world-map.ts"],
    lines: 97,
    functions: 92,
    branches: 86,
  },
  {
    label: "Interaction kernels",
    include: [
      "lib/kernels/kernel-tasks.ts",
      "lib/kernels/kernel-registry.ts",
      "lib/kernels/kernel-adaptation.ts",
      "lib/learning/error-signatures.ts",
    ],
    lines: 97,
    functions: 92,
    branches: 86,
  },
];

async function runPass(pass) {
  const child = spawn(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-test-coverage",
      ...pass.include.map((file) => `--test-coverage-include=${file}`),
      `--test-coverage-lines=${pass.lines}`,
      `--test-coverage-functions=${pass.functions}`,
      `--test-coverage-branches=${pass.branches}`,
      "--test",
      ...testFiles,
    ],
    {
      cwd: root,
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    },
  );

  let output = `\n===== ${pass.label} =====\n`;
  process.stdout.write(output);

  child.stdout.on("data", (chunk) => {
    output += chunk;
    process.stdout.write(chunk);
  });

  child.stderr.on("data", (chunk) => {
    output += chunk;
    process.stderr.write(chunk);
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });

  return { output, exitCode };
}

let combined = "";
let failed = 0;
for (const pass of passes) {
  const result = await runPass(pass);
  combined += result.output;
  if (result.exitCode !== 0) failed = result.exitCode;
}

await fs.writeFile(coveragePath, combined, "utf8");
console.log(`Coverage summary saved to ${path.relative(root, coveragePath)}.`);
process.exitCode = failed;
