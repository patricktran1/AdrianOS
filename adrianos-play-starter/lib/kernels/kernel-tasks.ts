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
};

export type KernelJudgement = {
  correct: boolean;
  /**
   * Canonical form of what the child actually made — the composed value for
   * BUILD, the chosen sequence for PLACE. Deterministic, so the same mistake
   * made twice clusters as the same misconception.
   */
  canonicalAnswer: string;
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
    return {
      correct: chosen.length > 0 && nearlyEqual(total, task.targetValue),
      canonicalAnswer: formatBuildTotal(task, total),
    };
  }
  const sequence = chosen.map((part) => part.id);
  const correct =
    sequence.length === task.targetIds.length
    && sequence.every((id, index) => id === task.targetIds[index]);
  return {
    correct,
    canonicalAnswer: chosen.map((part) => part.label).join(", "),
  };
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001;
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
    ...meta,
  };
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
    "math-fractions",
    "math-decimals",
  ],
  place: [
    "math-counting",
    "math-place-value",
    "math-fractions",
    "math-decimals",
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

const BUILD_GENERATORS: Record<string, (input: TaskInput) => KernelTask> = {
  "math-counting": buildCounting,
  "math-place-value": buildPlaceValue,
  "math-addition": buildAddition,
  "math-fractions": buildFractions,
  "math-decimals": buildDecimals,
};

const PLACE_GENERATORS: Record<string, (input: TaskInput) => KernelTask> = {
  "math-counting": placeCounting,
  "math-place-value": placePlaceValue,
  "math-fractions": placeFractions,
  "math-decimals": placeDecimals,
  "reading-sequencing": (input) => placeSequence(input, "reading-sequencing"),
  "science-life-cycles": (input) => placeSequence(input, "science-life-cycles"),
};

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
export function buildKernelRun(input: KernelRunInput): KernelTask[] {
  const generators = input.verb === "build" ? BUILD_GENERATORS : PLACE_GENERATORS;
  // skillId can arrive from a query parameter, so only own keys count: a
  // plain `generators[skillId]` lookup would let "constructor" or
  // "toString" dispatch to an inherited function instead of a generator.
  const requested = input.skillId && Object.prototype.hasOwnProperty.call(generators, input.skillId)
    ? input.skillId
    : defaultKernelSkill(input.verb, input.grade);
  const generator = generators[requested];
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
