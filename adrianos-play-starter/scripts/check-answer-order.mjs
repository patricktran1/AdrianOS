import { promises as fs } from "node:fs";
import path from "node:path";

/*
 * Where the answer sits must tell a child nothing.
 *
 * The authored banks put the correct option first — 358 of 359 rows when this
 * was measured — and every surface rendered them in the order they were
 * written. "Tap the top button" was therefore a complete strategy across the
 * fourteen subject labs, and for most of those subjects accuracy is the only
 * signal the system produces: no verb, no error signature, nothing else to go
 * on. A parent dashboard showed mastery of civics and health that had never
 * been demonstrated.
 *
 * Authoring the answer first is natural and this does not try to stop it. What
 * it stops is a surface rendering an authored list without permuting it, and
 * the "shuffles" that are not shuffles.
 */

const root = process.cwd();
const failures = [];
const notes = [];

async function source(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

async function walk(dir, out = []) {
  for (const entry of await fs.readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(relative, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(relative);
  }
  return out;
}

const files = [
  ...(await walk("lib")),
  ...(await walk("app")),
  ...(await walk("components")),
];

/* ------------------------------------------------------------------ *
 * (a) A comparator that returns a random number is not a shuffle.
 *
 * `sort(() => Math.random() - 0.5)` is inconsistent, so the result depends on
 * the sort algorithm. Measured on math-blast's four choices it left the answer
 * in the first or last slot 67% of the time. lib/adrian-content-rotation.ts
 * has a real Fisher-Yates shuffle; everything that needs one uses it.
 * ------------------------------------------------------------------ */
const COMPARATOR = /\.sort\(\s*\(\s*\)\s*=>[^)]*random\(\)/i;
for (const file of files) {
  const text = await source(file);
  if (COMPARATOR.test(text)) {
    failures.push(
      `${file} shuffles with a random comparator; use shuffled() from lib/adrian-content-rotation.ts or the seeded helpers in lib/learning/answer-order.ts`
    );
  }
}

/* ------------------------------------------------------------------ *
 * (b) Any surface that renders an authored option list must present it.
 *
 * The exemptions are the arcade pages that build their own choices inline
 * rather than reading a bank. They were measured separately at 66.7% on the
 * first slot — elevated over the 33.3% floor but nothing like the bank exploit
 * — and each is a single multi-thousand-character JSX expression where an
 * edit is a real risk. The number is written down here so the next person
 * starts from a measurement rather than a guess.
 * ------------------------------------------------------------------ */
const INLINE_CHOICE_PAGES = new Set([
  "app/games/cyber-city-five/page.tsx",
  "app/games/mystery-temple/page.tsx",
  "app/games/space-station-sigma/page.tsx",
  "app/games/rainbow-rocket-park/page.tsx",
  "app/games/robot-rescue-city/page.tsx",
  "app/games/adaptive-boss-arena/page.tsx",
  "app/games/dino-time-rescue/page.tsx",
  "app/games/family-quest-party/page.tsx",
  "app/games/mastery-rescue-lab/page.tsx",
  "app/games/human-body-explorer/page.tsx",
  "app/games/treasure-map-math/page.tsx",
  "app/games/placement-adventure/page.tsx",
  "app/games/dino-dash-volcano-escape/page.tsx",
  "app/games/question-quest/QuestionQuest.tsx",
  "app/games/daily-adventure-remix/page.tsx",
  // Renders a list it was handed, already presented by its caller.
  "components/CoachMode.tsx",
  // These two permute upstream, in the engine that builds the task, using a
  // seeded Fisher-Yates rather than the authored order. Measured rather than
  // assumed, so the exemption rests on a number:
  //   LocatePlayground  — 33,600 tasks, answer at 32.74 / 33.33 / 33.93%
  //   number-quest      — 48,600 questions, answer at 26.00 / 25.96 / 25.89 /
  //                       22.14% (the fourth slot is lighter because the
  //                       comparison questions offer three choices, not four)
  "components/kernels/LocatePlayground.tsx",
  "app/games/number-quest/page.tsx",
]);

const RENDERS_OPTIONS = /\.(options|choices)\.map\(/;
// An import is not a use. The check asks for the call, because a file can
// carry the import and still hand the bank straight to the screen — which is
// exactly what this contract exists to catch.
const PRESENTS = /\bpresent(?:Deck|Item|Options|Indexed|Values)\s*\(/;
let presented = 0;
for (const file of files) {
  if (!file.startsWith("app/") && !file.startsWith("components/")) continue;
  const text = await source(file);
  if (!RENDERS_OPTIONS.test(text)) continue;
  if (INLINE_CHOICE_PAGES.has(file)) continue;
  if (text.includes("learning/answer-order") && PRESENTS.test(text)) {
    presented += 1;
    continue;
  }
  failures.push(
    `${file} renders an authored option list without presenting it; call presentDeck/presentItem/presentOptions from lib/learning/answer-order.ts so the answer's position carries no information`
  );
}

/* ------------------------------------------------------------------ *
 * (c) The invariants presentation depends on.
 *
 * A row whose answer is not among its options, or that lists the same string
 * twice, cannot be permuted without changing the question. The module falls
 * back to the authored order for those rather than throwing at a child; this
 * is what stops that fallback becoming normal.
 * ------------------------------------------------------------------ */
const ROW = /options:\s*\[([\s\S]{0,900}?)\][\s\S]{0,500}?answer:\s*"((?:[^"\\]|\\.)*)"/g;
let rows = 0;
let authoredFirst = 0;
for (const file of files) {
  const text = await source(file);
  ROW.lastIndex = 0;
  let match;
  while ((match = ROW.exec(text))) {
    const options = [...match[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((o) => o[1]);
    if (options.length === 0) continue;
    const answer = match[2];
    rows += 1;
    if (options[0] === answer) authoredFirst += 1;
    if (options.length < 2) {
      failures.push(`${file} has a question with fewer than two options`);
    }
    if (!options.includes(answer)) {
      failures.push(`${file} has a question whose answer is not one of its options`);
    }
    if (new Set(options).size !== options.length) {
      failures.push(`${file} has a question that lists the same option twice`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * (d) Reported, not gated.
 *
 * Authoring the answer first is fine now that nothing renders it first, and
 * the longest-option tell is a separate problem that shuffling does not touch.
 * Both are printed so neither can drift without somebody seeing it.
 * ------------------------------------------------------------------ */
let longest = 0;
for (const file of files) {
  const text = await source(file);
  ROW.lastIndex = 0;
  let match;
  while ((match = ROW.exec(text))) {
    const options = [...match[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((o) => o[1]);
    if (options.length < 2) continue;
    const answer = match[2];
    const longestOption = options.reduce((a, b) => (b.length > a.length ? b : a));
    const ties = options.filter((o) => o.length === longestOption.length).length;
    if (ties === 1 && longestOption === answer) longest += 1;
  }
}
notes.push(`${rows} authored questions; ${authoredFirst} (${((authoredFirst / rows) * 100).toFixed(1)}%) list the answer first, which no surface now renders first`);
notes.push(`${longest} (${((longest / rows) * 100).toFixed(1)}%) have the answer as the uniquely longest option — a separate tell, not addressed here`);

/* One module owns presentation, and it stays prototype-safe. */
const module = await source("lib/learning/answer-order.ts");
if (!module.includes("export function presentOptions")) {
  failures.push("lib/learning/answer-order.ts must export presentOptions");
}
if (!module.includes("new Map(")) {
  failures.push(
    "lib/learning/answer-order.ts must resolve option positions through a Map; option text is content and must never reach a prototype"
  );
}
if (module.includes("Math.random")) {
  failures.push(
    "lib/learning/answer-order.ts must be seeded, not random; buttons that move between renders shift under a child's finger"
  );
}

if (failures.length > 0) {
  console.error("Answer-order contract failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `Answer-order contract passed: ${presented} bank-fed surfaces present their options, no random comparators, ${rows} authored questions intact.`
);
for (const note of notes) console.log(`  note: ${note}`);
