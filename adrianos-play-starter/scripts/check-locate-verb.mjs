import { promises as fs } from "node:fs";
import path from "node:path";

/*
 * Architectural contracts for LOCATE.
 *
 * The verb exists for one reason: a comprehension question with three options
 * cannot tell a child who read the sentence from a child who guessed, and
 * Reading Lab was already asking children to "use the passage as evidence"
 * with no way to see whether they did. Everything below protects that, and
 * the properties that make the marking itself worth trusting.
 *
 * They are string checks. Crude, but they fail loudly and they name the
 * promise rather than the implementation.
 */

const root = process.cwd();
const failures = [];

async function source(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

const tasks = await source("lib/kernels/locate-tasks.ts");
const evidence = await source("lib/learning/locate-evidence.ts");
const registry = await source("lib/kernels/kernel-registry.ts");
const playground = await source("components/kernels/LocatePlayground.tsx");
const signatures = await source("lib/learning/error-signatures.ts");
const bank = await source("lib/adrian-reading-bank.ts");

function require(condition, message) {
  if (!condition) failures.push(message);
}

/* One engine, one surface, one route. */
require(
  tasks.includes("export function buildLocateRun"),
  "there must be exactly one place a locate run is built"
);
require(
  playground.includes('const GAME_SLUG = "spyglass-bay"'),
  "the locate surface must record against its own game slug"
);
require(
  registry.includes('slug: "spyglass-bay"') && registry.includes('["locate", "evidence"]'),
  "the registry must know where LOCATE lives and what kind of thinking it is"
);

/* The passage is the point: it is never reordered and never hidden. */
require(
  !tasks.includes("seededShuffle(sentences") && !playground.includes("sentences.sort"),
  "a passage must be shown in reading order — reordering it makes this sequencing"
);

/* Anti-gaming: the two ways this verb could be reduced to multiple choice. */
require(
  playground.includes("marked.length > 0"),
  "answering must require at least one marked sentence, or picking is still free"
);
require(
  evidence.includes("export function isSweep"),
  "marking the whole passage must be distinguishable from finding the part"
);
require(
  evidence.includes("isSweep(input.task, input.trace)")
  || evidence.includes("!isSweep("),
  "a swept passage must not count as a supported answer"
);

/* Evidence stays observational, and never records the child's own text. */
for (const signature of [
  "reading.answered-without-evidence",
  "reading.evidence-found-but-misread",
  "reading.looked-in-another-part",
  "reading.marked-the-whole-passage",
]) {
  require(
    signatures.includes(`"${signature}"`),
    `the signature ${signature} must stay in the shared vocabulary`
  );
}
require(
  !playground.includes("markedIds: marked.join") && playground.includes("marked: marked.length"),
  "only how many sentences were marked may be stored, never which ones"
);

/* The authored evidence cannot go missing without the build noticing. */
require(
  bank.includes("supports: number[]"),
  "every reading question must be required to name the sentences that support it"
);
// Questions only: the skill-id map uses the same shape without a `skill` key.
const questions = (bank.match(/\{ id: "[a-z]+", skill: "/g) ?? []).length;
const supported = (bank.match(/supports: \[/g) ?? []).length;
require(
  questions > 0 && questions === supported,
  `every question must name its supporting sentences (${supported}/${questions})`
);

/* Nothing adult reaches the child's screen. */
for (const word of ["evidence score", "comprehension level", "reading age", "percentile", "assessment"]) {
  require(
    !playground.toLowerCase().includes(word),
    `the child's screen must not say "${word}"`
  );
}

if (failures.length > 0) {
  console.error("LOCATE contract failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `LOCATE contract passed: one engine, one surface, ${supported} questions with authored evidence, and marking that cannot be swept.`
);
