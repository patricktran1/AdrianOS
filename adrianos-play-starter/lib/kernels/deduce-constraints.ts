/**
 * Clues as data, and the validator that keeps them honest.
 *
 * A clue here is not a sentence with an answer hidden in it. It is a
 * constraint — `{ kind: "greater-than", value: 35 }` — that every candidate
 * either satisfies or does not. Three things follow from that, and they are
 * the whole reason for this module:
 *
 * 1. **Puzzles can be verified rather than trusted.** Before a task reaches
 *    a child, the validator proves it has exactly one answer, that every clue
 *    is load-bearing, and that no single clue gives the game away.
 *
 * 2. **A wrong move can be described.** When a child rules out a candidate,
 *    we can say whether any revealed clue actually rules it out. That turns
 *    "wrong" into "ruled out a card that nothing said to rule out", which is
 *    an observation worth acting on.
 *
 * 3. **The words stay in the view layer.** The same constraint reads as
 *    "It is more than 35" for a seven-year-old and as `greater-than 35` in
 *    an error signature, without either one being parsed from the other.
 *
 * Everything is pure and total. Candidate sets are small (three to six), so
 * validation is exhaustive rather than clever: no solver, no search, no
 * dependency.
 */

/** A thing the child can rule out. */
export type DeduceCandidate = {
  id: string;
  /** What the child reads on the card: "47", "3/4", "Tadpole". */
  label: string;
  emoji: string;
  /** Numeric worth, in whole units or in numerator units for fractions. */
  value: number;
  /** Fractions only: the denominator this candidate is cut into. */
  denominator: number;
  /** Category tags — "plant-eater", "cycle:frog". Never free text from a child. */
  attributes: string[];
  /** Ordinal position within a sequence, for before/after clues. */
  position: number;
};

/**
 * The constraint vocabulary. Deliberately small: a kind earns its place only
 * when it is decidable from candidate data alone and reads naturally to a
 * child.
 */
export type DeduceConstraint =
  | { kind: "greater-than"; value: number }
  | { kind: "less-than"; value: number }
  | { kind: "has-digit"; digit: number }
  | { kind: "lacks-digit"; digit: number }
  | { kind: "tens-is"; count: number }
  | { kind: "numerator-is"; value: number }
  | { kind: "denominator-is"; value: number }
  | { kind: "in-category"; category: string }
  | { kind: "not-in-category"; category: string }
  | { kind: "comes-before"; anchorId: string }
  | { kind: "comes-after"; anchorId: string };

export type DeduceConstraintKind = DeduceConstraint["kind"];

/** Every kind, as the authority for validating anything read from storage. */
export const DEDUCE_CONSTRAINT_KINDS: readonly DeduceConstraintKind[] = [
  "greater-than",
  "less-than",
  "has-digit",
  "lacks-digit",
  "tens-is",
  "numerator-is",
  "denominator-is",
  "in-category",
  "not-in-category",
  "comes-before",
  "comes-after",
] as const;

const KIND_SET = new Set<string>(DEDUCE_CONSTRAINT_KINDS);

export function isDeduceConstraintKind(value: unknown): value is DeduceConstraintKind {
  return typeof value === "string" && KIND_SET.has(value);
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

function digitsOf(value: number): number[] {
  return String(Math.abs(Math.trunc(value))).split("").map(Number);
}

/**
 * Does this candidate satisfy this clue?
 *
 * `universe` is needed only for before/after, which are relationships
 * between candidates rather than properties of one. An anchor that is not in
 * the universe makes the clue unsatisfiable rather than throwing: a puzzle
 * built that way fails validation loudly instead of reaching a child.
 */
export function satisfies(
  candidate: DeduceCandidate,
  constraint: DeduceConstraint,
  universe: readonly DeduceCandidate[] = []
): boolean {
  switch (constraint.kind) {
    case "greater-than":
      return candidate.value > constraint.value;
    case "less-than":
      return candidate.value < constraint.value;
    case "has-digit":
      return digitsOf(candidate.value).includes(constraint.digit);
    case "lacks-digit":
      return !digitsOf(candidate.value).includes(constraint.digit);
    case "tens-is":
      return Math.floor(candidate.value / 10) % 10 === constraint.count;
    case "numerator-is":
      return candidate.value === constraint.value;
    case "denominator-is":
      return candidate.denominator === constraint.value;
    case "in-category":
      return candidate.attributes.includes(constraint.category);
    case "not-in-category":
      return !candidate.attributes.includes(constraint.category);
    case "comes-before": {
      const anchor = universe.find((row) => row.id === constraint.anchorId);
      return anchor ? candidate.position < anchor.position : false;
    }
    case "comes-after": {
      const anchor = universe.find((row) => row.id === constraint.anchorId);
      return anchor ? candidate.position > anchor.position : false;
    }
    default:
      return false;
  }
}

/** Every candidate that satisfies every constraint. */
export function solutionsFor(
  candidates: readonly DeduceCandidate[],
  constraints: readonly DeduceConstraint[]
): DeduceCandidate[] {
  return candidates.filter((candidate) =>
    constraints.every((constraint) => satisfies(candidate, constraint, candidates))
  );
}

/**
 * Whether a set of revealed clues rules a candidate out.
 *
 * This is what makes an elimination checkable: a child who rules out a card
 * that nothing revealed contradicts has done something observably different
 * from one working through the clues, whatever the final answer turns out
 * to be.
 */
export function isRuledOut(
  candidate: DeduceCandidate,
  revealed: readonly DeduceConstraint[],
  universe: readonly DeduceCandidate[]
): boolean {
  return revealed.some((constraint) => !satisfies(candidate, constraint, universe));
}

/** The first revealed clue that rules a candidate out, if any. */
export function rulingConstraint(
  candidate: DeduceCandidate,
  revealed: readonly DeduceConstraint[],
  universe: readonly DeduceCandidate[]
): DeduceConstraint | null {
  return revealed.find((constraint) => !satisfies(candidate, constraint, universe)) ?? null;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type PuzzleReport = {
  /** How many candidates satisfy every clue. A usable puzzle has exactly 1. */
  solutionCount: number;
  /** Indices of clues that can be dropped without admitting another answer. */
  redundant: number[];
  /**
   * Indices of clues that on their own leave a single candidate. Such a clue
   * makes the rest of the puzzle decoration, so a task meant to require
   * combining clues must not contain one.
   */
  trivial: number[];
  /** How many clues, taken in order, are needed before one candidate remains. */
  cluesNeeded: number;
  /** True when the puzzle is fit to show a child. */
  usable: boolean;
};

/**
 * Checks a puzzle exhaustively.
 *
 * Runs during generation *and* in tests, so a generator change that starts
 * emitting two-answer puzzles fails at the source rather than in front of a
 * child.
 */
export function validatePuzzle(
  candidates: readonly DeduceCandidate[],
  constraints: readonly DeduceConstraint[]
): PuzzleReport {
  const solutionCount = solutionsFor(candidates, constraints).length;

  const redundant: number[] = [];
  const trivial: number[] = [];
  for (let index = 0; index < constraints.length; index += 1) {
    const without = constraints.filter((_, other) => other !== index);
    // Dropping a load-bearing clue lets another candidate back in.
    if (solutionsFor(candidates, without).length === solutionCount) redundant.push(index);
    if (solutionsFor(candidates, [constraints[index]]).length === 1) trivial.push(index);
  }

  // How far down the list a child must read before one candidate is left.
  let cluesNeeded = constraints.length;
  for (let count = 1; count <= constraints.length; count += 1) {
    if (solutionsFor(candidates, constraints.slice(0, count)).length === 1) {
      cluesNeeded = count;
      break;
    }
  }

  const usable =
    candidates.length >= 3
    && constraints.length >= 2
    && solutionCount === 1
    && redundant.length === 0
    && trivial.length === 0;

  return { solutionCount, redundant, trivial, cluesNeeded, usable };
}
