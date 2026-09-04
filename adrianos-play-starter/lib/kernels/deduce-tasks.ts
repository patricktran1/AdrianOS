/**
 * DEDUCE: the third interaction verb.
 *
 * BUILD asks whether a child can construct an idea. PLACE asks whether they
 * can position it. DEDUCE asks something neither can: can they arrive at it
 * from relationships, without being asked for it directly?
 *
 *   BUILD   Make 47 out of tens and ones.
 *   PLACE   Put 47 where it belongs.
 *   DEDUCE  I have 4 tens. I am more than 40. Which one am I?
 *
 * Same place-value knowledge, three genuinely different demands.
 *
 * Every task here is generated from a seed, then *validated* before it is
 * returned: exactly one candidate satisfies all the clues, every clue is
 * load-bearing, and no single clue gives the answer away. A generator that
 * cannot meet that bar within its attempt budget widens the candidate pool
 * rather than shipping a broken puzzle, and the unit tests assert the
 * guarantee across thousands of seeds.
 *
 * Difficulty is a small table of named dials — how many candidates, how many
 * clues, how alike the distractors are — so "why was this one harder?" has a
 * plain answer rather than a score.
 */

import type { Game } from "@/lib/games";
import type { ElementaryGrade } from "@/lib/adrian-elementary-scope";
import { createSeededRandom, seededShuffle } from "../deterministic-random.ts";
import {
  satisfies,
  solutionsFor,
  validatePuzzle,
  type DeduceCandidate,
  type DeduceConstraint,
} from "./deduce-constraints.ts";

export type DeduceTask = {
  id: string;
  skillId: string;
  skillLabel: string;
  subject: Game["subject"];
  standardCode: string | null;
  /** Child-facing framing. Short: the clues carry the content. */
  prompt: string;
  candidates: DeduceCandidate[];
  /** Clues in reveal order. The child sees them one at a time. */
  clues: DeduceConstraint[];
  /** The single candidate satisfying every clue. */
  solutionId: string;
  /** How many clues must be read before one candidate remains. */
  cluesNeeded: number;
  /** Worked explanation, shown only after a second miss. */
  explanation: string;
  /**
   * Who "I" is in the clues.
   *
   * On a card reading "47" the clue "I am more than 35" is unambiguous. On a
   * card reading "12 - 5" it is not: the child has to be told whether the
   * clue is about the card or about what the card works out to. Carried on
   * the task so the wording is decided where the cards are made, not guessed
   * at from their labels.
   */
  voice: DeduceVoice;
};

/** How a clue refers to the card it describes. */
export type DeduceVoice = "value" | "answer" | "next";

/** Difficulty dials, so a harder task can always be explained. */
export type DeduceShape = {
  candidateCount: number;
  clueCount: number;
};

/**
 * How difficulty is expressed. Fewer candidates and fewer clues for the
 * youngest children; more of both, which also means more clue-combining, as
 * the run gets harder.
 */
export function deduceShape(
  grade: ElementaryGrade,
  difficultyShift: -1 | 0 | 1
): DeduceShape {
  const base = grade <= 0 ? 0 : grade <= 2 ? 1 : 2;
  const level = Math.max(0, Math.min(3, base + difficultyShift));
  const candidateCount = [3, 4, 4, 5][level];
  const clueCount = [2, 2, 3, 3][level];
  return { candidateCount, clueCount };
}

/** Reads a clue aloud for a child. The words live here, not in the data. */
const VOICE_SUBJECTS = new Map<DeduceVoice, { is: string; has: string }>([
  ["value", { is: "I am", has: "I have" }],
  ["answer", { is: "My answer is", has: "My answer has" }],
  ["next", { is: "My next number is", has: "My next number has" }],
]);

export function describeClue(
  clue: DeduceConstraint,
  candidates: readonly DeduceCandidate[],
  voice: DeduceVoice = "value"
): string {
  const subject = VOICE_SUBJECTS.get(voice) ?? VOICE_SUBJECTS.get("value")!;
  switch (clue.kind) {
    case "greater-than":
      return `${subject.is} more than ${clue.value}.`;
    case "less-than":
      return `${subject.is} less than ${clue.value}.`;
    case "has-digit":
      return `${subject.has} a ${clue.digit} in it.`;
    case "lacks-digit":
      return `${subject.has} no ${clue.digit} in it.`;
    case "tens-is":
      return `${subject.has} ${clue.count} tens.`;
    case "numerator-is":
      return `I am made of ${clue.value} pieces.`;
    case "denominator-is":
      return `My pieces are ${clue.value}ths.`;
    case "in-category":
      return `${subject.is} ${categoryPhrase(clue.category)}.`;
    case "not-in-category":
      return `${subject.is} not ${categoryPhrase(clue.category)}.`;
    case "comes-before":
      return `I come before ${labelFor(clue.anchorId, candidates)}.`;
    case "comes-after":
      return `I come after ${labelFor(clue.anchorId, candidates)}.`;
    default:
      return "";
  }
}

const CATEGORY_PHRASES = new Map<string, string>([
  ["even", "an even number"],
  ["odd", "an odd number"],
  ["plant", "part of a plant's life"],
  ["animal", "part of an animal's life"],
  ["morning", "something you do in the morning"],
  ["evening", "something you do at the end of the day"],
]);

function categoryPhrase(category: string): string {
  return CATEGORY_PHRASES.get(category) ?? category;
}

function labelFor(id: string, candidates: readonly DeduceCandidate[]): string {
  return candidates.find((row) => row.id === id)?.label ?? "it";
}

/* ------------------------------------------------------------------ */
/* Candidate helpers                                                   */
/* ------------------------------------------------------------------ */

function numberCandidate(value: number, emoji: string): DeduceCandidate {
  return {
    id: `n-${value}`,
    label: String(value),
    emoji,
    value,
    denominator: 0,
    attributes: [value % 2 === 0 ? "even" : "odd"],
    position: value,
  };
}

function distinctValues(
  random: () => number,
  count: number,
  min: number,
  max: number
): number[] {
  const values = new Set<number>();
  let guard = 0;
  while (values.size < count && guard < 500) {
    values.add(min + Math.floor(random() * (max - min + 1)));
    guard += 1;
  }
  return [...values];
}

/**
 * Every clue this puzzle could offer about its target, richest first.
 *
 * The generator picks from these until the validator is satisfied, which is
 * what keeps clue sets non-redundant without hand-tuning each one.
 */
/** Digits of a whole number, for clue eligibility. */
function digitsOf(value: number): number[] {
  return String(Math.abs(Math.trunc(value))).split("").map(Number);
}

/**
 * How many "I have no N in me" clues a pool may offer. Two is enough to
 * combine with a magnitude or parity clue; more crowds them out.
 */
const MAX_LACKS_DIGIT_CLUES = 2;

function numberClues(target: DeduceCandidate, others: DeduceCandidate[]): DeduceConstraint[] {
  const clues: DeduceConstraint[] = [];
  const values = others.map((row) => row.value);
  const below = values.filter((value) => value < target.value);
  const above = values.filter((value) => value > target.value);

  if (below.length > 0) clues.push({ kind: "greater-than", value: Math.max(...below) });
  if (above.length > 0) clues.push({ kind: "less-than", value: Math.min(...above) });
  if (target.value >= 10) clues.push({ kind: "tens-is", count: Math.floor(target.value / 10) % 10 });
  const targetDigits = new Set(String(target.value).split("").map(Number));
  for (const digit of targetDigits) clues.push({ kind: "has-digit", digit });
  // Capped. Ten "I have no 4 in me" clues would otherwise outnumber every
  // other kind ten to one, and a shuffled pool would hand a child three of
  // them in a row — a puzzle about reading digits rather than about the
  // idea being taught. Only digits that actually rule a candidate out are
  // offered, and only a couple of those.
  const rulingDigits = [];
  for (let digit = 0; digit <= 9; digit += 1) {
    if (targetDigits.has(digit)) continue;
    if (!others.some((row) => digitsOf(row.value).includes(digit))) continue;
    rulingDigits.push(digit);
  }
  for (const digit of rulingDigits.slice(0, MAX_LACKS_DIGIT_CLUES)) {
    clues.push({ kind: "lacks-digit", digit });
  }
  clues.push({ kind: "in-category", category: target.value % 2 === 0 ? "even" : "odd" });
  return clues;
}

/**
 * Chooses the smallest clue set that pins the target down.
 *
 * Greedy and deterministic: walk the shuffled pool, keep a clue only when it
 * removes at least one candidate that is still standing, and stop as soon as
 * one candidate remains. A clue that removes nothing new would be redundant,
 * and the validator would reject the puzzle for containing it.
 */
function chooseClues(
  candidates: DeduceCandidate[],
  target: DeduceCandidate,
  pool: DeduceConstraint[],
  wanted: number
): DeduceConstraint[] | null {
  const chosen: DeduceConstraint[] = [];
  let standing = [...candidates];

  for (const clue of pool) {
    if (chosen.length >= wanted) break;
    if (!satisfies(target, clue, candidates)) continue;
    const next = standing.filter((row) => satisfies(row, clue, candidates));
    // A clue that eliminates nobody is decoration; one that eliminates
    // everyone but the target too early makes the remaining clues pointless.
    if (next.length === standing.length) continue;
    if (next.length === 1 && chosen.length + 1 < wanted) continue;
    chosen.push(clue);
    standing = next;
  }

  if (standing.length !== 1 || standing[0].id !== target.id) return null;
  if (chosen.length < 2) return null;
  // A set made only of "I have no N in me" is a valid deduction and a poor
  // puzzle: it asks the child to read digits rather than to think about the
  // idea the task is teaching. Rejected here rather than starved out of the
  // pool, so the generator simply reshuffles and finds a better set — the
  // pool still holds these clues for the puzzles that need them to close.
  if (chosen.every((clue) => clue.kind === "lacks-digit")) return null;
  return chosen;
}

/* ------------------------------------------------------------------ */
/* Skill generators                                                    */
/* ------------------------------------------------------------------ */

type DeduceInput = {
  seed: string;
  grade: ElementaryGrade;
  shape: DeduceShape;
};

const NUMBER_EMOJI = ["🪵", "🍄", "🌿", "🪨", "🌰", "🦔"];

/**
 * Builds a number puzzle, widening the value range until the validator is
 * satisfied. Every attempt is seeded, so the same input always yields the
 * same puzzle.
 */
function numberPuzzle(
  input: DeduceInput,
  options: {
    skillId: string;
    skillLabel: string;
    standardCode: string;
    prompt: string;
    min: number;
    max: number;
  }
): DeduceTask | null {
  const random = createSeededRandom(`${input.seed}:${options.skillId}`);
  const { candidateCount, clueCount } = input.shape;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    // Widen the pool on later attempts so a cramped range cannot deadlock.
    const spread = Math.floor(attempt / 6);
    const values = distinctValues(
      random,
      candidateCount,
      options.min,
      options.max + spread * 10
    );
    if (values.length < candidateCount) continue;
    const candidates = values.map((value, index) =>
      numberCandidate(value, NUMBER_EMOJI[index % NUMBER_EMOJI.length])
    );
    const target = candidates[Math.floor(random() * candidates.length)];
    const pool = seededShuffle(
      numberClues(target, candidates.filter((row) => row.id !== target.id)),
      `${input.seed}:${options.skillId}:${attempt}`
    );
    const clues = chooseClues(candidates, target, pool, clueCount);
    if (!clues) continue;

    const report = validatePuzzle(candidates, clues);
    if (!report.usable) continue;

    return {
      id: `deduce-${options.skillId}-${target.value}-${clues.length}`,
      skillId: options.skillId,
      skillLabel: options.skillLabel,
      subject: "Math",
      standardCode: options.standardCode,
      prompt: options.prompt,
      candidates: seededShuffle(candidates, `${input.seed}:layout:${attempt}`),
      clues,
      solutionId: target.id,
      cluesNeeded: report.cluesNeeded,
      explanation: `${target.label} is the only one that fits every clue.`,
      voice: "value",
    };
  }
  return null;
}

/**
 * A puzzle whose cards are working, not answers.
 *
 * Structurally the same deduction as a number puzzle — the clues are about a
 * value, and one card survives them all — but the value is not written on
 * the card. Nothing can be eliminated until the child has worked each card
 * out, which is what makes this evidence about the operation rather than
 * about reading numerals.
 */
function expressionPuzzle(
  input: DeduceInput,
  options: {
    skillId: string;
    skillLabel: string;
    subject: Game["subject"];
    standardCode: string;
    prompt: string;
    voice: DeduceVoice;
    /** One card. Called until enough distinct values are drawn. */
    draw: (random: () => number) => { label: string; value: number };
  }
): DeduceTask | null {
  const random = createSeededRandom(`${input.seed}:${options.skillId}`);
  const { candidateCount, clueCount } = input.shape;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const drawn: Array<{ label: string; value: number }> = [];
    const seen = new Set<number>();
    // Distinct values, or two cards could both answer the same clues.
    for (let guard = 0; guard < 200 && drawn.length < candidateCount; guard += 1) {
      const card = options.draw(random);
      if (seen.has(card.value)) continue;
      seen.add(card.value);
      drawn.push(card);
    }
    if (drawn.length < candidateCount) continue;

    const candidates: DeduceCandidate[] = drawn.map((card, index) => ({
      id: `x-${index}-${card.value}`,
      label: card.label,
      emoji: NUMBER_EMOJI[index % NUMBER_EMOJI.length],
      value: card.value,
      denominator: 0,
      attributes: [card.value % 2 === 0 ? "even" : "odd"],
      position: card.value,
    }));
    const target = candidates[Math.floor(random() * candidates.length)];
    const pool = seededShuffle(
      numberClues(target, candidates.filter((row) => row.id !== target.id)),
      `${input.seed}:${options.skillId}:${attempt}`
    );
    const clues = chooseClues(candidates, target, pool, clueCount);
    if (!clues) continue;

    const report = validatePuzzle(candidates, clues);
    if (!report.usable) continue;

    return {
      id: `deduce-${options.skillId}-${target.value}-${clues.length}`,
      skillId: options.skillId,
      skillLabel: options.skillLabel,
      subject: options.subject,
      standardCode: options.standardCode,
      prompt: options.prompt,
      candidates: seededShuffle(candidates, `${input.seed}:layout:${attempt}`),
      clues,
      solutionId: target.id,
      cluesNeeded: report.cluesNeeded,
      explanation: `${target.label} makes ${target.value}, and that is the only one that fits every clue.`,
      voice: options.voice,
    };
  }
  return null;
}

function deduceSubtraction(input: DeduceInput): DeduceTask | null {
  const small = input.grade <= 1;
  return expressionPuzzle(input, {
    skillId: "math-subtraction",
    skillLabel: "Subtraction",
    subject: "Math",
    standardCode: small ? "K.OA.A.2" : "2.OA.B.2",
    prompt: "Work out each card. Which answer am I?",
    voice: "answer",
    draw: (random) => {
      const left = 5 + Math.floor(random() * (small ? 6 : 15));
      const right = 1 + Math.floor(random() * Math.min(left - 1, small ? 4 : 9));
      return { label: `${left} - ${right}`, value: left - right };
    },
  });
}

function deduceMultiplication(input: DeduceInput): DeduceTask | null {
  const small = input.grade <= 2;
  return expressionPuzzle(input, {
    skillId: "math-multiplication",
    skillLabel: "Multiplication",
    subject: "Math",
    standardCode: small ? "2.OA.C.4" : "3.OA.A.1",
    prompt: "Work out each card. Which answer am I?",
    voice: "answer",
    draw: (random) => {
      const left = 2 + Math.floor(random() * (small ? 3 : 5));
      const right = 2 + Math.floor(random() * (small ? 4 : 6));
      return { label: `${left} x ${right}`, value: left * right };
    },
  });
}

function deducePatterns(input: DeduceInput): DeduceTask | null {
  const small = input.grade <= 1;
  return expressionPuzzle(input, {
    skillId: "logic-patterns",
    skillLabel: "Patterns",
    subject: "Logic",
    standardCode: small ? "1.OA.C.5" : "4.OA.C.5",
    prompt: "Each pattern keeps going. Which one's next number am I?",
    voice: "next",
    draw: (random) => {
      const step = small ? 1 + Math.floor(random() * 2) : 2 + Math.floor(random() * 4);
      const start = 1 + Math.floor(random() * (small ? 3 : 6));
      const shown = Array.from({ length: 3 }, (_, index) => start + index * step);
      return {
        label: `${shown.join(", ")}, ...`,
        value: start + 3 * step,
      };
    },
  });
}

function deduceCounting(input: DeduceInput): DeduceTask | null {
  return numberPuzzle(input, {
    skillId: "math-counting",
    skillLabel: "Counting",
    standardCode: input.grade <= -1 ? "TK.CC.2" : "K.CC.A.2",
    prompt: "Which one am I?",
    min: 2,
    max: input.grade <= 0 ? 12 : 20,
  });
}

function deducePlaceValue(input: DeduceInput): DeduceTask | null {
  return numberPuzzle(input, {
    skillId: "math-place-value",
    skillLabel: "Place value",
    standardCode: "1.NBT.B.3",
    prompt: "Which number am I?",
    min: 12,
    max: 99,
  });
}

function deduceFractions(input: DeduceInput): DeduceTask | null {
  const random = createSeededRandom(`${input.seed}:math-fractions`);
  // A fraction is pinned down by two facts — how big the pieces are and how
  // many there are — so more clues than that would have to be padding.
  // Difficulty comes from more look-alike pieces instead, which is the
  // honest dial here.
  const { candidateCount } = input.shape;
  const clueCount = 2;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const denominators = [2, 3, 4, 6, 8];
    const pool: DeduceCandidate[] = [];
    for (const denominator of denominators) {
      for (let numerator = 1; numerator < denominator; numerator += 1) {
        pool.push({
          id: `f-${numerator}-${denominator}`,
          label: `${numerator}/${denominator}`,
          emoji: "🍰",
          value: numerator,
          denominator,
          attributes: [`den:${denominator}`],
          position: numerator / denominator,
        });
      }
    }
    const picked = seededShuffle(pool, `${input.seed}:frac:${attempt}`).slice(0, candidateCount);
    if (picked.length < candidateCount) continue;
    const target = picked[Math.floor(random() * picked.length)];

    const clues: DeduceConstraint[] = [
      { kind: "denominator-is", value: target.denominator },
      { kind: "numerator-is", value: target.value },
    ];
    const shuffled = seededShuffle(clues, `${input.seed}:fracclue:${attempt}`);
    const chosen = chooseClues(picked, target, shuffled, clueCount);
    if (!chosen) continue;

    const report = validatePuzzle(picked, chosen);
    if (!report.usable) continue;

    return {
      id: `deduce-fractions-${target.value}-${target.denominator}`,
      skillId: "math-fractions",
      skillLabel: "Fractions",
      subject: "Math",
      standardCode: "3.NF.A.1",
      prompt: "Which piece am I?",
      candidates: seededShuffle(picked, `${input.seed}:fraclayout:${attempt}`),
      clues: chosen,
      solutionId: target.id,
      cluesNeeded: report.cluesNeeded,
      explanation: `${target.label} is the only one that fits every clue.`,
      voice: "value",
    };
  }
  return null;
}

/** Ordered real-world sequences, reused as before/after deduction. */
const SEQUENCES: Array<{
  id: string;
  skillId: "reading-sequencing" | "science-life-cycles";
  skillLabel: string;
  subject: Game["subject"];
  standardCode: string;
  prompt: string;
  category: string;
  minGrade: ElementaryGrade;
  steps: Array<{ label: string; emoji: string }>;
}> = [
  {
    id: "frog",
    skillId: "science-life-cycles",
    skillLabel: "Life cycles",
    subject: "Science",
    standardCode: "3-LS1-1",
    prompt: "Which stage am I?",
    category: "animal",
    minGrade: 0,
    steps: [
      { label: "Egg", emoji: "🥚" },
      { label: "Tadpole", emoji: "🐟" },
      { label: "Froglet", emoji: "🐸" },
      { label: "Frog", emoji: "🐸" },
      { label: "New eggs", emoji: "🫧" },
    ],
  },
  {
    id: "butterfly",
    skillId: "science-life-cycles",
    skillLabel: "Life cycles",
    subject: "Science",
    standardCode: "3-LS1-1",
    prompt: "Which stage am I?",
    category: "animal",
    minGrade: -1,
    steps: [
      { label: "Egg", emoji: "🥚" },
      { label: "Caterpillar", emoji: "🐛" },
      { label: "Chrysalis", emoji: "🛡️" },
      { label: "Butterfly", emoji: "🦋" },
      { label: "New eggs", emoji: "🫧" },
    ],
  },
  {
    id: "plant",
    skillId: "science-life-cycles",
    skillLabel: "Life cycles",
    subject: "Science",
    standardCode: "K-LS1-1",
    prompt: "Which stage am I?",
    category: "plant",
    minGrade: -1,
    steps: [
      { label: "Seed", emoji: "🌰" },
      { label: "Sprout", emoji: "🌱" },
      { label: "Bud", emoji: "🌿" },
      { label: "Flower", emoji: "🌸" },
      { label: "New seeds", emoji: "🌾" },
    ],
  },
  {
    id: "cake",
    skillId: "reading-sequencing",
    skillLabel: "Story order",
    subject: "Reading",
    standardCode: "RL.1.2",
    prompt: "Which part of the story am I?",
    category: "evening",
    minGrade: -1,
    steps: [
      { label: "Mix it", emoji: "🥣" },
      { label: "Bake it", emoji: "🔥" },
      { label: "Cool it", emoji: "🧁" },
      { label: "Ice it", emoji: "🎂" },
      { label: "Share it", emoji: "🍽️" },
    ],
  },
  {
    id: "day",
    skillId: "reading-sequencing",
    skillLabel: "Story order",
    subject: "Reading",
    standardCode: "RL.1.2",
    prompt: "Which part of the story am I?",
    category: "morning",
    minGrade: -1,
    steps: [
      { label: "Wake up", emoji: "⏰" },
      { label: "Get dressed", emoji: "👕" },
      { label: "Eat breakfast", emoji: "🥣" },
      { label: "Go to school", emoji: "🎒" },
      { label: "Come home", emoji: "🏡" },
    ],
  },
];

function deduceSequence(
  input: DeduceInput,
  skillId: "reading-sequencing" | "science-life-cycles"
): DeduceTask | null {
  const eligible = SEQUENCES.filter(
    (row) => row.skillId === skillId && row.minGrade <= input.grade
  );
  const pool = eligible.length > 0 ? eligible : SEQUENCES.filter((row) => row.skillId === skillId);
  if (pool.length === 0) return null;

  const random = createSeededRandom(`${input.seed}:${skillId}`);
  const bank = pool[Math.floor(random() * pool.length)];
  const { candidateCount } = input.shape;

  const all: DeduceCandidate[] = bank.steps.map((step, index) => ({
    id: `s-${bank.id}-${index}`,
    label: step.label,
    emoji: step.emoji,
    value: index,
    denominator: 0,
    attributes: [bank.category],
    position: index,
  }));

  for (let attempt = 0; attempt < 24; attempt += 1) {
    // Keep the stages in their natural order on screen: this is a deduction
    // task, not a hidden ordering task.
    const start = Math.floor(random() * Math.max(1, all.length - candidateCount + 1));
    const candidates = all.slice(start, start + candidateCount);
    if (candidates.length < 3) continue;
    const target = candidates[Math.floor(random() * candidates.length)];

    const clues: DeduceConstraint[] = [];
    const earlier = candidates.filter((row) => row.position < target.position);
    const later = candidates.filter((row) => row.position > target.position);
    if (earlier.length > 0) {
      clues.push({ kind: "comes-after", anchorId: earlier[earlier.length - 1].id });
    }
    if (later.length > 0) clues.push({ kind: "comes-before", anchorId: later[0].id });
    if (clues.length < 2) continue;

    const report = validatePuzzle(candidates, clues);
    if (!report.usable) continue;

    return {
      id: `deduce-${bank.id}-${target.position}`,
      skillId: bank.skillId,
      skillLabel: bank.skillLabel,
      subject: bank.subject,
      standardCode: bank.standardCode,
      prompt: bank.prompt,
      candidates,
      clues,
      solutionId: target.id,
      cluesNeeded: report.cluesNeeded,
      explanation: `${target.label} is the only one that fits every clue.`,
      voice: "value",
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Run assembly                                                        */
/* ------------------------------------------------------------------ */

const GENERATORS = new Map<string, (input: DeduceInput) => DeduceTask | null>([
  ["math-counting", deduceCounting],
  ["math-place-value", deducePlaceValue],
  ["math-subtraction", deduceSubtraction],
  ["math-multiplication", deduceMultiplication],
  ["logic-patterns", deducePatterns],
  ["math-fractions", deduceFractions],
  ["reading-sequencing", (input) => deduceSequence(input, "reading-sequencing")],
  ["science-life-cycles", (input) => deduceSequence(input, "science-life-cycles")],
]);

/** Skills DEDUCE can express, in preference order. */
export const DEDUCE_SKILLS: string[] = [
  "math-counting",
  "math-place-value",
  "math-subtraction",
  "math-multiplication",
  "logic-patterns",
  "math-fractions",
  "reading-sequencing",
  "science-life-cycles",
];

export function defaultDeduceSkill(grade: ElementaryGrade): string {
  if (grade <= 0) return "math-counting";
  if (grade <= 2) return "math-place-value";
  if (grade <= 4) return "math-fractions";
  return "math-fractions";
}

/**
 * The skill a run will teach. Matched against this module's own list rather
 * than used directly, because it can arrive from a query parameter.
 */
export function resolveDeduceSkill(
  grade: ElementaryGrade,
  skillId?: string | null
): string {
  return (
    DEDUCE_SKILLS.find((candidate) => candidate === skillId) ?? defaultDeduceSkill(grade)
  );
}

export const DEDUCE_RUN_LENGTH = 4;

export type DeduceRunInput = {
  profileId: string;
  grade: ElementaryGrade;
  skillId?: string | null;
  difficultyShift?: -1 | 0 | 1;
  dayKey: string;
};

/**
 * A run of validated puzzles for one visit.
 *
 * Only puzzles that pass validation are included, so a run is never padded
 * with a broken mystery. A generator that cannot produce enough for a given
 * seed yields a shorter run, which is a better outcome than an unsolvable
 * one; the tests assert full-length runs across the seed space.
 */
export function buildDeduceRun(input: DeduceRunInput): DeduceTask[] {
  const skillId = resolveDeduceSkill(input.grade, input.skillId);
  const generate = GENERATORS.get(skillId);
  if (!generate) return [];
  const shape = deduceShape(input.grade, input.difficultyShift ?? 0);

  const tasks: DeduceTask[] = [];
  const seen = new Set<string>();
  for (let round = 0; tasks.length < DEDUCE_RUN_LENGTH && round < DEDUCE_RUN_LENGTH * 8; round += 1) {
    const task = generate({
      seed: `${input.profileId}:${input.dayKey}:deduce:${skillId}:${round}`,
      grade: input.grade,
      shape,
    });
    if (!task) continue;
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    tasks.push({ ...task, id: `${task.id}#${tasks.length}` });
  }
  return tasks;
}

/** Re-exported so callers need only one import for a run. */
export { solutionsFor };
