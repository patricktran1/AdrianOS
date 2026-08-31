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
  // The world-portal story games: their answers feed misconception
  // clustering, so they must report what the child actually chose.
  "app/games/space-station-sigma/page.tsx",
  "app/games/mystery-temple/page.tsx",
  "app/games/cyber-city-five/page.tsx",
  "app/games/dino-time-rescue/page.tsx",
  "app/games/robot-rescue-city/page.tsx",
  "app/games/dino-dash-volcano-escape/page.tsx",
  "app/games/daily-adventure-remix/page.tsx",
];

/*
 * The kernel routes exist to give the learner model evidence from a second
 * interaction verb. That only works if every attempt they record carries the
 * mechanic and the canonical form of what the child made.
 */
const KERNEL_SOURCES = [
  "components/kernels/KernelPlayground.tsx",
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

for (const file of KERNEL_SOURCES) {
  const source = await read(file);
  if (!/mechanic: verb/.test(source)) {
    failures.push(`${file}: kernel attempts must carry their interaction mechanic`);
  }
  if (!/givenAnswer: judgement.canonicalAnswer/.test(source)) {
    failures.push(`${file}: kernel attempts must carry the canonical built answer`);
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
  ["MIN_MECHANIC_ATTEMPTS", "a minimum sample before a mechanic counts as secure"],
  ["collectMechanics", "cross-mechanic evidence collection"],
  ["findTransferCandidate", "the transfer routing decision"],
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
    // Split on ">{" and inspect each braced expression directly rather than
    // matching two unbounded classes around an alternation, which backtracks.
    if (/standardCode:/.test(line) || /standard:/.test(line)) continue;
    for (const segment of line.split(">{").slice(1)) {
      const close = segment.indexOf("}");
      if (close < 0) continue;
      const expression = segment.slice(0, close);
      if (expression.includes("{") || expression.includes("}")) continue;
      if (/\bstandardCode\b/.test(expression) || /\bstandard\b/.test(expression)) {
        childFacingCodes.push(`${entry.name}: >{${expression.trim().slice(0, 60)}}`);
      }
    }
  }
}
if (childFacingCodes.length) {
  console.error("Standards codes are rendered to children:");
  childFacingCodes.forEach((row) => console.error(`- ${row}`));
  process.exit(1);
}
console.log(`Child-facing standards audit passed across ${(await fs.readdir(gamesDir)).length} game folders.`);
