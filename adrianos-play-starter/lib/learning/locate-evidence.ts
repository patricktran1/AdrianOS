/**
 * What a reading attempt tells us, beyond whether it was right.
 *
 * A three-option comprehension question has a one-in-three floor, and the
 * child who read the sentence and the child who shrugged produce the same
 * row. Marking the sentence first makes the difference visible — but only if
 * the marking itself cannot be gamed. Marking every sentence would otherwise
 * be a guaranteed hit on the supporting one, which is the reading equivalent
 * of crossing out every card in Clue Hollow.
 *
 * So an attempt carries what the child marked, and the readings below are all
 * relationships between that and the sentences that actually make the answer
 * knowable. None of them is a judgement about the child.
 */

import type { LocateTask } from "../kernels/locate-tasks.ts";
import type { ErrorSignature } from "./error-signatures.ts";

/** What the child did on the way to an answer. Actions only. */
export type LocateTrace = {
  /** Sentence ids marked when the answer was given. */
  markedIds: string[];
  /** Sentences unmarked after being marked. A correction, not a fault. */
  unmarked: number;
};

/**
 * The most sentences a child can mark and still be pointing at something.
 *
 * Half the passage, or the number the answer actually needs, whichever is
 * larger — so a two-sentence answer in a four-sentence story is precise, and
 * marking three of four is not.
 */
export function markingBudget(task: LocateTask): number {
  return Math.max(
    task.supportingIds.length,
    Math.floor(task.sentences.length / 2)
  );
}

/** Marked so much of the passage that hitting the right part means nothing. */
export function isSweep(task: LocateTask, trace: LocateTrace): boolean {
  return trace.markedIds.length > markingBudget(task);
}

/** Every sentence the answer rests on was marked. */
export function markedTheEvidence(task: LocateTask, trace: LocateTrace): boolean {
  const marked = new Set(trace.markedIds);
  return task.supportingIds.every((id) => marked.has(id));
}

/**
 * Whether an attempt is evidence of reading, rather than of landing on the
 * right option.
 *
 * All three conditions are about the child's own actions: they got it right,
 * they marked what the answer rests on, and they did so without marking the
 * story flat. A correct answer failing any of them is still a correct answer
 * — it simply is not yet evidence that the passage was used.
 */
export function isSupportedAnswer(input: {
  correct: boolean;
  task: LocateTask;
  trace: LocateTrace;
}): boolean {
  return (
    input.correct
    && markedTheEvidence(input.task, input.trace)
    && !isSweep(input.task, input.trace)
  );
}

/**
 * Names what the marking and the answer say together, when they say
 * something worth naming.
 *
 * Ordered by how much it changes what to do next. Having found the sentence
 * and read it another way is the most useful thing this verb can observe: the
 * child is using the text, and needs that sentence, not another hunt for it.
 */
export function locateErrorSignature(input: {
  task: LocateTask;
  correct: boolean;
  trace: LocateTrace;
}): ErrorSignature | null {
  const { task, correct, trace } = input;
  const found = markedTheEvidence(task, trace);

  // Checked first: a swept passage makes every other reading meaningless,
  // because the supporting sentence was marked whether or not it was found.
  if (isSweep(task, trace)) return "reading.marked-the-whole-passage";
  if (found) {
    // The observation this verb exists to make. The child is using the text
    // and took a different meaning from the right sentence, which is a
    // different thing to teach than not having found it.
    return correct ? null : "reading.evidence-found-but-misread";
  }
  // A right answer whose evidence was never marked did not come from where
  // the child said it did. On a one-in-three question that is worth naming,
  // and repeated across tasks it is what tells a guess from a read.
  return correct
    ? "reading.answered-without-evidence"
    : "reading.looked-in-another-part";
}
