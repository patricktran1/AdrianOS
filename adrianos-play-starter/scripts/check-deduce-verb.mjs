import { promises as fs } from "node:fs";
import path from "node:path";

/*
 * Architectural contracts for DEDUCE.
 *
 * The verb exists so that a right answer reached by reasoning and a right
 * answer reached by guessing look different in the record. That promise was
 * broken twice at once, and both breaks are cheap to make again:
 *
 *   The surface answered every tap — "Hmm, no clue says it can't be that one
 *   yet" for a card nothing ruled out, "Good spot" for one that was. A child
 *   could reveal every clue, tap each card, and read the answer off the
 *   replies: 100% correct and 100% recorded as reasoning across 40,320
 *   puzzles, against 26% for guessing.
 *
 *   The sequence generators listed their cards in story order, and every
 *   sequence clue puts the answer strictly inside the row. With three cards
 *   the answer was the middle one on 100% of puzzles — every puzzle a TK or
 *   Kindergarten child sees.
 *
 * They are string checks. Crude, but they fail loudly and they name the
 * promise rather than the implementation.
 */

const root = process.cwd();
const failures = [];

async function source(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

/**
 * Comments explain the defects these rules exist for, and naming a defect is
 * not committing it. The "must not say" rules read the code with comments
 * removed so that documenting the old behaviour does not trip them.
 */
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const surface = await source("components/kernels/DeducePlayground.tsx");
const evidence = await source("lib/learning/deduce-evidence.ts");
const tasks = await source("lib/kernels/deduce-tasks.ts");
const surfaceCode = withoutComments(surface);
const tasksCode = withoutComments(tasks);
const evidenceCode = withoutComments(evidence);

function require(condition, message) {
  if (!condition) failures.push(message);
}

/* ---- A tap must answer nothing. ---- */

function bodyOf(text, signature) {
  const start = text.indexOf(signature);
  if (start === -1) return null;
  let depth = 0;
  for (let index = text.indexOf("{", start); index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

const tapBody = bodyOf(surfaceCode, "function tapCard(");
require(tapBody !== null, "the surface must have a tapCard handler");
if (tapBody) {
  require(
    !tapBody.includes("rulingConstraint") && !tapBody.includes("satisfies("),
    "tapCard must not consult the clues: a tap that knows whether it was justified is an oracle, and the child can read the answer off it"
  );
}

const useClueBody = bodyOf(surfaceCode, "function useClue(");
require(useClueBody !== null, "the surface must have a useClue handler");
require(
  (surfaceCode.match(/rulingConstraint\(/g) ?? []).length === 1,
  "rulingConstraint must be reached from exactly one place in the surface"
);
if (useClueBody) {
  require(
    useClueBody.includes("rulingConstraint("),
    "the one call to rulingConstraint belongs inside useClue, where the child has already committed"
  );
}

/* ---- What the child hears cannot depend on whether they were right. ---- */

require(
  tasks.includes("export function strikeLine("),
  "deduce-tasks must export strikeLine, the only sentence a strike is allowed to say"
);
const strikeBody = bodyOf(tasksCode, "export function strikeLine(");
if (strikeBody) {
  require(
    !strikeBody.includes("satisfies") && !strikeBody.includes("rulingConstraint"),
    "strikeLine must be built from the clue and the card alone, so it cannot vary with whether the strike was justified"
  );
}
require(
  !/Hmm/.test(surfaceCode),
  "the surface must not tell a child that nothing rules a card out; that was the oracle"
);
require(
  !/Good spot/.test(surfaceCode),
  "the surface must not confirm a cross-out as correct while the child is still deciding"
);

/* ---- The record must remember, and must not be spoken aloud. ---- */

require(
  evidence.includes("misattributedStrikes"),
  "the trace must carry misattributed strikes: crossing a card out under a clue that does not rule it out"
);
require(
  /misattributedStrikes === 0/.test(evidenceCode),
  "a clean deduction must have no misattributed strikes; forgiveness for a slip lives in the model's reasoned-rate over a run, not here"
);
require(
  !/Every clue fits/.test(surfaceCode),
  "the closing line must not read the recorded judgement back to the child; a verdict a child can hear is a verdict a child can replay for"
);
require(
  !/trace\.current\.unjustifiedEliminations = 0/.test(surfaceCode),
  "a second try resets the board, not the trace: crossings already made were still made"
);

/* ---- Where the answer sits must carry nothing. ---- */

const sequenceBody = bodyOf(tasksCode, "function deduceSequence(");
require(sequenceBody !== null, "deduce-tasks must have a deduceSequence generator");
if (sequenceBody) {
  require(
    sequenceBody.includes("seededShuffle("),
    "deduceSequence must shuffle its cards for presentation: every sequence clue puts the answer strictly inside the row, so story order names it — with three cards it was the middle one on 100% of puzzles"
  );
}

if (failures.length > 0) {
  console.error("DEDUCE contract failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  "DEDUCE contract passed: a tap answers nothing, one call site judges, the strike sentence cannot leak, and the record is neither erased nor read aloud."
);
