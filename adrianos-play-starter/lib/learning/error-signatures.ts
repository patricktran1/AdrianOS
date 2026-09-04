/**
 * Deterministic error signatures.
 *
 * A wrong answer is not one thing. "Build 47" answered as "7" and "Build 36"
 * answered as "6" are the same observable error — the tens were left out —
 * even though the literal answers share no characters. Clustering on the
 * literal string sees two unrelated one-off mistakes and learns nothing.
 *
 * This module turns a *structured* comparison of expected and submitted
 * responses into a small vocabulary of observable relationships. Two rules
 * govern everything here:
 *
 * 1. **Structure in, not text in.** Signatures are computed where the task
 *    structure is known — at the moment of answering — never reverse-engineered
 *    from stored prose. A game that cannot describe its task structurally
 *    simply reports no signature, which is a perfectly good answer.
 *
 * 2. **Describe, never diagnose.** `place-value.tens-omitted` states a
 *    relationship between two numbers. `child-does-not-understand-place-value`
 *    would be a claim about a mind we cannot see. Only the first kind of
 *    statement belongs in stored evidence.
 *
 * Everything is pure, deterministic, and unit-testable without a browser.
 * No model, heuristic, or network call participates.
 */

/**
 * The observable relationships this system can currently recognise.
 *
 * Deliberately small. A signature earns its place only when it can be
 * inferred deterministically from structured task data and would plausibly
 * change what AdrianOS does next.
 */
export type ErrorSignature =
  // Whole numbers
  | "place-value.tens-omitted"
  | "place-value.ones-omitted"
  | "place-value.digits-transposed"
  | "number.off-by-one"
  | "number.magnitude-displaced"
  | "count.short-by-one"
  | "count.over-by-one"
  // Fractions
  | "fraction.numerator-changed"
  | "fraction.denominator-changed"
  | "fraction.inverted"
  | "fraction.equivalent-form"
  // Ordered sequences
  | "sequence.adjacent-swap"
  | "sequence.reversed"
  | "sequence.first-last-swapped"
  | "sequence.cyclic-shift"
  | "sequence.incomplete"
  // Comparisons
  | "comparison.reversed"
  // Operations: the child worked, but worked the wrong operation. Only
  // claimable where the task itself names its operands, so the confused
  // result can be computed rather than guessed at from the answer alone.
  | "operation.added-instead-of-subtracted"
  | "operation.subtracted-instead-of-added"
  | "operation.added-instead-of-multiplied"
  | "operation.subtracted-instead-of-divided"
  // Growing patterns
  | "pattern.previous-term-repeated"
  // Deduction: relationships between the clues on screen and the cards
  // ruled in or out. Never a claim about why.
  | "deduce.comparison-ignored"
  | "deduce.order-relation-ignored"
  | "deduce.fraction-part-confused"
  | "deduce.contradicted-card-kept"
  | "deduce.decided-before-enough-clues"
  | "deduce.ruled-out-without-a-reason";

/**
 * Parent-facing wording. Observation only: what was seen, never why.
 *
 * A Map rather than an object literal: signatures arrive from stored
 * evidence, which a corrupted or hand-edited profile can control. On a plain
 * object, `"constructor" in phrases` is true and the lookup yields native
 * function source — which would then be validated as a real signature and
 * printed to a parent. A Map has no prototype to walk.
 */
const SIGNATURE_PHRASES = new Map<ErrorSignature, string>(Object.entries({
  "place-value.tens-omitted": "built only the ones and left the tens out",
  "place-value.ones-omitted": "built only the tens and left the ones out",
  "place-value.digits-transposed": "swapped the tens and the ones",
  "number.off-by-one": "landed one away from the answer",
  "number.magnitude-displaced": "was out by a factor of ten",
  "count.short-by-one": "counted one short",
  "count.over-by-one": "counted one too many",
  "fraction.numerator-changed": "kept the piece size but used a different number of pieces",
  "fraction.denominator-changed": "kept the number of pieces but used a different piece size",
  "fraction.inverted": "turned the fraction upside down",
  "fraction.equivalent-form": "gave an equal value written a different way",
  "sequence.adjacent-swap": "swapped two steps that sit next to each other",
  "sequence.reversed": "put the whole order backwards",
  "sequence.first-last-swapped": "swapped the first step with the last",
  "sequence.cyclic-shift": "started the order in the wrong place",
  "sequence.incomplete": "left the order unfinished",
  "comparison.reversed": "compared the two the wrong way round",
  "operation.added-instead-of-subtracted": "added the two numbers instead of taking one away",
  "operation.subtracted-instead-of-added": "took one number away instead of adding them",
  "operation.added-instead-of-multiplied": "added the two numbers instead of making groups of them",
  "operation.subtracted-instead-of-divided": "took one number away instead of sharing into groups",
  "pattern.previous-term-repeated": "repeated the last step instead of continuing the pattern",
  "deduce.comparison-ignored": "kept a card that the more-than or less-than clue rules out",
  "deduce.order-relation-ignored": "kept a card that the before or after clue rules out",
  "deduce.fraction-part-confused": "mixed up how many pieces with how big the pieces are",
  "deduce.contradicted-card-kept": "kept a card that one of the shown clues rules out",
  "deduce.decided-before-enough-clues": "settled on an answer before enough clues were shown",
  "deduce.ruled-out-without-a-reason": "crossed out a card that no shown clue ruled out",
}) as [ErrorSignature, string][]);

export function describeSignature(signature: string): string | null {
  return SIGNATURE_PHRASES.get(signature as ErrorSignature) ?? null;
}

export function isKnownSignature(value: unknown): value is ErrorSignature {
  return typeof value === "string" && SIGNATURE_PHRASES.has(value as ErrorSignature);
}

/**
 * Which teaching representation tends to make a signature concrete.
 *
 * This is a routing hint, not a claim about the child: an ordering error is
 * easier to see on a track, and a composition error is easier to see with
 * parts in your hands.
 */
export function signatureFavoursVerb(signature: string): "build" | "place" | null {
  if (signature.startsWith("place-value.") || signature.startsWith("count.")) return "build";
  if (signature.startsWith("sequence.")) return "place";
  if (signature === "number.magnitude-displaced") return "place";
  if (signature.startsWith("fraction.")) return "build";
  if (signature === "comparison.reversed") return "place";
  // A child who is not yet using the clue relationships is helped more by
  // seeing the idea concretely than by another mystery.
  if (signature === "deduce.comparison-ignored") return "place";
  if (signature === "deduce.order-relation-ignored") return "place";
  if (signature === "deduce.fraction-part-confused") return "build";
  // Working the wrong operation is a question of what the operation *does*,
  // which is what having the parts in your hands shows.
  if (signature.startsWith("operation.")) return "build";
  if (signature === "pattern.previous-term-repeated") return "build";
  return null;
}

/* ------------------------------------------------------------------ */
/* Whole numbers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Compares two whole numbers structurally.
 *
 * `composed` marks a task where the child assembled the value out of parts
 * (BUILD), which is what makes "the tens were never added" a meaningful
 * observation rather than an arithmetic slip.
 */
export function integerSignature(
  expected: number,
  submitted: number,
  options: { composed?: boolean } = {}
): ErrorSignature | null {
  if (!Number.isFinite(expected) || !Number.isFinite(submitted)) return null;
  if (expected === submitted) return null;
  if (!Number.isInteger(expected) || !Number.isInteger(submitted)) return null;
  if (expected < 0 || submitted < 0) return null;

  const tens = Math.floor(expected / 10) % 10;
  const ones = expected % 10;

  if (expected >= 10) {
    // 47 answered as 7: every ten is missing from the composition.
    if (submitted === ones && ones !== 0) return "place-value.tens-omitted";
    // 47 answered as 40: the loose ones never went in.
    if (submitted === expected - ones && ones !== 0) return "place-value.ones-omitted";
    // 47 answered as 74. Only meaningful when the digits actually differ.
    if (expected < 100 && tens !== ones && submitted === ones * 10 + tens) {
      return "place-value.digits-transposed";
    }
  }

  // A single unit either way. On a composition task this is a counting slip;
  // elsewhere it is the classic fencepost error.
  if (Math.abs(expected - submitted) === 1) {
    if (options.composed) {
      return submitted < expected ? "count.short-by-one" : "count.over-by-one";
    }
    return "number.off-by-one";
  }

  if (submitted === expected * 10 || (expected % 10 === 0 && submitted === expected / 10)) {
    return "number.magnitude-displaced";
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */

/** The arithmetic a task asks for. */
export type ArithmeticOperation = "add" | "subtract" | "multiply" | "divide";

/**
 * Names the case where a child worked a different operation than the one
 * asked for.
 *
 * This is the observation a construction task can make and a multiple-choice
 * task cannot: "12 take away 5" answered as 17 is not a slip near 7, it is a
 * complete and correct addition of the two numbers on screen. Distinguishing
 * the two changes what to teach — the first needs more practice, the second
 * needs the operation itself made concrete.
 *
 * Deliberately narrow. Only the confusion that the operands actually produce
 * is claimed, and only when it differs from the right answer: 2 + 2 and
 * 2 x 2 are both 4, and there is nothing to observe about a child who
 * answers 4.
 */
export function operationSignature(
  operation: ArithmeticOperation,
  left: number,
  right: number,
  submitted: number
): ErrorSignature | null {
  if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(submitted)) {
    return null;
  }
  const sum = left + right;
  const difference = left - right;

  switch (operation) {
    case "subtract":
      return submitted === sum && sum !== difference
        ? "operation.added-instead-of-subtracted"
        : null;
    case "add":
      return submitted === difference && difference !== sum
        ? "operation.subtracted-instead-of-added"
        : null;
    case "multiply":
      return submitted === sum && sum !== left * right
        ? "operation.added-instead-of-multiplied"
        : null;
    case "divide":
      return right !== 0 && submitted === difference && difference !== left / right
        ? "operation.subtracted-instead-of-divided"
        : null;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Fractions                                                           */
/* ------------------------------------------------------------------ */

export type FractionValue = { numerator: number; denominator: number };

export function fractionSignature(
  expected: FractionValue,
  submitted: FractionValue
): ErrorSignature | null {
  const { numerator: en, denominator: ed } = expected;
  const { numerator: sn, denominator: sd } = submitted;
  if (![en, ed, sn, sd].every((value) => Number.isInteger(value))) return null;
  if (ed <= 0 || sd <= 0) return null;
  if (en === sn && ed === sd) return null;

  // 3/4 answered as 4/3. Checked first: it is a more specific observation
  // than either half changing on its own.
  if (sn === ed && sd === en && en !== ed) return "fraction.inverted";
  // 2/4 for 1/2 is the right amount written differently, which is a very
  // different situation from getting the amount wrong.
  if (en * sd === sn * ed) return "fraction.equivalent-form";
  if (sn === en) return "fraction.denominator-changed";
  if (sd === ed) return "fraction.numerator-changed";
  return null;
}

/**
 * Greater-than answered as less-than, or the reverse. Equality is excluded:
 * choosing "=" is a different observation, not a reversal.
 */
export function comparisonSignature(
  expected: string,
  submitted: string
): ErrorSignature | null {
  const pair = new Set([expected, submitted]);
  return pair.size === 2 && pair.has(">") && pair.has("<")
    ? "comparison.reversed"
    : null;
}

/* ------------------------------------------------------------------ */
/* Ordered sequences                                                   */
/* ------------------------------------------------------------------ */

/*
 * Joins ids into one comparable string. A part id can hold any character a
 * skill author types, so the separator has to be one that cannot appear in
 * an id; U+0000 is the only such character. Written as an escape rather than
 * the byte itself, because a literal NUL in the source makes grep and file(1)
 * class this module as binary and skip it in every code search.
 */
const SEPARATOR = "\u0000";

/**
 * Compares two orderings of the same items.
 *
 * Returns null when the submission is not a permutation of the expected
 * items, because then the child was answering a different question than the
 * one this comparison assumes.
 */
export function sequenceSignature(
  expected: readonly string[],
  submitted: readonly string[]
): ErrorSignature | null {
  if (expected.length === 0) return null;
  if (submitted.length !== expected.length) {
    return submitted.length < expected.length ? "sequence.incomplete" : null;
  }
  if (expected.every((id, index) => id === submitted[index])) return null;

  const sameItems =
    [...expected].sort().join(SEPARATOR) === [...submitted].sort().join(SEPARATOR);
  if (!sameItems) return null;

  const reversed = [...expected].reverse();
  if (reversed.every((id, index) => id === submitted[index])) return "sequence.reversed";

  const mismatches: number[] = [];
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index] !== submitted[index]) mismatches.push(index);
  }

  if (mismatches.length === 2) {
    const [first, second] = mismatches;
    const swapped =
      expected[first] === submitted[second] && expected[second] === submitted[first];
    if (swapped) {
      if (second - first === 1) return "sequence.adjacent-swap";
      if (first === 0 && second === expected.length - 1) return "sequence.first-last-swapped";
    }
  }

  // Every item shifted by the same amount: the right order started in the
  // wrong place. Only meaningful for three or more items.
  if (expected.length >= 3) {
    const offset = expected.indexOf(submitted[0]);
    if (offset > 0) {
      const rotated = expected.every(
        (_, index) => submitted[index] === expected[(index + offset) % expected.length]
      );
      if (rotated) return "sequence.cyclic-shift";
    }
  }

  return null;
}
