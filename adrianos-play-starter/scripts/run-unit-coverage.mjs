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

const child = spawn(
  process.execPath,
  ["--experimental-test-coverage", "--test", ...testFiles],
  {
    cwd: root,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  },
);

let output = "";

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

await fs.writeFile(coveragePath, output, "utf8");
console.log(`Coverage summary saved to ${path.relative(root, coveragePath)}.`);
process.exitCode = exitCode;
