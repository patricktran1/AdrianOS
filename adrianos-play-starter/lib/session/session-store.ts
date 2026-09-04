/**
 * What a session leaves behind, and how it comes back.
 *
 * A session plan is child data, so the rule here is that a field must earn
 * its place by changing a future teaching decision. Everything derivable
 * from the evidence log is derived, not duplicated: what the child answered,
 * when, how fast, and how well already live there and are already minimised.
 *
 * The stored shape and its validation live in session-schema.ts, which knows
 * nothing about planning, so a surface that only needs to read progress does
 * not have to load the planner to do it.
 */

import type { LearnerModel } from "../adrian-learner-model.ts";
import {
  destinationKey,
  planSession,
  resolveGoal,
  withIntervention,
  type PlanContext,
  type SessionDayMode,
  type SessionIntervention,
  type SessionPlan,
  type SessionStep,
} from "./session-planner.ts";
import {
  MAX_STREAK_DAYS,
  DAY_KEY,
  parseStoredSession,
  type SessionMemory,
  type StoredSession,
} from "./session-schema.ts";
import type { SessionGoal } from "./session-goals.ts";

export {
  SESSION_STORE_PREFIX,
  parseStoredSession,
  type SessionMemory,
  type StoredSession,
} from "./session-schema.ts";

export function serializeSession(
  plan: SessionPlan,
  last: SessionMemory | null,
  history: { days?: readonly string[]; reward?: string | null } = {}
): StoredSession {
  const days = [...new Set(history.days ?? [])].filter((day) => DAY_KEY.test(day));
  if (plan.status === "complete" && !days.includes(plan.dayKey)) days.push(plan.dayKey);
  return {
    v: 1,
    day: plan.dayKey,
    grade: plan.grade,
    budget: plan.budget,
    status: plan.status,
    completion: plan.completion,
    goals: plan.steps.map((step) => ({
      k: step.goal.kind,
      s: step.goal.skillId,
      n: step.goal.need,
      r: step.goal.reason,
      st: step.status,
      d: destinationKey(step.destination),
    })),
    visited: plan.steps
      .filter((step) => step.status === "done")
      .map((step) => destinationKey(step.destination))
      .filter((key): key is string => key !== null),
    rev: plan.revisions.map((revision) => revision.reason),
    last,
    days: days.slice(-MAX_STREAK_DAYS),
    reward: history.reward ?? null,
  };
}

/**
 * Rebuilds a live plan from a stored one.
 *
 * Completed steps keep only what they were for and where they went; the
 * child-facing copy is regenerated, because it is presentation and not
 * evidence. Steps still to come are re-resolved against the current learner
 * model, which is why a plan restored after a game is already up to date.
 */
export function restoreSession(
  stored: StoredSession,
  model: LearnerModel,
  profileId: string,
  context: PlanContext = {}
): SessionPlan {
  const steps: SessionStep[] = stored.goals.map((entry) => {
    const goal: SessionGoal = {
      kind: entry.k,
      skillId: entry.s,
      skillLabel:
        model.skills.find((skill) => skill.skillId === entry.s)?.skillLabel ?? entry.s,
      need: entry.n,
      reason: entry.r,
    };
    const step = resolveGoal(model, goal, context);
    if (entry.st === "planned") return step;
    return {
      ...step,
      status: entry.st,
      destination: entry.d
        ? { slugs: step.destination.slugs, href: step.destination.href, key: entry.d }
        : step.destination,
    };
  });
  return {
    version: 1,
    profileId,
    dayKey: stored.day,
    grade: stored.grade,
    budget: stored.budget,
    steps,
    revisions: stored.rev.map((reason) => ({ reason, dropped: [], added: [] })),
    status: stored.status,
    completion: stored.completion,
  };
}

export type EnsureSessionInput = {
  stored: unknown;
  model: LearnerModel;
  profileId: string;
  dayKey: string;
  grade: number;
  mode?: SessionDayMode;
  needsPlacement?: boolean;
  exploreSlugs?: readonly string[];
  intervention?: SessionIntervention | null;
};

export type EnsureSessionResult = {
  plan: SessionPlan;
  last: SessionMemory | null;
  /** Days a session was finished, and the day a reward was collected. */
  history: { days: string[]; reward: string | null };
  /** Why the caller is holding this plan. Useful in tests and in the console. */
  source: "restored" | "planned" | "rebuilt";
};

/**
 * The one entry point a surface should use.
 *
 * Returns today's plan whatever state storage is in: resumed if it is
 * today's and valid, rebuilt from evidence if it is corrupt, and freshly
 * planned if it is yesterday's or absent. A completed session for today
 * stays completed — a child who has finished is not handed another plan by
 * reopening the app.
 */
export function ensureSessionPlan(input: EnsureSessionInput): EnsureSessionResult {
  const {
    stored, model, profileId, dayKey, grade, mode,
    needsPlacement, exploreSlugs, intervention,
  } = input;
  const parsed = parseStoredSession(stored);
  const last: SessionMemory | null = parsed
    ? parsed.day === dayKey
      ? parsed.last
      : { day: parsed.day, completion: parsed.completion }
    : null;

  const history = {
    days: parsed?.days ?? [],
    reward: parsed?.reward ?? null,
  };

  // A plan made before there was anything to go on is a placeholder, not a
  // plan. Once the evidence log can lead, it is replaced rather than carried
  // for the rest of the day: a child who opened the app before their first
  // answer should not be stuck exploring after their twelfth.
  const placeholder = parsed !== null
    && parsed.goals.every((goal) => goal.k === "sample" || goal.k === "placement")
    && parsed.goals.every((goal) => goal.st === "planned");

  if (parsed && parsed.day === dayKey && !(placeholder && model.confident)) {
    // An intervention raised after the plan was made still belongs in it.
    return {
      plan: withIntervention(
        restoreSession(parsed, model, profileId, { needsPlacement, exploreSlugs }),
        intervention ?? null
      ),
      last,
      history,
      source: "restored",
    };
  }
  return {
    plan: planSession({
      model, profileId, dayKey, grade, mode, needsPlacement, exploreSlugs, intervention,
    }),
    last,
    history: { days: history.days, reward: null },
    source: parsed || stored === null || stored === undefined ? "planned" : "rebuilt",
  };
}
