/**
 * How a kernel run changes for the child in front of it.
 *
 * The rules are a small, readable table rather than a scoring function, so
 * that the reason a task got easier or gained a helper can always be stated
 * in one sentence — to a parent, or to whoever is debugging it next.
 *
 * Nothing here is hidden or probabilistic: the same teaching decision always
 * produces the same adaptation.
 */

import type { NextActivity } from "../adrian-learner-model.ts";

export type KernelScaffold =
  /** Coaching appears after a miss, as normal. */
  | "on-miss"
  /** The strategy hint is on screen from the start. */
  | "visible";

export type KernelAdaptation = {
  difficultyShift: -1 | 0 | 1;
  scaffold: KernelScaffold;
  /**
   * A short pause enforced between a change of selection and Check becoming
   * available. Used only when answers have been arriving faster than the
   * question can be read: it removes the reward for tapping at random
   * without ever telling a child off or blocking them.
   */
  settleMs: number;
  /** Adult-facing sentence: why this run is not the default run. */
  reason: string | null;
};

export const DEFAULT_ADAPTATION: KernelAdaptation = {
  difficultyShift: 0,
  scaffold: "on-miss",
  settleMs: 0,
  reason: null,
};

/** How long a rapid-answering run waits before Check becomes available. */
const SETTLE_MS = 700;

/**
 * Applies the current teaching decision to this run.
 *
 * The decision only adapts the run when it is actually about the skill being
 * played; a decision about fractions must not quietly make a counting task
 * easier.
 */
export function adaptKernelRun(
  activity: NextActivity | null,
  skillId: string
): KernelAdaptation {
  if (!activity || activity.skillId !== skillId) return DEFAULT_ADAPTATION;

  switch (activity.intent) {
    case "reteach":
      return {
        difficultyShift: -1,
        scaffold: "visible",
        settleMs: 0,
        reason: "The same kind of mistake has come up more than once, so this run starts smaller with the strategy on screen.",
      };
    case "prerequisite":
      return {
        difficultyShift: -1,
        scaffold: "visible",
        settleMs: 0,
        reason: "This run works the idea underneath, so it starts smaller with the strategy on screen.",
      };
    case "represent":
      return {
        // The skill itself is fine; only this way of showing it is new, so
        // the content stays at level and help is simply available.
        difficultyShift: 0,
        scaffold: "visible",
        settleMs: 0,
        reason: "This skill is already reliable another way, so the level is unchanged and the strategy is on screen for the new form.",
      };
    case "scaffold":
      return {
        difficultyShift: -1,
        scaffold: "visible",
        settleMs: activity.hintStrategy === "immediate" ? SETTLE_MS : 0,
        reason: "Recent answers leaned on help or arrived very quickly, so this run is smaller, keeps the strategy on screen, and gives Check a moment to settle.",
      };
    case "stretch":
      return {
        difficultyShift: 1,
        scaffold: "on-miss",
        settleMs: 0,
        reason: "This skill is solved independently, so the run is a step harder.",
      };
    case "transfer":
      return {
        difficultyShift: 0,
        scaffold: "on-miss",
        settleMs: 0,
        reason: "The same skill, met through a different kind of activity.",
      };
    default:
      return DEFAULT_ADAPTATION;
  }
}
