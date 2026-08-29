import { promises as fs } from "node:fs";
import path from "node:path";

/*
 * The learner model can only distinguish a slip from a misunderstanding if
 * games report what the child actually answered. Accuracy alone tells a
 * parent that something is wrong, never what.
 *
 * These are the games whose evidence drives the world's beacon and the
 * parent evidence panel; each must supply the child's own answer.
 */
const EVIDENCE_GAMES = [
  "app/games/math-blast/page.tsx",
  "app/games/number-quest/page.tsx",
  "app/games/math-motion-lab/page.tsx",
  "app/games/science-quest/page.tsx",
  "app/games/reading-lab/page.tsx",
  "app/games/pattern-master/page.tsx",
  "app/games/adaptive-boss-arena/page.tsx",
  "app/mastery-lab/page.tsx",
];

const root = process.cwd();
const failures = [];

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

for (const file of EVIDENCE_GAMES) {
  const source = await read(file);
  if (!source.includes("recordLearningAttempt")) {
    failures.push(`${file}: no learning evidence is recorded at all`);
    continue;
  }
  if (!/givenAnswer:/.test(source)) {
    failures.push(`${file}: does not report the child's own answer (givenAnswer)`);
  }
}

const model = await read("lib/adrian-learner-model.ts");
const evidence = await read("lib/adrian-evidence.ts");
const learning = await read("lib/adrian-learning.ts");

const modelContracts = [
  ["MIN_MISCONCEPTION_COUNT", "a repeated wrong answer threshold"],
  ["MIN_CONFIDENT_SAMPLE", "a minimum sample before the model leads"],
  ["function buildLearnerModel", "the model builder"],
  ["function recommendNextActivity", "the next-activity decision"],
  ["collectMisconceptions", "misconception clustering"],
];
for (const [needle, description] of modelContracts) {
  if (!model.includes(needle)) failures.push(`learner model: missing ${description}`);
}

// The model must never invent a recommendation from thin evidence.
if (!model.includes("if (!model.confident || model.skills.length === 0) return EXPLORE_ACTIVITY;")) {
  failures.push("learner model: thin evidence no longer falls back to exploring");
}

if (!evidence.includes("markQuestionShown") || !evidence.includes("takeResponseMs")) {
  failures.push("evidence: central response timing is missing");
}
if (!learning.includes("recordAttemptEvidence")) {
  failures.push("learning: attempts are no longer mirrored into the evidence log");
}

if (failures.length) {
  console.error("Learning evidence contract failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Learning evidence contract passed across ${EVIDENCE_GAMES.length} evidence-critical experiences.`
);

/*
 * Standards codes are a filing label for adults. Printed next to a question a
 * child is reading, they make a game read as coursework, and in Math Motion
 * Lab a labelled target literally gave away the answer. The codes stay in the
 * evidence record and on the parent surfaces; they must not be rendered to a
 * child.
 */
const gamesDir = path.join(root, "app", "games");
const CODE_IN_JSX = /\{[^{}]*\b(?:standardCode|\w+\.standard)\b[^{}]*\}\s*</;
const childFacingCodes = [];
async function gameSources() {
  const rows = [];
  for (const entry of await fs.readdir(gamesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = path.join(gamesDir, entry.name);
    for (const file of await fs.readdir(folder)) {
      // Several games split their UI into a sibling component, so auditing
      // page.tsx alone let child-facing codes slip through.
      if (!file.endsWith(".tsx")) continue;
      rows.push({
        game: entry.name,
        source: await fs.readFile(path.join(folder, file), "utf8"),
      });
    }
  }
  return rows;
}

for (const { game: gameName, source } of await gameSources()) {
  const entry = { name: gameName };
  for (const line of source.split("\n")) {
    // Only JSX text nodes matter; object properties that carry the code into
    // the evidence record are exactly what should be preserved.
    const rendered = line.match(/>\s*\{[^{}]*\b(?:standardCode|standard)\b[^{}]*\}/);
    if (rendered && !/standardCode:/.test(line) && !/standard:/.test(line)) {
      childFacingCodes.push(`${entry.name}: ${rendered[0].trim().slice(0, 60)}`);
    }
  }
}
if (childFacingCodes.length) {
  console.error("Standards codes are rendered to children:");
  childFacingCodes.forEach((row) => console.error(`- ${row}`));
  process.exit(1);
}
console.log(`Child-facing standards audit passed across ${(await fs.readdir(gamesDir)).length} game folders.`);
