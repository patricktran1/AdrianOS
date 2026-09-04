/**
 * The parent's account of a session.
 *
 * Four questions, in the order a parent actually asks them: what did they
 * work on, what did the system notice, what did it do about it, and what
 * happens next.
 *
 * Every sentence describes something a parent could have watched over the
 * child's shoulder. There are no scores, no percentages, no probabilities
 * and no words about the child's mind — "put them in order was harder today"
 * is an observation; "weak ordering skills" is a claim about a person, and
 * this file never makes one.
 */

import type { LearnerModel, SkillSignal } from "../adrian-learner-model.ts";
import { mechanicCategory, type InteractionMechanic } from "../kernels/kernel-registry.ts";
import type { SessionCompletionReason, SessionRevisionReason } from "./session-goals.ts";
import type { SessionPlan, SessionStep } from "./session-planner.ts";

export type ParentSessionSummary = {
  /** What did they work on? */
  workedOn: string;
  /** What did AdrianOS observe? */
  observed: string;
  /** How did the system respond? */
  responded: string;
  /** What is likely to happen next? */
  next: string;
};

/** How an activity felt to do, in the words a parent would use. */
const ACTIVITY_PHRASES = new Map<InteractionMechanic, string>([
  ["build", "building numbers with pieces"],
  ["place", "putting things in order"],
  ["deduce", "working answers out from clues"],
  ["choose", "picking answers"],
  ["recall", "remembering pairs"],
  ["locate", "finding the part of a story that answers a question"],
]);

const REVISION_PHRASES = new Map<SessionRevisionReason, string>([
  [
    "goal_met_early",
    "showed it sooner than expected, so the repeat activity was dropped",
  ],
  [
    "cancel_transfer_after_error_pattern",
    "found that form harder today, so the clue puzzle was set aside",
  ],
  [
    "cancel_inference_after_unreasoned_solve",
    "reached the right answer without using the clues, so it did not count as done",
  ],
  [
    "hold_after_supported_success",
    "got there with help, so nothing harder was offered afterwards",
  ],
  [
    "substitute_after_representation_gap",
    "swapped the next activity for one aimed at what had just come up",
  ],
  [
    "substitution_blocked_by_guard",
    "kept going rather than repeating the activity that had just been hard",
  ],
  ["remediation_cap_reached", "moved on rather than staying on the same difficulty"],
  ["skill_exposure_cap_reached", "changed subject rather than repeating one skill"],
  ["budget_reached", "reached the end of today's session"],
  ["add_closure_after_recovery", "added a finishing activity after the tricky one"],
]);

const COMPLETION_PHRASES = new Map<SessionCompletionReason, string>([
  ["goal_demonstrated", "The session ended once that was clear."],
  ["budget_reached", "That was the whole session for today."],
  ["enough_for_today", "AdrianOS stopped there rather than pressing on."],
  ["closure_complete", "The session finished on something already familiar."],
  ["evidence_collected", "That was enough to start from."],
  ["exited", "The session was left partway through."],
]);

function done(plan: SessionPlan): SessionStep[] {
  return plan.steps.filter((step) => step.status === "done");
}

function listPhrase(items: readonly string[]): string {
  const unique = [...new Set(items)];
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
}

function skillNames(plan: SessionPlan, model: LearnerModel): string[] {
  const names: string[] = [];
  for (const step of done(plan)) {
    if (!step.goal.skillId) continue;
    const label =
      model.skills.find((skill) => skill.skillId === step.goal.skillId)?.skillLabel
      ?? step.goal.skillLabel;
    if (label) names.push(label.toLowerCase());
  }
  return names;
}

/**
 * The skill the summary should talk about.
 *
 * A taught step is the point of the session, so it wins. But a session that
 * has only got as far as its warm start still produced answers, and saying
 * nothing about them would make the panel go quiet exactly when a parent is
 * most likely to be looking.
 */
function skillFor(plan: SessionPlan, model: LearnerModel): SkillSignal | null {
  const steps = done(plan);
  const chosen =
    steps.find((step) => step.goal.kind !== "warm-start" && step.goal.kind !== "closure")
    ?? steps.find((step) => step.goal.skillId !== null);
  if (!chosen?.goal.skillId) return null;
  return model.skills.find((skill) => skill.skillId === chosen.goal.skillId) ?? null;
}

/**
 * What the evidence supports saying about one skill, in a parent's words.
 *
 * Each branch names a thing that happened and stops there. None of them
 * offers a cause, a level, or a comparison with other children.
 */
function observationFor(skill: SkillSignal): string {
  const strong = skill.secureMechanics[0];
  const weak = skill.weakMechanics[0];
  switch (skill.state) {
    case "representation-specific-difficulty":
      return strong && weak
        ? `${skill.skillLabel} went well when it meant ${ACTIVITY_PHRASES.get(strong) ?? "the familiar activity"}, and was harder today when it meant ${ACTIVITY_PHRASES.get(weak) ?? "a different activity"}.`
        : `${skill.skillLabel} went well in one kind of activity and was harder in another.`;
    case "repeatable-error-pattern":
      return `The same kind of answer came up on several different ${skill.skillLabel.toLowerCase()} questions, not just once.`;
    case "support-dependent":
      return `${skill.skillLabel} answers were mostly right, with a hint or a second try along the way.`;
    case "possible-random-response":
      return `${skill.skillLabel} answers were arriving faster than the questions could be read.`;
    case "secure":
      return `${skill.skillLabel} was answered independently across the activities it came up in.`;
    case "emerging":
      return `${skill.skillLabel} is coming along — some right, some not yet.`;
    default:
      return `There is not much ${skill.skillLabel.toLowerCase()} to go on yet.`;
  }
}

/**
 * Builds the summary.
 *
 * Reads the plan for what was offered and the learner model for what was
 * observed. It never reads raw answers, so there is nothing here a parent
 * could not have seen for themselves.
 */
export function summariseSession(
  plan: SessionPlan,
  model: LearnerModel,
  childName: string
): ParentSessionSummary {
  const name = childName.trim() || "Your child";
  const steps = done(plan);

  if (steps.length === 0) {
    return {
      workedOn: `${name} has not started today's session yet.`,
      observed: "Nothing has been recorded today.",
      responded: "AdrianOS is holding the plan it made from earlier sessions.",
      next: "The first activity will lead when the world opens.",
    };
  }

  const names = skillNames(plan, model);
  const categories = [
    ...new Set(
      steps
        .map((step) => step.mechanic)
        .filter((mechanic): mechanic is InteractionMechanic => mechanic !== null)
        .map(mechanicCategory)
    ),
  ];
  const activityPhrases = steps
    .map((step) => (step.mechanic ? ACTIVITY_PHRASES.get(step.mechanic) : null))
    .filter((phrase): phrase is string => Boolean(phrase));

  const workedOn = names.length > 0
    ? `${name} worked on ${listPhrase(names)} across ${steps.length} ${steps.length === 1 ? "activity" : "activities"}${
        categories.length > 1 ? `, in ${categories.length} different kinds of activity` : ""
      }.`
    : `${name} explored ${steps.length} ${steps.length === 1 ? "activity" : "activities"} while AdrianOS collected its first evidence.`;

  const focus = skillFor(plan, model);
  const observed = focus
    ? observationFor(focus)
    : activityPhrases.length > 0
      ? `The activities so far involved ${listPhrase(activityPhrases)}.`
      : "There is not enough yet to say anything specific.";

  const revisionPhrases = plan.revisions
    .map((revision) => REVISION_PHRASES.get(revision.reason))
    .filter((phrase): phrase is string => Boolean(phrase));
  const responded = revisionPhrases.length > 0
    ? `AdrianOS changed the route: ${name} ${listPhrase(revisionPhrases)}.`
    : `AdrianOS kept to the route it planned: ${steps.length === 1 ? "one activity" : `${steps.length} activities`} chosen from what ${name} had already shown.`;

  const remaining = plan.steps.filter((step) => step.status === "planned");
  const next = plan.status === "complete"
    ? `${COMPLETION_PHRASES.get(plan.completion ?? "exited") ?? "The session ended."} ${nextSentence(model, focus)}`
    : remaining.length > 0
      ? `One more activity is waiting: ${remaining[0].activity.adultReason}`
      : nextSentence(model, focus);

  return { workedOn, observed, responded, next };
}

function nextSentence(model: LearnerModel, focus: SkillSignal | null): string {
  if (!focus) {
    return model.confident
      ? "The next session will start from whatever today added."
      : "A few more activities will give AdrianOS enough to lead with.";
  }
  switch (focus.state) {
    case "representation-specific-difficulty":
      return `Next time AdrianOS will stay with that form of ${focus.skillLabel.toLowerCase()} rather than moving on.`;
    case "repeatable-error-pattern":
      return `Next time AdrianOS will offer ${focus.skillLabel.toLowerCase()} in a hands-on form rather than more of the same questions.`;
    case "support-dependent":
      return `Next time the help stays on for ${focus.skillLabel.toLowerCase()} rather than the challenge going up.`;
    case "possible-random-response":
      return `Next time ${focus.skillLabel.toLowerCase()} comes with a slower pace and help on screen.`;
    case "secure":
      return `Next time ${focus.skillLabel.toLowerCase()} is likely to appear in a form it has not been asked in yet.`;
    default:
      return `Next time AdrianOS will keep ${focus.skillLabel.toLowerCase()} in the rotation.`;
  }
}
