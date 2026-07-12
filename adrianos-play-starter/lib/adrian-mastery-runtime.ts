"use client";

import { readLearningForProfile, writeLearningForProfile, type ReviewItem } from "@/lib/adrian-learning";
import { syncMasteryLoopForProfile, type MasteryIntervention } from "@/lib/adrian-mastery-loop";

const INTERVENTION_GAME_SLUG = "adrianos-mastery-intervention";
const DAILY_SESSION_GAME_SLUG = "adrianos-daily-session";
const MASTERY_LAB_SLUG = "mastery-lab";

function parseIntervention(item: ReviewItem): MasteryIntervention | null {
  if (item.gameSlug !== INTERVENTION_GAME_SLUG || typeof item.data?.interventionJson !== "string") return null;
  try {
    const parsed = JSON.parse(item.data.interventionJson) as MasteryIntervention;
    return parsed?.id && parsed?.skillId ? parsed : null;
  } catch {
    return null;
  }
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

function hasUnseenEvidence(profileId: string): boolean {
  const state = readLearningForProfile(profileId);
  const bySkill = new Map(
    state.reviewQueue
      .map(parseIntervention)
      .filter((item): item is MasteryIntervention => Boolean(item))
      .map((item) => [item.skillId, new Set(item.evidenceKeys)]),
  );
  return state.reviewQueue
    .filter(isLearningEvidence)
    .some((item) => !bySkill.get(item.skillId)?.has(evidenceKey(item)));
}

function hasDueLoopWithoutMission(profileId: string): boolean {
  const now = new Date().toISOString();
  const state = readLearningForProfile(profileId);
  const due = state.reviewQueue
    .map(parseIntervention)
    .filter((item): item is MasteryIntervention => Boolean(item))
    .some((item) => item.phase !== "monitoring" && item.phase !== "resolved" && item.dueAt <= now);
  if (!due) return false;
  const adventureHasLab = state.dailyAdventure?.items.some((item) => item.gameSlug === MASTERY_LAB_SLUG) === true;
  const sessionHasLab = state.reviewQueue.some((item) => {
    if (item.gameSlug !== DAILY_SESSION_GAME_SLUG || typeof item.data?.sessionJson !== "string") return false;
    try {
      const session = JSON.parse(item.data.sessionJson) as { missions?: Array<{ gameSlug?: string }> };
      return session.missions?.some((mission) => mission.gameSlug === MASTERY_LAB_SLUG) === true;
    } catch {
      return false;
    }
  });
  return !adventureHasLab && !sessionHasLab;
}

function normalizeMonitoringStatus(profileId: string): void {
  const state = readLearningForProfile(profileId);
  let changed = false;
  const reviewQueue = state.reviewQueue.map((item) => {
    const intervention = parseIntervention(item);
    if (!intervention || intervention.phase !== "monitoring" || item.status === "resolved") return item;
    changed = true;
    return { ...item, status: "resolved" as const };
  });
  if (changed) writeLearningForProfile(profileId, { ...state, reviewQueue });
}

export function runMasteryLoopForProfile(profileId: string): MasteryIntervention[] {
  if (!hasUnseenEvidence(profileId) && !hasDueLoopWithoutMission(profileId)) {
    normalizeMonitoringStatus(profileId);
    return readLearningForProfile(profileId).reviewQueue
      .map(parseIntervention)
      .filter((item): item is MasteryIntervention => Boolean(item));
  }
  const rows = syncMasteryLoopForProfile(profileId);
  normalizeMonitoringStatus(profileId);
  return rows;
}
