/**
 * What a deduction attempt tells us, beyond whether it was right.
 *
 * A correct answer in Clue Hollow can be reached two ways: by working the
 * clues, or by crossing out cards until one happens to be left. Both produce
 * `correct: true`, and treating them the same would make guessing look like
 * competence — the exact failure this verb exists to avoid.
 *
 * So an attempt also carries how much of the clue set was actually used and
 * whether the eliminations were supported by it. Two numbers, both derived
 * from actions the child took, neither of them a judgement.
 *
 * The signatures below reuse the accumulation machinery from the teaching
 * decision engine: a single odd move means nothing, and only a relationship
 * repeated across independent tasks reaches a routing decision.
 */

import type { DeduceTask } from "../kernels/deduce-tasks.ts";
import {
  satisfies,
  type DeduceCandidate,
  type DeduceConstraintKind,
} from "../kernels/deduce-constraints.ts";

/** What the child did on the way to an answer. Actions only. */
export type DeduceTrace = {
  /** Cards crossed out that no revealed clue contradicted. */
  unjustifiedEliminations: number;
  /**
   * Cards crossed out under a clue that does not rule them out, when some
   * other revealed clue does. The card belonged out; the child named the
   * wrong reason. Kept apart from `unjustifiedEliminations` so that field
   * keeps the exact meaning rows already stored were written with.
   */
  misattributedStrikes: number;
  /** Cards brought back after being crossed out. A correction, not a fault. */
  restored: number;
  /** Clue kinds that were on screen when an unsupported cross-out happened. */
  misappliedKinds: DeduceConstraintKind[];
};


/**
 * Whether an attempt is evidence of deduction rather than of arriving at the
 * right card.
 *
 * Every condition is about the child's own actions: they read enough clues to
 * narrow the field, every card they ruled out was ruled out by something, and
 * they could say which clue did it. A correct answer failing any of them is
 * still a correct answer — it simply is not yet evidence that the reasoning
 * happened.
 *
 * There is deliberately no allowance for naming one clue wrongly. The
 * forgiveness a child needs already exists one level up: a run is four
 * puzzles and the learner model asks for a reasoned rate of 0.6, so a slip on
 * one puzzle still leaves 0.75 and still reads as secure. Measured over
 * 16,800 runs, a child who reasons correctly and misnames a clue once in a
 * run clears that bar on 100% of runs with no allowance at all, while a
 * per-puzzle allowance of one would carry blind play from 0.05% to 3.60% —
 * on a three-card board there are only two crossings, so forgiving one
 * forgives half the work.
 *
 * The third condition is what makes the other two mean anything. Every puzzle
 * needs its whole clue set to separate the field, and revealing clues costs
 * nothing, so at full reveal every card except the answer is ruled out by
 * something. A child who reveals everything and spares one card at random
 * therefore leaves a trace identical to a reasoner's — measured at 25.81% of
 * puzzles before this condition existed. Naming the clue is the part that
 * cannot be reached without reading it.
 */
export function isCleanDeduction(input: {
  correct: boolean;
  revealedCount: number;
  cluesNeeded: number;
  trace: DeduceTrace;
}): boolean {
  return (
    input.correct
    && input.revealedCount >= input.cluesNeeded
    && input.trace.unjustifiedEliminations === 0
    && input.trace.misattributedStrikes === 0
  );
}

/**
 * Names what went wrong structurally, when something did.
 *
 * Every branch describes a relationship between the clues on screen and the
 * cards the child ruled in or out. None of them claims to know why.
 */
export function deduceErrorSignature(input: {
  task: DeduceTask;
  chosen: DeduceCandidate;
  revealedCount: number;
  trace: DeduceTrace;
}): string | null {
  const { task, chosen, revealedCount, trace } = input;
  const revealed = task.clues.slice(0, revealedCount);

  // The card they kept is contradicted by a clue that was on screen.
  const broken = revealed.find((clue) => !satisfies(chosen, clue, task.candidates));
  if (broken) {
    if (broken.kind === "greater-than" || broken.kind === "less-than") {
      // Kept a card on the wrong side of a comparison that was visible.
      return "deduce.comparison-ignored";
    }
    if (broken.kind === "comes-before" || broken.kind === "comes-after") {
      return "deduce.order-relation-ignored";
    }
    if (broken.kind === "numerator-is" || broken.kind === "denominator-is") {
      return "deduce.fraction-part-confused";
    }
    return "deduce.contradicted-card-kept";
  }

  // Nothing on screen contradicts the answer, so the clue set was not read
  // far enough to separate the field.
  if (revealedCount < task.cluesNeeded) return "deduce.decided-before-enough-clues";

  // Every clue was read, the kept card fits them all, yet it is not the
  // answer: only possible when the target itself was ruled out on the way.
  if (trace.unjustifiedEliminations > 0) return "deduce.ruled-out-without-a-reason";

  return null;
}

/**
 * Reversal is worth separating from ordinary comparison trouble, but only
 * when the pattern is unmistakable: the child ruled out exactly the cards a
 * comparison keeps, and kept exactly the ones it excludes.
 */
export function isComparisonReversal(input: {
  task: DeduceTask;
  ruledOutIds: readonly string[];
  revealedCount: number;
}): boolean {
  const { task, ruledOutIds, revealedCount } = input;
  const comparison = task.clues
    .slice(0, revealedCount)
    .find((clue) => clue.kind === "greater-than" || clue.kind === "less-than");
  if (!comparison) return false;

  const satisfying = task.candidates.filter((row) => satisfies(row, comparison, task.candidates));
  const violating = task.candidates.filter((row) => !satisfies(row, comparison, task.candidates));
  if (satisfying.length === 0 || violating.length === 0) return false;

  const ruled = new Set(ruledOutIds);
  return (
    satisfying.every((row) => ruled.has(row.id))
    && violating.every((row) => !ruled.has(row.id))
  );
}
