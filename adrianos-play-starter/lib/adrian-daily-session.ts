"use client";

/**
 * The school screens' view of the session.
 *
 * This module used to be a second planner: it built a three-item playlist
 * once a day from the curriculum graph, stored it, and — because School Mode
 * is on by default — overrode the learner model's beacon with it. AdrianOS
 * therefore shipped two disagreeing answers to "what next?", and the one
 * built from evidence lost.
 *
 * It is now a projection. The session planner owns the sequence; everything
 * here reshapes the current plan into the mission vocabulary the school
 * screens already speak. Nothing is planned, decided or stored here, so the
 * two views cannot drift apart.
 */

import type { ChildProfile } from "@/lib/adrian-profiles";
import { readProfileGrade } from "@/lib/adrian-profile-grade";
import { learningPlanForDate, type LearningDayMode } from "@/lib/adrian-learning-schedule";
import {
  SESSION_EVENT,
  claimSessionReward,
  ensureSession,
  readSession,
  sessionDayKey,
  sessionStreak,
} from "@/lib/adrian-session-runtime";
import type { SessionStep } from "@/lib/session/session-planner";
import { games } from "@/lib/generated-games";
import { readLearningProfile } from "@/lib/adrian-learning-profile";

export type DailySessionMissionStatus = "pending" | "active" | "complete";

export type DailySessionMission = {
  id: string;
  kind: "skill" | "review" | "explore";
  gameSlug: string;
  title: string;
  /** Child-facing. The planner's own reason, not an adult explanation. */
  reason: string;
  difficulty: string;
  href: string;
  status: DailySessionMissionStatus;
};

export type DailySession = {
  version: 1;
  profileId: string;
  date: string;
  scheduleMode: LearningDayMode;
  /** Set once at least one activity has been finished today. */
  startedAt: string | null;
  completedAt: string | null;
  currentIndex: number;
  recommendedMinutes: number;
  missions: DailySessionMission[];
  rewardClaimed: boolean;
};

export const DAILY_SESSION_EVENT = SESSION_EVENT;

/**
 * Names a step for a child.
 *
 * Catalogue titles are written for a browsing adult: "Placement Adventure"
 * tells a six-year-old nothing, and reads like software. Where a step has a
 * purpose a child can understand, that wins; otherwise the catalogue title
 * is the honest name of the place they are going.
 */
const STEP_NAMES = new Map<string, string>([
  ["placement-adventure", "Find the right starting point"],
]);

function titleFor(step: SessionStep): string {
  const slug = step.destination.slugs[0];
  const named = slug ? STEP_NAMES.get(slug) : undefined;
  if (named) return named;
  // The Mastery Lab is a route rather than a catalogue game, and its name is
  // the skill it is re-explaining.
  if (slug === "mastery-lab" && step.activity.skillLabel) {
    return `${step.activity.skillLabel} Mastery Lab`;
  }
  const game = slug ? games.find((row) => row.slug === slug) : undefined;
  return game?.title ?? step.activity.skillLabel ?? "Next adventure";
}

/**
 * How long today should take.
 *
 * The schedule's day mode sets the shape; a parent who chose a session length
 * during setup gets that instead, which is the number the school screen has
 * always shown them.
 */
function sessionMinutes(profileId: string, mode: LearningDayMode, scheduled: number): number {
  const settings = readLearningProfile(profileId);
  if (!settings.configured) return scheduled;
  return mode === "full" ? settings.sessionMinutes : Math.min(8, settings.sessionMinutes);
}

function hrefFor(step: SessionStep): string {
  if (step.destination.href) return step.destination.href;
  const slug = step.destination.slugs[0];
  return slug ? `/games/${slug}` : "/";
}

/**
 * How a step reads on a school screen.
 *
 * Deliberately not a level or a percentage: a label like "Learning · 0%"
 * next to a child's next activity is a score, and the child reads it.
 */
function difficultyLabel(step: SessionStep): string {
  switch (step.goal.kind) {
    case "warm-start":
      return "Warm up";
    case "closure":
      return "Finish strong";
    case "alternate-representation":
      return "A new way in";
    case "inference-transfer":
      return "Work it out";
    case "recovery":
      return "With a helper";
    case "prerequisite-check":
      return "Back to basics";
    case "sample":
      return "Something new";
    case "placement":
      return "Starting map";
    default:
      return "Today's skill";
  }
}

function kindFor(step: SessionStep): DailySessionMission["kind"] {
  if (step.goal.kind === "sample" || step.goal.kind === "placement") return "explore";
  if (step.goal.kind === "recovery" || step.goal.kind === "prerequisite-check") return "review";
  return "skill";
}

function project(profile: ChildProfile, grade: number, ensure: boolean): DailySession {
  const state = ensure
    ? ensureSession(profile.id, grade, profile.age)
    : readSession(profile.id, grade, profile.age);
  const live = state.plan.steps.filter((step) => step.status !== "dropped");
  const currentIndex = live.findIndex((step) => step.status === "planned");
  const plan = learningPlanForDate(profile.id);
  return {
    version: 1,
    profileId: profile.id,
    date: state.plan.dayKey,
    scheduleMode: plan.mode,
    startedAt: live.some((step) => step.status === "done") ? state.plan.dayKey : null,
    completedAt: state.plan.status === "complete" ? `${state.plan.dayKey}T23:59:59.999Z` : null,
    currentIndex: currentIndex < 0 ? live.length : currentIndex,
    recommendedMinutes: sessionMinutes(profile.id, plan.mode, plan.minutes),
    missions: live.map((step, index) => ({
      id: `${state.plan.dayKey}:${index}:${step.goal.kind}`,
      kind: kindFor(step),
      gameSlug: step.destination.slugs[0] ?? "",
      title: titleFor(step),
      reason: step.activity.childReason,
      difficulty: difficultyLabel(step),
      href: hrefFor(step),
      status:
        step.status === "done"
          ? "complete"
          : index === currentIndex
            ? "active"
            : "pending",
    })),
    rewardClaimed: state.history.reward === sessionDayKey(),
  };
}

export function readDailySession(profileId: string, _date?: string): DailySession | null {
  void _date;
  if (typeof window === "undefined" || !profileId) return null;
  return project({ id: profileId, age: 7 } as ChildProfile, gradeFor(profileId), false);
}

export function ensureDailySession(profile: ChildProfile): DailySession {
  return project(profile, readProfileGrade(profile), true);
}

/**
 * Grade for a profile id alone.
 *
 * The school screens hold a full profile; the parent surfaces sometimes only
 * have an id. Reading the stored grade directly keeps both callers on the
 * same session rather than one of them planning at a default grade.
 */
function gradeFor(profileId: string): number {
  return readProfileGrade({ id: profileId, age: 7 });
}

/**
 * Kept so the school screens can keep calling it.
 *
 * Starting a mission no longer changes any state: the plan advances from the
 * evidence an activity produces, not from a child tapping a link, so a
 * mission that is opened and abandoned no longer counts as progress.
 */
export function startDailySessionMission(
  profileId: string,
  _missionIndex: number
): DailySession | null {
  void _missionIndex;
  return readDailySession(profileId);
}

/** The plan advances from evidence; this reports where it got to. */
export function completeDailySessionMission(
  profileId: string,
  _missionIndex: number
): DailySession | null {
  void _missionIndex;
  return readDailySession(profileId);
}

export function claimDailySessionReward(profileId: string): DailySession | null {
  claimSessionReward(profileId, gradeFor(profileId));
  return readDailySession(profileId);
}

export function guidedMissionHref(
  mission: DailySessionMission,
  profileId: string,
  missionIndex: number,
  total: number
): string {
  const [path, query = ""] = mission.href.split("?");
  const params = new URLSearchParams(query);
  params.set("guided", "1");
  params.set("school", "1");
  params.set("guidedProfile", profileId);
  params.set("guidedMission", String(missionIndex));
  params.set("guidedTotal", String(total));
  return `${path}?${params.toString()}`;
}

export function dailySessionStreak(profileId: string): number {
  if (typeof window === "undefined" || !profileId) return 0;
  return sessionStreak(readSession(profileId, gradeFor(profileId)).history.days);
}
