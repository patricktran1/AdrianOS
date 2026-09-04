/**
 * The vocabulary a session reasons in.
 *
 * A session goal is a *learning* goal — "collect a second representation of
 * place value" — never a game. Games are how a goal gets expressed, which is
 * the world's job, not the planner's. Keeping the two apart is what stops the
 * planner turning back into a playlist of slugs.
 *
 * Everything here is data: pure, prototype-safe, and free of storage,
 * rendering and randomness so it can be reasoned about in a unit test.
 */

/**
 * What a step is *for*.
 *
 * These are ordered as they usually appear in an arc — warm start, target,
 * a second look at the target, inference, recovery, closure — but the
 * planner is free to omit any of them and often does.
 */
export type SessionGoalKind =
  /** A skill the child already holds, played first so the session opens well. */
  | "warm-start"
  /** The main teaching move for the skill that most deserves attention. */
  | "target-skill"
  /** The same skill through an interaction form it has not been shown in. */
  | "alternate-representation"
  /** The same skill worked out from relationships rather than prompted. */
  | "inference-transfer"
  /** A bounded visit to the idea underneath the target. */
  | "prerequisite-check"
  /** A supported return to the target after it went badly. */
  | "recovery"
  /** A closing activity on something the child can already do. */
  | "closure"
  /** Evidence is too thin to teach from; go and collect some. */
  | "sample"
  /** Nobody has watched this child yet: find a starting point first. */
  | "placement";

/**
 * The question a step is trying to answer.
 *
 * This is the difference between *more practice* and *new evidence*, and it
 * is the planner's main ranking signal. `none` is not a failure: a child who
 * needs another go at something does not need a new question asked of them.
 */
export type EvidenceNeed =
  | "none"
  | "first-samples"
  | "independence"
  | "second-representation"
  | "inference"
  | "prerequisite-stability";

/**
 * Why the planner chose a step, in machine terms.
 *
 * Developer-facing. The presentation layer translates these into child
 * language; a parent gets the plain-language summary instead. No string here
 * is ever rendered to a child.
 */
export type SessionReason =
  | "secure_warmup"
  | "focus_skill_needs_teaching"
  | "representation_gap"
  | "breadth_without_inference"
  | "single_context_fluency"
  | "prerequisite_unsteady"
  | "recover_after_difficulty"
  | "finish_on_secure_skill"
  | "insufficient_evidence";

/** Why a plan changed after evidence arrived. */
export type SessionRevisionReason =
  | "goal_met_early"
  | "cancel_transfer_after_error_pattern"
  | "cancel_inference_after_unreasoned_solve"
  | "hold_after_supported_success"
  | "substitute_after_representation_gap"
  | "substitution_blocked_by_guard"
  | "remediation_cap_reached"
  | "skill_exposure_cap_reached"
  | "budget_reached"
  | "add_closure_after_recovery";

/** Why a session stopped. */
export type SessionCompletionReason =
  | "goal_demonstrated"
  | "budget_reached"
  | "enough_for_today"
  | "closure_complete"
  | "evidence_collected"
  | "exited";

export type SessionGoal = {
  kind: SessionGoalKind;
  /** The skill the goal is about, or null for open exploration. */
  skillId: string | null;
  skillLabel: string | null;
  need: EvidenceNeed;
  reason: SessionReason;
};

/**
 * How much a goal is worth when the planner has to choose.
 *
 * Deliberately an ordered list rather than a score: a number invites tuning
 * that nobody can explain, and every ordering decision here is a pedagogical
 * claim that should be arguable in words.
 *
 *   1. the idea underneath is unsteady — everything above it is guesswork
 *   2. the target itself needs teaching
 *   3. it works in one form and not another
 *   4. it is reliable in one form and untested in any other
 *   5. it is reliable across forms but has never been inferred
 *   6. there is not enough evidence to say anything
 *   7. a good place to start or finish
 *
 * Above all of them sits the starting-point check, because a plan built
 * before anybody has watched the child is a guess wearing a plan's clothes.
 */
const GOAL_PRIORITY: SessionGoalKind[] = [
  "placement",
  "prerequisite-check",
  "target-skill",
  "recovery",
  "alternate-representation",
  "inference-transfer",
  "sample",
  "warm-start",
  "closure",
];

export function goalPriority(kind: SessionGoalKind): number {
  const index = GOAL_PRIORITY.indexOf(kind);
  return index < 0 ? GOAL_PRIORITY.length : index;
}

/**
 * Goals that exist to *change* something rather than to observe it.
 *
 * The count of these in a row is what the anti-drilling cap limits: a
 * session may teach, but it may not spend itself entirely on correction.
 */
const REMEDIAL_GOALS = new Set<SessionGoalKind>([
  "prerequisite-check",
  "recovery",
]);

export function isRemedialGoal(kind: SessionGoalKind): boolean {
  return REMEDIAL_GOALS.has(kind);
}

/**
 * Remedial teaching intents, for the same cap applied to the chosen move.
 *
 * Named as plain strings rather than imported as a type from the learner
 * model. This module is the vocabulary a session is written in, and anything
 * that reads a stored plan has to load it; keeping it free of imports keeps
 * that read cheap.
 */
const REMEDIAL_INTENTS = new Set<string>([
  "reteach",
  "scaffold",
  "prerequisite",
]);

export function isRemedialIntent(intent: string): boolean {
  return REMEDIAL_INTENTS.has(intent);
}

/**
 * Goals whose evidence question can be *answered*, and therefore whose
 * repetition is over-sampling rather than teaching.
 */
const ANSWERABLE_NEEDS = new Set<EvidenceNeed>([
  "second-representation",
  "inference",
  "prerequisite-stability",
  "independence",
]);

export function isAnswerableNeed(need: EvidenceNeed): boolean {
  return ANSWERABLE_NEEDS.has(need);
}

/**
 * Where a step is in the plan.
 *
 * Lives here rather than with the planner so that reading a stored session
 * costs nothing but this file.
 */
export type SessionStepStatus = "planned" | "done" | "dropped";

/** A session is either still going or finished. Nothing else. */
export type SessionStatus = "active" | "complete";
