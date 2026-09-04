"use client";

/**
 * The session planner's binding to the browser.
 *
 * The planner itself is pure: it takes a learner model and a plan and gives
 * back a new plan. Everything that makes that awkward — storage, the clock,
 * the profile, telling the world something changed — lives here, in one
 * place, so no surface has to know how a session is stored.
 */

import { readLearnerModel, readEvidence } from "@/lib/adrian-evidence";
import type { LearningEvidence } from "@/lib/adrian-learner-model";
import { learningPlanForDate } from "@/lib/adrian-learning-schedule";
import { normalizeMechanic } from "@/lib/kernels/kernel-registry";
import { hasCompletedPlacement } from "@/lib/adrian-placement";
import {
  getDueMasteryInterventions,
  masteryLabHref,
  type MasteryIntervention,
} from "@/lib/adrian-mastery-loop";
import { interestMatch, readLearningProfile } from "@/lib/adrian-learning-profile";
import { readProgressForProfile } from "@/lib/adrian-progress";
import { isGameAgeFit } from "@/lib/adventure-arcade";
import { games } from "@/lib/generated-games";
import {
  PLACEMENT_SLUG,
  personalizedExploreSlugs,
} from "@/lib/session/session-explore";
import {
  currentStep,
  destinationKey,
  replanSession,
  type SessionDayMode,
  type SessionIntervention,
  type SessionOutcome,
  type SessionPlan,
  type SessionStep,
} from "@/lib/session/session-planner";
import {
  ensureSessionPlan,
  serializeSession,
  SESSION_STORE_PREFIX,
  type SessionMemory,
} from "@/lib/session/session-store";

export const SESSION_EVENT = "adrianos-session-updated";

/**
 * The current step, reduced to what a screen needs to render it.
 *
 * Announced rather than fetched. The post-activity panel lives in the games
 * layout, which the bundler copies into every game route, so a screen there
 * that imported the planner would put it — and the learner model, the mastery
 * loop and the placement report behind it — into fifty separate chunks. It
 * listens for this instead, and stays a few kilobytes.
 */
export const SESSION_STEP_EVENT = "adrianos-session-step";

export type SessionStepSummary = {
  /** The game the step leads to, or "" when the session is over. */
  slug: string;
  href: string;
  /** Child language, from the teaching decision behind the step. */
  childReason: string;
  complete: boolean;
};

function announce(state: SessionState): SessionState {
  if (typeof window === "undefined") return state;
  const step = state.step;
  const detail: SessionStepSummary = step
    ? {
        slug: step.destination.slugs[0] ?? "",
        href: step.destination.href
          ?? (step.destination.slugs[0] ? `/games/${step.destination.slugs[0]}?from=session` : "/"),
        childReason: step.activity.childReason,
        complete: false,
      }
    : { slug: "", href: "/", childReason: "", complete: true };
  window.dispatchEvent(new CustomEvent(SESSION_STEP_EVENT, { detail }));
  return state;
}

export type SessionState = {
  plan: SessionPlan;
  last: SessionMemory | null;
  step: SessionStep | null;
  /** Finished-session day keys and the day a reward was collected. */
  history: { days: string[]; reward: string | null };
};

export function sessionDayKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function storeKey(profileId: string): string {
  return `${SESSION_STORE_PREFIX}${profileId}`;
}

function readStored(profileId: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storeKey(profileId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Unparseable storage is treated exactly like corrupt storage: thrown
    // away, and the plan rebuilt from the evidence log.
    return null;
  }
}

function writeStored(
  profileId: string,
  plan: SessionPlan,
  last: SessionMemory | null,
  history: { days: string[]; reward: string | null }
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storeKey(profileId),
      JSON.stringify(serializeSession(plan, last, history))
    );
  } catch {
    // A full or blocked store must not break the session in progress.
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

/**
 * The day's schedule decides how long a session is, not which planner runs.
 *
 * School Mode used to switch AdrianOS between two different ways of choosing
 * what a child does next. It now does what its name suggests: a lighter day
 * is a shorter session.
 */
export function sessionModeFor(profileId: string): SessionDayMode {
  // The schedule module already validates the stored day map against its own
  // constant day keys, so the mode arrives as one of three known values and
  // nothing here indexes storage with a computed key.
  return learningPlanForDate(profileId).mode;
}

/**
 * Exploration destinations for a learner the model cannot yet reason about.
 *
 * The parent already told AdrianOS what this child enjoys and what matters
 * to them. On the one day there is no evidence at all, that is the only
 * signal there is, and ignoring it would make the first session the least
 * personal one.
 */
function exploreSlugsFor(profileId: string, age: number): string[] {
  const settings = readLearningProfile(profileId);
  const progress = readProgressForProfile(profileId);
  return personalizedExploreSlugs(
    games
      .filter(
        (game) =>
          game.status === "playable"
          && game.slug !== PLACEMENT_SLUG
          && isGameAgeFit(game, age)
      )
      .map((game) => ({
        slug: game.slug,
        subject: game.subject,
        interest: Boolean(interestMatch(game, settings.interests)),
        priority: settings.priorities.includes(game.subject as never),
        plays: progress.games[game.slug]?.plays ?? 0,
      }))
  );
}

const MASTERY_LAB_SLUG = "mastery-lab";

/**
 * The change-of-explanation waiting for this child, if there is one.
 *
 * The mastery loop decides when an explanation has stopped working; this only
 * translates its answer into something the planner can sequence.
 */
function interventionFor(profileId: string): SessionIntervention | null {
  const due: MasteryIntervention[] = getDueMasteryInterventions(profileId);
  const intervention = due.find((row) => row.phase === "reteach" || row.phase === "retention")
    ?? due[0]
    ?? null;
  if (!intervention) return null;
  const retention = intervention.phase === "retention";
  return {
    skillId: intervention.skillId,
    skillLabel: intervention.skillLabel,
    slug: MASTERY_LAB_SLUG,
    href: masteryLabHref(intervention.id),
    childReason: retention
      ? `Quick check: do you still have ${intervention.skillLabel.toLowerCase()}?`
      : `Let\u2019s try ${intervention.skillLabel.toLowerCase()} a completely different way.`,
    adultReason: retention
      ? `A short memory check will confirm that ${intervention.skillLabel} stayed strong.`
      : `${intervention.skillLabel} became sticky twice, so AdrianOS is switching explanations before more practice.`,
    retention,
  };
}

type PlanContext = {
  needsPlacement: boolean;
  exploreSlugs: string[];
  intervention: SessionIntervention | null;
};

function planContext(profileId: string, age: number): PlanContext {
  return {
    needsPlacement: !hasCompletedPlacement(profileId),
    exploreSlugs: exploreSlugsFor(profileId, age),
    intervention: interventionFor(profileId),
  };
}

/** Today's plan, resumed, rebuilt or freshly made. Never throws. */
export function readSession(profileId: string, grade: number, age = 7): SessionState {
  const model = readLearnerModel(profileId);
  const { plan, last, history } = ensureSessionPlan({
    stored: readStored(profileId),
    model,
    profileId,
    dayKey: sessionDayKey(),
    grade,
    mode: sessionModeFor(profileId),
    ...planContext(profileId, age),
  });
  return { plan, last, history, step: currentStep(plan) };
}

/** Today's plan, made and stored if it did not exist yet. */
export function ensureSession(profileId: string, grade: number, age = 7): SessionState {
  const model = readLearnerModel(profileId);
  const result = ensureSessionPlan({
    stored: readStored(profileId),
    model,
    profileId,
    dayKey: sessionDayKey(),
    grade,
    mode: sessionModeFor(profileId),
    ...planContext(profileId, age),
  });
  if (result.source !== "restored") {
    writeStored(profileId, result.plan, result.last, result.history);
  }
  return {
    plan: result.plan,
    last: result.last,
    history: result.history,
    step: currentStep(result.plan),
  };
}

/**
 * Turns the evidence written during one activity into the counts the planner
 * reasons about.
 *
 * Counts only. The planner never sees a prompt, an answer or a timestamp,
 * which is both a privacy property and the reason it stays easy to test.
 */
export function outcomeFromEvidence(rows: readonly LearningEvidence[]): SessionOutcome {
  const skillCounts = new Map<string, number>();
  for (const row of rows) {
    skillCounts.set(row.skillId, (skillCounts.get(row.skillId) ?? 0) + 1);
  }
  const skillId = [...skillCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const mechanics = new Map<string, number>();
  for (const row of rows) {
    const mechanic = normalizeMechanic(row.mechanic);
    if (mechanic) mechanics.set(mechanic, (mechanics.get(mechanic) ?? 0) + 1);
  }
  const mechanic = [...mechanics.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    skillId,
    attempts: rows.length,
    correct: rows.filter((row) => row.correct).length,
    supported: rows.filter((row) => row.hintsUsed > 0 || row.wrongAttempts > 0).length,
    reasoned: rows.filter((row) => row.correct && row.reasoned === true).length,
    mechanic: normalizeMechanic(mechanic),
  };
}

/**
 * Advances the session past the activity that just finished.
 *
 * Re-reads storage first, so a second tab that finished the same activity
 * cannot advance the plan twice, and skips entirely when the current step's
 * destination has already been recorded as played.
 */
export type AdvanceInput = {
  grade: number;
  age?: number;
  /** Evidence recorded while this activity was open. */
  rows: readonly LearningEvidence[];
  /** The game that was just completed. */
  slug: string;
};

/**
 * Advances the session past the activity that just finished.
 *
 * Two guards, both of which describe a real thing that goes wrong:
 *
 * - The finished game must be one the current step actually asked for.
 *   Without this, a child who wanders off to a different game would tick off
 *   the step they never played, and the session would skip its own plan. A
 *   step with no named destination is an exploration, and any game answers it.
 * - Storage is re-read first and a destination already recorded as played is
 *   refused, so two tabs finishing the same activity advance the plan once.
 */
export function advanceSession(
  profileId: string,
  input: AdvanceInput
): SessionState {
  const { grade, age = 7, rows, slug } = input;
  const model = readLearnerModel(profileId);
  const { plan, last, history } = ensureSessionPlan({
    stored: readStored(profileId),
    model,
    profileId,
    dayKey: sessionDayKey(),
    grade,
    mode: sessionModeFor(profileId),
    ...planContext(profileId, age),
  });
  const step = currentStep(plan);
  if (!step || plan.status === "complete") {
    return announce({ plan, last, history, step });
  }
  const wanted = step.destination.slugs;
  if (wanted.length > 0 && !wanted.includes(slug)) {
    return announce({ plan, last, history, step });
  }
  const played = destinationKey(step.destination);
  const alreadyPlayed = plan.steps.some(
    (row) => row.status === "done" && destinationKey(row.destination) === played
  );
  if (alreadyPlayed) return announce({ plan, last, history, step });

  const context = planContext(profileId, age);
  const next = replanSession(plan, model, outcomeFromEvidence(rows), {
    needsPlacement: context.needsPlacement,
    exploreSlugs: context.exploreSlugs,
  });
  writeStored(profileId, next, last, history);
  return announce({ plan: next, last, history, step: currentStep(next) });
}

/**
 * Marks the finish reward collected for today. Returns false when there is
 * nothing to collect, so a second tap cannot award twice.
 */
export function claimSessionReward(profileId: string, grade: number): boolean {
  const state = readSession(profileId, grade);
  const today = sessionDayKey();
  if (state.plan.status !== "complete" || state.history.reward === today) return false;
  writeStored(profileId, state.plan, state.last, { ...state.history, reward: today });
  return true;
}

/** Consecutive days ending today (or yesterday) on which a session finished. */
export function sessionStreak(days: readonly string[], today = new Date()): number {
  const finished = new Set(days);
  const cursor = new Date(today);
  if (!finished.has(sessionDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (finished.has(sessionDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Evidence recorded for this profile since a known row count. */
export function evidenceSince(profileId: string, watermark: number): LearningEvidence[] {
  const rows = readEvidence(profileId);
  return watermark >= 0 && watermark <= rows.length ? rows.slice(watermark) : rows;
}

export function evidenceCount(profileId: string): number {
  return readEvidence(profileId).length;
}
