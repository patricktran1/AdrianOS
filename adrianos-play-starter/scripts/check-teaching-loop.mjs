import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

async function source(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

const layout = await source("app/layout.tsx");
const shellCss = await source("app/mobile-app-shell.css");
const feedback = await source("components/BetaFeedbackLauncher.tsx");
const math = await source("app/games/math-blast/page.tsx");
const science = await source("app/games/science-quest/page.tsx");
const teaching = await source("lib/adrian-teaching-loop.ts");

if (!layout.includes("<MobileAppDock />")) failures.push("layout: mobile navigation dock is not mounted");
if (!shellCss.includes("safe-area-inset-top") || !shellCss.includes("safe-area-inset-bottom")) {
  failures.push("mobile shell: iPhone safe-area insets are missing");
}
if (!shellCss.includes(".mobile-app-dock") || !shellCss.includes(".beta-feedback-actions")) {
  failures.push("mobile shell: reachable navigation or feedback action styles are missing");
}
if (!feedback.includes("Sign in or connect family") || !feedback.includes("beta-feedback-signin-button") || !feedback.includes("beta-feedback-actions")) {
  failures.push("feedback: no visible action is guaranteed for signed-out parents");
}

for (const [name, game] of [["Math Blast", math], ["Science Quest", science]]) {
  if (!game.includes("@/lib/adrian-teaching-loop")) failures.push(`${name}: shared teaching loop is not imported`);
  if (!game.includes("Show a hint") && !game.includes("Show a clue")) failures.push(`${name}: child-facing support control is missing`);
  if (!game.includes("responseQualityLabel")) failures.push(`${name}: supported versus independent solves are not distinguished`);
  if (!game.includes("recordLearningAttempt")) failures.push(`${name}: teaching responses do not feed mastery evidence`);
}

for (const contract of ["classifyResponse", "responsePoints", "nextAdaptiveDifficulty", "arithmeticTeachingSupport", "scienceTopicHint"]) {
  if (!teaching.includes(`function ${contract}`)) failures.push(`teaching loop: missing ${contract}`);
}

if (failures.length) {
  console.error("Teaching loop and installed-app contract failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Teaching loop and installed-app contract passed.");
