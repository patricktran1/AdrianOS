/**
 * The AdrianOS session planner.
 *
 * The teaching decision engine answers "what is the right move for this
 * skill now?". This module answers the question above it: "what short
 * sequence of experiences should this child have, and how should that
 * sequence change as evidence arrives?".
 *
 * Three rules keep the two apart:
 *
 * 1. The planner never decides a pedagogical move. It chooses which skill
 *    deserves attention and in what order, then asks chooseSkillIntent.
 * 2. The planner never names a game as a goal. Goals are learning goals;
 *    slugs are how the world expresses them.
 * 3. The plan is a hypothesis, not a script. Every completed step runs it
 *    through replanSession, which may shorten it, substitute a step, or end
 *    the session outright.
 *
 * Pure and deterministic given (learner model, day key, grade, budget),
 * except where new evidence changes the plan — which is the point.
 */

import {
  chooseSkillIntent,
  chooseLearningIntent,
  type LearnerModel,
  type NextActivity,
  type SkillSignal,
  type WorldIntent,
} from "../adrian-learner-model.ts";
import {
  DEDUCE_GAME,
  KERNEL_GAMES,
  deduceRouteForSkill,
  deduceSupportsSkill,
  distinctCategories,
  kernelVerbsForSkill,
  mechanicCategory,
  mechanicForGame,
  type InteractionMechanic,
  type MechanicCategory,
} from "../kernels/kernel-registry.ts";

import { seededShuffle } from "../deterministic-random.ts";
import { PLACEMENT_HREF, PLACEMENT_SLUG } from "./session-explore.ts";
import {
  goalPriority,
  isAnswerableNeed,
  isRemedialGoal,
  isRemedialIntent,
  type EvidenceNeed,
  type SessionCompletionReason,
  type SessionGoal,
  type SessionGoalKind,
  type SessionReason,
  type SessionRevisionReason,
  type SessionStatus,
  type SessionStepStatus,
} from "./session-goals.ts";

export type {
  SessionGoal,
  SessionGoalKind,
  SessionCompletionReason,
  SessionStatus,
  SessionStepStatus,
};

export type SessionDestination = {
  /** Preferred game slugs, most relevant first. May be empty. */
  slugs: string[];
  /** A fully-parameterised route when the decision needs more than a game. */
  href: string | null;
  /**
   * What makes this the same activity as another: game and skill, nothing
   * else. Set when a completed step is restored from storage, where the
   * route itself is deliberately not kept.
   */
  key?: string;
};

export type SessionStep = {
  goal: SessionGoal;
  /**
   * The teaching decision for this step, in the same shape every other
   * AdrianOS surface already consumes. Keeping the whole decision rather
   * than a summary of it is what lets the world, the kernel routes and the
   * parent surfaces read one object instead of three approximations.
   */
  activity: NextActivity;
  /** The interaction form this step asks for, where the route implies one. */
  mechanic: InteractionMechanic | null;
  destination: SessionDestination;
  status: SessionStepStatus;
};

export type SessionRevision = {
  reason: SessionRevisionReason;
  /** Goal kinds removed by this revision. */
  dropped: SessionGoalKind[];
  /** Goal kinds added by this revision. */
  added: SessionGoalKind[];
};

export type SessionPlan = {
  version: 1;
  profileId: string;
  dayKey: string;
  grade: number;
  /** Meaningful activities this session may contain. */
  budget: number;
  steps: SessionStep[];
  revisions: SessionRevision[];
  status: SessionStatus;
  completion: SessionCompletionReason | null;
};

/**
 * What one completed step actually produced.
 *
 * Derived from the evidence rows written while the step was open, so the
 * planner never has to read storage or guess. Counts only: no prompts, no
 * answers, no free text.
 */
export type SessionOutcome = {
  skillId: string | null;
  attempts: number;
  correct: number;
  /** Attempts that leaned on a hint or a retry. */
  supported: number;
  /** Correct answers reached by working it out, where the form reports it. */
  reasoned: number;
  mechanic: InteractionMechanic | null;
};

export type SessionDayMode = "full" | "light" | "free";

/**
 * A pending change of explanation, ready to become a step.
 *
 * The planner does not decide that a skill needs one — the mastery loop
 * already did that from repeated evidence. What the planner decides is where
 * in the session it belongs, which is first: a child working with an
 * explanation that has stopped working should meet the new one before
 * anything else is asked of them.
 */
export type SessionIntervention = {
  skillId: string;
  skillLabel: string;
  slug: string;
  href: string;
  childReason: string;
  adultReason: string;
  /** True for a later memory check rather than a fresh explanation. */
  retention: boolean;
};

export type PlanSessionInput = {
  model: LearnerModel;
  profileId: string;
  dayKey: string;
  grade: number;
  mode?: SessionDayMode;
  /** True until the child has done the short starting-point check. */
  needsPlacement?: boolean;
  /**
   * A skill that has gone sticky twice and is waiting for a different
   * explanation. Supplied by the mastery loop, which decides when an
   * explanation has stopped working; the planner decides where it goes.
   */
  intervention?: SessionIntervention | null;
  /** Interest- and priority-ordered exploration slugs, best first. */
  exploreSlugs?: readonly string[];
};

/*
 * ---------------------------------------------------------------------------
 * Budgets and caps
 * ---------------------------------------------------------------------------
 *
 * These are activity counts, not minutes. A minute target invites the system
 * to keep a child busy; an activity target lets it stop as soon as the
 * evidence it wanted is in hand.
 *
 * The numbers follow the product's existing shape — a TK session is already
 * about six minutes, an upper-elementary one about twelve — and the
 * developmental fact that a five-year-old's useful attention runs out long
 * before a ten-year-old's.
 */
const BUDGET_BY_GRADE_BAND: Array<{ maxGrade: number; steps: number }> = [
  { maxGrade: 1, steps: 3 },
  { maxGrade: 3, steps: 4 },
  { maxGrade: 12, steps: 5 },
];

export function sessionBudget(grade: number, mode: SessionDayMode = "full"): number {
  const band = BUDGET_BY_GRADE_BAND.find((row) => grade <= row.maxGrade)
    ?? BUDGET_BY_GRADE_BAND[BUDGET_BY_GRADE_BAND.length - 1];
  if (mode === "free") return 2;
  if (mode === "light") return Math.max(2, band.steps - 1);
  return band.steps;
}

/**
 * A child who finds place value hard should not spend a whole session in
 * place value. Three touches is enough to teach and to see whether the
 * teaching landed; a fourth is a treadmill.
 */
const MAX_STEPS_PER_SKILL = 3;

/**
 * Consecutive steps that exist to correct something. Two is a teaching move
 * followed by a check. Three in a row is a session organised around being
 * wrong, which is the thing this cap exists to prevent.
 */
const MAX_CONSECUTIVE_REMEDIAL = 2;

/** Consecutive steps asking for the same kind of thinking. */
const MAX_CONSECUTIVE_CATEGORY = 2;

/**
 * A prerequisite visit is a detour, never a descent. One per session, and
 * never a prerequisite of a prerequisite.
 */
const MAX_PREREQUISITE_STEPS = 1;

/**
 * How many activities a session offers before it has evidence to teach from.
 *
 * Short on purpose. Exploration is how the model gets its first samples, not
 * a filler mode, and a long unguided session is exactly the engagement loop
 * this planner is not supposed to build.
 */
const COLD_START_STEPS = 3;

/*
 * ---------------------------------------------------------------------------
 * Session priorities
 * ---------------------------------------------------------------------------
 */

type Candidate = {
  skill: SkillSignal;
  goal: SessionGoal;
};

function goalFor(
  skill: SkillSignal,
  kind: SessionGoalKind,
  need: EvidenceNeed,
  reason: SessionReason
): SessionGoal {
  return {
    kind,
    skillId: skill.skillId,
    skillLabel: skill.skillLabel,
    need,
    reason,
  };
}

/**
 * What each skill's evidence says it needs, one goal per skill.
 *
 * Every branch reads a state the learner model already derived. None of them
 * re-derives a judgement about the child: if the model will not call a skill
 * unsteady, neither will the planner.
 */
function candidateFor(skill: SkillSignal): Candidate | null {
  switch (skill.state) {
    case "repeatable-error-pattern":
      return {
        skill,
        goal: goalFor(skill, "target-skill", "independence", "focus_skill_needs_teaching"),
      };
    case "representation-specific-difficulty":
      return {
        skill,
        goal: goalFor(
          skill,
          "alternate-representation",
          "second-representation",
          "representation_gap"
        ),
      };
    case "possible-random-response":
    case "support-dependent":
      return {
        skill,
        goal: goalFor(skill, "recovery", "independence", "recover_after_difficulty"),
      };
    case "emerging":
      return {
        skill,
        goal: goalFor(skill, "target-skill", "independence", "focus_skill_needs_teaching"),
      };
    case "secure": {
      if (skill.grasp === "single-context") {
        return {
          skill,
          goal: goalFor(
            skill,
            "alternate-representation",
            "second-representation",
            "single_context_fluency"
          ),
        };
      }
      if (
        skill.grasp === "cross-context"
        && !skill.secureCategories.includes("inference")
        && deduceSupportsSkill(skill.skillId)
      ) {
        return {
          skill,
          goal: goalFor(
            skill,
            "inference-transfer",
            "inference",
            "breadth_without_inference"
          ),
        };
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * The session's priorities, strongest first.
 *
 * Ties break on goal priority, then on how much evidence the skill has (a
 * thinner sample is a weaker claim), then on skill id so the same evidence
 * always produces the same order.
 */
export function sessionPriorities(model: LearnerModel): SessionGoal[] {
  const candidates = model.skills
    .map(candidateFor)
    .filter((row): row is Candidate => row !== null)
    .sort((a, b) => {
      const byGoal = goalPriority(a.goal.kind) - goalPriority(b.goal.kind);
      if (byGoal !== 0) return byGoal;
      const byEvidence = b.skill.attempts - a.skill.attempts;
      if (byEvidence !== 0) return byEvidence;
      return a.skill.skillId.localeCompare(b.skill.skillId);
    });
  return candidates.map((row) => row.goal);
}

/**
 * Skills the child can currently do on their own.
 *
 * Used for the two steps whose whole purpose is that the child succeeds:
 * the warm start and the closure.
 */
function secureSkills(model: LearnerModel): SkillSignal[] {
  return model.skills.filter(
    (skill) => skill.state === "secure" && skill.secureMechanics.length > 0
  );
}

/**
 * Picks among equally valid options without picking at random.
 *
 * Two sessions built from the same evidence on the same day are identical,
 * which is what makes a surprising route debuggable. Two sessions built from
 * the same evidence on different days differ, which is what stops the world
 * feeling like a rerun.
 */
function seededPick<T>(items: readonly T[], seed: string): T | null {
  if (items.length === 0) return null;
  return seededShuffle(items, seed)[0] ?? null;
}

/*
 * ---------------------------------------------------------------------------
 * Resolving a goal into a step
 * ---------------------------------------------------------------------------
 */

/**
 * The interaction form a route implies, when it names one.
 *
 * Asked of the registry rather than matched against a list of slugs kept
 * here: a second copy of that list is a copy that goes stale, and a step
 * whose mechanic reads null is invisible to both the breadth count and the
 * same-kind-twice cap.
 */
function mechanicForActivity(activity: NextActivity): InteractionMechanic | null {
  const href = activity.preferredHref ?? "";
  const fromHref = href.startsWith("/games/")
    ? href.slice("/games/".length).split(/[?#]/)[0]
    : "";
  for (const slug of [fromHref, activity.preferredSlugs[0] ?? ""]) {
    if (slug === "") continue;
    const mechanic = mechanicForGame(slug);
    // "choose" is the registry's default for anything it does not carry, so
    // it cannot distinguish a genuine choose route from an unknown slug.
    if (mechanic !== "choose") return mechanic;
  }
  return null;
}

function stepFrom(goal: SessionGoal, activity: NextActivity): SessionStep {
  return {
    goal,
    activity,
    mechanic: mechanicForActivity(activity),
    destination: {
      slugs: activity.preferredSlugs,
      href: activity.preferredHref,
    },
    status: "planned",
  };
}

/**
 * Turns one goal into one step by asking the teaching engine.
 *
 * The planner deliberately does not override the engine's answer. If it asks
 * about a skill and the engine says "reteach", the step is a reteach even
 * though the goal was written as a transfer — the engine has seen evidence
 * the plan was made before.
 */
/**
 * What a plan needs to know beyond the learner model.
 *
 * Both planning and restoring need it: a step restored from storage has to
 * resolve to the same destination it had when it was planned, and a
 * starting-point check that forgot where it was going would send a brand-new
 * learner nowhere.
 */
export type PlanContext = {
  needsPlacement?: boolean;
  exploreSlugs?: readonly string[];
};

export function resolveGoal(
  model: LearnerModel,
  goal: SessionGoal,
  context: PlanContext = {}
): SessionStep {
  if (goal.kind === "placement") return placementStep();
  if (goal.kind === "sample") return exploreStep(model, context.exploreSlugs ?? []);
  if (goal.kind === "warm-start" || goal.kind === "closure") {
    const familiar = familiarStep(model, goal);
    if (familiar) return familiar;
  }
  if (goal.kind === "inference-transfer" && goal.skillId) {
    const inference = inferenceStep(model, goal);
    if (inference) return inference;
  }
  if (!goal.skillId) return stepFrom(goal, chooseLearningIntent(model));
  return stepFrom(goal, chooseSkillIntent(model, goal.skillId));
}

/** Where a skill is already reliably expressed, when the route is a kernel. */
function familiarRoute(
  skillId: string,
  mechanic: InteractionMechanic,
  from: string
): SessionDestination | null {
  if (mechanic === "deduce" && deduceSupportsSkill(skillId)) {
    return {
      slugs: [DEDUCE_GAME.slug],
      href: `/games/${DEDUCE_GAME.slug}?${new URLSearchParams({ skill: skillId, from })}`,
    };
  }
  if ((mechanic === "build" || mechanic === "place") && kernelVerbsForSkill(skillId).includes(mechanic)) {
    // Selected rather than indexed. The mechanic reaches here from stored
    // evidence, and a computed lookup on a module object is the exact
    // dataflow that had to be unpicked in the kernel registry.
    const game = mechanic === "build" ? KERNEL_GAMES.build : KERNEL_GAMES.place;
    return {
      slugs: [game.slug],
      href: `/games/${game.slug}?${new URLSearchParams({ skill: skillId, from })}`,
    };
  }
  return null;
}

/**
 * The two steps whose purpose is that the child succeeds.
 *
 * A warm start and a closure are not teaching moves, so they do not go
 * through the teaching engine: asking it about a secure skill correctly
 * answers "offer this in a new form", which is exactly what a familiar
 * opening must not be. The question here is narrower and factual — where has
 * this child already succeeded at this? — so it reads the skill's own secure
 * mechanics and goes there, at unchanged difficulty.
 */
function familiarStep(model: LearnerModel, goal: SessionGoal): SessionStep | null {
  const skill = model.skills.find((row) => row.skillId === goal.skillId);
  if (!skill || skill.secureMechanics.length === 0) return null;
  const warm = goal.kind === "warm-start";
  const from = warm ? "warmup" : "closure";
  const chosen =
    skill.secureMechanics
      .map((mechanic) => ({ mechanic, route: familiarRoute(skill.skillId, mechanic, from) }))
      .find((row) => row.route !== null)
    ?? { mechanic: skill.secureMechanics[0], route: null };
  const destination = chosen.route ?? { slugs: skill.gameSlugs, href: null };
  return stepFrom(goal, {
    intent: "practice",
    skillId: skill.skillId,
    skillLabel: skill.skillLabel,
    subject: skill.subject,
    preferredSlugs: destination.slugs,
    preferredHref: destination.href,
    childReason: warm
      ? `Let's start with ${skill.skillLabel.toLowerCase()} — you've got this one.`
      : `One more ${skill.skillLabel.toLowerCase()} to finish on.`,
    adultReason: warm
      ? `Opening on ${skill.skillLabel} in the form it is already reliable in, at unchanged difficulty, so the session starts with a success rather than a correction.`
      : `Closing on ${skill.skillLabel} in a form that is already reliable, so the session ends on something completed rather than on the hardest thing attempted.`,
    difficultyShift: 0,
    hintStrategy: "on-request",
  });
}

/**
 * An inference goal names its own mechanic, so it resolves to the inference
 * route directly.
 *
 * This is not the planner overruling the teaching engine. A step planned to
 * follow one that has not happened yet cannot be resolved from today's
 * evidence — asking the engine now would answer a question about a child who
 * has not played the previous activity. The goal is re-examined on every
 * replan, and cancelled outright when the evidence stops supporting it.
 */
function inferenceStep(model: LearnerModel, goal: SessionGoal): SessionStep | null {
  const skillId = goal.skillId;
  if (!skillId) return null;
  const route = deduceRouteForSkill(skillId, "transfer");
  if (!route) return null;
  const skill = model.skills.find((row) => row.skillId === skillId) ?? null;
  const label = skill?.skillLabel ?? goal.skillLabel ?? skillId;
  return stepFrom(goal, {
    intent: "transfer",
    skillId,
    skillLabel: label,
    subject: skill?.subject ?? null,
    preferredSlugs: [route.slug],
    preferredHref: route.href,
    childReason: `You know ${label.toLowerCase()} — now try working it out from clues.`,
    adultReason: `${label} is reliable in the forms it has been asked in, but has never been inferred from relationships. Offering it as a deduction to see whether the understanding carries.`,
    difficultyShift: 0,
    hintStrategy: "on-request",
  });
}

/**
 * The follow-on a goal implies.
 *
 * A skill that is fluent in one form has an obvious two-step arc: show it in
 * a second form, then ask the child to work it out. Planning both up front is
 * what makes the session an arc rather than a series of next moves — and the
 * second half is the first thing replanning removes when the first half goes
 * badly.
 */
function followOnGoal(goal: SessionGoal): SessionGoal | null {
  if (goal.kind !== "alternate-representation" || !goal.skillId) return null;
  if (!deduceSupportsSkill(goal.skillId)) return null;
  return {
    kind: "inference-transfer",
    skillId: goal.skillId,
    skillLabel: goal.skillLabel,
    need: "inference",
    reason: "breadth_without_inference",
  };
}

/*
 * ---------------------------------------------------------------------------
 * Coherence
 * ---------------------------------------------------------------------------
 */

/**
 * What makes two steps the same activity: the game and the skill it is
 * parameterised for. The `from` marker records how the child arrived, which
 * changes the copy, not the experience.
 */
export function destinationKey(destination: SessionDestination): string | null {
  if (destination.key) return destination.key;
  const slug = destination.slugs[0];
  if (!slug) return null;
  if (!destination.href) return slug;
  const query = destination.href.split("?")[1] ?? "";
  const skill = new URLSearchParams(query).get("skill");
  return skill ? `${slug}:${skill}` : slug;
}

function stepsForSkill(steps: readonly SessionStep[], skillId: string | null): number {
  if (!skillId) return 0;
  return steps.filter((step) => step.status !== "dropped" && step.goal.skillId === skillId).length;
}

function trailingRemedial(steps: readonly SessionStep[]): number {
  let count = 0;
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step.status === "dropped") continue;
    if (isRemedialGoal(step.goal.kind) || isRemedialIntent(step.activity.intent)) count += 1;
    else break;
  }
  return count;
}

function trailingCategory(steps: readonly SessionStep[]): {
  category: MechanicCategory | null;
  count: number;
} {
  let category: MechanicCategory | null = null;
  let count = 0;
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step.status === "dropped") continue;
    const stepCategory = step.mechanic ? mechanicCategory(step.mechanic) : null;
    if (!stepCategory) break;
    if (category === null) category = stepCategory;
    if (stepCategory !== category) break;
    count += 1;
  }
  return { category, count };
}

/**
 * Whether a step may be appended after the ones already chosen.
 *
 * These are the anti-drilling protections. Each of them describes a session
 * a child should not be given, not a rule about code.
 */
export function admitsStep(
  steps: readonly SessionStep[],
  step: SessionStep
): boolean {
  if (stepsForSkill(steps, step.goal.skillId) >= MAX_STEPS_PER_SKILL) return false;
  if (
    (isRemedialGoal(step.goal.kind) || isRemedialIntent(step.activity.intent))
    && trailingRemedial(steps) >= MAX_CONSECUTIVE_REMEDIAL
  ) {
    return false;
  }
  if (step.goal.kind === "prerequisite-check" || step.activity.intent === "prerequisite") {
    const already = steps.filter(
      (row) =>
        row.status !== "dropped"
        && (row.goal.kind === "prerequisite-check" || row.activity.intent === "prerequisite")
    ).length;
    if (already >= MAX_PREREQUISITE_STEPS) return false;
  }
  if (step.mechanic) {
    const trailing = trailingCategory(steps);
    if (
      trailing.category === mechanicCategory(step.mechanic)
      && trailing.count >= MAX_CONSECUTIVE_CATEGORY
    ) {
      return false;
    }
  }
  // A session must not send a child to the same place twice for no reason.
  // The comparison ignores what brought the child there, because the same
  // game on the same skill is the same activity whether it was reached as a
  // warm start or as a closure.
  //
  // One case is exempt. Going back to the workbench to work out something
  // that just went wrong is a coherent next move, and refusing it would mean
  // the planner could observe a problem and then decline to answer it. So an
  // earlier destination may be revisited by a teaching response — but never
  // by the step immediately after it, which is replay whatever the reason.
  const key = destinationKey(step.destination);
  if (key) {
    const live = steps.filter((row) => row.status !== "dropped");
    const previous = live[live.length - 1];
    if (previous && destinationKey(previous.destination) === key) return false;
    const teachingResponse = isRemedialGoal(step.goal.kind) || isRemedialIntent(step.activity.intent);
    if (!teachingResponse && live.some((row) => destinationKey(row.destination) === key)) {
      return false;
    }
  }
  return true;
}

/*
 * ---------------------------------------------------------------------------
 * Planning
 * ---------------------------------------------------------------------------
 */

/**
 * A warm start is a different skill from the one the session is about.
 *
 * Opening on the very skill the next step teaches is not a warm start, it is
 * the same activity twice with a friendlier caption — and it spends one of
 * the three or four activities a child has today. When the only secure skill
 * is the one being worked on, the session simply begins with the work.
 */
function warmStartGoal(
  model: LearnerModel,
  seed: string,
  avoidSkillId: string | null
): SessionGoal | null {
  const options = secureSkills(model).filter((skill) => skill.skillId !== avoidSkillId);
  const skill = seededPick(options, `${seed}:warm`);
  if (!skill) return null;
  return goalFor(skill, "warm-start", "none", "secure_warmup");
}

function closureGoal(
  model: LearnerModel,
  seed: string,
  avoidSkillIds: readonly (string | null)[]
): SessionGoal | null {
  const secure = secureSkills(model);
  const fresh = secure.filter((skill) => !avoidSkillIds.includes(skill.skillId));
  const skill = seededPick(fresh.length > 0 ? fresh : secure, `${seed}:close`);
  if (!skill) return null;
  return goalFor(skill, "closure", "none", "finish_on_secure_skill");
}

function sampleGoal(): SessionGoal {
  return {
    kind: "sample",
    skillId: null,
    skillLabel: null,
    need: "first-samples",
    reason: "insufficient_evidence",
  };
}

/**
 * The starting-point check, as a step.
 *
 * Built here rather than routed through the teaching engine because there is
 * nothing to decide: a learner with no calibration has exactly one sensible
 * first activity, and a light day is not a reason to skip it.
 */
const PLACEMENT_GOAL: SessionGoal = {
  kind: "placement",
  skillId: null,
  skillLabel: null,
  need: "first-samples",
  reason: "insufficient_evidence",
};

function placementStep(): SessionStep {
  return stepFrom(PLACEMENT_GOAL, {
    intent: "explore",
    skillId: null,
    skillLabel: null,
    subject: null,
    preferredSlugs: [PLACEMENT_SLUG],
    preferredHref: PLACEMENT_HREF,
    childReason: "Let\u2019s find your starting point together.",
    adultReason:
      "A short, low-pressure check that tunes the first learning route. It is not a grade or a standardized test, and nothing is planned around it until it is done.",
    difficultyShift: 0,
    hintStrategy: "on-request",
  });
}

/** The change-of-explanation step, when one is waiting. */
function interventionStep(intervention: SessionIntervention): SessionStep {
  const goal: SessionGoal = {
    kind: intervention.retention ? "recovery" : "target-skill",
    skillId: intervention.skillId,
    skillLabel: intervention.skillLabel,
    need: "independence",
    reason: intervention.retention ? "recover_after_difficulty" : "focus_skill_needs_teaching",
  };
  return stepFrom(goal, {
    intent: intervention.retention ? "practice" : "reteach",
    skillId: intervention.skillId,
    skillLabel: intervention.skillLabel,
    subject: null,
    preferredSlugs: [intervention.slug],
    preferredHref: intervention.href,
    childReason: intervention.childReason,
    adultReason: intervention.adultReason,
    difficultyShift: intervention.retention ? 0 : -1,
    hintStrategy: intervention.retention ? "on-request" : "early",
  });
}

/**
 * An exploration step, pointed at whatever the child was said to enjoy.
 *
 * The teaching engine is still asked first: a session that began with no
 * evidence can become a taught session partway through, and when the engine
 * has something to say it says it here. Interests only fill the gap the
 * engine leaves.
 */
function exploreStep(
  model: LearnerModel,
  exploreSlugs: readonly string[]
): SessionStep {
  const step = stepFrom(sampleGoal(), chooseLearningIntent(model));
  if (exploreSlugs.length === 0 || step.destination.slugs.length > 0) return step;
  return {
    ...step,
    destination: { slugs: [...exploreSlugs], href: null },
  };
}

/**
 * Builds the session's opening hypothesis.
 *
 * The arc is: something the child can already do, then the work that
 * matters, then a finish they are likely to complete. Every part of it is
 * optional — a cold-start learner gets exploration, and a learner with one
 * urgent thing gets a short session rather than a padded one.
 */
export function planSession(input: PlanSessionInput): SessionPlan {
  const {
    model,
    profileId,
    dayKey,
    grade,
    mode = "full",
    needsPlacement = false,
    exploreSlugs = [],
    intervention = null,
  } = input;
  const budget = sessionBudget(grade, mode);
  const seed = `${profileId}:${dayKey}`;
  const steps: SessionStep[] = [];

  const push = (goal: SessionGoal | null): boolean => {
    if (!goal || steps.length >= budget) return false;
    const step = resolveGoal(model, goal, context);
    if (!admitsStep(steps, step)) return false;
    steps.push(step);
    return true;
  };

  // A skill whose explanation has stopped working leads the session. It is
  // pushed rather than offered to the caps: nothing else in the plan is more
  // urgent than not repeating an explanation that has already failed twice.
  // It also outranks the starting-point check, because a child whose
  // explanation is measurably failing is a child somebody has already been
  // watching — calibration is not their first need.
  if (intervention) steps.push(interventionStep(intervention));

  // Placement cannot be displaced by a light or free day. It is skipped only
  // once the evidence log has enough in it to lead on its own: the check
  // exists to calibrate a learner nobody has watched yet, and a child who
  // has already answered enough questions has been watched.
  if (needsPlacement && !model.confident) steps.push(placementStep());
  const context: PlanContext = { needsPlacement, exploreSlugs };

  if (!model.confident || model.skills.length === 0) {
    // Thin evidence gets exploration, not a confident-looking plan built on
    // nothing. The steps are deliberately unresolved: each one is re-asked of
    // the teaching engine when the one before it finishes, so a session that
    // begins with no evidence can turn into a taught session partway through
    // without anybody pretending it started that way.
    for (let index = steps.length; index < Math.min(budget, COLD_START_STEPS); index += 1) {
      if (!push(sampleGoal())) break;
    }
    return {
      version: 1,
      profileId,
      dayKey,
      grade,
      budget,
      steps,
      revisions: [],
      status: "active",
      completion: null,
    };
  }

  const priorities = sessionPriorities(model);
  // A warm start earns its place only when the session has room for the work
  // that matters afterwards.
  if (budget >= 3 && priorities.length > 0) {
    push(warmStartGoal(model, seed, priorities[0].skillId));
  }

  for (const goal of priorities) {
    if (steps.length >= budget - 1) break;
    if (!push(goal)) continue;
    // The arc, not just the next move: a second form now, an inference after
    // it. The follow-on is planned as a hypothesis and is the first thing
    // replanning drops if the second form does not go well.
    if (steps.length < budget - 1) push(followOnGoal(goal));
  }

  // Nothing to teach and nothing to sample: exploring is the honest answer.
  if (steps.length === 0) push(sampleGoal());

  if (steps.length < budget) {
    push(closureGoal(model, seed, steps.map((step) => step.goal.skillId)));
  }

  return {
    version: 1,
    profileId,
    dayKey,
    grade,
    budget,
    steps,
    revisions: [],
    status: "active",
    completion: null,
  };
}

/*
 * ---------------------------------------------------------------------------
 * Replanning
 * ---------------------------------------------------------------------------
 */

/**
 * Puts a change of explanation into a session that is already under way.
 *
 * A plan is made once a day; an intervention can be raised at any point in
 * it, because it is raised by the very evidence the session is producing. A
 * plan that could only learn about one at breakfast would quietly ignore the
 * thing it most needs to act on.
 *
 * The step goes in at the current position, so the child meets the new
 * explanation next rather than after everything else. Steps already done
 * stay done.
 */
export function withIntervention(
  plan: SessionPlan,
  intervention: SessionIntervention | null
): SessionPlan {
  if (!intervention || plan.status === "complete") return plan;
  const step = interventionStep(intervention);
  const key = destinationKey(step.destination);
  const known = plan.steps.some(
    (row) => row.status !== "dropped" && destinationKey(row.destination) === key
  );
  if (known) return plan;
  const index = currentStepIndex(plan);
  const at = index < 0 ? plan.steps.length : index;
  const steps = [...plan.steps.slice(0, at), step, ...plan.steps.slice(at)];
  return { ...plan, steps };
}

export function currentStepIndex(plan: SessionPlan): number {
  return plan.steps.findIndex((step) => step.status === "planned");
}

export function currentStep(plan: SessionPlan): SessionStep | null {
  const index = currentStepIndex(plan);
  return index < 0 ? null : plan.steps[index];
}

/** True once the evidence question a goal asked has an answer. */
function needAnswered(model: LearnerModel, goal: SessionGoal): boolean {
  if (!isAnswerableNeed(goal.need) || !goal.skillId) return false;
  const skill = model.skills.find((row) => row.skillId === goal.skillId);
  if (!skill) return false;
  switch (goal.need) {
    case "second-representation":
      return distinctCategories(skill.secureMechanics).length >= 2;
    case "inference":
      return skill.secureCategories.includes("inference");
    case "independence":
      return skill.state === "secure";
    case "prerequisite-stability":
      return skill.state === "secure" || skill.state === "emerging";
    default:
      return false;
  }
}

/** States where the evidence says the skill needs a teaching move now. */
const UNSTEADY_STATES = new Set([
  "repeatable-error-pattern",
  "support-dependent",
  "possible-random-response",
  "representation-specific-difficulty",
]);

function needsTeachingNow(skill: SkillSignal): boolean {
  return UNSTEADY_STATES.has(skill.state);
}

function isSecureNow(model: LearnerModel, skillId: string): boolean {
  const skill = model.skills.find((row) => row.skillId === skillId);
  return skill ? skill.state === "secure" : false;
}

function outcomeSupported(outcome: SessionOutcome): boolean {
  return outcome.attempts > 0 && outcome.supported / outcome.attempts >= 0.5;
}

function outcomeClean(outcome: SessionOutcome): boolean {
  return outcome.attempts > 0 && outcome.correct === outcome.attempts && !outcomeSupported(outcome);
}

/**
 * An inference step is only satisfied by inference.
 *
 * A child who eliminated their way to the right card without reading the
 * clues answered the question by luck, and the session goal it was meant to
 * settle is still open. This is the single rule that stops final correctness
 * standing in for reasoning.
 */
function inferenceUnearned(step: SessionStep, outcome: SessionOutcome): boolean {
  return (
    step.goal.need === "inference"
    && outcome.correct > 0
    && outcome.reasoned === 0
  );
}

/**
 * Revises the plan after a step finished.
 *
 * The plan may shrink, substitute, or end here. It grows only in one case —
 * a recovery that worked earns a closure — because a session that gets
 * longer when things go badly is the treadmill this planner exists to
 * prevent.
 */
export function replanSession(
  plan: SessionPlan,
  model: LearnerModel,
  outcome: SessionOutcome,
  context: PlanContext = {}
): SessionPlan {
  const index = currentStepIndex(plan);
  if (index < 0 || plan.status === "complete") return plan;

  const finished = plan.steps[index];
  const steps = plan.steps.map((step, position) =>
    position === index ? { ...step, status: "done" as const } : step
  );
  const revisions: SessionRevision[] = [...plan.revisions];
  const drop = (
    reason: SessionRevisionReason,
    predicate: (step: SessionStep) => boolean
  ) => {
    const dropped: SessionGoalKind[] = [];
    for (let position = index + 1; position < steps.length; position += 1) {
      const step = steps[position];
      if (step.status !== "planned" || !predicate(step)) continue;
      steps[position] = { ...step, status: "dropped" };
      dropped.push(step.goal.kind);
    }
    if (dropped.length > 0) revisions.push({ reason, dropped, added: [] });
  };

  const targetSkillId = finished.goal.skillId;
  const skill = targetSkillId
    ? model.skills.find((row) => row.skillId === targetSkillId) ?? null
    : null;

  // 1. Evidence that the idea is not holding cancels the plans that assumed
  //    it was. A child who has just failed to put a number in order is not
  //    the child the inference step was planned for, whether the model reads
  //    that as a repeated structural error or as a representation the skill
  //    does not yet survive.
  if (skill && needsTeachingNow(skill)) {
    drop(
      "cancel_transfer_after_error_pattern",
      (step) =>
        step.goal.skillId === targetSkillId
        && step.goal.kind === "inference-transfer"
    );
  }
  if (skill && skill.state === "repeatable-error-pattern") {
    drop(
      "cancel_transfer_after_error_pattern",
      (step) =>
        step.goal.skillId === targetSkillId
        && step.goal.kind === "alternate-representation"
    );
  }

  // 2. A lucky solve leaves the inference question open, but repeating the
  //    same ask immediately is not the answer either.
  //
  //    Recorded whether or not there is a later step to remove: the point of
  //    the rule is that final correctness did not settle the question, and a
  //    session that stayed silent about it would let "he got it right" stand
  //    as the whole story.
  if (inferenceUnearned(finished, outcome)) {
    const before = revisions.length;
    drop(
      "cancel_inference_after_unreasoned_solve",
      (step) => step.goal.kind === "inference-transfer" && step.goal.skillId === targetSkillId
    );
    if (revisions.length === before) {
      revisions.push({
        reason: "cancel_inference_after_unreasoned_solve",
        dropped: [],
        added: [],
      });
    }
  }

  // 3. Success that leaned on help is success, and it is not a reason to
  //    raise the challenge.
  if (outcome.attempts > 0 && outcomeSupported(outcome)) {
    drop(
      "hold_after_supported_success",
      (step) =>
        step.goal.skillId === targetSkillId && step.goal.kind === "inference-transfer"
    );
  }

  // 3b. A closure is a promise that the child can already do the thing. A
  //     skill that just stopped looking secure cannot keep that promise.
  drop(
    "substitute_after_representation_gap",
    (step) =>
      step.goal.kind === "closure"
      && step.goal.skillId !== null
      && !isSecureNow(model, step.goal.skillId)
  );

  // 3c. The step that just finished may have created a problem the plan was
  //     made before. Answering it now is the difference between a plan and a
  //     script — but it replaces a step rather than adding one, so a session
  //     never gets longer because it went badly.
  if (skill && needsTeachingNow(skill)) {
    const goal = candidateFor(skill)?.goal ?? null;
    const alreadyPlanned = goal !== null && steps.some(
      (step) =>
        step.status === "planned"
        && step.goal.kind === goal.kind
        && step.goal.skillId === goal.skillId
    );
    const position = steps.findIndex((step) => step.status === "planned");
    if (goal && !alreadyPlanned && position >= 0) {
      const kept = steps.filter((row) => row.status === "done");
      const substitute = resolveGoal(model, goal, context);
      if (admitsStep(kept, substitute)) {
        const replaced = steps[position];
        steps[position] = { ...substitute, status: "planned" };
        revisions.push({
          reason: "substitute_after_representation_gap",
          dropped: [replaced.goal.kind],
          added: [goal.kind],
        });
      } else {
        // The response the engine wants is the activity the child has just
        // been through. Repeating it now is the treadmill, so the plan lets
        // the observation stand and carries it to the next session. Recorded
        // rather than silent: a plan that declines to react should say so.
        revisions.push({
          reason: "substitution_blocked_by_guard",
          dropped: [],
          added: [],
        });
      }
    }
  }

  // 4. Anything the child has now demonstrated stops being worth planning.
  const met: SessionGoalKind[] = [];
  for (let position = index + 1; position < steps.length; position += 1) {
    const step = steps[position];
    if (step.status !== "planned") continue;
    if (needAnswered(model, step.goal)) {
      steps[position] = { ...step, status: "dropped" };
      met.push(step.goal.kind);
    }
  }
  if (met.length > 0) revisions.push({ reason: "goal_met_early", dropped: met, added: [] });

  // 5. A recovery that worked deserves a finish the child can complete.
  const remaining = () => steps.filter((step) => step.status === "planned");
  if (
    finished.goal.kind === "recovery"
    && outcome.correct > 0
    && remaining().length === 0
    && steps.filter((step) => step.status !== "dropped").length < plan.budget
  ) {
    const closure = closureGoal(
      model,
      `${plan.profileId}:${plan.dayKey}`,
      steps.filter((row) => row.status !== "dropped").map((row) => row.goal.skillId)
    );
    if (closure) {
      const step = resolveGoal(model, closure, context);
      const kept = steps.filter((row) => row.status !== "dropped");
      if (admitsStep(kept, step)) {
        steps.push(step);
        revisions.push({
          reason: "add_closure_after_recovery",
          dropped: [],
          added: [closure.kind],
        });
      }
    }
  }

  // 6. Re-resolve what is left: a step planned three activities ago was
  //    resolved against evidence that no longer exists.
  for (let position = 0; position < steps.length; position += 1) {
    const step = steps[position];
    if (step.status !== "planned") continue;
    const resolved = resolveGoal(model, step.goal, context);
    const kept = steps.slice(0, position).filter((row) => row.status === "done");
    if (!admitsStep(kept, resolved)) {
      steps[position] = { ...step, status: "dropped" };
      const reason: SessionRevisionReason =
        stepsForSkill(kept, resolved.goal.skillId) >= MAX_STEPS_PER_SKILL
          ? "skill_exposure_cap_reached"
          : "remediation_cap_reached";
      revisions.push({ reason, dropped: [step.goal.kind], added: [] });
      continue;
    }
    steps[position] = { ...resolved, status: "planned" };
  }

  const done = steps.filter((step) => step.status === "done").length;
  const stillPlanned = steps.filter((step) => step.status === "planned");

  let status: SessionPlan["status"] = "active";
  let completion: SessionCompletionReason | null = null;
  if (done >= plan.budget) {
    status = "complete";
    completion = "budget_reached";
    for (let position = 0; position < steps.length; position += 1) {
      if (steps[position].status === "planned") {
        steps[position] = { ...steps[position], status: "dropped" };
      }
    }
    revisions.push({ reason: "budget_reached", dropped: [], added: [] });
  } else if (stillPlanned.length === 0) {
    status = "complete";
    completion = completionReasonFor(finished, outcome, revisions);
  }

  return { ...plan, steps, revisions, status, completion };
}

function completionReasonFor(
  finished: SessionStep,
  outcome: SessionOutcome,
  revisions: readonly SessionRevision[]
): SessionCompletionReason {
  if (revisions.some((row) => row.reason === "remediation_cap_reached")) {
    return "enough_for_today";
  }
  if (finished.goal.kind === "closure") return "closure_complete";
  if (finished.goal.kind === "sample") return "evidence_collected";
  if (outcomeClean(outcome)) return "goal_demonstrated";
  return "enough_for_today";
}

/** Ends a session the child walked away from, without losing what happened. */
export function endSession(
  plan: SessionPlan,
  completion: SessionCompletionReason = "exited"
): SessionPlan {
  if (plan.status === "complete") return plan;
  return {
    ...plan,
    status: "complete",
    completion,
    steps: plan.steps.map((step) =>
      step.status === "planned" ? { ...step, status: "dropped" as const } : step
    ),
  };
}

/*
 * ---------------------------------------------------------------------------
 * Developer explainability
 * ---------------------------------------------------------------------------
 */

export type SessionTraceRow = {
  position: number;
  goal: SessionGoalKind;
  because: SessionReason;
  need: EvidenceNeed;
  intent: WorldIntent;
  mechanic: InteractionMechanic | null;
  destination: string;
  status: SessionStepStatus;
};

/**
 * A machine-readable account of every planner decision.
 *
 * Never rendered to a child, and not written to storage. It exists so that a
 * surprising route can be root-caused from a console rather than by reading
 * the planner's source.
 */
export function traceSession(plan: SessionPlan): {
  budget: number;
  status: SessionPlan["status"];
  completion: SessionCompletionReason | null;
  steps: SessionTraceRow[];
  revisions: SessionRevision[];
} {
  return {
    budget: plan.budget,
    status: plan.status,
    completion: plan.completion,
    steps: plan.steps.map((step, position) => ({
      position,
      goal: step.goal.kind,
      because: step.goal.reason,
      need: step.goal.need,
      intent: step.activity.intent,
      mechanic: step.mechanic,
      destination: step.destination.href ?? step.destination.slugs[0] ?? "(world choice)",
      status: step.status,
    })),
    revisions: plan.revisions,
  };
}

/** Kinds of thinking the session has actually asked for so far. */
export function sessionCategories(plan: SessionPlan): MechanicCategory[] {
  return distinctCategories(
    plan.steps
      .filter((step) => step.status === "done" && step.mechanic)
      .map((step) => step.mechanic as InteractionMechanic)
  );
}

/** Skills the session has touched, in order of first appearance. */
export function sessionSkills(plan: SessionPlan): string[] {
  const seen: string[] = [];
  for (const step of plan.steps) {
    if (step.status === "dropped" || !step.goal.skillId) continue;
    if (!seen.includes(step.goal.skillId)) seen.push(step.goal.skillId);
  }
  return seen;
}

