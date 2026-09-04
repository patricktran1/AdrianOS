/**
 * The shape of a stored session, and the only way to read one.
 *
 * A session plan is child data, so the rule here is that a field must earn
 * its place by changing a future teaching decision. Everything derivable
 * from the evidence log is derived, not duplicated: what the child answered,
 * when, how fast, and how well already live there and are already minimised.
 *
 * What is kept, and why each one is needed:
 *
 *   day         is this today's plan, or last week's?
 *   grade       how long a session should be
 *   budget      the same, resolved once so a mid-session schedule change
 *               cannot silently lengthen a session in progress
 *   status      whether to resume or start fresh
 *   completion  how the last session ended, which the parent summary reports
 *   goals       the plan itself: kind, skill, evidence need, reason, status
 *   visited     game-and-skill pairs already played, so the session cannot
 *               send a child to the same activity twice
 *   revisions   why the plan changed, for the parent summary
 *   last        the previous session's day and ending
 *
 * What is deliberately not kept: prompts, answers, timings, response text,
 * hrefs, titles, guide lines, identifiers beyond the profile the storage key
 * already scopes to, and any history beyond the previous session.
 *
 * Everything read back is validated against constant-authoritative lists,
 * and every dynamic lookup goes through a Map, because a plan restored from
 * localStorage is untrusted input: an object literal would answer `true` to
 * `"constructor" in table`.
 */

import type {
  EvidenceNeed,
  SessionStatus,
  SessionStepStatus,
  SessionCompletionReason,
  SessionGoalKind,
  SessionReason,
  SessionRevisionReason,
} from "./session-goals.ts";

export const SESSION_STORE_PREFIX = "adrianos-session-v1:";

/**
 * Deliberately free of the planner.
 *
 * Reading "how far through today is this child?" must not cost a page the
 * whole planner, the learner model and the game catalogue. The guided ribbon
 * that sits on top of fifty game screens asks exactly that question, and
 * before this split it dragged all three onto every one of them.
 */

/** The previous session, kept so a new one can start from somewhere. */
export type SessionMemory = {
  day: string;
  completion: SessionCompletionReason | null;
};

/**
 * Two fields that are product state rather than evidence: the days a session
 * was finished (so the school screen can show a streak, a feature that
 * predates the planner) and the day a reward was collected (so it can only
 * be collected once). Neither is read by the planner, both are bounded, and
 * a day key is the coarsest possible record of a visit.
 */
export const MAX_STREAK_DAYS = 14;

export type { SessionStatus, SessionStepStatus } from "./session-goals.ts";

export type StoredSession = {
  v: 1;
  day: string;
  grade: number;
  budget: number;
  status: SessionStatus;
  completion: SessionCompletionReason | null;
  goals: Array<{
    k: SessionGoalKind;
    s: string | null;
    n: EvidenceNeed;
    r: SessionReason;
    st: SessionStepStatus;
    d: string | null;
  }>;
  visited: string[];
  rev: SessionRevisionReason[];
  last: SessionMemory | null;
  /** Day keys on which a session was finished, most recent last. */
  days: string[];
  /** The day the finish reward was collected, if it has been. */
  reward: string | null;
};

/*
 * ---------------------------------------------------------------------------
 * Validation
 * ---------------------------------------------------------------------------
 *
 * Sets, not object literals. A stored value of "constructor" or "toString"
 * must fail validation, and `value in table` on a plain object would not.
 */

const GOAL_KINDS = new Set<SessionGoalKind>([
  "placement",
  "warm-start",
  "target-skill",
  "alternate-representation",
  "inference-transfer",
  "prerequisite-check",
  "recovery",
  "closure",
  "sample",
]);

const EVIDENCE_NEEDS = new Set<EvidenceNeed>([
  "none",
  "first-samples",
  "independence",
  "second-representation",
  "inference",
  "prerequisite-stability",
]);

const REASONS = new Set<SessionReason>([
  "secure_warmup",
  "focus_skill_needs_teaching",
  "representation_gap",
  "breadth_without_inference",
  "single_context_fluency",
  "prerequisite_unsteady",
  "recover_after_difficulty",
  "finish_on_secure_skill",
  "insufficient_evidence",
]);

const REVISION_REASONS = new Set<SessionRevisionReason>([
  "goal_met_early",
  "cancel_transfer_after_error_pattern",
  "cancel_inference_after_unreasoned_solve",
  "hold_after_supported_success",
  "substitute_after_representation_gap",
  "substitution_blocked_by_guard",
  "remediation_cap_reached",
  "skill_exposure_cap_reached",
  "budget_reached",
  "add_closure_after_recovery",
]);

const COMPLETIONS = new Set<SessionCompletionReason>([
  "goal_demonstrated",
  "budget_reached",
  "enough_for_today",
  "closure_complete",
  "evidence_collected",
  "exited",
]);

const STEP_STATUSES = new Set<SessionStepStatus>(["planned", "done", "dropped"]);

/** Skill ids and game slugs come from evidence, so they are shape-checked. */
const IDENTIFIER = /^[a-z0-9][a-z0-9-]{0,39}$/;
const DESTINATION_KEY = /^[a-z0-9][a-z0-9-]{0,39}(:[a-z0-9][a-z0-9-]{0,39})?$/;
export const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function asIdentifier(value: unknown): string | null {
  return typeof value === "string" && IDENTIFIER.test(value) ? value : null;
}

function asDestinationKey(value: unknown): string | null {
  return typeof value === "string" && DESTINATION_KEY.test(value) ? value : null;
}

function asMember<T>(set: ReadonlySet<T>, value: unknown): T | null {
  return set.has(value as T) ? (value as T) : null;
}

function asCount(value: unknown, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max
    ? value
    : null;
}

/**
 * Reads a stored session, or null.
 *
 * Anything that does not validate is discarded whole rather than repaired:
 * a half-understood plan is worse than no plan, because the planner would
 * then reason from a state no evidence produced.
 */
export function parseStoredSession(value: unknown): StoredSession | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.v !== 1) return null;
  if (typeof raw.day !== "string" || !DAY_KEY.test(raw.day)) return null;
  const grade = asCount(raw.grade, 12);
  const budget = asCount(raw.budget, 8);
  if (grade === null || budget === null || budget === 0) return null;
  const status = raw.status === "complete" ? "complete" : raw.status === "active" ? "active" : null;
  if (!status) return null;

  const rawGoals = Array.isArray(raw.goals) ? raw.goals : null;
  if (!rawGoals || rawGoals.length === 0 || rawGoals.length > 16) return null;
  const goals: StoredSession["goals"] = [];
  for (const entry of rawGoals) {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    const kind = asMember(GOAL_KINDS, row.k);
    const need = asMember(EVIDENCE_NEEDS, row.n);
    const reason = asMember(REASONS, row.r);
    const stepStatus = asMember(STEP_STATUSES, row.st);
    if (!kind || !need || !reason || !stepStatus) return null;
    const skillId = row.s === null || row.s === undefined ? null : asIdentifier(row.s);
    if (row.s !== null && row.s !== undefined && skillId === null) return null;
    goals.push({
      k: kind,
      s: skillId,
      n: need,
      r: reason,
      st: stepStatus,
      d: asDestinationKey(row.d),
    });
  }

  const visited: string[] = [];
  for (const entry of Array.isArray(raw.visited) ? raw.visited.slice(0, 16) : []) {
    const key = asDestinationKey(entry);
    if (key) visited.push(key);
  }

  const rev: SessionRevisionReason[] = [];
  for (const entry of Array.isArray(raw.rev) ? raw.rev.slice(0, 24) : []) {
    const reason = asMember(REVISION_REASONS, entry);
    if (reason) rev.push(reason);
  }

  const rawLast = raw.last && typeof raw.last === "object"
    ? (raw.last as Record<string, unknown>)
    : null;
  const last: SessionMemory | null =
    rawLast && typeof rawLast.day === "string" && DAY_KEY.test(rawLast.day)
      ? { day: rawLast.day, completion: asMember(COMPLETIONS, rawLast.completion) }
      : null;

  const days: string[] = [];
  for (const entry of Array.isArray(raw.days) ? raw.days.slice(-MAX_STREAK_DAYS) : []) {
    if (typeof entry === "string" && DAY_KEY.test(entry) && !days.includes(entry)) days.push(entry);
  }

  return {
    v: 1,
    day: raw.day,
    grade,
    budget,
    status,
    completion: asMember(COMPLETIONS, raw.completion),
    goals,
    visited,
    rev,
    last,
    days,
    reward: typeof raw.reward === "string" && DAY_KEY.test(raw.reward) ? raw.reward : null,
  };
}

