"use client";

import {
  readLearningForProfile,
  writeLearningForProfile,
  type AdventureItem,
  type LearningState,
  type ReviewItem,
} from "@/lib/adrian-learning";
import { readProgressForProfile } from "@/lib/adrian-progress";
import type { Game } from "@/lib/games";

export type MasteryPhase = "monitoring" | "reteach" | "verify" | "retention" | "resolved";

export type MasteryIntervention = {
  id: string;
  profileId: string;
  skillId: string;
  skillLabel: string;
  subject: Game["subject"];
  phase: MasteryPhase;
  sourceGameSlug: string;
  triggerPrompt: string;
  evidenceCount: number;
  evidenceKeys: string[];
  verificationSuccesses: number;
  checkFailures: number;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
  resolvedAt: string | null;
  lastResult: "correct" | "not-yet" | null;
};

const INTERVENTION_GAME_SLUG = "adrianos-mastery-intervention";
const MASTERY_LAB_SLUG = "mastery-lab";
const DAILY_SESSION_GAME_SLUG = "adrianos-daily-session";
const DAILY_SESSION_PREFIX = "daily-session:";
const EVIDENCE_THRESHOLD = 2;
const RETENTION_DELAY_MS = 24 * 60 * 60 * 1000;
export const MASTERY_LOOP_EVENT = "adrianos-mastery-loop-updated";

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIntervention(item: ReviewItem | undefined): MasteryIntervention | null {
  if (!item || item.gameSlug !== INTERVENTION_GAME_SLUG || item.data?.masteryIntervention !== true) return null;
  const raw = item.data.interventionJson;
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MasteryIntervention>;
    if (!parsed.id || !parsed.profileId || !parsed.skillId || !parsed.skillLabel) return null;
    const phase: MasteryPhase = ["monitoring", "reteach", "verify", "retention", "resolved"].includes(String(parsed.phase))
      ? parsed.phase as MasteryPhase
      : "monitoring";
    return {
      id: String(parsed.id),
      profileId: String(parsed.profileId),
      skillId: String(parsed.skillId),
      skillLabel: String(parsed.skillLabel),
      subject: (typeof parsed.subject === "string" ? parsed.subject : "Logic") as Game["subject"],
      phase,
      sourceGameSlug: typeof parsed.sourceGameSlug === "string" ? parsed.sourceGameSlug : "",
      triggerPrompt: typeof parsed.triggerPrompt === "string" ? parsed.triggerPrompt : "",
      evidenceCount: typeof parsed.evidenceCount === "number" ? Math.max(0, parsed.evidenceCount) : 0,
      evidenceKeys: Array.isArray(parsed.evidenceKeys)
        ? parsed.evidenceKeys.filter((value): value is string => typeof value === "string").slice(-24)
        : [],
      verificationSuccesses: typeof parsed.verificationSuccesses === "number" ? Math.max(0, parsed.verificationSuccesses) : 0,
      checkFailures: typeof parsed.checkFailures === "number" ? Math.max(0, parsed.checkFailures) : 0,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : item.updatedAt,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : item.updatedAt,
      dueAt: typeof parsed.dueAt === "string" ? parsed.dueAt : item.dueAt,
      resolvedAt: typeof parsed.resolvedAt === "string" ? parsed.resolvedAt : null,
      lastResult: parsed.lastResult === "correct" || parsed.lastResult === "not-yet" ? parsed.lastResult : null,
    };
  } catch {
    return null;
  }
}

function interventionItem(intervention: MasteryIntervention): ReviewItem {
  return {
    id: intervention.id,
    gameSlug: INTERVENTION_GAME_SLUG,
    skillId: intervention.skillId,
    subject: intervention.subject,
    prompt: `Mastery recovery: ${intervention.skillLabel}`,
    correctAnswer: "",
    dueAt: intervention.dueAt,
    updatedAt: intervention.updatedAt,
    successes: intervention.verificationSuccesses,
    status: intervention.phase === "resolved" ? "resolved" : "due",
    data: {
      masteryIntervention: true,
      interventionJson: JSON.stringify(intervention),
    },
  };
}

function isLearningEvidence(item: ReviewItem): boolean {
  if (item.status !== "due" || !item.correctAnswer.trim()) return false;
  if (item.gameSlug === INTERVENTION_GAME_SLUG || item.gameSlug === DAILY_SESSION_GAME_SLUG) return false;
  if (item.data?.weeklyReport === true || item.data?.goal === true || item.data?.learningSchedule === true) return false;
  if (item.data?.placementReport === true || item.data?.dailySession === true || item.data?.learnerProfile === true) return false;
  return true;
}

function evidenceKey(item: ReviewItem): string {
  return `${item.id}@${item.updatedAt}`;
}

function newIntervention(profileId: string, item: ReviewItem, now: string): MasteryIntervention {
  return {
    id: `mastery-intervention:${item.skillId}`,
    profileId,
    skillId: item.skillId,
    skillLabel: item.data?.skillLabel && typeof item.data.skillLabel === "string" ? item.data.skillLabel : item.skillId,
    subject: item.subject,
    phase: "monitoring",
    sourceGameSlug: item.gameSlug,
    triggerPrompt: item.prompt,
    evidenceCount: 0,
    evidenceKeys: [],
    verificationSuccesses: 0,
    checkFailures: 0,
    createdAt: now,
    updatedAt: now,
    dueAt: now,
    resolvedAt: null,
    lastResult: null,
  };
}

function addEvidence(
  intervention: MasteryIntervention,
  item: ReviewItem,
  now: string,
): MasteryIntervention {
  const key = evidenceKey(item);
  if (intervention.evidenceKeys.includes(key)) return intervention;
  const reopened = intervention.phase === "resolved";
  const evidenceCount = reopened ? 1 : intervention.evidenceCount + 1;
  const phase: MasteryPhase = reopened || evidenceCount >= EVIDENCE_THRESHOLD ? "reteach" : "monitoring";
  return {
    ...intervention,
    phase,
    sourceGameSlug: item.gameSlug,
    triggerPrompt: item.prompt,
    subject: item.subject,
    evidenceCount,
    evidenceKeys: [...intervention.evidenceKeys, key].slice(-24),
    verificationSuccesses: reopened ? 0 : intervention.verificationSuccesses,
    updatedAt: now,
    dueAt: phase === "reteach" ? now : intervention.dueAt,
    resolvedAt: reopened ? null : intervention.resolvedAt,
    lastResult: reopened ? null : intervention.lastResult,
  };
}

function masteryMission(intervention: MasteryIntervention, profileId: string): AdventureItem {
  const progress = readProgressForProfile(profileId);
  return {
    id: `${localDateKey()}:review:mastery-lab:${intervention.skillId}`,
    kind: "review",
    gameSlug: MASTERY_LAB_SLUG,
    title: `${intervention.skillLabel} Mastery Lab`,
    reason: intervention.phase === "retention"
      ? "A short memory check will confirm that this skill stayed strong."
      : "This skill became sticky twice, so AdrianOS is switching explanations before more practice.",
    difficulty: intervention.phase === "retention" ? "Retention check" : "New learning path",
    href: masteryLabHref(intervention.id),
    baselinePlays: progress.games[MASTERY_LAB_SLUG]?.plays ?? 0,
  };
}

function parseSession(item: ReviewItem): Record<string, unknown> | null {
  if (item.gameSlug !== DAILY_SESSION_GAME_SLUG || typeof item.data?.sessionJson !== "string") return null;
  try {
    const parsed = JSON.parse(item.data.sessionJson) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function injectMasteryMission(
  state: LearningState,
  profileId: string,
  intervention: MasteryIntervention | null,
): LearningState {
  if (!intervention) return state;
  const today = localDateKey();
  const mission = masteryMission(intervention, profileId);
  const sessionIndex = state.reviewQueue.findIndex((item) => item.id === `${DAILY_SESSION_PREFIX}${today}`);
  const sessionItem = sessionIndex >= 0 ? state.reviewQueue[sessionIndex] : null;
  const session = sessionItem ? parseSession(sessionItem) : null;
  const sessionMissions = Array.isArray(session?.missions) ? session?.missions as Array<Record<string, unknown>> : [];
  const sessionStarted = typeof session?.startedAt === "string" || sessionMissions.some((row) => row.status === "complete");
  let nextState = state;

  if (!sessionStarted) {
    const existingItems = state.dailyAdventure?.date === today ? state.dailyAdventure.items : [];
    const nextItems = [mission, ...existingItems.filter((item) => item.gameSlug !== MASTERY_LAB_SLUG)].slice(0, 3);
    const sameAdventure = state.dailyAdventure?.date === today
      && JSON.stringify(state.dailyAdventure.items) === JSON.stringify(nextItems);
    if (!sameAdventure) {
      nextState = { ...nextState, dailyAdventure: { date: today, items: nextItems } };
    }
  }

  if (sessionItem && session && !sessionStarted) {
    const progress = readProgressForProfile(profileId);
    const sessionMission = {
      ...mission,
      baselineCompletions: progress.games[MASTERY_LAB_SLUG]?.completions ?? 0,
      status: "pending",
      startedAt: null,
      completedAt: null,
    };
    const nextMissions = [
      sessionMission,
      ...sessionMissions.filter((row) => row.gameSlug !== MASTERY_LAB_SLUG),
    ].slice(0, 3);
    if (JSON.stringify(sessionMissions) !== JSON.stringify(nextMissions)) {
      const now = new Date().toISOString();
      const nextSession = {
        ...session,
        currentIndex: 0,
        missions: nextMissions,
        updatedAt: now,
      };
      const nextQueue = [...nextState.reviewQueue];
      nextQueue[sessionIndex] = {
        ...sessionItem,
        updatedAt: now,
        data: { ...sessionItem.data, sessionJson: JSON.stringify(nextSession) },
      };
      nextState = { ...nextState, reviewQueue: nextQueue };
    }
  }

  return nextState;
}

function dueIntervention(interventions: MasteryIntervention[], now: string): MasteryIntervention | null {
  return interventions
    .filter((item) => item.phase !== "monitoring" && item.phase !== "resolved" && item.dueAt <= now)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0] ?? null;
}

function publish(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MASTERY_LOOP_EVENT));
}

export function readMasteryInterventions(profileId: string): MasteryIntervention[] {
  return readLearningForProfile(profileId).reviewQueue
    .map(parseIntervention)
    .filter((item): item is MasteryIntervention => Boolean(item))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDueMasteryInterventions(profileId: string): MasteryIntervention[] {
  const now = new Date().toISOString();
  return readMasteryInterventions(profileId)
    .filter((item) => item.phase !== "monitoring" && item.phase !== "resolved" && item.dueAt <= now)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function syncMasteryLoopForProfile(profileId: string): MasteryIntervention[] {
  if (typeof window === "undefined" || !profileId) return [];
  const current = readLearningForProfile(profileId);
  const now = new Date().toISOString();
  const interventions = new Map(
    current.reviewQueue
      .map(parseIntervention)
      .filter((item): item is MasteryIntervention => Boolean(item))
      .map((item) => [item.skillId, item]),
  );

  for (const evidence of current.reviewQueue.filter(isLearningEvidence)) {
    const previous = interventions.get(evidence.skillId) ?? newIntervention(profileId, evidence, now);
    interventions.set(evidence.skillId, addEvidence(previous, evidence, now));
  }

  const interventionRows = [...interventions.values()];
  const otherRows = current.reviewQueue.filter((item) => item.gameSlug !== INTERVENTION_GAME_SLUG);
  let next: LearningState = {
    ...current,
    reviewQueue: [...otherRows, ...interventionRows.map(interventionItem)].slice(-100),
  };
  next = injectMasteryMission(next, profileId, dueIntervention(interventionRows, now));

  if (JSON.stringify(next) !== JSON.stringify(current)) {
    writeLearningForProfile(profileId, next);
    publish();
  }
  return interventionRows;
}

function updateIntervention(
  profileId: string,
  interventionId: string,
  change: (current: MasteryIntervention) => MasteryIntervention,
): MasteryIntervention | null {
  const state = readLearningForProfile(profileId);
  let updated: MasteryIntervention | null = null;
  const queue = state.reviewQueue.map((item) => {
    const parsed = parseIntervention(item);
    if (!parsed || parsed.id !== interventionId) return item;
    updated = change(parsed);
    return interventionItem(updated);
  });
  if (!updated) return null;
  writeLearningForProfile(profileId, { ...state, reviewQueue: queue });
  publish();
  return updated;
}

export function markMasteryLessonViewed(profileId: string, interventionId: string): MasteryIntervention | null {
  const now = new Date().toISOString();
  return updateIntervention(profileId, interventionId, (current) => ({
    ...current,
    phase: current.phase === "retention" ? "retention" : "verify",
    updatedAt: now,
    dueAt: now,
  }));
}

export function recordMasteryCheck(
  profileId: string,
  interventionId: string,
  correct: boolean,
): MasteryIntervention | null {
  const now = new Date();
  return updateIntervention(profileId, interventionId, (current) => {
    if (!correct) {
      return {
        ...current,
        phase: "reteach",
        checkFailures: current.checkFailures + 1,
        updatedAt: now.toISOString(),
        dueAt: now.toISOString(),
        resolvedAt: null,
        lastResult: "not-yet",
      };
    }
    if (current.phase === "retention") {
      return {
        ...current,
        phase: "resolved",
        verificationSuccesses: current.verificationSuccesses + 1,
        updatedAt: now.toISOString(),
        resolvedAt: now.toISOString(),
        lastResult: "correct",
      };
    }
    return {
      ...current,
      phase: "retention",
      verificationSuccesses: current.verificationSuccesses + 1,
      updatedAt: now.toISOString(),
      dueAt: new Date(now.getTime() + RETENTION_DELAY_MS).toISOString(),
      resolvedAt: null,
      lastResult: "correct",
    };
  });
}

export function masteryLabHref(interventionId?: string): string {
  const params = new URLSearchParams();
  if (interventionId) params.set("intervention", interventionId);
  const query = params.toString();
  return `/mastery-lab${query ? `?${query}` : ""}`;
}
