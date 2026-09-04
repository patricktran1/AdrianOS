/**
 * AdrianOS interaction kernels: the task engine.
 *
 * A kernel is a reusable interaction verb — a cognitive action a child
 * performs — separated from the curriculum content that flows through it.
 * This file owns the content side: given a skill, a grade band, and a
 * difficulty, it produces tasks for a verb. The UI side (one shared
 * tray-and-slots component) renders any task from any verb.
 *
 * Two verbs are implemented deeply rather than four shallowly:
 *
 * - BUILD  — compose a target from parts: counts from blocks, two-digit
 *            numbers from tens and ones, sums from blocks, fractions from
 *            unit pieces, decimals from tenths and hundredths.
 * - PLACE  — put things where they belong along a track: number order,
 *            comparing magnitudes, fraction and decimal order, story and
 *            science sequences.
 *
 * The same skill ids games already record (`math-place-value`,
 * `math-counting`, `reading-sequencing`, …) flow through both verbs, so a
 * child who has only ever *chosen* place-value answers can now *construct*
 * and *position* them — and the learner model can see the difference.
 *
 * Everything here is pure and deterministic (seeded by profile, day, and
 * round) so tasks are stable within a day, vary between days, and can be
 * unit tested without a browser.
 */

import type { Game } from "@/lib/games";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
// Relative with extension so the module loads under node type stripping
// (unit tests) as well as the bundler.
import { createSeededRandom, seededShuffle } from "../deterministic-random.ts";
import {
  fractionSignature,
  integerSignature,
  operationSignature,
  sequenceSignature,
  type ArithmeticOperation,
  type ErrorSignature,
} from "../learning/error-signatures.ts";
import {
  WRITING_SENTENCES,
  type WritingLevel,
} from "../writing/sentence-bank.ts";

export type KernelVerb = "build" | "place";

/** One selectable piece in the tray. */
export type KernelPart = {
  id: string;
  label: string;
  emoji: string;
  /** Numeric worth for BUILD aggregation; 0 for purely ordinal parts. */
  value: number;
};

export type KernelTask = {
  id: string;
  verb: KernelVerb;
  skillId: string;
  skillLabel: string;
  subject: Game["subject"];
  standardCode: string | null;
  /** Short child-facing instruction. Read-aloud friendly. */
  prompt: string;
  /** Coaching after the first miss. Names a strategy, not the answer. */
  hint: string;
  /** Worked explanation after the second miss. Names the answer. */
  explanation: string;
  tray: KernelPart[];
  /**
   * PLACE: the number of visible slots to fill (= targetIds.length).
   * BUILD: 0 — the box is open-ended, judged purely by what it totals,
   * so every valid composition of the target counts, exactly as it would
   * with physical blocks.
   */
  slots: number;
  /** PLACE: the correct part ids in order. Empty for BUILD. */
  targetIds: string[];
  /** BUILD: the value the selection must total. 0 for PLACE. */
  targetValue: number;
  /** How BUILD totals read back: 47, 3/4, or 0.47. */
  format: "integer" | "fraction" | "decimal";
  /** Fraction tasks: the shared denominator the pieces are cut into. */
  denominator: number;
  /** Human-readable form of the correct answer, for evidence and coaching. */
  targetLabel: string;
  /**
   * The arithmetic the task asks for, and the two numbers it asks it of.
   *
   * Carried on the task rather than parsed back out of the prompt, because
   * this is the only place the structure is still known: "17" tells you
   * nothing, but "17 on a task whose operands were 12 and 5" says the child
   * added. Null for tasks that are not arithmetic on two numbers — counting,
   * place value, ordering — where there is no wrong operation to work.
   */
  operation: {
    kind: ArithmeticOperation | "pattern";
    left: number;
    right: number;
  } | null;
};

export type KernelJudgement = {
  correct: boolean;
  /**
   * Canonical form of what the child actually made — the composed value for
   * BUILD, the chosen sequence for PLACE. Deterministic, so the same mistake
   * made twice clusters as the same misconception.
   */
  canonicalAnswer: string;
  /**
   * The observable relationship between what was expected and what was made,
   * when there is one worth naming. Computed here because this is where the
   * task's structure is still known; a string comparison later could not
   * recover it. Null for correct answers and for unremarkable misses.
   */
  errorSignature: ErrorSignature | null;
};

export const KERNEL_VERB_LABELS: Record<KernelVerb, string> = {
  build: "building",
  place: "putting in order",
};

/* ------------------------------------------------------------------ */
/* Judging                                                             */
/* ------------------------------------------------------------------ */

/**
 * Judges a selection against a task.
 *
 * BUILD is order-free: four tens and seven ones make 47 no matter the tap
 * order, exactly as physical blocks would. PLACE is order itself.
 */
export function judgeKernelAnswer(
  task: KernelTask,
  chosen: KernelPart[]
): KernelJudgement {
  if (task.verb === "build") {
    const total = chosen.reduce((sum, part) => sum + part.value, 0);
    const correct = chosen.length > 0 && nearlyEqual(total, task.targetValue);
    return {
      correct,
      canonicalAnswer: formatBuildTotal(task, total),
      errorSignature: correct ? null : buildErrorSignature(task, total),
    };
  }
  const sequence = chosen.map((part) => part.id);
  const exact =
    sequence.length === task.targetIds.length
    && sequence.every((id, index) => id === task.targetIds[index]);
  // Two tiles that read the same *are* the same tile. Nothing in the bank
  // repeats a word today, so this changes no current task — it is here
  // because rebuilding sentences is the one PLACE task where a duplicate
  // tile is natural English ("the cat sat on the mat"), and without it the
  // first author to write one would silently mark an identical sentence
  // wrong. Comparing what the row reads, rather than which tile object it
  // came from, can only ever accept an arrangement indistinguishable on
  // screen; a test holds every other PLACE task to distinct labels.
  const correct = exact || readsTheSame(task, chosen);
  return {
    correct,
    canonicalAnswer: chosen.map((part) => part.label).join(", "),
    errorSignature: correct ? null : sequenceSignature(task.targetIds, sequence),
  };
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001;
}

/** Whether a placement reads identically to the answer, tile ids aside. */
function readsTheSame(task: KernelTask, chosen: KernelPart[]): boolean {
  if (chosen.length !== task.targetIds.length) return false;
  const labelOf = new Map(task.tray.map((part) => [part.id, part.label]));
  return task.targetIds.every(
    (id, index) => labelOf.get(id) === chosen[index]?.label
  );
}

/**
 * Names the relationship between the target and what the box actually holds.
 *
 * Fractions compare piece-for-piece; decimals and whole numbers compare as
 * integers in their own smallest unit, so "0.47 built as 0.07" reads as the
 * same tens-omitted relationship that "47 built as 7" does.
 */
function buildErrorSignature(task: KernelTask, total: number): ErrorSignature | null {
  if (task.format === "fraction") {
    return fractionSignature(
      { numerator: task.targetValue, denominator: task.denominator },
      { numerator: Math.round(total), denominator: task.denominator }
    );
  }
  const built = Math.round(total);
  // Asked before the numeric comparison: a box holding 17 for "12 take away
  // 5" is a whole operation worked correctly on the wrong instruction, which
  // is a different thing to teach than a box holding 6.
  const worked = operationErrorSignature(task, built);
  if (worked) return worked;
  return integerSignature(task.targetValue, built, { composed: true });
}

/** The wrong-operation reading of a build, when the task has operands. */
function operationErrorSignature(
  task: KernelTask,
  built: number
): ErrorSignature | null {
  const operation = task.operation;
  if (!operation) return null;
  if (operation.kind === "pattern") {
    // The pattern's previous term stands in `right`.
    return built === operation.right ? "pattern.previous-term-repeated" : null;
  }
  return operationSignature(operation.kind, operation.left, operation.right, built);
}

export function formatBuildTotal(task: KernelTask, total: number): string {
  if (task.format === "fraction") {
    // Totals are stored in denominator units, so 3 quarter-pieces read "3/4".
    return `${Math.round(total)}/${task.denominator}`;
  }
  if (task.format === "decimal") {
    return (Math.round(total) / 100).toFixed(2);
  }
  return String(Math.round(total));
}

/* ------------------------------------------------------------------ */
/* BUILD tasks                                                         */
/* ------------------------------------------------------------------ */

type TaskInput = {
  seed: string;
  grade: ElementaryGrade;
  /** -1 easier, 0 standard, +1 harder — from the learner model or query. */
  difficultyShift: -1 | 0 | 1;
};

const BLOCK: KernelPart = { id: "one", label: "1", emoji: "🟦", value: 1 };
const TEN_ROD: KernelPart = { id: "ten", label: "10", emoji: "🟨", value: 10 };

function repeatPart(part: KernelPart, count: number): KernelPart[] {
  return Array.from({ length: count }, (_, index) => ({
    ...part,
    id: `${part.id}-${index}`,
  }));
}

function buildCounting({ seed, grade, difficultyShift }: TaskInput): KernelTask {
  const random = createSeededRandom(`${seed}:build-counting`);
  const ceiling = grade <= -1 ? 5 : 9;
  // Capped at 9 so the tray always holds at least one extra block: counting
  // to capacity would let "select everything" pass without counting at all.
  const max = Math.max(3, Math.min(9, ceiling + difficultyShift * 2));
  const target = 2 + Math.floor(random() * (max - 1));
  return {
    id: `build-counting-${target}`,
    verb: "build",
    skillId: "math-counting",
    skillLabel: "Counting",
    subject: "Math",
    standardCode: grade <= -1 ? "TK.CC.1" : "K.CC.B.4",
    prompt: `Put ${target} blocks in the box.`,
    hint: "Count out loud each time you add a block.",
    explanation: `Count one block at a time: ${Array.from({ length: target }, (_, i) => i + 1).join(", ")}. That makes ${target}.`,
    tray: repeatPart(BLOCK, Math.min(10, target + 3)),
    slots: 0,
    targetIds: [],
    targetValue: target,
    format: "integer",
    denominator: 0,
    targetLabel: String(target),
    operation: null,
  };
}

function buildPlaceValue({ seed, difficultyShift }: TaskInput): KernelTask {
  const random = createSeededRandom(`${seed}:build-place-value`);
  const tensCeiling = difficultyShift < 0 ? 4 : 9;
  const tens = 1 + Math.floor(random() * tensCeiling);
  let ones = 1 + Math.floor(random() * 9);
  // A target like 44 makes the transposition misconception invisible;
  // keep tens and ones distinct so building 74 for 47 is a readable error.
  if (ones === tens) ones = (ones % 9) + 1;
  const target = tens * 10 + ones;
  return {
    id: `build-place-value-${target}`,
    verb: "build",
    skillId: "math-place-value",
    skillLabel: "Place value",
    subject: "Math",
    standardCode: "1.NBT.B.2",
    prompt: `Build the number ${target} with tens and ones.`,
    hint: "A yellow rod is worth 10. A blue block is worth 1. How many of each?",
    explanation: `${target} is ${tens} tens and ${ones} ones: ${tens} × 10 + ${ones} = ${target}.`,
    tray: [...repeatPart(TEN_ROD, 9), ...repeatPart(BLOCK, 9)],
    slots: 0,
    targetIds: [],
    targetValue: target,
    format: "integer",
    denominator: 0,
    targetLabel: String(target),
    operation: null,
  };
}

function buildAddition({ seed, grade, difficultyShift }: TaskInput): KernelTask {
  const random = createSeededRandom(`${seed}:build-addition`);
  const small = grade <= 0 || difficultyShift < 0;
  const left = small ? 2 + Math.floor(random() * 4) : 4 + Math.floor(random() * 6);
  const right = small ? 1 + Math.floor(random() * 4) : 3 + Math.floor(random() * 6);
  const target = left + right;
  const useRods = target > 10;
  return {
    id: `build-addition-${left}-${right}`,
    verb: "build",
    skillId: "math-addition",
    skillLabel: "Addition",
    subject: "Math",
    standardCode: small ? "K.OA.A.1" : "1.OA.C.6",
    prompt: `Build ${left} + ${right} with blocks.`,
    hint: `Put in ${left} blocks first, then keep counting while you add ${right} more.`,
    explanation: `${left} + ${right} = ${target}. ${useRods ? "Ten blocks make one rod, with the rest as ones." : `Count all the blocks together: ${target}.`}`,
    tray: useRods
      ? [...repeatPart(TEN_ROD, 2), ...repeatPart(BLOCK, 12)]
      : repeatPart(BLOCK, Math.min(12, target + 3)),
    slots: 0,
    targetIds: [],
    targetValue: target,
    format: "integer",
    denominator: 0,
    targetLabel: String(target),
    operation: null,
  };
}

function buildSubtraction({ seed, grade, difficultyShift }: TaskInput): KernelTask {
  const random = createSeededRandom(`${seed}:build-subtraction`);
  const small = grade <= 1 || difficultyShift < 0;
  // The minuend leads so the difference is never negative, and `right` stays
  // clear of `left` so "take them all away" is not accidentally the answer.
  const left = small ? 5 + Math.floor(random() * 5) : 11 + Math.floor(random() * 9);
  const right = 1 + Math.floor(random() * (Math.min(left - 1, small ? 4 : 9)));
  const target = left - right;
  return {
    id: `build-subtraction-${left}-${right}`,
    verb: "build",
    skillId: "math-subtraction",
    skillLabel: "Subtraction",
    subject: "Math",
    standardCode: small ? "K.OA.A.2" : "1.OA.C.6",
    prompt: `Build what is left when you take ${right} away from ${left}.`,
    hint: `Put in ${left} blocks, then take ${right} of them back out. Count what stays.`,
    explanation: `${left} take away ${right} is ${target}. Starting at ${left} and counting back ${right} lands on ${target}.`,
    tray: left > 10
      ? [...repeatPart(TEN_ROD, 2), ...repeatPart(BLOCK, 12)]
      : repeatPart(BLOCK, Math.min(12, left + 2)),
    slots: 0,
    targetIds: [],
    targetValue: target,
    format: "integer",
    denominator: 0,
    targetLabel: String(target),
    operation: { kind: "subtract", left, right },
  };
}

function buildMultiplication({ seed, grade, difficultyShift }: TaskInput): KernelTask {
  const random = createSeededRandom(`${seed}:build-multiplication`);
  const small = grade <= 2 || difficultyShift < 0;
  // Both factors stay above one: "1 group of 6" is answerable without
  // grouping at all, so it would not be evidence of multiplying.
  const groups = 2 + Math.floor(random() * (small ? 3 : 5));
  const each = 2 + Math.floor(random() * (small ? 4 : 6));
  const target = groups * each;
  return {
    id: `build-multiplication-${groups}-${each}`,
    verb: "build",
    skillId: "math-multiplication",
    skillLabel: "Multiplication",
    subject: "Math",
    standardCode: small ? "2.OA.C.4" : "3.OA.A.1",
    prompt: `Build ${groups} groups of ${each}.`,
    hint: `Count out ${each} blocks. Then do that ${groups} times in total.`,
    explanation: `${groups} groups of ${each} is ${target}. Counting by ${each}s: ${Array.from({ length: groups }, (_, i) => each * (i + 1)).join(", ")}.`,
    // Rods scale with the target so the tray always holds more than the
    // answer. A tray totalling exactly the target could be solved by tipping
    // all of it in, without ever making a group.
    tray: target > 10
      ? [...repeatPart(TEN_ROD, Math.floor(target / 10) + 1), ...repeatPart(BLOCK, 12)]
      : repeatPart(BLOCK, Math.min(12, target + 3)),
    slots: 0,
    targetIds: [],
    targetValue: target,
    format: "integer",
    denominator: 0,
    targetLabel: String(target),
    operation: { kind: "multiply", left: groups, right: each },
  };
}

function buildDivision({ seed, grade, difficultyShift }: TaskInput): KernelTask {
  const random = createSeededRandom(`${seed}:build-division`);
  const small = grade <= 2 || difficultyShift < 0;
  // Generated from the quotient outwards, so the share is always exact and
  // the child never meets a remainder this task has no way to express.
  const groups = 2 + Math.floor(random() * (small ? 2 : 4));
  const each = 2 + Math.floor(random() * (small ? 4 : 5));
  const total = groups * each;
  return {
    id: `build-division-${total}-${groups}`,
    verb: "build",
    skillId: "math-division",
    skillLabel: "Division",
    subject: "Math",
    standardCode: "3.OA.A.2",
    prompt: `Share ${total} between ${groups} boxes. Build what one box gets.`,
    hint: `Try a number for one box. If all ${groups} boxes hold that many, do they make ${total}?`,
    explanation: `${total} shared between ${groups} is ${each} each, because ${groups} groups of ${each} make ${total}.`,
    tray: repeatPart(BLOCK, Math.min(12, each + 4)),
    slots: 0,
    targetIds: [],
    targetValue: each,
    format: "integer",
    denominator: 0,
    targetLabel: String(each),
    operation: { kind: "divide", left: total, right: groups },
  };
}

function buildPatterns({ seed, grade, difficultyShift }: TaskInput): KernelTask {
  const random = createSeededRandom(`${seed}:build-patterns`);
  const small = grade <= 1 || difficultyShift < 0;
  const step = small ? 1 + Math.floor(random() * 2) : 2 + Math.floor(random() * 4);
  const start = 1 + Math.floor(random() * (small ? 3 : 6));
  // Four terms shown: three can be read as almost any rule, four settle it.
  const shown = Array.from({ length: 4 }, (_, index) => start + index * step);
  const previous = shown[shown.length - 1];
  const target = previous + step;
  return {
    id: `build-patterns-${start}-${step}`,
    verb: "build",
    skillId: "logic-patterns",
    skillLabel: "Patterns",
    subject: "Logic",
    standardCode: small ? "1.OA.C.5" : "4.OA.C.5",
    prompt: `The pattern goes ${shown.join(", ")}. Build what comes next.`,
    hint: "Look at how much the pattern jumps each time. Then jump once more.",
    explanation: `The pattern adds ${step} each time, so after ${previous} comes ${target}.`,
    tray: target > 10
      ? [...repeatPart(TEN_ROD, 2), ...repeatPart(BLOCK, 12)]
      : repeatPart(BLOCK, Math.min(12, target + 3)),
    slots: 0,
    targetIds: [],
    targetValue: target,
    format: "integer",
    denominator: 0,
    targetLabel: String(target),
    // `right` carries the last term shown, so repeating it rather than
    // continuing the rule is a nameable observation.
    operation: { kind: "pattern", left: step, right: previous },
  };
}

function buildFractions({ seed, difficultyShift }: TaskInput): KernelTask {
  const random = createSeededRandom(`${seed}:build-fractions`);
  const denominators = difficultyShift < 0 ? [2, 4] : difficultyShift > 0 ? [6, 8] : [4, 6, 8];
  const denominator = denominators[Math.floor(random() * denominators.length)];
  const numerator = 1 + Math.floor(random() * (denominator - 1));
  const piece: KernelPart = {
    id: "piece",
    label: `1/${denominator}`,
    emoji: "🍕",
    value: 1,
  };
  return {
    id: `build-fractions-${numerator}-${denominator}`,
    verb: "build",
    skillId: "math-fractions",
    skillLabel: "Fractions",
    subject: "Math",
    standardCode: "3.NF.A.1",
    prompt: `Build the fraction ${numerator}/${denominator} from ${denominator === 2 ? "halves" : `1/${denominator} pieces`}.`,
    hint: `The bottom number says the piece size. The top number says how many pieces you need.`,
    explanation: `${numerator}/${denominator} means ${numerator} pieces of size 1/${denominator}.`,
    tray: repeatPart(piece, denominator),
    slots: 0,
    targetIds: [],
    targetValue: numerator,
    format: "fraction",
    denominator,
    targetLabel: `${numerator}/${denominator}`,
    operation: null,
  };
}

function buildDecimals({ seed, difficultyShift }: TaskInput): KernelTask {
  const random = createSeededRandom(`${seed}:build-decimals`);
  const tenth: KernelPart = { id: "tenth", label: "0.1", emoji: "🟪", value: 10 };
  const hundredth: KernelPart = { id: "hundredth", label: "0.01", emoji: "🟩", value: 1 };
  const tenths = 1 + Math.floor(random() * 8);
  const hundredths = difficultyShift < 0 ? 0 : 1 + Math.floor(random() * 8);
  // Stored in hundredth units so integer arithmetic stays exact.
  const target = tenths * 10 + hundredths;
  const label = (target / 100).toFixed(2);
  return {
    id: `build-decimals-${target}`,
    verb: "build",
    skillId: "math-decimals",
    skillLabel: "Decimals",
    subject: "Math",
    standardCode: "5.NBT.A.3",
    prompt: `Build the decimal ${label} from tenths and hundredths.`,
    hint: "The first digit after the point counts tenths. The second counts hundredths.",
    explanation: `${label} is ${tenths} tenths and ${hundredths} hundredths.`,
    tray: [...repeatPart(tenth, 9), ...repeatPart(hundredth, 9)],
    slots: 0,
    targetIds: [],
    targetValue: target,
    format: "decimal",
    denominator: 0,
    targetLabel: label,
    operation: null,
  };
}

/* ------------------------------------------------------------------ */
/* PLACE tasks                                                         */
/* ------------------------------------------------------------------ */

function orderedNumberTask(
  input: TaskInput,
  values: number[],
  meta: Pick<KernelTask, "skillId" | "skillLabel" | "standardCode" | "hint">,
  format: (value: number) => string = String
): KernelTask {
  const parts = values.map((value) => ({
    id: `n-${value}`,
    label: format(value),
    emoji: "🪨",
    value,
  }));
  const sorted = [...parts].sort((a, b) => a.value - b.value);
  return {
    id: `place-${meta.skillId}-${values.join("-")}`,
    verb: "place",
    subject: "Math",
    prompt: "Put the stones in order, smallest first.",
    explanation: `Smallest to largest: ${sorted.map((part) => part.label).join(", ")}.`,
    tray: seededShuffle(parts, `${input.seed}:tray`),
    slots: parts.length,
    targetIds: sorted.map((part) => part.id),
    targetValue: 0,
    format: "integer",
    denominator: 0,
    targetLabel: sorted.map((part) => part.label).join(", "),
    operation: null,
    ...meta,
  };
}

/**
 * Ordering tasks whose stones are arithmetic expressions rather than numbers.
 *
 * The positioning is the same as any other PLACE task; what makes it a
 * genuine second representation of the operation is that nothing can be
 * ordered until each expression has been worked out. A child who can pick
 * "17" from four options but cannot say whether 12 - 5 sits before or after
 * 9 - 2 is telling you something the multiple-choice question could not.
 */
function orderedExpressionTask(
  input: TaskInput,
  expressions: Array<{ label: string; value: number }>,
  meta: Pick<KernelTask, "skillId" | "skillLabel" | "standardCode" | "hint" | "subject">
): KernelTask {
  const parts = expressions.map((expression, index) => ({
    id: `e-${index}-${expression.value}`,
    label: expression.label,
    emoji: "🪨",
    value: expression.value,
  }));
  const sorted = [...parts].sort((a, b) => a.value - b.value);
  return {
    id: `place-${meta.skillId}-${expressions.map((e) => e.label).join("_")}`,
    verb: "place",
    prompt: "Work out each stone, then put them in order, smallest first.",
    explanation: `Smallest to largest: ${sorted.map((part) => `${part.label} = ${part.value}`).join(", ")}.`,
    tray: seededShuffle(parts, `${input.seed}:tray`),
    slots: parts.length,
    targetIds: sorted.map((part) => part.id),
    targetValue: 0,
    format: "integer",
    denominator: 0,
    targetLabel: sorted.map((part) => part.label).join(", "),
    operation: null,
    ...meta,
  };
}

type Expression = { label: string; value: number };

/**
 * Distinct results, so the ordering has exactly one right answer.
 *
 * Returns fewer expressions than asked for rather than looping forever if a
 * narrow range cannot supply them; every caller can order what it gets.
 */
/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

/** Which band of sentences a grade rebuilds. */
function writingLevelFor(grade: ElementaryGrade, difficultyShift: -1 | 0 | 1): WritingLevel {
  const base = grade <= 1 ? 0 : grade <= 3 ? 1 : 2;
  const level = Math.max(0, Math.min(2, base + difficultyShift));
  return (["Starter", "Growing", "Challenge"] as const)[level];
}

/**
 * Rebuild a sentence from its words.
 *
 * The ending mark is its own tile, and the only capitalised word is the one
 * that starts the sentence, so getting this right means placing a capital
 * first and punctuation last as well as ordering the words — which is why
 * this is sentence writing rather than another ordering puzzle.
 *
 * The words are shown scrambled but never sorted into a helpful order: a
 * tray in alphabetical order would let a child work backwards from the tray
 * rather than from the sentence.
 */
function placeWritingSentence(
  input: TaskInput,
  skillId: "writing-sentences" | "writing-conventions" = "writing-sentences"
): KernelTask {
  const conventions = skillId === "writing-conventions";
  const level = writingLevelFor(input.grade, input.difficultyShift);
  const pool = WRITING_SENTENCES.filter((row) => row.level === level);
  const chosen = seededShuffle(pool, `${input.seed}:writing-sentence`)[0] ?? WRITING_SENTENCES[0];

  const mark = chosen.text.slice(-1);
  const words = chosen.text.slice(0, -1).trim().split(/\s+/);
  const parts: KernelPart[] = [
    ...words.map((word, index) => ({
      id: `w-${index}`,
      label: word,
      emoji: "🪧",
      value: index,
    })),
    { id: "w-mark", label: mark, emoji: "🪧", value: words.length },
  ];

  // The same task serves both skills, and the attribution is honest either
  // way: the capital can only go first and the mark can only go last, so a
  // correct build is evidence of both ordering the words and placing the
  // conventions. Which one is recorded is which one we came here to observe.
  return {
    id: `place-${skillId}-${chosen.id}`,
    verb: "place",
    skillId,
    skillLabel: conventions ? "Capitalization and punctuation" : "Sentence construction",
    subject: "Reading",
    standardCode: conventions
      ? (input.grade <= 1 ? "L.1.2" : input.grade <= 3 ? "L.3.2" : "L.5.2")
      : (input.grade <= 1 ? "L.1.1" : input.grade <= 3 ? "L.3.1" : "L.5.1"),
    prompt: conventions
      ? "Build the sentence. Watch where the capital and the mark belong."
      : "Put the words in order to make one sentence.",
    hint: "A sentence starts with a capital letter and ends with its mark.",
    explanation: `The sentence reads: ${chosen.text}`,
    tray: seededShuffle(parts, `${input.seed}:writing-tray`),
    slots: parts.length,
    targetIds: parts.map((part) => part.id),
    targetValue: 0,
    format: "integer",
    denominator: 0,
    targetLabel: chosen.text,
    operation: null,
  };
}

function distinctResults(
  make: () => Expression,
  count: number,
  attempts = 40
): Expression[] {
  const chosen: Expression[] = [];
  const seen = new Set<number>();
  for (let attempt = 0; attempt < attempts && chosen.length < count; attempt += 1) {
    const candidate = make();
    if (seen.has(candidate.value)) continue;
    seen.add(candidate.value);
    chosen.push(candidate);
  }
  return chosen;
}

/** The number a child reads first on a stone: the 12 in "12 - 5". */
function leadingNumber(expression: Expression): number {
  return Number(expression.label.match(/\d+/)?.[0] ?? 0);
}

/**
 * A set of expressions the leading number cannot order.
 *
 * Without this, "12 - 5, 9 - 2, 7 - 1" sorts correctly by first number alone,
 * and the task rewards reading rather than subtracting. Redraws until the two
 * orderings disagree, and falls back to the last usable set so a task is
 * always produced.
 */
function orderableExpressions(
  make: () => Expression,
  count: number,
  attempts = 12
): Expression[] {
  let fallback: Expression[] = [];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const drawn = distinctResults(make, count);
    if (drawn.length < count) continue;
    fallback = drawn;
    const byValue = [...drawn].sort((a, b) => a.value - b.value);
    const byLeading = [...drawn].sort((a, b) => leadingNumber(a) - leadingNumber(b));
    if (byValue.some((expression, index) => expression !== byLeading[index])) return drawn;
  }
  return fallback;
}

function placeSubtraction(input: TaskInput): KernelTask {
  const random = createSeededRandom(`${input.seed}:place-subtraction`);
  const small = input.grade <= 1 || input.difficultyShift < 0;
  const ceiling = small ? 10 : 20;
  const expressions = orderableExpressions(() => {
    const left = 4 + Math.floor(random() * (ceiling - 4));
    const right = 1 + Math.floor(random() * Math.min(left - 1, small ? 4 : 9));
    return { label: `${left} - ${right}`, value: left - right };
  }, small ? 3 : 4);
  return orderedExpressionTask(input, expressions, {
    skillId: "math-subtraction",
    skillLabel: "Subtraction",
    subject: "Math",
    standardCode: small ? "K.OA.A.2" : "2.OA.B.2",
    hint: "Take each one away first. Compare the answers, not the first numbers.",
  });
}

function placeMultiplication(input: TaskInput): KernelTask {
  const random = createSeededRandom(`${input.seed}:place-multiplication`);
  const small = input.grade <= 2 || input.difficultyShift < 0;
  const expressions = orderableExpressions(() => {
    const left = 2 + Math.floor(random() * (small ? 3 : 5));
    const right = 2 + Math.floor(random() * (small ? 4 : 6));
    return { label: `${left} x ${right}`, value: left * right };
  }, small ? 3 : 4);
  return orderedExpressionTask(input, expressions, {
    skillId: "math-multiplication",
    skillLabel: "Multiplication",
    subject: "Math",
    standardCode: small ? "2.OA.C.4" : "3.OA.A.1",
    hint: "Count in groups to work each one out. A bigger first number does not always win.",
  });
}

function placeDivision(input: TaskInput): KernelTask {
  const random = createSeededRandom(`${input.seed}:place-division`);
  const small = input.grade <= 2 || input.difficultyShift < 0;
  const expressions = orderableExpressions(() => {
    // Built from the answer outwards so every stone divides exactly.
    const groups = 2 + Math.floor(random() * (small ? 2 : 4));
    const each = 2 + Math.floor(random() * (small ? 4 : 6));
    return { label: `${groups * each} / ${groups}`, value: each };
  }, small ? 3 : 4);
  return orderedExpressionTask(input, expressions, {
    skillId: "math-division",
    skillLabel: "Division",
    subject: "Math",
    standardCode: "3.OA.A.2",
    hint: "Share each one out first. The biggest total does not always share into the most.",
  });
}

function distinctRandomValues(
  random: () => number,
  count: number,
  min: number,
  max: number
): number[] {
  const values = new Set<number>();
  // The range always exceeds the count, so this terminates fast.
  while (values.size < count) {
    values.add(min + Math.floor(random() * (max - min + 1)));
  }
  return [...values];
}

function placeCounting(input: TaskInput): KernelTask {
  const random = createSeededRandom(`${input.seed}:place-counting`);
  const count = input.grade <= -1 ? 3 : 4;
  const start = 1 + Math.floor(random() * 4);
  const values = Array.from({ length: count }, (_, index) => start + index);
  return orderedNumberTask(input, values, {
    skillId: "math-counting",
    skillLabel: "Counting",
    standardCode: input.grade <= -1 ? "TK.CC.2" : "K.CC.A.2",
    hint: "Say the counting numbers out loud. Which comes first?",
  });
}

function placePlaceValue(input: TaskInput): KernelTask {
  const random = createSeededRandom(`${input.seed}:place-place-value`);
  const count = input.difficultyShift < 0 ? 3 : 4;
  const values = distinctRandomValues(random, count, 12, 99);
  return orderedNumberTask(input, values, {
    skillId: "math-place-value",
    skillLabel: "Place value",
    standardCode: "1.NBT.B.3",
    hint: "Compare the tens digit first. Only check the ones if the tens match.",
  });
}

function placeFractions(input: TaskInput): KernelTask {
  const random = createSeededRandom(`${input.seed}:place-fractions`);
  const denominator = [4, 6, 8][Math.floor(random() * 3)];
  const numerators = distinctRandomValues(random, 3, 1, denominator - 1);
  const parts = numerators.map((numerator) => ({
    id: `f-${numerator}`,
    label: `${numerator}/${denominator}`,
    emoji: "🪨",
    value: numerator,
  }));
  const sorted = [...parts].sort((a, b) => a.value - b.value);
  return {
    id: `place-fractions-${denominator}-${numerators.join("-")}`,
    verb: "place",
    skillId: "math-fractions",
    skillLabel: "Fractions",
    subject: "Math",
    standardCode: "3.NF.A.3",
    prompt: "Put the fractions in order, smallest first.",
    hint: "The pieces are all the same size, so more pieces means a bigger fraction.",
    explanation: `Smallest to largest: ${sorted.map((part) => part.label).join(", ")}.`,
    tray: seededShuffle(parts, `${input.seed}:tray`),
    slots: parts.length,
    targetIds: sorted.map((part) => part.id),
    targetValue: 0,
    format: "integer",
    denominator: 0,
    targetLabel: sorted.map((part) => part.label).join(", "),
    operation: null,
  };
}

function placeDecimals(input: TaskInput): KernelTask {
  const random = createSeededRandom(`${input.seed}:place-decimals`);
  const values = distinctRandomValues(random, 4, 5, 95);
  return orderedNumberTask(
    input,
    values,
    {
      skillId: "math-decimals",
      skillLabel: "Decimals",
      standardCode: "5.NBT.A.3",
      hint: "Line up the decimal points, then compare tenths before hundredths.",
    },
    (value) => (value / 100).toFixed(2)
  );
}

/** Ordered real-world sequences for the PLACE verb outside math. */
type SequenceBank = {
  id: string;
  skillId: "reading-sequencing" | "science-life-cycles";
  skillLabel: string;
  subject: Game["subject"];
  standardCode: string;
  prompt: string;
  hint: string;
  steps: Array<{ label: string; emoji: string }>;
  /** Lowest grade the sequence reads well at. */
  minGrade: ElementaryGrade;
};

const SEQUENCES: SequenceBank[] = [
  {
    id: "seed-flower",
    skillId: "science-life-cycles",
    skillLabel: "Life cycles",
    subject: "Science",
    standardCode: "K-LS1-1",
    prompt: "Put the plant's life in order.",
    hint: "What has to happen first, before anything can grow?",
    steps: [
      { label: "Seed", emoji: "🌰" },
      { label: "Sprout", emoji: "🌱" },
      { label: "Flower", emoji: "🌸" },
    ],
    minGrade: -1,
  },
  {
    id: "frog-cycle",
    skillId: "science-life-cycles",
    skillLabel: "Life cycles",
    subject: "Science",
    standardCode: "3-LS1-1",
    prompt: "Put the frog's life in order.",
    hint: "A frog starts life in the water, without any legs.",
    steps: [
      { label: "Egg", emoji: "🥚" },
      { label: "Tadpole", emoji: "🐟" },
      { label: "Froglet", emoji: "🐸" },
      { label: "Frog", emoji: "🐸" },
    ],
    minGrade: 1,
  },
  {
    id: "butterfly-cycle",
    skillId: "science-life-cycles",
    skillLabel: "Life cycles",
    subject: "Science",
    standardCode: "3-LS1-1",
    prompt: "Put the butterfly's life in order.",
    hint: "Before the wings, there is a long sleep inside a shell.",
    steps: [
      { label: "Egg", emoji: "🥚" },
      { label: "Caterpillar", emoji: "🐛" },
      { label: "Chrysalis", emoji: "🛡️" },
      { label: "Butterfly", emoji: "🦋" },
    ],
    minGrade: 1,
  },
  {
    id: "sandwich-story",
    skillId: "reading-sequencing",
    skillLabel: "Story order",
    subject: "Reading",
    standardCode: "RL.K.2",
    prompt: "Put the story in order: making a sandwich.",
    hint: "You cannot eat it before you make it!",
    steps: [
      { label: "Get the bread", emoji: "🍞" },
      { label: "Add the filling", emoji: "🧀" },
      { label: "Eat it up", emoji: "😋" },
    ],
    minGrade: -1,
  },
  {
    id: "garden-story",
    skillId: "reading-sequencing",
    skillLabel: "Story order",
    subject: "Reading",
    standardCode: "RL.1.2",
    prompt: "Put the story in order: growing a garden.",
    hint: "Think about what the gardener must do before watering.",
    steps: [
      { label: "Dig the soil", emoji: "🪏" },
      { label: "Plant the seeds", emoji: "🌰" },
      { label: "Water them", emoji: "💧" },
      { label: "Pick the vegetables", emoji: "🥕" },
    ],
    minGrade: 0,
  },
  {
    id: "letter-story",
    skillId: "reading-sequencing",
    skillLabel: "Story order",
    subject: "Reading",
    standardCode: "RL.2.5",
    prompt: "Put the story in order: sending a letter.",
    hint: "The stamp goes on before the mailbox.",
    steps: [
      { label: "Write the letter", emoji: "✍️" },
      { label: "Seal the envelope", emoji: "✉️" },
      { label: "Add a stamp", emoji: "📮" },
      { label: "Mail it", emoji: "📬" },
    ],
    minGrade: 1,
  },
  {
    id: "water-cycle",
    skillId: "science-life-cycles",
    skillLabel: "Cycles in nature",
    subject: "Science",
    standardCode: "5-ESS2-1",
    prompt: "Put the water cycle in order, starting at the sea.",
    hint: "The sun lifts water up before clouds can form.",
    steps: [
      { label: "Water evaporates", emoji: "☀️" },
      { label: "Clouds form", emoji: "☁️" },
      { label: "Rain falls", emoji: "🌧️" },
      { label: "Rivers return it", emoji: "🏞️" },
    ],
    minGrade: 3,
  },
  {
    id: "recipe-story",
    skillId: "reading-sequencing",
    skillLabel: "Story order",
    subject: "Reading",
    standardCode: "RI.4.5",
    prompt: "Put the baking steps in order.",
    hint: "Read like a baker: nothing goes in the oven before it is mixed.",
    steps: [
      { label: "Measure the flour", emoji: "🥄" },
      { label: "Mix the batter", emoji: "🥣" },
      { label: "Bake it", emoji: "🔥" },
      { label: "Let it cool", emoji: "🧁" },
    ],
    minGrade: 2,
  },
];

function placeSequence(
  input: TaskInput,
  skillId: "reading-sequencing" | "science-life-cycles"
): KernelTask {
  const eligible = SEQUENCES.filter(
    (sequence) => sequence.skillId === skillId && sequence.minGrade <= input.grade
  );
  const pool = eligible.length > 0
    ? eligible
    : SEQUENCES.filter((sequence) => sequence.skillId === skillId);
  const random = createSeededRandom(`${input.seed}:place-${skillId}`);
  const bank = pool[Math.floor(random() * pool.length)];
  const parts = bank.steps.map((step, index) => ({
    id: `s-${index}`,
    label: step.label,
    emoji: step.emoji,
    value: index,
  }));
  return {
    id: `place-${bank.id}`,
    verb: "place",
    skillId: bank.skillId,
    skillLabel: bank.skillLabel,
    subject: bank.subject,
    standardCode: bank.standardCode,
    prompt: bank.prompt,
    hint: bank.hint,
    explanation: `The order is: ${parts.map((part) => part.label).join(" → ")}.`,
    tray: seededShuffle(parts, `${input.seed}:tray`),
    slots: parts.length,
    targetIds: parts.map((part) => part.id),
    targetValue: 0,
    format: "integer",
    denominator: 0,
    targetLabel: parts.map((part) => part.label).join(" → "),
    operation: null,
  };
}

/* ------------------------------------------------------------------ */
/* Task selection                                                      */
/* ------------------------------------------------------------------ */

/** Skills each verb can express, in default-preference order per verb. */
export const KERNEL_SKILLS: Record<KernelVerb, string[]> = {
  build: [
    "math-counting",
    "math-place-value",
    "math-addition",
    "math-subtraction",
    "math-multiplication",
    "math-division",
    "logic-patterns",
    "math-fractions",
    "math-decimals",
  ],
  place: [
    "math-counting",
    "math-place-value",
    "math-subtraction",
    "math-multiplication",
    "math-division",
    "math-fractions",
    "math-decimals",
    "writing-sentences",
    "writing-conventions",
    "reading-sequencing",
    "science-life-cycles",
  ],
};

/** The skill a run defaults to when nothing routed the child here. */
export function defaultKernelSkill(verb: KernelVerb, grade: ElementaryGrade): string {
  if (grade <= 0) return "math-counting";
  if (grade <= 2) return verb === "place" && grade === 2 ? "reading-sequencing" : "math-place-value";
  if (grade <= 4) return "math-fractions";
  return "math-decimals";
}

type KernelGenerator = (input: TaskInput) => KernelTask;

/*
 * Maps rather than plain objects: a Map has no prototype chain, so a skill id
 * arriving from a query parameter can never resolve to an inherited function
 * like `constructor`. `generatorFor` below adds the second guard.
 */
const BUILD_GENERATORS = new Map<string, KernelGenerator>([
  ["math-counting", buildCounting],
  ["math-place-value", buildPlaceValue],
  ["math-addition", buildAddition],
  ["math-subtraction", buildSubtraction],
  ["math-multiplication", buildMultiplication],
  ["math-division", buildDivision],
  ["logic-patterns", buildPatterns],
  ["math-fractions", buildFractions],
  ["math-decimals", buildDecimals],
]);

const PLACE_GENERATORS = new Map<string, KernelGenerator>([
  ["math-counting", placeCounting],
  ["math-place-value", placePlaceValue],
  ["math-fractions", placeFractions],
  ["math-decimals", placeDecimals],
  ["math-subtraction", placeSubtraction],
  ["math-multiplication", placeMultiplication],
  ["math-division", placeDivision],
  ["writing-sentences", placeWritingSentence],
  ["writing-conventions", (input) => placeWritingSentence(input, "writing-conventions")],
  ["reading-sequencing", (input) => placeSequence(input, "reading-sequencing")],
  ["science-life-cycles", (input) => placeSequence(input, "science-life-cycles")],
]);

/**
 * The generator for a verb and skill. `KERNEL_SKILLS` is the authority on
 * which skills a verb hosts, and counting is the floor every verb implements,
 * so an id the map does not carry still produces a playable round.
 */
function generatorFor(verb: KernelVerb, skillId: string): KernelGenerator {
  const generators = verb === "build" ? BUILD_GENERATORS : PLACE_GENERATORS;
  return generators.get(skillId) ?? (verb === "build" ? buildCounting : placeCounting);
}

export type KernelRunInput = {
  verb: KernelVerb;
  profileId: string;
  grade: ElementaryGrade;
  /** Explicit skill (from routing). Falls back to the grade default. */
  skillId?: string | null;
  difficultyShift?: -1 | 0 | 1;
  /** Local date key; passed in so runs are testable and stable per day. */
  dayKey: string;
};

export const KERNEL_RUN_LENGTH = 5;

/**
 * A run of tasks for one visit: same verb, same skill, varied content.
 * Same-day replays get the same run (a fair rematch); tomorrow differs.
 */
/**
 * The skill a run will actually teach.
 *
 * The requested id can arrive from a query parameter, so it is matched
 * against the verb's own skill list rather than used directly: the result
 * always comes from this module's constants, never from the request.
 */
export function resolveKernelSkill(
  verb: KernelVerb,
  grade: ElementaryGrade,
  skillId?: string | null
): string {
  return (
    KERNEL_SKILLS[verb].find((candidate) => candidate === skillId)
    ?? defaultKernelSkill(verb, grade)
  );
}

export function buildKernelRun(input: KernelRunInput): KernelTask[] {
  const requested = resolveKernelSkill(input.verb, input.grade, input.skillId);
  const generator = generatorFor(input.verb, requested);
  const shift = input.difficultyShift ?? 0;

  const tasks: KernelTask[] = [];
  const seen = new Set<string>();
  for (let round = 0; tasks.length < KERNEL_RUN_LENGTH && round < KERNEL_RUN_LENGTH * 4; round += 1) {
    const task = generator({
      seed: `${input.profileId}:${input.dayKey}:${input.verb}:${requested}:${round}`,
      grade: input.grade,
      difficultyShift: shift,
    });
    // Repeated identical targets within one run teach less than varied ones;
    // skip duplicates while the generator space allows it.
    if (seen.has(task.id) && round < KERNEL_RUN_LENGTH * 3) continue;
    seen.add(task.id);
    tasks.push({ ...task, id: `${task.id}#${tasks.length}` });
  }
  return tasks;
}
