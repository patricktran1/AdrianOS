"use client";

import { readLearningForProfile, writeLearningForProfile, type ReviewItem } from "@/lib/adrian-learning";
import { syncMasteryLoopForProfile, type MasteryIntervention } from "@/lib/adrian-mastery-loop";

const INTERVENTION_GAME_SLUG = "adrianos-mastery-intervention";
const DAILY_SESSION_GAME_SLUG = "adrianos-daily-session";
const MASTERY_LAB_SLUG = "mastery-lab";

const SKILL_LABELS: Record<string, string> = {
  "math-addition": "Addition",
  "math-subtraction": "Subtraction",
  "math-money": "Money math",
  "math-word-problems": "Math word problems",
  "reading-spelling-easy": "Short-word spelling",
  "reading-spelling-medium": "Medium-word spelling",
  "reading-spelling-hard": "Advanced spelling",
  "reading-comprehension-detail": "Finding story details",
  "reading-sequencing": "Story sequencing",
  "reading-vocabulary": "Vocabulary in context",
  "reading-inference": "Reading inference",
  "science-earth": "Earth science",
  "science-body": "Human body",
  "science-space": "Space science",
  "science-technology": "Technology systems",
  "memory-matching": "Visual matching",
  "memory-working-memory": "Working memory",
  "logic-patterns": "Recognizing patterns",
  "logic-multi-step": "Multi-step reasoning",
};

function humanizeSkill(skillId: string): string {
  return SKILL_LABELS[skillId] ?? skillId
    .split("-")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

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

function skillIdFromMission(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { id?: unknown; gameSlug?: unknown };
  if (row.gameSlug !== MASTERY_LAB_SLUG || typeof row.id !== "string") return null;
  const marker = ":mastery-lab:";
  const index = row.id.lastIndexOf(marker);
  return index >= 0 ? row.id.slice(index + marker.length) : null;
}

function normalizeMission<T extends Record<string, unknown>>(mission: T, labels: Map<string, string>): T {
  const skillId = skillIdFromMission(mission);
  if (!skillId) return mission;
  const label = labels.get(skillId) ?? humanizeSkill(skillId);
  const title = `${label} Mastery Lab`;
  return mission.title === title ? mission : { ...mission, title };
}

function normalizeInterventionRows(profileId: string): void {
  const state = readLearningForProfile(profileId);
  let changed = false;
  const labels = new Map<string, string>();

  const reviewQueue = state.reviewQueue.map((item) => {
    const intervention = parseIntervention(item);
    if (!intervention) return item;
    const skillLabel = intervention.skillLabel === intervention.skillId
      ? humanizeSkill(intervention.skillId)
      : intervention.skillLabel;
    labels.set(intervention.skillId, skillLabel);
    const status = intervention.phase === "monitoring" ? "resolved" as const : item.status;
    if (skillLabel === intervention.skillLabel && status === item.status) return item;
    changed = true;
    const normalized = { ...intervention, skillLabel };
    return {
      ...item,
      prompt: `Mastery recovery: ${skillLabel}`,
      status,
      data: { ...item.data, interventionJson: JSON.stringify(normalized) },
    };
  });

  const dailyAdventure = state.dailyAdventure
    ? {
        ...state.dailyAdventure,
        items: state.dailyAdventure.items.map((item) => {
          const next = normalizeMission(item as unknown as Record<string, unknown>, labels) as unknown as typeof item;
          if (next !== item) changed = true;
          return next;
        }),
      }
    : null;

  const normalizedQueue = reviewQueue.map((item) => {
    if (item.gameSlug !== DAILY_SESSION_GAME_SLUG || typeof item.data?.sessionJson !== "string") return item;
    try {
      const session = JSON.parse(item.data.sessionJson) as Record<string, unknown>;
      if (!Array.isArray(session.missions)) return item;
      let sessionChanged = false;
      const missions = session.missions.map((mission) => {
        if (!mission || typeof mission !== "object") return mission;
        const next = normalizeMission(mission as Record<string, unknown>, labels);
        if (next !== mission) sessionChanged = true;
        return next;
      });
      if (!sessionChanged) return item;
      changed = true;
      return {
        ...item,
        data: { ...item.data, sessionJson: JSON.stringify({ ...session, missions }) },
      };
    } catch {
      return item;
    }
  });

  if (changed) writeLearningForProfile(profileId, { ...state, dailyAdventure, reviewQueue: normalizedQueue });
}

export function runMasteryLoopForProfile(profileId: string): MasteryIntervention[] {
  if (!hasUnseenEvidence(profileId) && !hasDueLoopWithoutMission(profileId)) {
    normalizeInterventionRows(profileId);
    return readLearningForProfile(profileId).reviewQueue
      .map(parseIntervention)
      .filter((item): item is MasteryIntervention => Boolean(item));
  }
  const rows = syncMasteryLoopForProfile(profileId);
  normalizeInterventionRows(profileId);
  return rows;
}
