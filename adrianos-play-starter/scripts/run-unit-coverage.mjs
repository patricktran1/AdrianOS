import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const coverageDir = path.join(process.cwd(), "coverage");
const coveragePath = path.join(coverageDir, "unit-coverage.txt");
await fs.mkdir(coverageDir, { recursive: true });

const child = spawn(
  process.execPath,
  ["--experimental-test-coverage", "--test", "test/unit"],
  {
    cwd: process.cwd(),
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
console.log(`Coverage summary saved to ${path.relative(process.cwd(), coveragePath)}.`);
process.exitCode = exitCode;
