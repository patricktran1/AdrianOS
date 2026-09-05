/**
 * Where the answer sits must tell a child nothing.
 *
 * Across the authored banks the correct option is written first — it is the
 * natural way to author a question, and every consuming surface rendered the
 * list exactly as written. So "tap the top button" was a complete strategy for
 * the fourteen subject labs, and those labs are the only place several subjects
 * are observed at all. A child who never read a word could finish civics,
 * health, history, economics, wellbeing and geography without a single miss,
 * and accuracy is the only signal those routes produce.
 *
 * This module permutes the presentation and leaves the bank alone. The answer
 * keeps its identity — comparisons stay `option === item.answer` — only the
 * order a child sees changes.
 *
 * Two properties matter more than the shuffle itself:
 *
 *   It is seeded, not random. The same child meeting the same item sees the
 *   same order every render, so buttons never move under a finger mid-answer,
 *   a retry after a miss shows the layout the child just studied, and a test
 *   can assert which items a position-tapping bot gets wrong rather than
 *   asserting a probability.
 *
 *   It is per child. Two children on the same question see different orders,
 *   so an order learned by watching a sibling is worth nothing.
 *
 * Nothing here is persisted. Order is derived from ids the caller already has.
 */

import { seededShuffle } from "../deterministic-random.ts";

/**
 * The seed for one item's presentation.
 *
 * Per child, per surface, per item: the same three parts every caller already
 * has, combined the same way, so two surfaces showing the same bank item still
 * agree with themselves and a child's order is theirs alone.
 */
export function optionSeed(
  profileId: string,
  gameSlug: string,
  itemId: string
): string {
  return `answer-order:${profileId}:${gameSlug}:${itemId}`;
}

/**
 * Whether a list can be permuted without changing what it asks.
 *
 * Shuffling assumes the answer is in the list exactly once and there is
 * something to reorder. A bank row that breaks either assumption is an
 * authoring bug, and the contract check makes it loud at build time — but a
 * child mid-question is the wrong place to raise it, so presentation falls
 * back to the authored order instead of throwing.
 */
function permutable(options: readonly string[], answer: string): boolean {
  if (options.length < 2) return false;
  const seen = new Set(options);
  if (seen.size !== options.length) return false;
  return seen.has(answer);
}

/**
 * The options as this child should see them.
 *
 * Returns the authored order unchanged when the row cannot be permuted safely.
 */
export function presentOptions(
  options: readonly string[],
  answer: string,
  seed: string
): string[] {
  if (!permutable(options, answer)) return [...options];
  return seededShuffle(options, seed);
}

/**
 * The same, for a bank row that carries its answer as an index rather than
 * text. The returned index points at the same choice it always did.
 */
export function presentIndexed(
  choices: readonly string[],
  answerIndex: number,
  seed: string
): { choices: string[]; answerIndex: number } {
  const answer = choices[answerIndex];
  if (answer === undefined || !permutable(choices, answer)) {
    return { choices: [...choices], answerIndex };
  }
  const presented = seededShuffle(choices, seed);
  // Membership through a Map rather than indexing an object: the choice
  // strings are content, and content must never reach a prototype.
  const position = new Map(presented.map((choice, index) => [choice, index]));
  return { choices: presented, answerIndex: position.get(answer) ?? answerIndex };
}

/**
 * The same, for numeric choices — math-blast builds four numbers rather than
 * authored text. Numbers are compared by value, so the guard is duplicates
 * and membership only.
 */
export function presentValues(
  values: readonly number[],
  answer: number,
  seed: string
): number[] {
  if (values.length < 2) return [...values];
  const seen = new Set(values);
  if (seen.size !== values.length || !seen.has(answer)) return [...values];
  return seededShuffle(values, seed);
}

/** A bank row shaped like every authored multiple-choice question. */
type Askable = { options: string[]; answer: string };

/**
 * One bank row, presented. A shallow copy with `options` permuted; every other
 * field — `answer` included — is the row's own, so callers keep comparing
 * against the authored answer and every id stays stable.
 */
export function presentItem<T extends Askable>(item: T, seed: string): T {
  return { ...item, options: presentOptions(item.options, item.answer, seed) };
}

/**
 * A whole deck, presented. Each row is seeded by its own id, so adding or
 * reordering the deck does not disturb the rows a child has already seen.
 */
export function presentDeck<T extends Askable & { id: string }>(
  items: readonly T[],
  profileId: string,
  gameSlug: string
): T[] {
  return items.map((item) =>
    presentItem(item, optionSeed(profileId, gameSlug, item.id))
  );
}
