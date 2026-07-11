"use client";

import type { AdrianProgress } from "@/lib/adrian-progress";
import type { ChildProfile } from "@/lib/adrian-profiles";
import {
  getRecommendedSkill,
  getSkillGraph,
  setSkillGoal,
  SKILL_CATALOG,
} from "@/lib/adrian-skill-graph";
import {
  readLearningForProfile,
  writeLearningForProfile,
  type ReviewItem,
  type SkillProgress,
} from "@/lib/adrian-learning";
import type { Game } from "@/lib/games";

export type PlacementDomain = "Math" | "Reading" | "Science" | "Memory" | "Logic";

export type PlacementAnswer = {
  questionId: string;
  domain: PlacementDomain;
  skillId: string;
  skillLabel: string;
  subject: Game["subject"];
  level: 1 | 2 | 3;
  correct: boolean;
};

export type PlacementPlanDay = {
  day: number;
  skillId: string;
  minutes: number;
  activity: "learn" | "practice" | "review";
};

export type PlacementReport = {
  completedAt: string;
  age: number;
  durationSeconds: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  strengths: string[];
  building: string[];
  nextSkillId: string | null;
  planSkillIds: string[];
  recommendedMinutes: number;
  plan: PlacementPlanDay[];
};

export const PLACEMENT_EVENT = "adrianos-placement-updated";
const REPORT_ID = "placement-report";
const REPORT_GAME_SLUG = "placement-adventure-report";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeStringArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function safePlan(value: unknown): PlacementPlanDay[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const row = item as Partial<PlacementPlanDay>;
        return {
          day: typeof row.day === "number" ? row.day : 1,
          skillId: typeof row.skillId === "string" ? row.skillId : "",
          minutes: typeof row.minutes === "number" ? row.minutes : 10,
          activity: row.activity === "review" || row.activity === "practice" ? row.activity : "learn",
        };
      })
      .filter((item) => item.skillId);
  } catch {
    return [];
  }
}

function reportFromItem(item: ReviewItem | undefined): PlacementReport | null {
  if (!item || item.gameSlug !== REPORT_GAME_SLUG || item.data?.placementReport !== true) return null;
  const data = item.data;
  return {
    completedAt: typeof data.completedAt === "string" ? data.completedAt : item.updatedAt,
    age: typeof data.age === "number" ? data.age : 7,
    durationSeconds: typeof data.durationSeconds === "number" ? data.durationSeconds : 0,
    totalQuestions: typeof data.totalQuestions === "number" ? data.totalQuestions : 0,
    correctAnswers: typeof data.correctAnswers === "number" ? data.correctAnswers : 0,
    accuracy: typeof data.accuracy === "number" ? data.accuracy : 0,
    strengths: safeStringArray(data.strengthsJson),
    building: safeStringArray(data.buildingJson),
    nextSkillId: typeof data.nextSkillId === "string" && data.nextSkillId ? data.nextSkillId : null,
    planSkillIds: safeStringArray(data.planSkillIdsJson),
    recommendedMinutes: typeof data.recommendedMinutes === "number" ? data.recommendedMinutes : 12,
    plan: safePlan(data.planJson),
  };
}

export function readPlacementReport(profileId: string): PlacementReport | null {
  const state = readLearningForProfile(profileId);
  return reportFromItem(state.reviewQueue.find((item) => item.id === REPORT_ID));
}

export function hasCompletedPlacement(profileId: string): boolean {
  return Boolean(readPlacementReport(profileId));
}

function masterySignal(answer: PlacementAnswer): number {
  const correctByLevel = { 1: 58, 2: 74, 3: 89 } as const;
  const missByLevel = { 1: 18, 2: 34, 3: 48 } as const;
  return answer.correct ? correctByLevel[answer.level] : missByLevel[answer.level];
}

function seedWeight(level: 1 | 2 | 3): number {
  return level === 3 ? 5 : level === 2 ? 4 : 3;
}

function mergePlacementEvidence(
  previous: SkillProgress | undefined,
  skillId: string,
  skillLabel: string,
  subject: Game["subject"],
  answers: PlacementAnswer[]
): SkillProgress {
  const totalWeight = answers.reduce((sum, answer) => sum + seedWeight(answer.level), 0);
  const placementMastery = Math.round(
    answers.reduce((sum, answer) => sum + masterySignal(answer) * seedWeight(answer.level), 0) /
      Math.max(1, totalWeight)
  );
  const placementCorrect = answers.filter((answer) => answer.correct).length;
  const placementAttempts = answers.length;

  if (!previous || previous.attempts === 0) {
    const attempts = Math.max(totalWeight, placementAttempts);
    return {
      id: skillId,
      label: skillLabel,
      subject,
      attempts,
      correct: clamp(Math.round((placementMastery / 100) * attempts), 0, attempts),
      streak: placementCorrect === placementAttempts ? placementAttempts : 0,
      mastery: placementMastery,
      lastPracticed: new Date().toISOString(),
    };
  }

  const combinedWeight = previous.attempts + totalWeight;
  const mastery = Math.round(
    (previous.mastery * previous.attempts + placementMastery * totalWeight) /
      Math.max(1, combinedWeight)
  );
  return {
    ...previous,
    label: skillLabel,
    subject,
    attempts: previous.attempts + placementAttempts,
    correct: clamp(previous.correct + placementCorrect, 0, previous.attempts + placementAttempts),
    streak: placementCorrect === placementAttempts ? previous.streak + placementAttempts : 0,
    mastery,
    lastPracticed: new Date().toISOString(),
  };
}

function inferPrerequisites(skills: Record<string, SkillProgress>): Record<string, SkillProgress> {
  const next = { ...skills };
  let changed = true;
  while (changed) {
    changed = false;
    for (const definition of SKILL_CATALOG) {
      const skill = next[definition.id];
      if (!skill || skill.mastery < 70) continue;
      for (const prerequisiteId of definition.prerequisites) {
        const prerequisiteDefinition = SKILL_CATALOG.find((item) => item.id === prerequisiteId);
        if (!prerequisiteDefinition) continue;
        const previous = next[prerequisiteId];
        const inferredMastery = Math.min(82, Math.max(58, skill.mastery - 14));
        if (previous && previous.mastery >= inferredMastery) continue;
        const attempts = Math.max(previous?.attempts ?? 0, 4);
        next[prerequisiteId] = {
          id: prerequisiteId,
          label: prerequisiteDefinition.label,
          subject: prerequisiteDefinition.subject,
          attempts,
          correct: Math.max(previous?.correct ?? 0, Math.round((inferredMastery / 100) * attempts)),
          streak: previous?.streak ?? 0,
          mastery: inferredMastery,
          lastPracticed: skill.lastPracticed,
        };
        changed = true;
      }
    }
  }
  return next;
}

function uniqueAcrossSubjects(skillIds: string[]): string[] {
  const subjects = new Set<string>();
  const selected: string[] = [];
  for (const skillId of skillIds) {
    const definition = SKILL_CATALOG.find((item) => item.id === skillId);
    if (!definition || subjects.has(definition.subject)) continue;
    subjects.add(definition.subject);
    selected.push(skillId);
    if (selected.length >= 3) break;
  }
  return selected;
}

function buildSevenDayPlan(skillIds: string[], minutes: number): PlacementPlanDay[] {
  const fallback = skillIds[0] ?? "math-addition";
  const ids = skillIds.length > 0 ? skillIds : [fallback];
  return Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    skillId: ids[index % ids.length],
    minutes,
    activity: index === 6 ? "review" : index >= 3 ? "practice" : "learn",
  }));
}

export function savePlacementReport(
  profile: ChildProfile,
  progress: AdrianProgress,
  answers: PlacementAnswer[],
  durationSeconds: number
): PlacementReport {
  const current = readLearningForProfile(profile.id);
  const grouped = new Map<string, PlacementAnswer[]>();
  for (const answer of answers) {
    const rows = grouped.get(answer.skillId) ?? [];
    rows.push(answer);
    grouped.set(answer.skillId, rows);
  }

  const seeded = { ...current.skills };
  for (const [skillId, rows] of grouped) {
    const first = rows[0];
    seeded[skillId] = mergePlacementEvidence(
      seeded[skillId],
      skillId,
      first.skillLabel,
      first.subject,
      rows
    );
  }

  const skills = inferPrerequisites(seeded);
  writeLearningForProfile(profile.id, {
    ...current,
    skills,
    dailyAdventure: null,
  });

  const graph = getSkillGraph(profile, progress);
  const recommended = getRecommendedSkill(graph);
  const ranked = graph
    .filter((node) => !node.locked && node.stage !== "Mastered")
    .sort((a, b) => {
      if (recommended && a.id === recommended.id) return -1;
      if (recommended && b.id === recommended.id) return 1;
      if (a.mastery !== b.mastery) return a.mastery - b.mastery;
      return a.order - b.order;
    });
  const planSkillIds = uniqueAcrossSubjects(ranked.map((node) => node.id));
  if (planSkillIds.length === 0 && recommended) planSkillIds.push(recommended.id);

  const tested = Object.values(skills)
    .filter((skill) => grouped.has(skill.id))
    .sort((a, b) => b.mastery - a.mastery);
  const strengths = tested.filter((skill) => skill.mastery >= 70).slice(0, 4).map((skill) => skill.id);
  const building = tested
    .filter((skill) => skill.mastery < 70)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 4)
    .map((skill) => skill.id);
  const recommendedMinutes = profile.age <= 4 ? 8 : profile.age <= 8 ? 12 : 15;
  const correctAnswers = answers.filter((answer) => answer.correct).length;
  const accuracy = answers.length > 0 ? Math.round((correctAnswers / answers.length) * 100) : 0;
  const plan = buildSevenDayPlan(planSkillIds, recommendedMinutes);
  const completedAt = new Date().toISOString();

  const report: PlacementReport = {
    completedAt,
    age: profile.age,
    durationSeconds: Math.max(0, Math.round(durationSeconds)),
    totalQuestions: answers.length,
    correctAnswers,
    accuracy,
    strengths,
    building,
    nextSkillId: recommended?.id ?? planSkillIds[0] ?? null,
    planSkillIds,
    recommendedMinutes,
    plan,
  };

  const latest = readLearningForProfile(profile.id);
  const definition = recommended
    ? SKILL_CATALOG.find((item) => item.id === recommended.id)
    : undefined;
  const reportItem: ReviewItem = {
    id: REPORT_ID,
    gameSlug: REPORT_GAME_SLUG,
    skillId: recommended?.id ?? "placement-starting-map",
    subject: definition?.subject ?? "Logic",
    prompt: `${profile.name} placement starting map`,
    correctAnswer: "",
    dueAt: completedAt,
    updatedAt: completedAt,
    successes: 0,
    status: "resolved",
    data: {
      placementReport: true,
      completedAt,
      age: profile.age,
      durationSeconds: report.durationSeconds,
      totalQuestions: report.totalQuestions,
      correctAnswers,
      accuracy,
      strengthsJson: JSON.stringify(strengths),
      buildingJson: JSON.stringify(building),
      nextSkillId: report.nextSkillId ?? "",
      planSkillIdsJson: JSON.stringify(planSkillIds),
      recommendedMinutes,
      planJson: JSON.stringify(plan),
    },
  };

  writeLearningForProfile(profile.id, {
    ...latest,
    dailyAdventure: null,
    reviewQueue: [
      ...latest.reviewQueue.filter((item) => item.id !== REPORT_ID),
      reportItem,
    ].slice(-100),
  });

  for (const skillId of planSkillIds.slice(0, 2)) {
    setSkillGoal(profile.id, skillId, 80);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PLACEMENT_EVENT));
  }
  return report;
}

export function skillLabel(skillId: string): string {
  return SKILL_CATALOG.find((skill) => skill.id === skillId)?.label ?? skillId;
}
